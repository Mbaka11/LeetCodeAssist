import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGETS, createActivity } from './activities';
import { CALIBRATION_MARGIN, CALIBRATION_MIN_SAMPLES, calibrateBudgets } from './calibration';
import { complete, day, newState } from './testing';
import type { ActivityType, AppState } from './types';

const EASY = ['two-sum', 'valid-anagram', 'contains-duplicate', 'valid-palindrome', 'valid-parentheses', 'binary-search'];
const MEDIUM = ['group-anagrams', 'top-k-frequent-elements', '3sum', 'min-stack', 'daily-temperatures', 'search-a-2d-matrix'];

function finish(state: AppState, type: ActivityType, slug: string, minutes: number, patch: { extra?: boolean } = {}): AppState {
  const date = day(1);
  const activity = { ...createActivity(state.activities, { type, slug, dueDate: date, createdAt: date }), ...patch };
  return complete({ ...state, activities: [...state.activities, activity] }, activity.id, 'solo', date, minutes);
}

function withMinutes(type: ActivityType, slugs: string[], minutes: number[]): AppState {
  let state = newState();
  slugs.forEach((slug, i) => {
    state = finish(state, type, slug, minutes[i % minutes.length]!);
  });
  return state;
}

describe('calibrateBudgets', () => {
  it('suggests the median plus a 25 % margin, rounded up, for cells with enough samples', () => {
    const state = withMinutes('new', EASY, [10, 12, 14, 12, 30, 11]);
    const result = calibrateBudgets(state);
    expect(result.cells).toHaveLength(1);
    // Sorted 10, 11, 12, 12, 14, 30: median 12 -> 12 * 1.25 = 15.
    expect(result.cells[0]).toMatchObject({ type: 'new', difficulty: 'Easy', samples: 6, medianMinutes: 12, current: 15, suggested: 15 });
    expect(result.sampleCount).toBe(6);
    expect(result.table.new.Easy).toBe(15);
    expect(CALIBRATION_MARGIN).toBe(1.25);
  });

  it('leaves cells with too few samples at their current value, defaults or overrides', () => {
    const few = withMinutes('new', EASY.slice(0, CALIBRATION_MIN_SAMPLES - 1), [10]);
    const result = calibrateBudgets(few);
    expect(result.cells).toEqual([]);
    expect(result.table.new.Easy).toBe(DEFAULT_BUDGETS.new.Easy);
    const overridden = calibrateBudgets(few, { new: { Easy: 21 } });
    expect(overridden.table.new.Easy).toBe(21);
    expect(overridden.table.new.Medium).toBe(DEFAULT_BUDGETS.new.Medium);
  });

  it('calibrates each type and difficulty on its own', () => {
    let state = withMinutes('new', EASY, [10]);
    for (const [i, slug] of MEDIUM.entries()) state = finish(state, 'new', slug, 20 + i);
    for (const slug of MEDIUM) state = finish(state, 'resolve', slug, 8);
    const cells = calibrateBudgets(state).cells.map((c) => [c.type, c.difficulty, c.suggested]);
    // Easy new: 10 * 1.25 = 12.5 -> 13. Medium new: median of 20..25 is 22.5 * 1.25 = 28.1 -> 29. Re-solve: 8 * 1.25 = 10.
    expect(cells).toEqual([
      ['new', 'Easy', 13],
      ['new', 'Medium', 29],
      ['resolve', 'Medium', 10],
    ]);
  });

  it('ignores optional practice, benchmarks, unfinished and accidental (under 30 s) activities', () => {
    let state = newState();
    for (const slug of EASY) state = finish(state, 'new', slug, 10, { extra: true });
    for (const slug of EASY) state = finish(state, 'benchmark', slug, 10);
    const short = createActivity(state.activities, { type: 'new', slug: 'two-sum', dueDate: day(1), createdAt: day(1) });
    state = { ...state, activities: [...state.activities, { ...short, status: 'done', totalMs: 5_000, completedAt: day(1), outcome: 'solo' }] };
    expect(calibrateBudgets(state).cells).toEqual([]);
  });

  it('keeps suggestions inside the budget limits and is read-only', () => {
    const state = withMinutes('new', EASY, [170]);
    const before = structuredClone(state);
    expect(calibrateBudgets(state).table.new.Easy).toBe(180);
    expect(state).toEqual(before);
  });
});
