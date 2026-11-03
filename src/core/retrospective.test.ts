import { describe, expect, it } from 'vitest';
import { BENCHMARKS, PHASE_ONE_QUEUE, PHASE_TWO_QUEUE } from '../data/program';
import { createActivity } from './activities';
import {
  RETROSPECTIVE_PHASES,
  WEAK_CATEGORY_MIN_ATTEMPTS,
  programRetrospective,
  visibleRetrospectives,
} from './retrospective';
import { complete, day, newState, simulateDay } from './testing';
import type { AppState, Outcome } from './types';

const [PHASE_ONE, PHASE_TWO] = RETROSPECTIVE_PHASES as [(typeof RETROSPECTIVE_PHASES)[number], (typeof RETROSPECTIVE_PHASES)[number]];

function run(days: number, outcome: Outcome = 'solo'): AppState {
  let state = newState();
  for (let d = 1; d <= days; d += 1) state = simulateDay(state, day(d), { outcome }).state;
  return state;
}

function finished(state: AppState, slug: string, type: 'new' | 'recall' | 'rebuild' | 'resolve' | 'blind', date: string, outcome: Outcome, minutes: number): AppState {
  const activity = createActivity(state.activities, { type, slug, dueDate: date, createdAt: date });
  return complete({ ...state, activities: [...state.activities, activity] }, activity.id, outcome, date, minutes);
}

describe('RETROSPECTIVE_PHASES', () => {
  it('covers days 1-30 and 31-60 with the matching halves of the queue', () => {
    expect(RETROSPECTIVE_PHASES.map((p) => [p.fromDay, p.toDay])).toEqual([[1, 30], [31, 60]]);
    expect(PHASE_ONE.queue).toBe(PHASE_ONE_QUEUE);
    expect(PHASE_TWO.queue).toBe(PHASE_TWO_QUEUE);
  });
});

describe('programRetrospective: the Day 30 retrospective of a perfect user', () => {
  const state = run(30);
  const r = programRetrospective(state, PHASE_ONE, day(30));

  it('is reached on day 30 and spans the first 30 dates', () => {
    expect(r.reached).toBe(true);
    expect(r.startDate).toBe(day(1));
    expect(r.endDate).toBe(day(30));
  });

  it('counts the phase 1 problems learned, all of them solo', () => {
    expect(r.learned).toEqual({ count: PHASE_ONE_QUEUE.length, total: PHASE_ONE_QUEUE.length, solo: PHASE_ONE_QUEUE.length });
  });

  it('counts practised days and plan-done days', () => {
    expect(r.days.elapsed).toBe(30);
    expect(r.days.active).toBe(30);
    expect(r.days.planDone).toBe(r.days.planDays);
    expect(r.days.planDays).toBeGreaterThan(20);
    expect(r.loggedMinutes).toBeGreaterThan(30 * 30);
  });

  it('reports each review type once, in order, with solo counts and median minutes', () => {
    expect(r.reviews.map((x) => x.type)).toEqual(['recall', 'rebuild', 'resolve', 'blind']);
    for (const row of r.reviews) {
      expect(row.solo).toBe(row.attempts);
      expect(row.medianMinutes).toBeGreaterThan(0);
    }
  });

  it('lists the three benchmark pairs of the phase with their results', () => {
    expect(r.benchmarks.map((b) => b.day)).toEqual([1, 15, 30]);
    for (const benchmark of r.benchmarks) {
      expect(benchmark.lighter).toMatchObject({ done: true, outcome: 'solo' });
      expect(benchmark.harder).toMatchObject({ done: true, outcome: 'solo' });
    }
    expect(r.benchmarks[0]!.lighter.slug).toBe(BENCHMARKS[0]!.easy);
  });

  it('has no weak category for a user who never needed help', () => {
    expect(r.weakCategories).toEqual([]);
  });
});

describe('programRetrospective: before the end of the phase', () => {
  it('is not reached on day 12 and only counts the days that have started', () => {
    const r = programRetrospective(run(11), PHASE_ONE, day(12));
    expect(r.reached).toBe(false);
    expect(r.days.elapsed).toBe(12);
    expect(r.days.active).toBe(11);
  });

  it('shows nothing for a program that has not started', () => {
    const r = programRetrospective(newState(), PHASE_ONE, day(-3));
    expect(r.reached).toBe(false);
    expect(r.days).toMatchObject({ elapsed: 0, active: 0, planDone: 0 });
    expect(r.learned.count).toBe(0);
    expect(r.reviews).toEqual([]);
  });
});

describe('programRetrospective: phase windows', () => {
  const state = run(60);

  it('keeps phase 2 separate from phase 1', () => {
    const one = programRetrospective(state, PHASE_ONE, day(60));
    const two = programRetrospective(state, PHASE_TWO, day(60));
    expect(two.reached).toBe(true);
    expect(two.startDate).toBe(day(31));
    expect(two.days.elapsed).toBe(30);
    expect(one.learned.count).toBe(PHASE_ONE_QUEUE.length);
    expect(two.learned.count).toBeGreaterThan(0);
    expect(two.learned.total).toBe(PHASE_TWO_QUEUE.length);
    expect(two.benchmarks.map((b) => b.day)).toEqual([45, 60]);
    expect(two.benchmarks.every((b) => b.lighter.done && b.harder.done)).toBe(true);
  });

  it('counts a phase 2 problem that was learned early, and nothing learned after the phase ended', () => {
    const early = programRetrospective(run(30), PHASE_TWO, day(30));
    expect(early.reached).toBe(false);
    expect(early.learned.count).toBe(1); // the planner reaches into the queue on day 30
    const state = run(60);
    const lateOnly = programRetrospective(state, PHASE_ONE, day(60));
    expect(lateOnly.learned.count).toBe(PHASE_ONE_QUEUE.length);
    // A phase 1 problem first finished on day 45 is outside the day 30 window.
    const never = programRetrospective(finished(newState(), 'two-sum', 'new', day(45), 'solo', 20), PHASE_ONE, day(60));
    expect(never.learned.count).toBe(0);
  });
});

describe('programRetrospective: weak categories and outcomes', () => {
  it('ranks categories by the share of attempts that needed help and ignores small samples', () => {
    let state = newState();
    // Stack: 3 of 4 attempts needed help. Trees: 2 of 2 (below the minimum sample). Arrays: 0 of 3.
    const stack = ['valid-parentheses', 'min-stack', 'daily-temperatures', 'valid-parentheses'] as const;
    const outcomes: Outcome[] = ['solo', 'hint', 'stuck', 'solution'];
    stack.forEach((slug, i) => {
      state = finished(state, slug, i === 0 ? 'new' : 'recall', day(2 + i), outcomes[i]!, 20);
    });
    state = finished(state, 'invert-binary-tree', 'new', day(8), 'hint', 25);
    state = finished(state, 'same-tree', 'new', day(9), 'solution', 25);
    for (const [i, slug] of (['two-sum', 'valid-anagram', 'group-anagrams'] as const).entries()) {
      state = finished(state, slug, 'new', day(10 + i), 'solo', 15);
    }
    const r = programRetrospective(state, PHASE_ONE, day(30));
    expect(WEAK_CATEGORY_MIN_ATTEMPTS).toBe(3);
    expect(r.weakCategories).toEqual([{ category: 'Stack', attempts: 4, notSolo: 3 }]);
  });

  it('ignores optional practice and counts a failed first attempt as not solo', () => {
    let state = finished(newState(), 'two-sum', 'new', day(1), 'hint', 20);
    const practice = createActivity(state.activities, { type: 'blind', slug: 'two-sum', dueDate: day(5), createdAt: day(5) });
    state = complete({ ...state, activities: [...state.activities, { ...practice, extra: true }] }, practice.id, 'solo', day(5), 10);
    const r = programRetrospective(state, PHASE_ONE, day(30));
    expect(r.learned).toMatchObject({ count: 1, solo: 0 });
    expect(r.reviews).toEqual([]);
  });

  it('is read-only', () => {
    const state = run(10);
    const snapshot = structuredClone(state);
    programRetrospective(state, PHASE_ONE, day(30));
    visibleRetrospectives(state, day(30));
    expect(state).toEqual(snapshot);
  });
});

describe('visibleRetrospectives', () => {
  const state = newState();

  it('shows nothing early, the Day 30 card as locked from day 23, and both once reached', () => {
    expect(visibleRetrospectives(state, day(10))).toEqual([]);
    const locked = visibleRetrospectives(state, day(23));
    expect(locked.map((r) => [r.phase.id, r.reached])).toEqual([['phase1', false]]);
    const afterOne = visibleRetrospectives(state, day(31));
    expect(afterOne.map((r) => [r.phase.id, r.reached])).toEqual([['phase1', true]]);
    const nearTwo = visibleRetrospectives(state, day(53));
    expect(nearTwo.map((r) => [r.phase.id, r.reached])).toEqual([['phase1', true], ['phase2', false]]);
    const done = visibleRetrospectives(state, day(60));
    expect(done.map((r) => [r.phase.id, r.reached])).toEqual([['phase1', true], ['phase2', true]]);
  });
});
