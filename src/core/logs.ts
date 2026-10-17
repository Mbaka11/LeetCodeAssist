/** Pure helpers behind the Logs page: one row per completed or skipped activity, filters, summary, CSV. */
import { getProblem } from '../data/neetcode150';
import { estimatedMinutes } from './activities';
import { dayIndex } from './dates';
import type { Activity, ActivityType, AppState, Difficulty, Outcome } from './types';

export type LogStatus = 'done' | 'skipped' | 'postponed';

export interface LogRow {
  /** Activity id. */
  id: string;
  /** Completion date, or the due date of a skipped activity (YYYY-MM-DD). */
  date: string;
  /** 1-based program day of `date` (<= 0 before the start date). */
  programDay: number;
  type: ActivityType;
  slug: string;
  /** Problem title (the slug for a problem outside NeetCode 150). */
  title: string;
  difficulty?: Difficulty;
  category?: string;
  /** Logged minutes of a completed activity. */
  loggedMinutes?: number;
  /** Minutes until "approach found". */
  approachMinutes?: number;
  /** Current budget (with the user's overrides) in minutes. */
  budgetMinutes: number;
  /** `loggedMinutes - budgetMinutes`: positive means over budget. */
  deltaMinutes?: number;
  outcome?: Outcome;
  hintsUsed: number;
  status: LogStatus;
}

/** Empty or undefined fields do not filter. Dates are inclusive YYYY-MM-DD. */
export interface LogFilters {
  type?: ActivityType;
  difficulty?: Difficulty;
  outcome?: Outcome;
  category?: string;
  from?: string;
  to?: string;
  /** Case-insensitive substring of the problem title. */
  search?: string;
}

export interface LogSummary {
  /** Rows after filtering (done and skipped). */
  count: number;
  doneCount: number;
  /** Logged minutes over the done rows. */
  totalMinutes: number;
  /** Average logged and budgeted minutes of the done rows; null without done rows. */
  averageMinutes: number | null;
  averageBudgetMinutes: number | null;
  /** Average of `logged - budget` over the done rows; null without done rows. */
  averageDeltaMinutes: number | null;
  /** Share (0-1) of the done rows with outcome `solo`; null without done rows. */
  soloRate: number | null;
}

function statusOf(activity: Activity): LogStatus {
  if (activity.status === 'done') return 'done';
  return activity.postponed ? 'postponed' : 'skipped';
}

function rowOf(state: AppState, activity: Activity): LogRow {
  const problem = getProblem(activity.slug);
  const done = activity.status === 'done';
  const date = done ? (activity.completedAt ?? activity.dueDate) : activity.dueDate;
  const budgetMinutes = estimatedMinutes(activity.type, activity.slug, state.settings.budgets);
  const loggedMinutes = done ? (activity.totalMs ?? 0) / 60_000 : undefined;
  return {
    id: activity.id,
    date,
    programDay: dayIndex(state.settings.startDate, date),
    type: activity.type,
    slug: activity.slug,
    title: problem?.title ?? activity.slug,
    ...(problem ? { difficulty: problem.difficulty, category: problem.category } : {}),
    ...(loggedMinutes !== undefined ? { loggedMinutes, deltaMinutes: loggedMinutes - budgetMinutes } : {}),
    ...(done && activity.approachMs !== undefined ? { approachMinutes: activity.approachMs / 60_000 } : {}),
    budgetMinutes,
    ...(activity.outcome ? { outcome: activity.outcome } : {}),
    hintsUsed: activity.hintsUsed ?? 0,
    status: statusOf(activity),
  };
}

/** Every done or skipped activity, newest first (ties: the one recorded later comes first). */
export function buildLogRows(state: AppState): LogRow[] {
  return state.activities
    .map((activity, order) => ({ activity, order }))
    .filter(({ activity }) => activity.status === 'done' || activity.status === 'skipped')
    .map(({ activity, order }) => ({ row: rowOf(state, activity), order }))
    .sort((a, b) => (a.row.date < b.row.date ? 1 : a.row.date > b.row.date ? -1 : b.order - a.order))
    .map(({ row }) => row);
}

export function filterLogRows(rows: readonly LogRow[], filters: LogFilters): LogRow[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  return rows.filter(
    (row) =>
      (!filters.type || row.type === filters.type) &&
      (!filters.difficulty || row.difficulty === filters.difficulty) &&
      (!filters.outcome || row.outcome === filters.outcome) &&
      (!filters.category || row.category === filters.category) &&
      (!filters.from || row.date >= filters.from) &&
      (!filters.to || row.date <= filters.to) &&
      (search === '' || row.title.toLowerCase().includes(search)),
  );
}

export function summarizeLogRows(rows: readonly LogRow[]): LogSummary {
  const done = rows.filter((row) => row.status === 'done');
  const totalMinutes = done.reduce((sum, row) => sum + (row.loggedMinutes ?? 0), 0);
  const totalBudget = done.reduce((sum, row) => sum + row.budgetMinutes, 0);
  const solo = done.filter((row) => row.outcome === 'solo').length;
  const hasDone = done.length > 0;
  return {
    count: rows.length,
    doneCount: done.length,
    totalMinutes,
    averageMinutes: hasDone ? totalMinutes / done.length : null,
    averageBudgetMinutes: hasDone ? totalBudget / done.length : null,
    averageDeltaMinutes: hasDone ? (totalMinutes - totalBudget) / done.length : null,
    soloRate: hasDone ? solo / done.length : null,
  };
}

export const CSV_HEADER = [
  'date',
  'program_day',
  'type',
  'problem',
  'slug',
  'difficulty',
  'category',
  'logged_min',
  'approach_min',
  'budget_min',
  'delta_min',
  'outcome',
  'hints_used',
  'status',
] as const;

function csvField(value: string | number | undefined): string {
  if (value === undefined) return '';
  const text = typeof value === 'number' ? String(Math.round(value * 10) / 10) : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV (CRLF line breaks, header first) of the given rows. */
export function logRowsToCsv(rows: readonly LogRow[]): string {
  const lines = rows.map((row) =>
    [
      row.date,
      row.programDay,
      row.type,
      row.title,
      row.slug,
      row.difficulty,
      row.category,
      row.loggedMinutes,
      row.approachMinutes,
      row.budgetMinutes,
      row.deltaMinutes,
      row.outcome,
      row.hintsUsed,
      row.status,
    ]
      .map(csvField)
      .join(','),
  );
  return [CSV_HEADER.join(','), ...lines].join('\r\n') + '\r\n';
}
