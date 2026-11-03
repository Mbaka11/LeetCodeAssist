/**
 * Program retrospectives (SPEC §4): a read-only summary of a finished phase of the program, built from the activity
 * history only. Nothing is stored, scheduled or changed, so it needs no migration and works on older backups.
 *
 * Phase 1 is days 1-30 (the Day 30 retrospective), phase 2 is days 31-60 (the Day 60 retrospective). A retrospective
 * is available once the training day reaches the last day of its phase; until then `reached` is false and the numbers
 * describe the days elapsed so far.
 */
import { getProblem } from '../data/neetcode150';
import { BENCHMARKS, PHASE_ONE_DAYS, PHASE_ONE_QUEUE, PHASE_TWO_QUEUE, PROGRAM_LENGTH_DAYS } from '../data/program';
import { REVIEW_TYPES } from './activities';
import { calendarDays } from './calendar';
import { dateFromDayIndex, dayIndex } from './dates';
import { median } from './pace';
import type { Activity, ActivityType, AppState, Outcome } from './types';

export interface RetrospectivePhase {
  id: 'phase1' | 'phase2';
  /** Short name used in titles, for example "Day 30". */
  label: string;
  fromDay: number;
  toDay: number;
  /** Program problems that belong to this phase. */
  queue: readonly string[];
}

export const RETROSPECTIVE_PHASES: readonly RetrospectivePhase[] = [
  { id: 'phase1', label: 'Day 30', fromDay: 1, toDay: PHASE_ONE_DAYS, queue: PHASE_ONE_QUEUE },
  { id: 'phase2', label: 'Day 60', fromDay: PHASE_ONE_DAYS + 1, toDay: PROGRAM_LENGTH_DAYS, queue: PHASE_TWO_QUEUE },
];

/** Minimum attempts in a category before it can be called weak, so one bad attempt is not a trend. */
export const WEAK_CATEGORY_MIN_ATTEMPTS = 3;

export interface RetrospectiveDays {
  /** Days of the phase that have started (today included). */
  elapsed: number;
  /** Elapsed days with at least one finished activity. */
  active: number;
  /** Elapsed days that met the streak rule (one activity and 30 logged minutes). */
  streak: number;
  /** Elapsed days with core activities whose core plan was at least 80% done, and how many had core activities. */
  planDone: number;
  planDays: number;
}

export interface RetrospectiveLearned {
  /** Problems of this phase's queue with a finished first attempt, by the end of the phase window. */
  count: number;
  total: number;
  /** Learned problems whose first attempt was solo. */
  solo: number;
}

export interface TypeStat {
  type: ActivityType;
  /** Finished activities of this type with a recorded outcome. */
  attempts: number;
  solo: number;
  /** Median logged minutes (undefined without a measured time). */
  medianMinutes?: number;
}

export interface CategoryStat {
  category: string;
  attempts: number;
  notSolo: number;
}

export interface BenchmarkResult {
  slug: string;
  outcome?: Outcome;
  minutes?: number;
  done: boolean;
}

export interface BenchmarkStat {
  day: number;
  date: string;
  lighter: BenchmarkResult;
  harder: BenchmarkResult;
}

export interface Retrospective {
  phase: RetrospectivePhase;
  startDate: string;
  endDate: string;
  /** Today's training day has reached the last day of the phase. */
  reached: boolean;
  days: RetrospectiveDays;
  learned: RetrospectiveLearned;
  /** Recall, rebuild, resolve, blind and retry, in that order (types with no attempts are left out). */
  reviews: TypeStat[];
  /** The whole phase's logged minutes (all finished activities, optional practice included). */
  loggedMinutes: number;
  /** Weakest categories first (highest share of attempts that were not solo), at most three. */
  weakCategories: CategoryStat[];
  benchmarks: BenchmarkStat[];
}

function inWindow(activity: Activity, from: string, to: string): boolean {
  return activity.status === 'done' && activity.completedAt !== undefined && activity.completedAt >= from && activity.completedAt <= to;
}

function minutesOf(activity: Activity): number | undefined {
  return activity.totalMs !== undefined && activity.totalMs > 0 ? activity.totalMs / 60_000 : undefined;
}

function resultOf(state: AppState, slug: string): BenchmarkResult {
  const done = state.activities.find((a) => a.type === 'benchmark' && a.slug === slug && a.status === 'done');
  if (!done) return { slug, done: false };
  const minutes = minutesOf(done);
  return {
    slug,
    done: true,
    ...(done.outcome ? { outcome: done.outcome } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
  };
}

/** The retrospective of `phase` as seen on training day `today`. */
export function programRetrospective(state: AppState, phase: RetrospectivePhase, today: string): Retrospective {
  const start = state.settings.startDate;
  const startDate = dateFromDayIndex(start, phase.fromDay);
  const endDate = dateFromDayIndex(start, phase.toDay);
  const todayIndex = dayIndex(start, today);

  const calendar = calendarDays(state, today).filter(
    (d) => d.dayIndex >= phase.fromDay && d.dayIndex <= phase.toDay && d.kind !== 'future',
  );
  const counted = calendar.filter((d) => d.coreCount > 0);
  const days: RetrospectiveDays = {
    elapsed: calendar.length,
    active: calendar.filter((d) => d.doneCount > 0).length,
    streak: calendar.filter((d) => d.streakQualified).length,
    planDone: counted.filter((d) => d.planDone).length,
    planDays: counted.length,
  };

  const finished = state.activities.filter((a) => inWindow(a, startDate, endDate));
  const loggedMinutes = finished.reduce((sum, a) => sum + (a.totalMs ?? 0), 0) / 60_000;

  // First attempts of this phase's problems. The first finished 'new' activity per slug decides.
  const queue = new Set(phase.queue);
  const firstAttempt = new Map<string, Activity>();
  for (const a of [...state.activities].sort((x, y) => (x.completedAt ?? '').localeCompare(y.completedAt ?? ''))) {
    if (a.type !== 'new' || a.status !== 'done' || a.extra || !queue.has(a.slug)) continue;
    if (a.completedAt === undefined || a.completedAt > endDate) continue;
    if (!firstAttempt.has(a.slug)) firstAttempt.set(a.slug, a);
  }
  const learned: RetrospectiveLearned = {
    count: firstAttempt.size,
    total: phase.queue.length,
    solo: [...firstAttempt.values()].filter((a) => a.outcome === 'solo').length,
  };

  const reviews: TypeStat[] = [];
  for (const type of REVIEW_TYPES) {
    const items = finished.filter((a) => a.type === type && !a.extra && a.outcome !== undefined);
    if (items.length === 0) continue;
    const mid = median(items.map(minutesOf).filter((m): m is number => m !== undefined));
    reviews.push({
      type,
      attempts: items.length,
      solo: items.filter((a) => a.outcome === 'solo').length,
      ...(mid !== undefined ? { medianMinutes: mid } : {}),
    });
  }

  const byCategory = new Map<string, CategoryStat>();
  for (const a of finished) {
    if (a.extra || a.outcome === undefined || a.type === 'benchmark') continue;
    const category = getProblem(a.slug)?.category;
    if (category === undefined) continue;
    const stat = byCategory.get(category) ?? { category, attempts: 0, notSolo: 0 };
    stat.attempts += 1;
    if (a.outcome !== 'solo') stat.notSolo += 1;
    byCategory.set(category, stat);
  }
  const weakCategories = [...byCategory.values()]
    .filter((c) => c.attempts >= WEAK_CATEGORY_MIN_ATTEMPTS && c.notSolo > 0)
    .sort((x, y) => y.notSolo / y.attempts - x.notSolo / x.attempts || y.attempts - x.attempts || x.category.localeCompare(y.category))
    .slice(0, 3);

  const benchmarks: BenchmarkStat[] = BENCHMARKS.filter((b) => b.day >= phase.fromDay && b.day <= phase.toDay).map((b) => ({
    day: b.day,
    date: dateFromDayIndex(start, b.day),
    lighter: resultOf(state, b.easy),
    harder: resultOf(state, b.medium),
  }));

  return {
    phase,
    startDate,
    endDate,
    reached: todayIndex >= phase.toDay,
    days,
    learned,
    reviews,
    loggedMinutes,
    weakCategories,
    benchmarks,
  };
}

/**
 * The phases to show on `today`: every phase whose last day has been reached, plus the next one when it starts
 * within a week (shown as locked with its date). Returns the retrospective of each, oldest first.
 */
export function visibleRetrospectives(state: AppState, today: string): Retrospective[] {
  const todayIndex = dayIndex(state.settings.startDate, today);
  return RETROSPECTIVE_PHASES.map((phase) => programRetrospective(state, phase, today)).filter(
    (r) => r.reached || todayIndex >= r.phase.toDay - 7,
  );
}
