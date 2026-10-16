import {
  REVIEW_OFFSETS,
  REVIEW_STRENGTH,
  createActivity,
  findActivity,
  isReviewType,
} from './activities';
import { addDays, compareDates } from './dates';
import { elapsedMs, pauseTimer } from './timer';
import type { Activity, ActivityType, AppState, Outcome, ProblemStatus, ReviewType } from './types';

export interface Completion {
  outcome: Outcome;
  /** Local calendar date (YYYY-MM-DD) on which the activity is completed. */
  completedDate: string;
  /** Current timestamp (ms); the activity timer is paused here. */
  now: number;
  /** Overrides the activity's recorded approach time. */
  approachMs?: number;
  /** Overrides the timer-derived total time. */
  totalMs?: number;
}

const CYCLE_TYPES: readonly ReviewType[] = ['recall', 'rebuild', 'resolve', 'blind'];

function isFailure(outcome: Outcome): boolean {
  return outcome === 'solution' || outcome === 'stuck';
}

function withStatus(state: AppState, slug: string, status: ProblemStatus): AppState {
  return { ...state, problemStatus: { ...state.problemStatus, [slug]: status } };
}

/** Marks planned activities of `slug` matching `predicate` as skipped (never deletes history). */
function skipPlanned(
  activities: readonly Activity[],
  slug: string,
  predicate: (activity: Activity) => boolean,
): Activity[] {
  return activities.map((a) =>
    a.slug === slug && a.status === 'planned' && predicate(a) ? { ...a, status: 'skipped' } : a,
  );
}

/**
 * Adds a review activity, enforcing "at most one review per problem per day": the stronger
 * of the existing planned review and the new one is kept, the other one is not scheduled
 * (or is marked skipped).
 */
function scheduleReview(
  activities: readonly Activity[],
  params: { type: ReviewType; slug: string; dueDate: string; createdAt: string },
): Activity[] {
  const clashing = activities.filter(
    (a) =>
      a.slug === params.slug &&
      a.dueDate === params.dueDate &&
      a.status === 'planned' &&
      isReviewType(a.type),
  );
  const strength = REVIEW_STRENGTH[params.type];
  const strongestExisting = Math.max(
    0,
    ...clashing.map((a) => REVIEW_STRENGTH[a.type as ReviewType]),
  );
  if (strongestExisting >= strength) return [...activities];
  const clashingIds = new Set(clashing.map((a) => a.id));
  const remaining = activities.map((a) =>
    clashingIds.has(a.id) ? { ...a, status: 'skipped' as const } : a,
  );
  return [...remaining, createActivity(remaining, { ...params, type: params.type })];
}

function hasPlanned(activities: readonly Activity[], slug: string, type: ActivityType): boolean {
  return activities.some((a) => a.slug === slug && a.type === type && a.status === 'planned');
}

/**
 * Completes an activity and derives the follow-up activities and status changes (SPEC §3).
 * Pure: returns a new state. All offsets are measured from `completion.completedDate`.
 * Completing an already-done activity is a no-op.
 */
export function applyOutcome(state: AppState, activityId: string, completion: Completion): AppState {
  const activity = findActivity(state, activityId);
  if (!activity) throw new Error(`Unknown activity: ${activityId}`);
  if (activity.status === 'done') return state;

  const { outcome, completedDate, now } = completion;
  const timer = pauseTimer(activity.timer, now);
  const completed: Activity = {
    ...activity,
    status: 'done',
    timer,
    outcome,
    completedAt: completedDate,
    totalMs: completion.totalMs ?? elapsedMs(timer, now),
    ...(completion.approachMs !== undefined || activity.approachMs !== undefined
      ? { approachMs: completion.approachMs ?? activity.approachMs }
      : {}),
  };

  let activities = state.activities.map((a) => (a.id === activity.id ? completed : a));
  let next: AppState = state;
  const slug = activity.slug;
  const createdAt = completedDate;
  const schedule = (type: ReviewType, days: number): void => {
    activities = scheduleReview(activities, {
      type,
      slug,
      dueDate: addDays(completedDate, days),
      createdAt,
    });
  };

  // A completed review covers weaker reviews of the same problem that are already due.
  if (isReviewType(activity.type)) {
    const strength = REVIEW_STRENGTH[activity.type];
    activities = skipPlanned(
      activities,
      slug,
      (a) =>
        isReviewType(a.type) &&
        REVIEW_STRENGTH[a.type] < strength &&
        compareDates(a.dueDate, completedDate) <= 0,
    );
  }

  switch (activity.type) {
    case 'new': {
      // (Re)start the review cycle from the actual completion date.
      activities = skipPlanned(activities, slug, (a) =>
        (CYCLE_TYPES as readonly ActivityType[]).includes(a.type),
      );
      schedule('recall', REVIEW_OFFSETS.recall);
      schedule('rebuild', REVIEW_OFFSETS.rebuild);
      schedule('resolve', REVIEW_OFFSETS.resolve);
      schedule('blind', REVIEW_OFFSETS.blind);
      if ((next.problemStatus[slug] ?? 'untouched') === 'untouched') {
        next = withStatus(next, slug, 'learning');
      }
      break;
    }
    case 'recall':
    case 'rebuild': {
      if (isFailure(outcome)) {
        schedule('retry', 1);
        next = withStatus(next, slug, 'consolidating');
      }
      break;
    }
    case 'retry': {
      if (isFailure(outcome)) next = withStatus(next, slug, 'consolidating');
      break;
    }
    case 'resolve': {
      if (outcome === 'solo') {
        if (next.problemStatus[slug] !== 'mastered') next = withStatus(next, slug, 'reviewed');
        if (!hasPlanned(activities, slug, 'blind')) {
          // resolve-day + 14: blind stays 21 days after the original `new`.
          schedule('blind', 14);
        }
      } else {
        activities = skipPlanned(activities, slug, (a) =>
          a.type === 'rebuild' || a.type === 'resolve' || a.type === 'blind',
        );
        schedule('rebuild', 3);
        schedule('resolve', 7);
        schedule('blind', 21);
        next = withStatus(next, slug, 'consolidating');
      }
      break;
    }
    case 'blind': {
      if (outcome === 'solo') {
        next = withStatus(next, slug, 'mastered');
      } else {
        activities = skipPlanned(activities, slug, (a) => a.type === 'resolve');
        schedule('resolve', 7);
        next = withStatus(next, slug, 'consolidating');
      }
      break;
    }
    case 'benchmark':
      break;
  }

  return { ...next, activities };
}
