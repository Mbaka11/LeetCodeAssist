import { describe, expect, it } from 'vitest';
import { BONUS_POOL } from '../data/bonus';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import { createActivity } from './activities';
import { planDay } from './planner';
import { simulateDay, day, newState } from './testing';
import type { Activity, ActivityType, AppState } from './types';
import { workedTotals } from './worked';

function add(
  state: AppState,
  type: ActivityType,
  slug: string,
  patch: Partial<Activity> = { status: 'done', completedAt: day(1) },
): AppState {
  const activity = { ...createActivity(state.activities, { type, slug, dueDate: day(1), createdAt: day(1) }), ...patch };
  return { ...state, activities: [...state.activities, activity] };
}

const benchmarkSlugs = BENCHMARKS.flatMap((b) => [b.easy, b.medium]);

describe('workedTotals', () => {
  it('is empty for a fresh state and exposes the program and benchmark sizes', () => {
    expect(workedTotals(newState())).toEqual({
      program: 0,
      programTotal: 50,
      benchmark: 0,
      benchmarkTotal: 6,
      bonus: 0,
      other: 0,
      total: 0,
    });
  });

  it('adds 5 program + 2 benchmark + 1 bonus problems to 8', () => {
    let state = newState();
    for (const slug of PROGRAM_QUEUE.slice(0, 5)) state = add(state, 'new', slug);
    for (const slug of benchmarkSlugs.slice(0, 2)) state = add(state, 'benchmark', slug);
    state = add(state, 'new', BONUS_POOL[0]!);
    expect(workedTotals(state)).toMatchObject({ program: 5, benchmark: 2, bonus: 1, other: 0, total: 8 });
  });

  it('counts a problem once however many review attempts it has', () => {
    let state = newState();
    for (const slug of PROGRAM_QUEUE.slice(0, 5)) state = add(state, 'new', slug);
    for (const slug of benchmarkSlugs.slice(0, 2)) state = add(state, 'benchmark', slug);
    state = add(state, 'new', BONUS_POOL[0]!);
    for (const type of ['recall', 'rebuild', 'resolve', 'blind', 'retry'] as const) {
      for (const slug of [...PROGRAM_QUEUE.slice(0, 5), ...benchmarkSlugs.slice(0, 2), BONUS_POOL[0]!]) {
        state = add(state, type, slug);
      }
    }
    expect(workedTotals(state).total).toBe(8);
  });

  it('classifies a problem with only extra blind or resolve attempts exactly once', () => {
    let state = newState();
    state = add(state, 'blind', 'trapping-rain-water', { status: 'done', completedAt: day(2), extra: true });
    state = add(state, 'resolve', 'trapping-rain-water', { status: 'done', completedAt: day(3), extra: true });
    state = add(state, 'resolve', BONUS_POOL[1]!, { status: 'done', completedAt: day(2), extra: true });
    state = add(state, 'blind', BONUS_POOL[1]!, { status: 'done', completedAt: day(4), extra: true });
    expect(workedTotals(state)).toMatchObject({ program: 0, benchmark: 0, bonus: 1, other: 1, total: 2 });
  });

  it('puts a slug that has program history and extra attempts in the program bucket only', () => {
    const slug = PROGRAM_QUEUE[0]!;
    let state = add(newState(), 'new', slug);
    state = add(state, 'resolve', slug, { status: 'done', completedAt: day(5), extra: true });
    state = add(state, 'blind', slug, { status: 'done', completedAt: day(6), extra: true });
    const totals = workedTotals(state);
    expect(totals).toMatchObject({ program: 1, benchmark: 0, bonus: 0, other: 0, total: 1 });
    // A benchmark slug with extra attempts is a benchmark, never "other".
    state = add(state, 'resolve', benchmarkSlugs[0]!, { status: 'done', completedAt: day(5), extra: true });
    expect(workedTotals(state)).toMatchObject({ program: 1, benchmark: 1, other: 0, total: 2 });
  });

  it('ignores planned, skipped, in-progress and manually ticked problems', () => {
    let state = newState();
    state = add(state, 'new', PROGRAM_QUEUE[0]!, { status: 'planned' });
    state = add(state, 'new', PROGRAM_QUEUE[1]!, { status: 'skipped' });
    state = add(state, 'new', PROGRAM_QUEUE[2]!, { status: 'in_progress' });
    state = add(state, 'new', BONUS_POOL[0]!, { status: 'in_progress' });
    state = { ...state, checked: { [PROGRAM_QUEUE[3]!]: true, 'trapping-rain-water': true }, problemStatus: { [PROGRAM_QUEUE[4]!]: 'learning' } };
    expect(workedTotals(state).total).toBe(0);
  });

  it('is derived from the history of a played program: buckets are disjoint and sum to the total', () => {
    let state = newState();
    for (let d = 1; d <= 12; d += 1) state = simulateDay(state, day(d), { bonus: d % 2 === 0 }).state;
    const totals = workedTotals(state);
    expect(totals.program + totals.benchmark + totals.bonus + totals.other).toBe(totals.total);
    expect(totals.benchmark).toBe(2);
    expect(totals.bonus).toBeGreaterThan(0);
    const learned = new Set(
      state.activities.filter((a) => a.type === 'new' && a.status === 'done' && PROGRAM_QUEUE.includes(a.slug)).map((a) => a.slug),
    );
    expect(totals.program).toBe(learned.size);
    // Pending offers on the plan add nothing.
    expect(planDay(state, day(13)).bonuses.length).toBeGreaterThan(0);
    expect(workedTotals(state)).toEqual(totals);
  });
});
