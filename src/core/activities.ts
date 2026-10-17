import { getProblem } from '../data/neetcode150';
import { createTimer, elapsedMs } from './timer';
import type {
  Activity,
  ActivityType,
  AppState,
  BudgetOverrides,
  BudgetedType,
  Difficulty,
  Outcome,
  ReviewType,
} from './types';

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

/** Flat budget of a benchmark problem in minutes (a pair is 2 x 30 = 60). */
export const BENCHMARK_BUDGET_MIN = 30;

export const BUDGETED_TYPES: readonly BudgetedType[] = ['new', 'recall', 'rebuild', 'resolve', 'blind', 'retry'];

export const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard'];

/** Default time budgets in minutes per activity type and difficulty (SPEC §3). */
export const DEFAULT_BUDGETS: Readonly<Record<BudgetedType, Readonly<Record<Difficulty, number>>>> = {
  new: { Easy: 25, Medium: 40, Hard: 50 },
  recall: { Easy: 5, Medium: 15, Hard: 20 },
  rebuild: { Easy: 10, Medium: 20, Hard: 25 },
  retry: { Easy: 10, Medium: 20, Hard: 25 },
  resolve: { Easy: 15, Medium: 30, Hard: 40 },
  blind: { Easy: 15, Medium: 25, Hard: 35 },
};

/** Difficulty used for problems outside NeetCode 150. */
const UNKNOWN_PROBLEM_DIFFICULTY: Difficulty = 'Medium';

/**
 * The single source of every time budget (planner, projection, calendar, reminders and UI). `overrides` is
 * `settings.budgets`; a missing entry falls back to `DEFAULT_BUDGETS`. Problems outside NeetCode 150 count
 * as Medium.
 */
export function estimatedMinutes(type: ActivityType, slug: string, overrides?: BudgetOverrides): number {
  if (type === 'benchmark') return BENCHMARK_BUDGET_MIN;
  const difficulty = getProblem(slug)?.difficulty ?? UNKNOWN_PROBLEM_DIFFICULTY;
  return overrides?.[type]?.[difficulty] ?? DEFAULT_BUDGETS[type][difficulty];
}

/** Budgets with the overrides applied: the full table shown in Settings. */
export function effectiveBudgets(overrides?: BudgetOverrides): Record<BudgetedType, Record<Difficulty, number>> {
  const table = {} as Record<BudgetedType, Record<Difficulty, number>>;
  for (const type of BUDGETED_TYPES) {
    table[type] = {
      Easy: overrides?.[type]?.Easy ?? DEFAULT_BUDGETS[type].Easy,
      Medium: overrides?.[type]?.Medium ?? DEFAULT_BUDGETS[type].Medium,
      Hard: overrides?.[type]?.Hard ?? DEFAULT_BUDGETS[type].Hard,
    };
  }
  return table;
}

/** Average of the Easy and Medium `new` budgets, for new problems that are not chosen yet. */
export function expectedNewMinutes(overrides?: BudgetOverrides): number {
  const budgets = effectiveBudgets(overrides).new;
  return Math.round((budgets.Easy + budgets.Medium) / 2);
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

/**
 * Outcome the completion form starts on: revealing any hint means the problem was not solved alone, so
 * `hint` is pre-selected. It is only a default; the user can still pick another outcome.
 */
export function suggestedOutcome(hintsUsed: number | undefined): Outcome | null {
  return hintsUsed !== undefined && hintsUsed > 0 ? 'hint' : null;
}
