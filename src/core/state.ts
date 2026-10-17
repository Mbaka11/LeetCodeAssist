import { CATEGORY_NAMES } from '../data/neetcode150';
import { isConsolidationDay } from '../data/program';
import { BUDGETED_TYPES, DIFFICULTIES } from './activities';
import { catalogProblems, type CatalogId } from './catalog';
import { addDays, dayIndex, isValidDateString } from './dates';
import type {
  Activity,
  ActivityStatus,
  ActivityType,
  AppState,
  BudgetOverrides,
  Difficulty,
  Note,
  Outcome,
  ProblemStatus,
  RoadmapCatalog,
  RoadmapViewMode,
  Settings,
  TimerState,
} from './types';

export const STATE_VERSION = 1;

/** Hints per problem: nudge, insight, sketch (see `src/data/hints.ts`). */
export const MAX_HINTS = 3;

/** A day counts towards the streak with >= 1 activity done and >= 30 minutes logged. */
export const STREAK_MIN_LOGGED_MIN = 30;

/** Target for consolidation days (SPEC §2). */
export const CONSOLIDATION_TARGET_MIN = 90;

export const DEFAULT_SETTINGS = {
  dailyTargetMin: 150,
  dailyCapMin: 180,
  morningNotify: '08:30',
  eveningNotify: '20:00',
  language: 'python',
} as const;

export function defaultState(startDate: string): AppState {
  if (!isValidDateString(startDate)) throw new Error(`Invalid start date: "${startDate}"`);
  return {
    version: STATE_VERSION,
    settings: { startDate, ...DEFAULT_SETTINGS },
    activities: [],
    notes: {},
    problemStatus: {},
    checked: {},
  };
}

// ---------------------------------------------------------------------------
// Serialization and validation
// ---------------------------------------------------------------------------

export class StateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateValidationError';
  }
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}

/** Parses and validates JSON produced by `serializeState` (or a user import). Throws `StateValidationError`. */
export function deserializeState(raw: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StateValidationError('State is not valid JSON');
  }
  return validateState(parsed);
}

const ACTIVITY_TYPES: readonly ActivityType[] = [
  'new',
  'recall',
  'rebuild',
  'resolve',
  'blind',
  'retry',
  'benchmark',
];
const ACTIVITY_STATUSES: readonly ActivityStatus[] = ['planned', 'in_progress', 'done', 'skipped'];
const OUTCOMES: readonly Outcome[] = ['solo', 'hint', 'solution', 'stuck'];
const PROBLEM_STATUSES: readonly ProblemStatus[] = [
  'untouched',
  'learning',
  'consolidating',
  'reviewed',
  'mastered',
];
const ROADMAP_VIEWS: readonly RoadmapViewMode[] = ['tree', 'grid'];
const ROADMAP_CATALOGS: readonly RoadmapCatalog[] = ['neetcode150', 'blind75'];
/** Allowed range of a budget override in minutes. */
export const BUDGET_MIN_MINUTES = 1;
export const BUDGET_MAX_MINUTES = 180;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type Json = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new StateValidationError(`${path}: ${message}`);
}

function asObject(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'expected an object');
  }
  return value as Json;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'expected a string');
  return value;
}

function asDate(value: unknown, path: string): string {
  if (!isValidDateString(value)) fail(path, 'expected a YYYY-MM-DD date');
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'expected a finite number');
  return value;
}

function asNonNegative(value: unknown, path: string): number {
  const n = asNumber(value, path);
  if (n < 0) fail(path, 'expected a non-negative number');
  return n;
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(path, `expected one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function validateBudgets(value: unknown): BudgetOverrides | undefined {
  const o = asObject(value, 'settings.budgets');
  const budgets: BudgetOverrides = {};
  for (const [type, byDifficulty] of Object.entries(o)) {
    const typePath = `settings.budgets.${type}`;
    const budgetedType = asOneOf(type, BUDGETED_TYPES, typePath);
    const row: Partial<Record<Difficulty, number>> = {};
    for (const [difficulty, minutes] of Object.entries(asObject(byDifficulty, typePath))) {
      const path = `${typePath}.${difficulty}`;
      const level = asOneOf(difficulty, DIFFICULTIES, path);
      const n = asNumber(minutes, path);
      if (!Number.isInteger(n) || n < BUDGET_MIN_MINUTES || n > BUDGET_MAX_MINUTES) {
        fail(path, `expected an integer from ${BUDGET_MIN_MINUTES} to ${BUDGET_MAX_MINUTES}`);
      }
      row[level] = n;
    }
    if (Object.keys(row).length > 0) budgets[budgetedType] = row;
  }
  return Object.keys(budgets).length > 0 ? budgets : undefined;
}

function validateSettings(value: unknown): Settings {
  const o = asObject(value, 'settings');
  const settings: Settings = {
    startDate: asDate(o.startDate, 'settings.startDate'),
    dailyTargetMin: asNumber(o.dailyTargetMin, 'settings.dailyTargetMin'),
    dailyCapMin: asNumber(o.dailyCapMin, 'settings.dailyCapMin'),
    morningNotify: asString(o.morningNotify, 'settings.morningNotify'),
    eveningNotify: asString(o.eveningNotify, 'settings.eveningNotify'),
    language: asOneOf(o.language, ['python'], 'settings.language'),
  };
  if (o.roadmapView !== undefined) {
    settings.roadmapView = asOneOf(o.roadmapView, ROADMAP_VIEWS, 'settings.roadmapView');
  }
  if (o.roadmapCatalog !== undefined) {
    settings.roadmapCatalog = asOneOf(o.roadmapCatalog, ROADMAP_CATALOGS, 'settings.roadmapCatalog');
  }
  if (o.budgets !== undefined) {
    const budgets = validateBudgets(o.budgets);
    if (budgets) settings.budgets = budgets;
  }
  if (settings.dailyTargetMin <= 0) fail('settings.dailyTargetMin', 'must be positive');
  if (settings.dailyCapMin < settings.dailyTargetMin) {
    fail('settings.dailyCapMin', 'must be at least dailyTargetMin');
  }
  if (!TIME_PATTERN.test(settings.morningNotify)) fail('settings.morningNotify', 'expected HH:MM');
  if (!TIME_PATTERN.test(settings.eveningNotify)) fail('settings.eveningNotify', 'expected HH:MM');
  return settings;
}

function validateTimer(value: unknown, path: string): TimerState {
  const o = asObject(value, path);
  const running = o.running;
  if (typeof running !== 'boolean') fail(`${path}.running`, 'expected a boolean');
  const startedAt = o.startedAt === null ? null : asNonNegative(o.startedAt, `${path}.startedAt`);
  if (running && startedAt === null) fail(`${path}.startedAt`, 'a running timer needs startedAt');
  return { startedAt, accumulatedMs: asNonNegative(o.accumulatedMs, `${path}.accumulatedMs`), running };
}

function validateActivity(value: unknown, index: number): Activity {
  const path = `activities[${index}]`;
  const o = asObject(value, path);
  const activity: Activity = {
    id: asString(o.id, `${path}.id`),
    slug: asString(o.slug, `${path}.slug`),
    type: asOneOf(o.type, ACTIVITY_TYPES, `${path}.type`),
    dueDate: asDate(o.dueDate, `${path}.dueDate`),
    status: asOneOf(o.status, ACTIVITY_STATUSES, `${path}.status`),
    timer: validateTimer(o.timer, `${path}.timer`),
    createdAt: asDate(o.createdAt, `${path}.createdAt`),
  };
  if (o.approachMs !== undefined) activity.approachMs = asNonNegative(o.approachMs, `${path}.approachMs`);
  if (o.totalMs !== undefined) activity.totalMs = asNonNegative(o.totalMs, `${path}.totalMs`);
  if (o.outcome !== undefined) activity.outcome = asOneOf(o.outcome, OUTCOMES, `${path}.outcome`);
  if (o.completedAt !== undefined) activity.completedAt = asDate(o.completedAt, `${path}.completedAt`);
  if (o.extra !== undefined) {
    if (typeof o.extra !== 'boolean') fail(`${path}.extra`, 'expected a boolean');
    activity.extra = o.extra;
  }
  if (o.hintsUsed !== undefined) {
    const hints = asNonNegative(o.hintsUsed, `${path}.hintsUsed`);
    if (!Number.isInteger(hints) || hints > MAX_HINTS) {
      fail(`${path}.hintsUsed`, `expected an integer from 0 to ${MAX_HINTS}`);
    }
    activity.hintsUsed = hints;
  }
  if (o.postponed !== undefined) {
    if (typeof o.postponed !== 'boolean') fail(`${path}.postponed`, 'expected a boolean');
    activity.postponed = o.postponed;
  }
  if (activity.status === 'done' && activity.completedAt === undefined) {
    fail(`${path}.completedAt`, 'a done activity needs completedAt');
  }
  return activity;
}

function validateNote(value: unknown, slug: string): Note {
  const path = `notes.${slug}`;
  const o = asObject(value, path);
  const note: Note = {
    slug: asString(o.slug, `${path}.slug`),
    trigger: asString(o.trigger, `${path}.trigger`),
    principle: asString(o.principle, `${path}.principle`),
    pitfall: asString(o.pitfall, `${path}.pitfall`),
    complexity: asString(o.complexity, `${path}.complexity`),
    updatedAt: asString(o.updatedAt, `${path}.updatedAt`),
  };
  if (o.code !== undefined) note.code = asString(o.code, `${path}.code`);
  return note;
}

/** Validates an unknown value as `AppState` and returns a normalized copy. */
export function validateState(value: unknown): AppState {
  const o = asObject(value, 'state');
  if (o.version !== STATE_VERSION) {
    throw new StateValidationError(
      `Unsupported state version: ${String(o.version)} (expected ${STATE_VERSION})`,
    );
  }
  if (!Array.isArray(o.activities)) fail('activities', 'expected an array');
  const activities = o.activities.map(validateActivity);
  const ids = new Set<string>();
  for (const a of activities) {
    if (ids.has(a.id)) fail('activities', `duplicate activity id "${a.id}"`);
    ids.add(a.id);
  }

  const notes: Record<string, Note> = {};
  for (const [slug, note] of Object.entries(asObject(o.notes, 'notes'))) {
    notes[slug] = validateNote(note, slug);
  }
  const problemStatus: Record<string, ProblemStatus> = {};
  for (const [slug, status] of Object.entries(asObject(o.problemStatus, 'problemStatus'))) {
    problemStatus[slug] = asOneOf(status, PROBLEM_STATUSES, `problemStatus.${slug}`);
  }
  const checked: Record<string, boolean> = {};
  for (const [slug, flag] of Object.entries(asObject(o.checked, 'checked'))) {
    if (typeof flag !== 'boolean') fail(`checked.${slug}`, 'expected a boolean');
    checked[slug] = flag;
  }

  let queue: string[] | undefined;
  if (o.queue !== undefined) {
    if (!Array.isArray(o.queue)) fail('queue', 'expected an array');
    queue = o.queue.map((slug, i) => asString(slug, `queue[${i}]`));
    if (new Set(queue).size !== queue.length) fail('queue', 'duplicate slug');
  }

  return {
    version: STATE_VERSION,
    settings: validateSettings(o.settings),
    activities,
    notes,
    problemStatus,
    checked,
    ...(queue ? { queue } : {}),
  };
}

// ---------------------------------------------------------------------------
// Daily progress, streak and plan done
// ---------------------------------------------------------------------------

export function getProblemStatus(state: AppState, slug: string): ProblemStatus {
  return state.problemStatus[slug] ?? 'untouched';
}

export interface DayProgress {
  date: string;
  doneCount: number;
  loggedMs: number;
  /** >= 1 activity done and >= 30 minutes logged. */
  streakQualified: boolean;
}

/** Share of a day's core activities that must be done for the day's plan to count as done. */
export const PLAN_DONE_RATIO = 0.8;

/**
 * A day's plan is done when at least 80% of its core activities are done. A day without core
 * activities (`total` 0) is neither done nor missed.
 */
export function isPlanDone(doneCount: number, totalCount: number): boolean {
  return totalCount >= 1 && doneCount * 5 >= totalCount * 4;
}

/** Logged milliseconds of activities completed in the 7 days ending `today`, and of all time. */
export function loggedTotals(state: AppState, today: string): { last7DaysMs: number; allTimeMs: number } {
  const windowStart = addDays(today, -6);
  let last7DaysMs = 0;
  let allTimeMs = 0;
  for (const a of state.activities) {
    if (a.status !== 'done' || a.completedAt === undefined) continue;
    const ms = a.totalMs ?? 0;
    allTimeMs += ms;
    if (a.completedAt >= windowStart && a.completedAt <= today) last7DaysMs += ms;
  }
  return { last7DaysMs, allTimeMs };
}

/** Target minutes for `date`: 90 on consolidation days, otherwise the configured target. */
export function dailyTargetMinutes(settings: Settings, date: string): number {
  return isConsolidationDay(dayIndex(settings.startDate, date))
    ? CONSOLIDATION_TARGET_MIN
    : settings.dailyTargetMin;
}

export function dayProgress(state: AppState, date: string): DayProgress {
  let doneCount = 0;
  let loggedMs = 0;
  for (const a of state.activities) {
    if (a.status === 'done' && a.completedAt === date) {
      doneCount += 1;
      loggedMs += a.totalMs ?? 0;
    }
  }
  return {
    date,
    doneCount,
    loggedMs,
    streakQualified: doneCount >= 1 && loggedMs >= STREAK_MIN_LOGGED_MIN * 60_000,
  };
}

export interface Streak {
  current: number;
  longest: number;
}

/**
 * Consecutive qualifying days (see `DayProgress.streakQualified`). The current streak ends today,
 * or yesterday while today has not qualified yet.
 */
export function computeStreak(state: AppState, today: string): Streak {
  const loggedByDate = new Map<string, { count: number; ms: number }>();
  for (const a of state.activities) {
    if (a.status !== 'done' || a.completedAt === undefined) continue;
    const entry = loggedByDate.get(a.completedAt) ?? { count: 0, ms: 0 };
    entry.count += 1;
    entry.ms += a.totalMs ?? 0;
    loggedByDate.set(a.completedAt, entry);
  }
  const qualified = new Set<string>();
  for (const [date, entry] of loggedByDate) {
    if (entry.count >= 1 && entry.ms >= STREAK_MIN_LOGGED_MIN * 60_000) qualified.add(date);
  }

  let longest = 0;
  for (const date of qualified) {
    if (qualified.has(addDays(date, -1))) continue; // not the start of a run
    let length = 1;
    while (qualified.has(addDays(date, length))) length += 1;
    longest = Math.max(longest, length);
  }

  let cursor = qualified.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (qualified.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

// ---------------------------------------------------------------------------
// Problem statistics (roadmap counters)
// ---------------------------------------------------------------------------

export interface ProblemCounts {
  total: number;
  /** Status is not `untouched`, or the problem is checked manually. */
  worked: number;
  /** Status `reviewed` or `mastered` (solved solo in a review). */
  soloInReview: number;
  consolidating: number;
}

export interface CategoryStats extends ProblemCounts {
  category: string;
}

export interface ProblemStats {
  overall: ProblemCounts;
  byCategory: CategoryStats[];
  byDifficulty: Record<Difficulty, ProblemCounts>;
}

function emptyCounts(): ProblemCounts {
  return { total: 0, worked: 0, soloInReview: 0, consolidating: 0 };
}

/** Roadmap counters for a catalog (the NeetCode 150 unless `catalog` says otherwise); the state is shared. */
export function problemStats(state: AppState, catalog: CatalogId = 'neetcode150'): ProblemStats {
  const overall = emptyCounts();
  const byCategory = new Map<string, CategoryStats>(
    CATEGORY_NAMES.map((category) => [category, { category, ...emptyCounts() }]),
  );
  const byDifficulty: Record<Difficulty, ProblemCounts> = {
    Easy: emptyCounts(),
    Medium: emptyCounts(),
    Hard: emptyCounts(),
  };

  for (const problem of catalogProblems(catalog)) {
    const status = getProblemStatus(state, problem.slug);
    const buckets: ProblemCounts[] = [
      overall,
      byCategory.get(problem.category)!,
      byDifficulty[problem.difficulty],
    ];
    for (const bucket of buckets) {
      bucket.total += 1;
      if (status !== 'untouched' || state.checked[problem.slug]) bucket.worked += 1;
      if (status === 'reviewed' || status === 'mastered') bucket.soloInReview += 1;
      if (status === 'consolidating') bucket.consolidating += 1;
    }
  }

  return { overall, byCategory: [...byCategory.values()], byDifficulty };
}
