/** Day-by-day view of the program for the Calendar (SPEC §6): planned, done and carried work per day. */
import { isBonusProblem } from '../data/bonus';
import {
  BENCHMARKS,
  NEW_PROBLEMS_PER_DAY,
  PROGRAM_LENGTH_DAYS,
  PROGRAM_QUEUE,
  isConsolidationDay,
} from '../data/program';
import { estimatedMinutes, isReviewType } from './activities';
import { compareDates, dateFromDayIndex, dayIndex } from './dates';
import { planDay } from './planner';
import { dailyTargetMinutes, dayProgress, isPlanDone } from './state';
import type { Activity, ActivityType, AppState, Outcome } from './types';

/**
 * - `done`: completed on this day.
 * - `open`: still to do (today or later).
 * - `carried`: a review that was not finished on its day; it is planned again later.
 * - `missed`: a new problem, benchmark or optional practice that was not finished on its day.
 * - `skipped`: skipped by the user.
 * - `expected`: not created yet (future benchmark pair and new problems).
 */
export type EntryState = 'done' | 'open' | 'carried' | 'missed' | 'skipped' | 'expected';

export interface CalendarEntry {
  /** Activity id, or a synthetic id for `expected` entries. */
  id: string;
  type: ActivityType;
  /** Undefined for an expected new problem: the queue decides which one it will be. */
  slug?: string;
  state: EntryState;
  /** Budgeted minutes. */
  minutes: number;
  /** Logged minutes of a completed activity. */
  loggedMinutes?: number;
  outcome?: Outcome;
  /** A planned, not yet started review that can be moved to another day. */
  movable: boolean;
  /** A new problem from the queue that is not finished and can be postponed (when it is today's). */
  postponable: boolean;
  /** A bonus-pool problem: optional, not part of the program, not counted in pace. */
  bonus?: boolean;
}

export interface CalendarDay {
  date: string;
  /** 1-based program day. */
  dayIndex: number;
  kind: 'past' | 'today' | 'future';
  /** Beyond day 30: only listed when it has reviews (or is today). */
  overflow: boolean;
  isConsolidation: boolean;
  isBenchmark: boolean;
  /** Activities planned for this day (including ones that were carried or finished later). */
  plannedCount: number;
  plannedMinutes: number;
  /** Activities completed on this day (including carried-in reviews from earlier days). */
  doneCount: number;
  loggedMinutes: number;
  /** Reviews that were not finished on their day and moved on. */
  carriedCount: number;
  targetMinutes: number;
  /** >= 1 activity done and >= 30 minutes logged. */
  streakQualified: boolean;
  /** Core activities due this day: not optional practice, bonus or postponed. 0 on future days. */
  coreCount: number;
  /** Core activities of this day that were completed on it. */
  coreDoneCount: number;
  /** At least 80% of the day's core activities are done (see `isPlanDone`). Never on future days. */
  planDone: boolean;
  entries: CalendarEntry[];
}

/** Average of the Easy (25) and Medium (40) budgets, for new problems that are not chosen yet. */
export const EXPECTED_NEW_MINUTES = Math.round((25 + 40) / 2);

interface Draft {
  entry: CalendarEntry;
  /** Counts towards the day's planned total. */
  planned: boolean;
  /** Counts towards the day's plan-done ratio: planned, due this day, not optional practice. */
  core: boolean;
}

function isCoreActivity(a: Activity, date: string): boolean {
  return a.dueDate === date && !a.extra && !a.postponed;
}

function entryOf(a: Activity, state: EntryState): CalendarEntry {
  return {
    id: a.id,
    type: a.type,
    slug: a.slug,
    state,
    minutes: estimatedMinutes(a.type, a.slug),
    ...(a.status === 'done' ? { loggedMinutes: (a.totalMs ?? 0) / 60_000 } : {}),
    ...(a.outcome ? { outcome: a.outcome } : {}),
    movable: isReviewType(a.type) && !a.extra && a.status === 'planned',
    postponable:
      a.type === 'new' &&
      !a.extra &&
      !isBonusProblem(a.slug) &&
      (a.status === 'planned' || a.status === 'in_progress'),
    ...(a.type === 'new' && isBonusProblem(a.slug) ? { bonus: true } : {}),
  };
}

/** State of a stored activity as seen from `date` (<= today), or null when it does not belong there. */
function stateOnDate(a: Activity, date: string, today: string, carriedIds: ReadonlySet<string>): EntryState | null {
  if (a.status === 'done') {
    if (a.completedAt === date) return 'done';
    // Due here but finished later: carried. Finished before its due date: it belongs to that earlier day.
    return a.completedAt !== undefined && compareDates(a.completedAt, date) > 0 ? 'carried' : null;
  }
  const review = isReviewType(a.type) && !a.extra;
  if (a.status === 'skipped') return review ? 'carried' : 'skipped';
  if (date < today) return review ? 'carried' : 'missed';
  return carriedIds.has(a.id) ? 'carried' : 'open';
}

/**
 * Ids of persisted, unstarted new problems beyond the daily two: the optional bonus. Not finishing
 * it is not a miss, so it neither counts as planned nor as missed.
 */
function bonusIds(state: AppState, date: string): Set<string> {
  const due = state.activities.filter((a) => a.type === 'new' && !a.extra && a.dueDate === date);
  // Bonus-pool problems are always the bonus; a queue problem beyond the daily two is one too (older data).
  const pool = due.filter((a) => isBonusProblem(a.slug));
  const queued = due.filter((a) => !isBonusProblem(a.slug));
  const committed = queued.filter((a) => a.status !== 'planned' && !a.postponed).length;
  const unstarted = queued.filter((a) => a.status === 'planned');
  return new Set(
    [...pool, ...unstarted.slice(Math.max(0, NEW_PROBLEMS_PER_DAY - committed))].map((a) => a.id),
  );
}

/** Days up to and including today: the stored history, plus today's not yet persisted plan. */
function draftsUpToToday(state: AppState, date: string, today: string): Draft[] {
  const drafts = new Map<string, Draft>();
  const plan = date === today ? planDay(state, date) : null;
  const carriedIds = new Set(plan?.carriedOver.map((i) => i.activity.id));
  const bonus = bonusIds(state, date);

  for (const a of state.activities) {
    const dueHere = a.dueDate === date;
    if (!dueHere && !(a.status === 'done' && a.completedAt === date)) continue;
    if (a.extra && a.status === 'planned') continue; // optional practice that was never started
    const entryState = stateOnDate(a, date, today, carriedIds);
    if (entryState === null) continue;
    const isBonus = bonus.has(a.id);
    drafts.set(a.id, {
      entry: entryOf(a, isBonus && date < today ? 'skipped' : entryState),
      planned: dueHere && !isBonus && !a.postponed,
      core: dueHere && !isBonus && isCoreActivity(a, date),
    });
  }
  if (plan) {
    for (const item of plan.items) {
      const existing = drafts.get(item.activity.id);
      if (existing) {
        existing.planned = !bonus.has(item.activity.id);
        existing.core = existing.planned && isCoreActivity(item.activity, date);
      } else {
        drafts.set(item.activity.id, {
          entry: entryOf(item.activity, 'open'),
          planned: true,
          core: isCoreActivity(item.activity, date),
        });
      }
    }
    for (const item of plan.carriedOver) {
      const existing = drafts.get(item.activity.id);
      if (!existing) drafts.set(item.activity.id, { entry: entryOf(item.activity, 'carried'), planned: false, core: false });
    }
  }
  return [...drafts.values()];
}

/** Future days: the reviews already scheduled plus the fixed program (benchmark pair, new problems). */
function draftsAfterToday(state: AppState, date: string, index: number): Draft[] {
  const entries: CalendarEntry[] = state.activities
    .filter((a) => a.dueDate === date && a.status === 'planned' && !a.extra)
    .map((a) => entryOf(a, 'open'));
  const benchmark = BENCHMARKS.find((b) => b.day === index);
  if (benchmark) {
    for (const slug of [benchmark.easy, benchmark.medium]) {
      if (entries.some((e) => e.slug === slug && e.type === 'benchmark')) continue;
      entries.push({
        id: `expected:benchmark:${slug}:${date}`,
        type: 'benchmark',
        slug,
        state: 'expected',
        minutes: estimatedMinutes('benchmark', slug),
        movable: false,
        postponable: false,
      });
    }
  }
  if (index <= PROGRAM_LENGTH_DAYS && !isConsolidationDay(index)) {
    const stored = entries.filter((e) => e.type === 'new').length;
    for (let n = stored; n < NEW_PROBLEMS_PER_DAY; n += 1) {
      entries.push({
        id: `expected:new:${n}:${date}`,
        type: 'new',
        state: 'expected',
        minutes: EXPECTED_NEW_MINUTES,
        movable: false,
        postponable: false,
      });
    }
  }
  return entries.map((entry) => ({ entry, planned: true, core: false }));
}

function buildDay(state: AppState, date: string, today: string): CalendarDay {
  const index = dayIndex(state.settings.startDate, date);
  const kind = date < today ? 'past' : date === today ? 'today' : 'future';
  const drafts =
    kind === 'future' ? draftsAfterToday(state, date, index) : draftsUpToToday(state, date, today);
  const planned = drafts.filter((d) => d.planned);
  const progress = dayProgress(state, date);
  const core = drafts.filter((d) => d.core);
  const coreDoneCount = core.filter((d) => d.entry.state === 'done').length;

  return {
    date,
    dayIndex: index,
    kind,
    overflow: index > PROGRAM_LENGTH_DAYS,
    isConsolidation: isConsolidationDay(index),
    isBenchmark: BENCHMARKS.some((b) => b.day === index),
    plannedCount: planned.length,
    plannedMinutes: planned.reduce((sum, d) => sum + d.entry.minutes, 0),
    doneCount: progress.doneCount,
    loggedMinutes: progress.loggedMs / 60_000,
    carriedCount: drafts.filter((d) => d.entry.state === 'carried').length,
    targetMinutes: dailyTargetMinutes(state.settings, date),
    streakQualified: progress.streakQualified,
    coreCount: core.length,
    coreDoneCount,
    planDone: isPlanDone(coreDoneCount, core.length),
    entries: drafts.map((d) => d.entry),
  };
}

/**
 * Days 1-30 of the program, then the later days that have reviews (planned or done) and today when
 * it is past day 30. Before the start date every program day is in the future.
 */
export function calendarDays(state: AppState, today: string): CalendarDay[] {
  const start = state.settings.startDate;
  const dates: string[] = [];
  for (let i = 1; i <= PROGRAM_LENGTH_DAYS; i += 1) dates.push(dateFromDayIndex(start, i));

  const lastProgramDate = dateFromDayIndex(start, PROGRAM_LENGTH_DAYS);
  const overflow = new Set<string>();
  const consider = (date: string | undefined): void => {
    if (date !== undefined && compareDates(date, lastProgramDate) > 0) overflow.add(date);
  };
  for (const a of state.activities) {
    if (a.extra && a.status === 'planned') continue;
    if (a.status === 'planned' || a.status === 'in_progress') consider(a.dueDate);
    if (a.status === 'done') {
      consider(a.completedAt);
      consider(a.dueDate);
    }
  }
  consider(today);
  dates.push(...[...overflow].sort());

  return dates.map((date) => buildDay(state, date, today));
}

export interface ProgramProgress {
  /** Program problems with a completed `new` activity. */
  learned: number;
  totalProblems: number;
  /** Program days elapsed including today, between 0 and `totalDays`. */
  daysElapsed: number;
  totalDays: number;
}

/** Overall progress through the 30-day program (shown at the top of the Calendar). */
export function programProgress(state: AppState, today: string): ProgramProgress {
  const inProgram = new Set(PROGRAM_QUEUE);
  const learned = new Set(
    state.activities
      .filter((a) => a.type === 'new' && a.status === 'done' && inProgram.has(a.slug))
      .map((a) => a.slug),
  );
  const index = dayIndex(state.settings.startDate, today);
  return {
    learned: learned.size,
    totalProblems: PROGRAM_QUEUE.length,
    daysElapsed: Math.min(Math.max(index, 0), PROGRAM_LENGTH_DAYS),
    totalDays: PROGRAM_LENGTH_DAYS,
  };
}
