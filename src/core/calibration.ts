/**
 * Calibrating the time budgets from the user's own finished activities (Settings -> Time budgets). Pure and
 * read-only: it only suggests numbers; the user reviews them and saves them like any other budget edit.
 *
 * Rule. For every activity type and difficulty with at least `CALIBRATION_MIN_SAMPLES` finished, non-optional
 * activities with a measured time, the suggestion is the median logged time plus a margin of 25 %, rounded up
 * and kept within the budget limits. The median ignores the odd forgotten timer. Cells without enough samples are
 * left as they are. Benchmarks (flat 30 minutes) and optional practice are not used.
 */
import { getProblem } from '../data/neetcode150';
import { BUDGETED_TYPES, DIFFICULTIES, effectiveBudgets } from './activities';
import { median } from './pace';
import { BUDGET_MAX_MINUTES, BUDGET_MIN_MINUTES } from './state';
import type { AppState, BudgetOverrides, BudgetedType, Difficulty } from './types';

/** Safety margin added on top of the median (1.25 = 25 % more time than the user usually needs). */
export const CALIBRATION_MARGIN = 1.25;

/** Finished activities needed in a cell before it is calibrated. */
export const CALIBRATION_MIN_SAMPLES = 5;

/** Activities logged for less than this are treated as accidental and ignored. */
const MIN_SAMPLE_MS = 30_000;

export interface CalibrationCell {
  type: BudgetedType;
  difficulty: Difficulty;
  samples: number;
  /** Median logged minutes. */
  medianMinutes: number;
  /** Budget now in effect (default or the user's override). */
  current: number;
  /** Median plus the margin, rounded up. */
  suggested: number;
}

export interface Calibration {
  /** Cells with enough samples, in table order. */
  cells: CalibrationCell[];
  /** Finished activities that fed the cells with enough samples. */
  sampleCount: number;
  /** The full budget table to show: suggestions in the calibrated cells, the current value elsewhere. */
  table: Record<BudgetedType, Record<Difficulty, number>>;
}

export function calibrateBudgets(state: AppState, overrides: BudgetOverrides | undefined = state.settings.budgets): Calibration {
  const minutes = new Map<string, number[]>();
  for (const a of state.activities) {
    if (a.status !== 'done' || a.extra || a.type === 'benchmark') continue;
    if (a.totalMs === undefined || a.totalMs < MIN_SAMPLE_MS) continue;
    const difficulty = getProblem(a.slug)?.difficulty ?? 'Medium';
    const key = `${a.type}/${difficulty}`;
    const list = minutes.get(key) ?? [];
    list.push(a.totalMs / 60_000);
    minutes.set(key, list);
  }

  const current = effectiveBudgets(overrides);
  const table = effectiveBudgets(overrides);
  const cells: CalibrationCell[] = [];
  let sampleCount = 0;
  for (const type of BUDGETED_TYPES) {
    for (const difficulty of DIFFICULTIES) {
      const list = minutes.get(`${type}/${difficulty}`) ?? [];
      if (list.length < CALIBRATION_MIN_SAMPLES) continue;
      const mid = median(list)!;
      const suggested = Math.min(BUDGET_MAX_MINUTES, Math.max(BUDGET_MIN_MINUTES, Math.ceil(mid * CALIBRATION_MARGIN)));
      cells.push({ type, difficulty, samples: list.length, medianMinutes: mid, current: current[type][difficulty], suggested });
      table[type][difficulty] = suggested;
      sampleCount += list.length;
    }
  }
  return { cells, sampleCount, table };
}
