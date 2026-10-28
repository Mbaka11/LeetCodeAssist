/** Pure data behind the pace chart in Logs: monthly median logged minutes per difficulty. Informational only. */
import { getProblem } from '../data/neetcode150';
import { isReviewType } from './activities';
import { localDateFromTimestamp } from './dates';
import type { AppState, Difficulty } from './types';

/** Editorial interview-style reference lengths in minutes. They are a guideline, never measured data or a target. */
export const PACE_GUIDELINE_MINUTES: Readonly<Record<Difficulty, number>> = { Easy: 15, Medium: 30, Hard: 45 };
export const PACE_DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard'];
/** Fewer samples than this are drawn as "few samples" (hollow markers); the number is always shown. */
export const PACE_FEW_SAMPLES = 3;
/** The chart shows at most this many calendar months, ending with the latest month that has data. */
export const PACE_MAX_MONTHS = 12;

export interface PaceSample { median: number; count: number }
export interface PaceRow { month: string; first?: PaceSample; review?: PaceSample; simulation?: PaceSample }
export interface PacePanel { difficulty: Difficulty; guidelineMinutes: number; rows: PaceRow[] }
export interface PaceData {
  /** `YYYY-MM`, oldest first, contiguous (months without samples stay as gaps). */
  months: string[];
  panels: PacePanel[];
  hasData: boolean;
  /** Samples shown (after the month limit). */
  counts: { first: number; review: number; simulation: number };
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`;
}

type Kind = 'first' | 'review' | 'simulation';
interface Sample { month: string; difficulty: Difficulty; kind: Kind; minutes: number }

function samples(state: AppState): Sample[] {
  const out: Sample[] = [];
  for (const a of state.activities) {
    if (a.status !== 'done' || !a.completedAt || !a.totalMs || a.totalMs <= 0 || a.type === 'benchmark') continue;
    const problem = getProblem(a.slug);
    if (!problem) continue;
    out.push({ month: a.completedAt.slice(0, 7), difficulty: problem.difficulty,
      kind: isReviewType(a.type) ? 'review' : 'first', minutes: a.totalMs / 60_000 });
  }
  for (const s of Object.values(state.simulations ?? {})) {
    const problem = getProblem(s.slug);
    if (!problem || s.durationMs <= 0) continue;
    out.push({ month: localDateFromTimestamp(s.endedAt).slice(0, 7), difficulty: problem.difficulty, kind: 'simulation', minutes: s.durationMs / 60_000 });
  }
  return out;
}

/**
 * First attempts are `new` activities; reviews are every review type (including optional extra repeats).
 * Benchmarks, activities without logged time and problems outside the catalog are excluded. Simulation
 * durations form a separate series and are never merged into logged activity time.
 */
export function paceData(state: AppState): PaceData {
  const all = samples(state);
  const emptyPanels = PACE_DIFFICULTIES.map((difficulty) => ({ difficulty, guidelineMinutes: PACE_GUIDELINE_MINUTES[difficulty], rows: [] }));
  if (all.length === 0) return { months: [], panels: emptyPanels, hasData: false, counts: { first: 0, review: 0, simulation: 0 } };
  const sortedMonths = all.map((s) => s.month).sort();
  const last = sortedMonths.at(-1)!;
  let months: string[] = [];
  for (let m = sortedMonths[0]!; m <= last; m = nextMonth(m)) months.push(m);
  months = months.slice(-PACE_MAX_MONTHS);
  const counts = { first: 0, review: 0, simulation: 0 };
  const panels = PACE_DIFFICULTIES.map((difficulty): PacePanel => ({ difficulty, guidelineMinutes: PACE_GUIDELINE_MINUTES[difficulty],
    rows: months.map((month) => {
      const row: PaceRow = { month };
      for (const kind of ['first', 'review', 'simulation'] as const) {
        const minutes = all.filter((s) => s.month === month && s.difficulty === difficulty && s.kind === kind).map((s) => s.minutes);
        const mid = median(minutes);
        if (mid !== undefined) { row[kind] = { median: mid, count: minutes.length }; counts[kind] += minutes.length; }
      }
      return row;
    }) }));
  return { months, panels, hasData: true, counts };
}
