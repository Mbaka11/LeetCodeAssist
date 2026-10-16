/**
 * Pure state transitions behind the UI actions. Each takes the current `AppState` (and the
 * current timestamp where time matters) and returns the next one; storage lives in `storage.ts`.
 */
import {
  REVIEW_STRENGTH,
  createActivity,
  findActivity,
  isReviewType,
  markApproachFound,
  updateActivity,
} from '../core/activities';
import { addDays, compareDates, isValidDateString, localDateFromTimestamp } from '../core/dates';
import { materializePlan, planDay } from '../core/planner';
import { getProblem } from '../data/neetcode150';
import { postponeInQueue, programQueue } from '../core/queue';
import { applyOutcome } from '../core/reviews';
import { MAX_HINTS, validateState } from '../core/state';
import { pauseTimer, resumeTimer, startTimer } from '../core/timer';
import type { Activity, AppState, Note, Outcome, ReviewType, Settings } from '../core/types';

/** Persists the activities of today's plan (new problems, benchmarks, bonus) so timers can persist. */
export function materializeToday(state: AppState, now: number): AppState {
  return materializePlan(state, planDay(state, localDateFromTimestamp(now)));
}

function requireOpen(state: AppState, id: string): Activity {
  const activity = findActivity(state, id);
  if (!activity) throw new Error(`Unknown activity: ${id}`);
  if (activity.status === 'done' || activity.status === 'skipped') {
    throw new Error(`Activity ${id} is already ${activity.status}`);
  }
  return activity;
}

/** Starts (or resumes) an activity. Only one timer runs at a time: others are paused. */
export function startActivity(state: AppState, id: string, now: number): AppState {
  requireOpen(state, id);
  const paused: AppState = {
    ...state,
    activities: state.activities.map((a) =>
      a.id !== id && a.timer.running ? { ...a, timer: pauseTimer(a.timer, now) } : a,
    ),
  };
  return updateActivity(paused, id, (a) => ({
    ...a,
    status: 'in_progress',
    timer: startTimer(a.timer, now),
  }));
}

export function pauseActivity(state: AppState, id: string, now: number): AppState {
  requireOpen(state, id);
  return updateActivity(state, id, (a) => ({ ...a, timer: pauseTimer(a.timer, now) }));
}

export function resumeActivity(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  if (activity.status !== 'in_progress') throw new Error(`Activity ${id} was not started`);
  return startActivity(state, id, now);
}

export function recordApproachFound(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  if (activity.status !== 'in_progress') throw new Error(`Activity ${id} was not started`);
  return updateActivity(state, id, (a) => markApproachFound(a, now));
}

export interface CompletionInput {
  outcome: Outcome;
  /** Overrides the timer-derived time (for example after forgetting to pause). */
  totalMs?: number;
}

export function completeActivity(
  state: AppState,
  id: string,
  input: CompletionInput,
  now: number,
): AppState {
  requireOpen(state, id);
  return applyOutcome(state, id, {
    outcome: input.outcome,
    completedDate: localDateFromTimestamp(now),
    now,
    ...(input.totalMs !== undefined ? { totalMs: input.totalMs } : {}),
  });
}

/**
 * Skips an activity. A skipped review is never dropped (SPEC §4): unless it was optional practice,
 * the same review is planned again for tomorrow.
 */
export function skipActivity(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  const today = localDateFromTimestamp(now);
  const skipped = updateActivity(state, id, (a) => ({
    ...a,
    status: 'skipped',
    timer: pauseTimer(a.timer, now),
  }));
  if (!isReviewType(activity.type) || activity.extra) return skipped;
  const retry = createActivity(skipped.activities, {
    type: activity.type,
    slug: activity.slug,
    dueDate: addDays(today, 1),
    createdAt: today,
  });
  return { ...skipped, activities: [...skipped.activities, retry] };
}

/**
 * Records that hint number `level` (1 = nudge, 2 = insight, 3 = sketch) was revealed during an open
 * activity. Revealing a hint also counts the lower ones; revealing an earlier hint again changes nothing.
 */
export function revealHint(state: AppState, id: string, level: number): AppState {
  if (!Number.isInteger(level) || level < 1 || level > MAX_HINTS) {
    throw new Error(`Hint level must be an integer from 1 to ${MAX_HINTS}`);
  }
  const activity = requireOpen(state, id);
  if ((activity.hintsUsed ?? 0) >= level) return state;
  return updateActivity(state, id, (a) => ({ ...a, hintsUsed: level }));
}

/**
 * Moves a planned review to another day (>= today). The review keeps its type and history; only its
 * due date changes. If the problem already has a planned review on that day the stronger one is kept
 * (SPEC §3 merge rule) and the weaker one is marked skipped.
 */
export function rescheduleReview(state: AppState, id: string, newDate: string, now: number): AppState {
  const activity = findActivity(state, id);
  if (!activity) throw new Error(`Unknown activity: ${id}`);
  if (!isReviewType(activity.type) || activity.extra) {
    throw new Error('Only scheduled reviews can be moved to another day');
  }
  if (activity.status !== 'planned') throw new Error(`Activity ${id} is already ${activity.status}`);
  if (!isValidDateString(newDate)) throw new Error(`Invalid date: "${newDate}"`);
  const today = localDateFromTimestamp(now);
  if (compareDates(newDate, today) < 0) throw new Error('A review cannot be moved to a day in the past');
  if (newDate === activity.dueDate) return state;

  const moved: Activity = { ...activity, dueDate: newDate };
  const clash = state.activities.find(
    (a) =>
      a.id !== id &&
      a.slug === activity.slug &&
      a.status === 'planned' &&
      !a.extra &&
      isReviewType(a.type) &&
      a.dueDate === newDate,
  );
  const strength = (a: Activity): number => REVIEW_STRENGTH[a.type as ReviewType];
  const loserId = clash ? (strength(clash) >= strength(moved) ? moved.id : clash.id) : null;
  return {
    ...state,
    activities: state.activities.map((a) => {
      const next = a.id === id ? moved : a;
      return next.id === loserId ? { ...next, status: 'skipped' as const } : next;
    }),
  };
}

/**
 * Postpones a new problem: it is skipped for now (history is kept, marked `postponed`) and moved back in
 * the queue behind the next two problems, so the planner offers it again later. It never leaves the program.
 */
export function postponeNew(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  if (activity.type !== 'new' || activity.extra) {
    throw new Error('Only new problems from the queue can be postponed');
  }
  const finished = new Set(
    state.activities
      .filter((a) => a.type === 'new' && (a.status === 'done' || (a.status === 'skipped' && !a.postponed)))
      .map((a) => a.slug),
  );
  finished.delete(activity.slug);
  const queue = postponeInQueue(programQueue(state), activity.slug, finished);
  const postponed = updateActivity(state, id, (a) => ({
    ...a,
    status: 'skipped',
    postponed: true,
    timer: pauseTimer(a.timer, now),
  }));
  return { ...postponed, queue };
}

/**
 * Starts practice on a problem that is not part of today's plan (for example one opened on LeetCode).
 * A problem that was never completed becomes an extra `new` (finishing it starts its review cycle);
 * a learned one becomes an extra `resolve`. Extra practice is optional: skipping it never plans a
 * follow-up. Returns the id of the started activity, which is the plan's own activity when the
 * problem is already planned today.
 */
export function startExtraPractice(
  state: AppState,
  slug: string,
  now: number,
): { state: AppState; activityId: string } {
  if (!getProblem(slug)) throw new Error(`"${slug}" is not in the NeetCode 150 list`);
  const today = localDateFromTimestamp(now);
  const materialized = materializeToday(state, now);
  const planned = planDay(materialized, today).items.find(
    (item) =>
      item.activity.slug === slug &&
      (item.activity.status === 'planned' || item.activity.status === 'in_progress'),
  );
  if (planned) {
    return { state: startActivity(materialized, planned.activity.id, now), activityId: planned.activity.id };
  }
  const learned = materialized.activities.some(
    (a) => a.slug === slug && a.type === 'new' && a.status === 'done',
  );
  const activity = createActivity(materialized.activities, {
    type: learned ? 'resolve' : 'new',
    slug,
    dueDate: today,
    createdAt: today,
    extra: true,
  });
  const withActivity = { ...materialized, activities: [...materialized.activities, activity] };
  return { state: startActivity(withActivity, activity.id, now), activityId: activity.id };
}

export interface NoteFields {
  trigger: string;
  principle: string;
  pitfall: string;
  complexity: string;
  code: string;
}

export function saveNote(state: AppState, slug: string, fields: NoteFields, now: number): AppState {
  const note: Note = {
    slug,
    trigger: fields.trigger,
    principle: fields.principle,
    pitfall: fields.pitfall,
    complexity: fields.complexity,
    updatedAt: localDateFromTimestamp(now),
    ...(fields.code.trim() !== '' ? { code: fields.code } : {}),
  };
  return { ...state, notes: { ...state.notes, [slug]: note } };
}

export function toggleChecked(state: AppState, slug: string): AppState {
  const checked = { ...state.checked };
  if (checked[slug]) delete checked[slug];
  else checked[slug] = true;
  return { ...state, checked };
}

/** Applies a settings change; throws `StateValidationError` when the result is invalid. */
export function updateSettings(state: AppState, change: Partial<Settings>): AppState {
  return validateState({ ...state, settings: { ...state.settings, ...change } });
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}
