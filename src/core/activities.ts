import { getProblem } from '../data/neetcode150';
import { createTimer, elapsedMs } from './timer';
import type { Activity, ActivityType, AppState, Difficulty, ReviewType } from './types';

export const REVIEW_TYPES: readonly ReviewType[] = ['recall', 'rebuild', 'resolve', 'blind', 'retry'];

export function isReviewType(type: ActivityType): type is ReviewType {
  return (REVIEW_TYPES as readonly string[]).includes(type);
}

/** Merge rule (SPEC §3): when two reviews of one problem overlap, the stronger one wins. */
export const REVIEW_STRENGTH: Record<ReviewType, number> = {
  recall: 1,
  rebuild: 2,
  retry: 3,
  resolve: 4,
  blind: 5,
};

/** Planner ordering (SPEC §4): lower comes first. */
export const PLAN_PRIORITY: Record<ActivityType, number> = {
  retry: 0,
  recall: 1,
  rebuild: 2,
  resolve: 3,
  blind: 4,
  benchmark: 5,
  new: 6,
};

/** Review offsets in days from the completion of the `new` activity (SPEC §3). */
export const REVIEW_OFFSETS = { recall: 1, rebuild: 3, resolve: 7, blind: 21 } as const;

/** Time budgets in minutes per activity (SPEC §3). A benchmark pair is 2 x 30 = 60. */
const REVIEW_BUDGET_MIN: Record<Exclude<ActivityType, 'new'>, number> = {
  recall: 5,
  rebuild: 10,
  resolve: 20,
  blind: 15,
  retry: 15,
  benchmark: 30,
};

const NEW_BUDGET_MIN: Record<Difficulty, number> = { Easy: 25, Medium: 40, Hard: 40 };

/** Budget for an activity of `type` on `slug`. Problems outside NeetCode 150 count as Medium. */
export function estimatedMinutes(type: ActivityType, slug: string): number {
  if (type === 'new') {
    return NEW_BUDGET_MIN[getProblem(slug)?.difficulty ?? 'Medium'];
  }
  return REVIEW_BUDGET_MIN[type];
}

/** Returns an id of the form `type:slug:date` that is not yet used (`#2`, `#3`... on collision). */
export function uniqueActivityId(
  existing: readonly Activity[],
  type: ActivityType,
  slug: string,
  dueDate: string,
): string {
  const taken = new Set(existing.map((a) => a.id));
  const base = `${type}:${slug}:${dueDate}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}#${n}`)) n += 1;
  return `${base}#${n}`;
}

export function createActivity(
  existing: readonly Activity[],
  params: { type: ActivityType; slug: string; dueDate: string; createdAt: string; extra?: boolean },
): Activity {
  return {
    ...(params.extra ? { extra: true } : {}),
    id: uniqueActivityId(existing, params.type, params.slug, params.dueDate),
    slug: params.slug,
    type: params.type,
    dueDate: params.dueDate,
    status: 'planned',
    timer: createTimer(),
    createdAt: params.createdAt,
  };
}

export function findActivity(state: AppState, id: string): Activity | undefined {
  return state.activities.find((a) => a.id === id);
}

/** Returns a new state with `update` applied to the activity `id`. Throws on unknown ids. */
export function updateActivity(
  state: AppState,
  id: string,
  update: (activity: Activity) => Activity,
): AppState {
  if (!state.activities.some((a) => a.id === id)) {
    throw new Error(`Unknown activity: ${id}`);
  }
  return {
    ...state,
    activities: state.activities.map((a) => (a.id === id ? update(a) : a)),
  };
}

/** Records "approach found" at the current elapsed time (only the first click counts). */
export function markApproachFound(activity: Activity, now: number): Activity {
  if (activity.approachMs !== undefined) return activity;
  return { ...activity, approachMs: elapsedMs(activity.timer, now) };
}
