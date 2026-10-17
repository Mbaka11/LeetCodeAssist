import { BONUS_POOL } from '../data/bonus';
import { getProblem } from '../data/neetcode150';
import {
  BENCHMARKS,
  type Benchmark,
  MAX_NEW_PROBLEMS_PER_DAY,
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
import { BONUS_SLOTS, openBonusOffers, selectBonusSlugs, type BonusHold } from './bonus';
import { compareDates, dayIndex, diffDays } from './dates';
import { programQueue } from './queue';
import { CONSOLIDATION_TARGET_MIN, getProblemStatus } from './state';
import type { Activity, AppState, Settings } from './types';

/** Minimum age (days since the `new` was completed) for consolidation-day blind practice. */
const EXTRA_PRACTICE_MIN_AGE_DAYS = 3;

/**
 * Soft overflow (SPEC §4): a third new problem is allowed on a normal day when the next queue problem is
 * Easy and the day's planned minutes with it stay <= cap + this many minutes. The cap itself still limits
 * reviews, the first two new problems and the bonus.
 */
export const SOFT_OVERFLOW_MIN = 30;

function isEasy(slug: string): boolean {
  return getProblem(slug)?.difficulty === 'Easy';
}

/**
 * How many of a day's committed queue problems (in queue order) are core rather than the optional bonus:
 * the daily two, plus a third when it is Easy (see `SOFT_OVERFLOW_MIN`).
 */
export function coreNewCount(slugs: readonly string[]): number {
  const third = slugs[NEW_PROBLEMS_PER_DAY];
  if (third !== undefined && isEasy(third)) return MAX_NEW_PROBLEMS_PER_DAY;
  return Math.min(slugs.length, NEW_PROBLEMS_PER_DAY);
}

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
  /** Program-queue problems completed so far (bonus-pool problems do not count). */
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
  /** Ordered list for the day: reviews, benchmark pair, new problems. Excludes the bonus offers. */
  items: PlanItem[];
  /**
   * Up to `BONUS_SLOTS` optional, uncompleted bonus problems from the pool (`BONUS_POOL`). They are offers:
   * never debt, never part of `items`, `plannedMinutes`, the badge or the plan-done ratio, and they do not count
   * toward pace or the program queue. Open offers (planned or started, kept in the order they were created)
   * are sticky across reloads and days; a completed or skipped one is replaced at once, as often as the user
   * completes them. They are shown even when the core plan already fills the cap (see `bonusRoomMinutes`).
   */
  bonuses: PlanItem[];
  /** Bonus problems completed today (optional work that is already done); not replaced by `bonuses`. */
  completedBonuses: PlanItem[];
  /** Why fewer than `BONUS_SLOTS` offers are shown (prerequisites not ready, pool exhausted); null otherwise. */
  bonusHold: BonusHold | null;
  /**
   * Minutes of the daily cap that the core items leave free. An offer longer than this is overtime the
   * user chooses deliberately; it is still outside the core budget.
   */
  bonusRoomMinutes: number;
  /** TEMPORARY alias of `bonuses[0]`, kept until every UI caller uses `bonuses` (removed in the UI stage). */
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
  /** Overrides the bonus pool (tests). */
  bonusPool?: readonly string[];
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
  const bonusPool = options.bonusPool ?? BONUS_POOL;
  const index = dayIndex(settings.startDate, date);
  const consolidation = isConsolidationDay(index);
  const benchmark = benchmarks.find((b) => b.day === index);
  const capMinutes = settings.dailyCapMin;
  const budgets = settings.budgets;
  const targetMinutes = consolidation ? CONSOLIDATION_TARGET_MIN : settings.dailyTargetMin;

  // Pace counts program-queue problems only: a finished bonus-pool problem is extra work.
  const inQueue = new Set(queue);
  const doneNew = new Set(
    state.activities
      .filter((a) => a.type === 'new' && a.status === 'done' && inQueue.has(a.slug))
      .map((a) => a.slug),
  );
  const expected = expectedNewDone(index, queue.length);
  // Today's own problems are not "due" yet: being behind means missing what earlier days required, and
  // being ahead means exceeding what today requires. In between is on pace.
  const expectedBeforeToday = expectedNewDone(index - 1, queue.length);
  const paceDelta =
    doneNew.size < expectedBeforeToday
      ? doneNew.size - expectedBeforeToday
      : doneNew.size > expected
        ? doneNew.size - expected
        : 0;
  const pace: Pace = {
    actual: doneNew.size,
    expected,
    delta: paceDelta,
    label: paceLabel(paceDelta),
  };

  const persistedIds = new Set(state.activities.map((a) => a.id));
  const created: Activity[] = [];
  const makeVirtual = (params: Parameters<typeof createActivity>[1]): PlanItem => {
    const activity = createActivity([...state.activities, ...created], params);
    created.push(activity);
    return {
      activity,
      minutes: estimatedMinutes(activity.type, activity.slug, budgets),
      overdue: false,
      persisted: false,
    };
  };
  const toItem = (activity: Activity): PlanItem => ({
    activity,
    minutes: estimatedMinutes(activity.type, activity.slug, budgets),
    overdue: activity.dueDate < date,
    persisted: persistedIds.has(activity.id),
  });

  const empty: DayPlan = {
    date,
    dayIndex: index,
    isConsolidationDay: consolidation,
    isBenchmarkDay: benchmark !== undefined,
    items: [],
    bonuses: [],
    completedBonuses: [],
    bonusHold: null,
    bonusRoomMinutes: 0,
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
  // Bonus-pool problems are never core: they are handled as offers below. The rest are core problems from the
  // queue (a queue problem beyond the daily two, saved by an older version as the bonus, still counts as one
  // bonus offer).
  const poolSlugs = new Set(bonusPool);
  const todaysQueue = todaysNew.filter((a) => !poolSlugs.has(a.slug));
  const coreCount = consolidation ? todaysQueue.length : coreNewCount(todaysQueue.map((a) => a.slug));
  const overflow = todaysQueue.slice(coreCount);
  const legacyOverflowBonus = overflow[0];
  const newItems = todaysQueue.slice(0, coreCount).map(toItem);
  newItems.push(...overflow.slice(1).map(toItem));

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
      const minutes = estimatedMinutes('blind', candidate.slug, budgets);
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

  // 4b. New problems from the queue: fill up to 2 (none on consolidation days). Then the bonus.
  const consumed = new Set<string>();
  const skippedToday = new Set<string>();
  for (const a of state.activities) {
    if (a.type !== 'new') continue;
    if (a.status === 'skipped' && a.dueDate === date) skippedToday.add(a.slug);
    if (a.postponed) continue; // a postponed problem is still in the queue
    if (a.status === 'skipped') continue; // a skipped problem goes back to the queue
    if (a.status !== 'planned' || a.dueDate === date) consumed.add(a.slug);
  }
  if (!consolidation) {
    // A problem skipped or postponed today is not offered again today, even as the Easy third problem.
    const upcoming = queue.filter((slug) => !consumed.has(slug) && !skippedToday.has(slug));
    let next = 0;
    while (next < upcoming.length) {
      const slug = upcoming[next]!;
      let limit: number;
      if (newItems.length < NEW_PROBLEMS_PER_DAY) limit = capMinutes;
      else if (newItems.length < MAX_NEW_PROBLEMS_PER_DAY && isEasy(slug)) limit = capMinutes + SOFT_OVERFLOW_MIN;
      else break;
      if (used + estimatedMinutes('new', slug, budgets) > limit) break;
      const item = makeVirtual({ type: 'new', slug, dueDate: date, createdAt: date });
      newItems.push(item);
      used += item.minutes;
      next += 1;
    }
  }

  reviewItems.sort(reviewOrder);
  const items = [...reviewItems, ...benchmarkItems, ...newItems];
  const plannedMinutes = sum(items);

  // Bonus offers come from the pool, not the queue, and never displace core work: they are chosen after the
  // core plan is final, whether or not they fit under the cap.
  // An offer is never overdue: it is optional and keeps its place instead of becoming debt.
  const toOffer = (activity: Activity): PlanItem => ({ ...toItem(activity), overdue: false });
  const completedBonuses = state.activities
    .filter(
      (a) =>
        a.type === 'new' && a.status === 'done' && a.completedAt === date && poolSlugs.has(a.slug),
    )
    .map(toOffer);
  const legacyDone = legacyOverflowBonus?.status === 'done';
  if (legacyOverflowBonus && legacyDone) completedBonuses.push(toOffer(legacyOverflowBonus));
  const legacyOpen = legacyOverflowBonus && !legacyDone ? [toOffer(legacyOverflowBonus)] : [];
  const slots = BONUS_SLOTS - legacyOpen.length;
  const stored = openBonusOffers(state, poolSlugs, slots).map(toOffer);
  const selection = selectBonusSlugs(state, {
    pool: bonusPool,
    count: slots - stored.length,
    coreSlugs: items.map((i) => i.activity.slug),
    exclude: new Set([...stored, ...legacyOpen].map((i) => i.activity.slug)),
  });
  const offers = selection.slugs.map((slug) =>
    makeVirtual({ type: 'new', slug, dueDate: date, createdAt: date }),
  );
  const bonuses = [...legacyOpen, ...stored, ...offers];
  return {
    ...empty,
    items,
    bonuses,
    completedBonuses,
    bonusHold: selection.hold,
    bonusRoomMinutes: Math.max(0, capMinutes - plannedMinutes),
    bonus: bonuses[0] ?? null,
    carriedOver,
    mergedAway,
    plannedMinutes,
    remainingMinutes: sum(items.filter((i) => i.activity.status !== 'done')),
  };
}

/** Persists the activities of a plan that do not exist yet (new problems, benchmarks, practice, bonus offers). */
export function materializePlan(state: AppState, plan: DayPlan): AppState {
  const missing = [...plan.items, ...plan.bonuses]
    .filter((item) => !item.persisted)
    .map((item) => item.activity);
  if (missing.length === 0) return state;
  return { ...state, activities: [...state.activities, ...missing] };
}
