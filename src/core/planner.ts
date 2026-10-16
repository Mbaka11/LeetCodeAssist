import { getProblem } from '../data/neetcode150';
import {
  BENCHMARKS,
  type Benchmark,
  NEW_PROBLEMS_PER_DAY,
  expectedNewDone,
  isConsolidationDay,
} from '../data/program';
import {
  PLAN_PRIORITY,
  REVIEW_STRENGTH,
  createActivity,
  estimatedMinutes,
  isReviewType,
} from './activities';
import { compareDates, dayIndex, diffDays } from './dates';
import { programQueue } from './queue';
import { CONSOLIDATION_TARGET_MIN, getProblemStatus } from './state';
import type { Activity, AppState, Settings } from './types';

/** Minimum age (days since the `new` was completed) for consolidation-day blind practice. */
const EXTRA_PRACTICE_MIN_AGE_DAYS = 3;

export interface PlanItem {
  activity: Activity;
  /** Budgeted minutes for this activity (not the logged time). */
  minutes: number;
  /** Review that was due before the planned date. */
  overdue: boolean;
  /** False when the activity does not exist in the state yet (see `materializePlan`). */
  persisted: boolean;
}

export interface Pace {
  /** New problems completed so far. */
  actual: number;
  /** New problems expected to be complete by the end of this program day. */
  expected: number;
  delta: number;
  /** "+2 ahead", "−1 behind" or "on pace". */
  label: string;
}

export interface DayPlan {
  date: string;
  /** 1-based program day (<= 0 before the start date). */
  dayIndex: number;
  isConsolidationDay: boolean;
  isBenchmarkDay: boolean;
  /** Ordered list for the day: reviews, benchmark pair, new problems. Excludes the bonus. */
  items: PlanItem[];
  /** Optional third new problem; never becomes debt. */
  bonus: PlanItem | null;
  /** Due reviews that did not fit under the cap today; they stay planned and are re-planned tomorrow. */
  carriedOver: PlanItem[];
  /** Weaker reviews hidden because a stronger review of the same problem is due (merge rule). */
  mergedAway: Activity[];
  targetMinutes: number;
  capMinutes: number;
  /** Budgeted minutes of `items` (done ones included). */
  plannedMinutes: number;
  /** Budgeted minutes of `items` that are not done yet. */
  remainingMinutes: number;
  pace: Pace;
}

export interface PlanOptions {
  /** Overrides the program queue (tests). */
  queue?: readonly string[];
  /** Overrides the benchmark pairs (tests). */
  benchmarks?: readonly Benchmark[];
}

function paceLabel(delta: number): string {
  if (delta > 0) return `+${delta} ahead`;
  if (delta < 0) return `\u2212${-delta} behind`;
  return 'on pace';
}

function isMandatory(activity: Activity, date: string): boolean {
  return (
    activity.status === 'in_progress' ||
    (activity.status === 'done' && activity.completedAt === date)
  );
}

function reviewOrder(a: PlanItem, b: PlanItem): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const byPriority = PLAN_PRIORITY[a.activity.type] - PLAN_PRIORITY[b.activity.type];
  if (byPriority !== 0) return byPriority;
  const byDue = compareDates(a.activity.dueDate, b.activity.dueDate);
  if (byDue !== 0) return byDue;
  return a.activity.id < b.activity.id ? -1 : a.activity.id > b.activity.id ? 1 : 0;
}

/** Strongest review wins; ties go to the earliest due date. */
function strongerReview(a: Activity, b: Activity): Activity {
  const sa = REVIEW_STRENGTH[a.type as keyof typeof REVIEW_STRENGTH];
  const sb = REVIEW_STRENGTH[b.type as keyof typeof REVIEW_STRENGTH];
  if (sa !== sb) return sa > sb ? a : b;
  return compareDates(a.dueDate, b.dueDate) <= 0 ? a : b;
}

function lastDoneDate(state: AppState, slug: string): string | undefined {
  let last: string | undefined;
  for (const a of state.activities) {
    if (a.slug === slug && a.status === 'done' && a.completedAt !== undefined) {
      if (last === undefined || compareDates(a.completedAt, last) > 0) last = a.completedAt;
    }
  }
  return last;
}

/**
 * Plans one day (SPEC §4). Pure: the same state and date always give the same plan.
 * The plan is stable while the user works through it: completing items does not change it.
 */
export function planDay(
  state: AppState,
  date: string,
  settings: Settings = state.settings,
  options: PlanOptions = {},
): DayPlan {
  const queue = options.queue ?? programQueue(state);
  const benchmarks = options.benchmarks ?? BENCHMARKS;
  const index = dayIndex(settings.startDate, date);
  const consolidation = isConsolidationDay(index);
  const benchmark = benchmarks.find((b) => b.day === index);
  const capMinutes = settings.dailyCapMin;
  const targetMinutes = consolidation ? CONSOLIDATION_TARGET_MIN : settings.dailyTargetMin;

  const doneNew = new Set(
    state.activities.filter((a) => a.type === 'new' && a.status === 'done').map((a) => a.slug),
  );
  const expected = expectedNewDone(index, queue.length);
  const pace: Pace = {
    actual: doneNew.size,
    expected,
    delta: doneNew.size - expected,
    label: paceLabel(doneNew.size - expected),
  };

  const persistedIds = new Set(state.activities.map((a) => a.id));
  const created: Activity[] = [];
  const makeVirtual = (params: Parameters<typeof createActivity>[1]): PlanItem => {
    const activity = createActivity([...state.activities, ...created], params);
    created.push(activity);
    return {
      activity,
      minutes: estimatedMinutes(activity.type, activity.slug),
      overdue: false,
      persisted: false,
    };
  };
  const toItem = (activity: Activity): PlanItem => ({
    activity,
    minutes: estimatedMinutes(activity.type, activity.slug),
    overdue: activity.dueDate < date,
    persisted: persistedIds.has(activity.id),
  });

  const empty: DayPlan = {
    date,
    dayIndex: index,
    isConsolidationDay: consolidation,
    isBenchmarkDay: benchmark !== undefined,
    items: [],
    bonus: null,
    carriedOver: [],
    mergedAway: [],
    targetMinutes,
    capMinutes,
    plannedMinutes: 0,
    remainingMinutes: 0,
    pace,
  };
  if (index < 1) return empty;

  // 1. Reviews: mandatory (started or finished today) plus due/overdue planned ones.
  const reviewItems: PlanItem[] = [];
  const pendingBySlug = new Map<string, Activity>();
  const mergedAway: Activity[] = [];
  for (const a of state.activities) {
    if (!isReviewType(a.type)) continue;
    if (isMandatory(a, date)) {
      reviewItems.push(toItem(a));
      continue;
    }
    if (a.status !== 'planned' || compareDates(a.dueDate, date) > 0) continue;
    if (a.extra && a.dueDate < date) continue; // stale optional practice, not debt
    const current = pendingBySlug.get(a.slug);
    if (current === undefined) {
      pendingBySlug.set(a.slug, a);
    } else {
      const keep = strongerReview(current, a);
      mergedAway.push(keep === current ? a : current);
      pendingBySlug.set(a.slug, keep);
    }
  }
  const pending = [...pendingBySlug.values()].map(toItem);

  // 2. Benchmark pair (always planned on benchmark days).
  const benchmarkItems: PlanItem[] = [];
  if (benchmark) {
    for (const slug of [benchmark.easy, benchmark.medium]) {
      const existing = state.activities.find(
        (a) => a.type === 'benchmark' && a.slug === slug && a.dueDate === date,
      );
      if (existing) {
        if (existing.status !== 'skipped') benchmarkItems.push(toItem(existing));
      } else {
        benchmarkItems.push(
          makeVirtual({ type: 'benchmark', slug, dueDate: date, createdAt: date }),
        );
      }
    }
  }

  // A benchmark started on an earlier day and still running must stay finishable.
  for (const a of state.activities) {
    if (a.type !== 'benchmark' || a.status !== 'in_progress' || a.dueDate >= date) continue;
    benchmarkItems.push(toItem(a));
  }

  // 3. New problems already committed for today (done, started, or materialized).
  const queueIndex = (slug: string): number => {
    const i = queue.indexOf(slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const todaysNew = state.activities
    .filter(
      (a) =>
        a.type === 'new' &&
        (isMandatory(a, date) || (a.status === 'planned' && a.dueDate === date)),
    )
    .sort((a, b) => queueIndex(a.slug) - queueIndex(b.slug) || (a.id < b.id ? -1 : 1));
  const coreCount = consolidation ? todaysNew.length : NEW_PROBLEMS_PER_DAY;
  const newItems = todaysNew.slice(0, coreCount).map(toItem);
  let bonus: PlanItem | null = todaysNew[coreCount] ? toItem(todaysNew[coreCount]!) : null;
  newItems.push(...todaysNew.slice(coreCount + 1).map(toItem));

  const sum = (items: readonly PlanItem[]): number => items.reduce((n, i) => n + i.minutes, 0);
  let used = sum(reviewItems) + sum(benchmarkItems) + sum(newItems);

  // Reviews are never dropped, only carried: take them in priority order while they fit.
  pending.sort(reviewOrder);
  const carriedOver: PlanItem[] = [];
  let fitting = true;
  for (const item of pending) {
    const nothingPlanned = used === 0;
    if (fitting && (nothingPlanned || used + item.minutes <= capMinutes)) {
      reviewItems.push(item);
      used += item.minutes;
    } else {
      fitting = false;
      carriedOver.push(item);
    }
  }

  // 4a. Consolidation days: top up to the target with blind practice on learned problems.
  if (consolidation) {
    const busySlugs = new Set([
      ...reviewItems.map((i) => i.activity.slug),
      ...carriedOver.map((i) => i.activity.slug),
      ...mergedAway.map((a) => a.slug),
      ...newItems.map((i) => i.activity.slug),
    ]);
    const learnedOn = new Map<string, string>();
    for (const a of state.activities) {
      if (a.type !== 'new' || a.status !== 'done' || a.completedAt === undefined) continue;
      const prev = learnedOn.get(a.slug);
      if (prev === undefined || compareDates(a.completedAt, prev) < 0) learnedOn.set(a.slug, a.completedAt);
    }
    const statusRank = { consolidating: 0, learning: 1, reviewed: 2, untouched: 3, mastered: 4 };
    const candidates = [...learnedOn.entries()]
      .filter(
        ([slug, learned]) =>
          !busySlugs.has(slug) &&
          getProblemStatus(state, slug) !== 'mastered' &&
          diffDays(learned, date) >= EXTRA_PRACTICE_MIN_AGE_DAYS,
      )
      .map(([slug]) => ({
        slug,
        rank: statusRank[getProblemStatus(state, slug)],
        last: lastDoneDate(state, slug) ?? '',
        order: getProblem(slug)?.neetcodeOrder ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          (a.last < b.last ? -1 : a.last > b.last ? 1 : 0) ||
          a.order - b.order,
      );
    for (const candidate of candidates) {
      const minutes = estimatedMinutes('blind', candidate.slug);
      if (used >= targetMinutes || used + minutes > capMinutes) break;
      const item = makeVirtual({
        type: 'blind',
        slug: candidate.slug,
        dueDate: date,
        createdAt: date,
        extra: true,
      });
      reviewItems.push(item);
      used += item.minutes;
    }
  }

  // 4b. New problems from the queue: fill up to 2 (none on consolidation days), then a bonus.
  if (!consolidation) {
    const consumed = new Set<string>();
    for (const a of state.activities) {
      if (a.type !== 'new' || a.postponed) continue; // a postponed problem is still in the queue
      if (a.status !== 'planned' || a.dueDate === date) consumed.add(a.slug);
    }
    const upcoming = queue.filter((slug) => !consumed.has(slug));
    let next = 0;
    while (newItems.length < NEW_PROBLEMS_PER_DAY && next < upcoming.length) {
      const slug = upcoming[next]!;
      if (used + estimatedMinutes('new', slug) > capMinutes) break;
      const item = makeVirtual({ type: 'new', slug, dueDate: date, createdAt: date });
      newItems.push(item);
      used += item.minutes;
      next += 1;
    }
    if (
      bonus === null &&
      newItems.length >= NEW_PROBLEMS_PER_DAY &&
      next < upcoming.length &&
      used + estimatedMinutes('new', upcoming[next]!) <= capMinutes
    ) {
      bonus = makeVirtual({ type: 'new', slug: upcoming[next]!, dueDate: date, createdAt: date });
    }
  }

  reviewItems.sort(reviewOrder);
  const items = [...reviewItems, ...benchmarkItems, ...newItems];
  return {
    ...empty,
    items,
    bonus,
    carriedOver,
    mergedAway,
    plannedMinutes: sum(items),
    remainingMinutes: sum(items.filter((i) => i.activity.status !== 'done')),
  };
}

/** Persists the activities of a plan that do not exist yet (new problems, benchmarks, practice, bonus). */
export function materializePlan(state: AppState, plan: DayPlan): AppState {
  const missing = [...plan.items, ...(plan.bonus ? [plan.bonus] : [])]
    .filter((item) => !item.persisted)
    .map((item) => item.activity);
  if (missing.length === 0) return state;
  return { ...state, activities: [...state.activities, ...missing] };
}
