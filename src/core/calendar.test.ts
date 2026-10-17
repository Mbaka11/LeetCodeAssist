import { describe, expect, it } from 'vitest';
import { PROGRAM_QUEUE } from '../data/program';
import { calendarDays, programProgress } from './calendar';
import { createActivity } from './activities';
import { materializePlan, planDay } from './planner';
import { START, complete, day, newState, simulateDay } from './testing';
import { applyOutcome } from './reviews';
import type { Activity, ActivityType, AppState } from './types';

describe('calendarDays', () => {
  it('lists days 1-30 with markers and a highlighted today', () => {
    const days = calendarDays(newState(), day(1));
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ date: START, dayIndex: 1, kind: 'today', isBenchmark: true, overflow: false });
    expect(days.filter((d) => d.isConsolidation).map((d) => d.dayIndex)).toEqual([7, 14, 21, 28]);
    expect(days.filter((d) => d.isBenchmark).map((d) => d.dayIndex)).toEqual([1, 15, 30]);
    expect(days.filter((d) => d.kind === 'today')).toHaveLength(1);
    expect(days[1]!.kind).toBe('future');
  });

  it('plans today from the planner and expects the program on future days', () => {
    const state = newState();
    const days = calendarDays(state, day(1));
    const plan = planDay(state, day(1));
    expect(days[0]).toMatchObject({
      plannedCount: plan.items.length,
      plannedMinutes: plan.plannedMinutes,
      doneCount: 0,
      carriedCount: 0,
    });
    // Day 2: 2 expected new problems; consolidation day 7: nothing expected.
    expect(days[1]!.entries.map((e) => [e.type, e.state])).toEqual([
      ['new', 'expected'],
      ['new', 'expected'],
    ]);
    expect(days[6]!.entries).toEqual([]);
    // Day 15 is a benchmark day: the pair is expected.
    expect(days[14]!.entries.filter((e) => e.type === 'benchmark')).toHaveLength(2);
  });

  it('counts done work and logged minutes, and future scheduled reviews', () => {
    const state = simulateDay(newState(), day(1), { minutes: 40 }).state;
    const days = calendarDays(state, day(2));
    const first = days[0]!;
    expect(first.kind).toBe('past');
    expect(first.doneCount).toBe(first.plannedCount);
    expect(first.loggedMinutes).toBe(first.doneCount * 40);
    expect(first.carriedCount).toBe(0);
    expect(first.streakQualified).toBe(true);
    expect(first.planDone).toBe(true);
    // Recalls scheduled for day 2 are part of day 2's plan (today).
    expect(days[1]!.entries.some((e) => e.type === 'recall' && e.state === 'open')).toBe(true);
    // Rebuilds are scheduled on day 4 (a future day): shown as open reviews.
    expect(days[3]!.entries.some((e) => e.type === 'rebuild' && e.state === 'open')).toBe(true);
  });

  it('marks unfinished reviews of past days as carried and keeps carried-in work on the day it was done', () => {
    let state = simulateDay(newState(), day(1)).state;
    // Day 2 is skipped entirely. On day 3 the recalls (due day 2) are done late.
    const plan3 = planDay(state, day(3));
    state = materializePlan(state, plan3);
    const lateRecall = plan3.items.find((i) => i.activity.type === 'recall')!;
    state = applyOutcome(state, lateRecall.activity.id, {
      outcome: 'solo',
      completedDate: day(3),
      now: 0,
      totalMs: 5 * 60_000,
    });
    const days = calendarDays(state, day(3));
    const second = days[1]!;
    expect(second.kind).toBe('past');
    expect(second.doneCount).toBe(0);
    expect(second.carriedCount).toBeGreaterThanOrEqual(1);
    expect(second.entries.find((e) => e.id === lateRecall.activity.id)?.state).toBe('carried');
    const third = days[2]!;
    expect(third.doneCount).toBe(1);
    expect(third.entries.find((e) => e.id === lateRecall.activity.id)).toMatchObject({
      state: 'done',
      loggedMinutes: 5,
    });
  });

  it('shows carried-over reviews on today when they do not fit the cap', () => {
    // Many overdue reviews: complete 3 problems per day for a week, skip the rest, then return.
    let state = newState();
    for (const n of [1, 2, 3, 4, 5, 6]) state = simulateDay(state, day(n), { bonus: true }).state;
    const plan = planDay(state, day(10));
    const days = calendarDays(state, day(10));
    const today = days.find((d) => d.kind === 'today')!;
    expect(today.carriedCount).toBe(plan.carriedOver.length);
    expect(today.entries.filter((e) => e.state === 'carried')).toHaveLength(plan.carriedOver.length);
  });

  it('keeps plan done and streak qualified as separate flags', () => {
    // Everything planned is done, but only 10 minutes in total: plan done without a streak day.
    const state = simulateDay(newState(), day(1), { minutes: 2 }).state;
    const first = calendarDays(state, day(2))[0]!;
    expect(first.planDone).toBe(true);
    expect(first.streakQualified).toBe(false);
  });

  it('adds overflow days that have reviews and today when it is past day 30', () => {
    // Learn problems on day 29: resolve lands on day 36 and blind on day 50.
    let state = newState();
    state = simulateDay(state, day(29)).state;
    const days = calendarDays(state, day(30));
    const overflow = days.filter((d) => d.overflow);
    expect(overflow.map((d) => d.dayIndex)).toEqual([32, 36, 50]);
    expect(overflow.every((d) => d.kind === 'future' && d.entries.length > 0)).toBe(true);

    const later = calendarDays(state, day(40));
    expect(later.filter((d) => d.overflow).map((d) => d.dayIndex)).toEqual([32, 36, 40, 50]);
    expect(later.find((d) => d.dayIndex === 40)?.kind).toBe('today');
  });
});

describe('calendar entries: movable and postponable', () => {
  it('flags planned reviews as movable and unfinished queue problems as postponable', () => {
    const state = simulateDay(newState(), day(1)).state;
    const days = calendarDays(state, day(2));
    const recalls = days[1]!.entries.filter((e) => e.type === 'recall');
    expect(recalls.length).toBeGreaterThan(0);
    expect(recalls.every((e) => e.movable && !e.postponable)).toBe(true);
    // Future reviews can be moved too; the expected program work cannot.
    expect(days[3]!.entries.filter((e) => e.type === 'rebuild').every((e) => e.movable)).toBe(true);
    expect(days[2]!.entries.filter((e) => e.state === 'expected').every((e) => !e.movable && !e.postponable)).toBe(true);
    // Today's new problems are postponable, finished ones are not.
    const first = calendarDays(newState(), day(1))[0]!;
    expect(first.entries.filter((e) => e.type === 'new').every((e) => e.postponable && !e.movable)).toBe(true);
    expect(first.entries.filter((e) => e.type === 'benchmark').every((e) => !e.postponable && !e.movable)).toBe(true);
    const done = calendarDays(state, day(2))[0]!;
    expect(done.entries.filter((e) => e.state === 'done').every((e) => !e.movable && !e.postponable)).toBe(true);
  });
});

describe('postponed problems', () => {
  it("do not count as planned: today's planned count is the plan, not plan plus the postponed problem", () => {
    const base = materializePlan(newState(), planDay(newState(), day(1)));
    const target = base.activities.find((a) => a.type === 'new')!;
    const state = {
      ...base,
      activities: base.activities.map((a) =>
        a.id === target.id ? { ...a, status: 'skipped' as const, postponed: true } : a,
      ),
    };
    const first = calendarDays(state, day(1))[0]!;
    expect(first.plannedCount).toBe(planDay(state, day(1)).items.length);
    expect(first.plannedCount).toBe(calendarDays(base, day(1))[0]!.plannedCount);
  });
});

describe('programProgress', () => {
  it('counts learned program problems and elapsed program days', () => {
    expect(programProgress(newState(), day(1))).toEqual({
      learned: 0,
      totalProblems: PROGRAM_QUEUE.length,
      daysElapsed: 1,
      totalDays: 30,
    });
    const state = simulateDay(simulateDay(newState(), day(1)).state, day(2)).state;
    const progress = programProgress(state, day(3));
    expect(progress.learned).toBe(state.activities.filter((a) => a.type === 'new' && a.status === 'done').length);
    expect(progress.learned).toBeGreaterThanOrEqual(4);
    expect(progress.daysElapsed).toBe(3);
  });

  it('clamps the elapsed days before the start and after day 30, and ignores non-program problems', () => {
    expect(programProgress(newState(), day(-5)).daysElapsed).toBe(0);
    expect(programProgress(newState(), day(45)).daysElapsed).toBe(30);
  });
});

describe('plan done', () => {
  interface Seed {
    type: ActivityType;
    slug: string;
    status?: Activity['status'];
    extra?: boolean;
    postponed?: boolean;
  }

  /** State whose only activities are the given ones, all due on `date`; done ones completed on it. */
  function stateWith(date: string, seeds: Seed[]): AppState {
    const state = newState();
    const activities: Activity[] = [];
    for (const seed of seeds) {
      const base = createActivity(activities, {
        type: seed.type,
        slug: seed.slug,
        dueDate: date,
        createdAt: date,
        ...(seed.extra ? { extra: true } : {}),
      });
      const status = seed.status ?? 'planned';
      activities.push({
        ...base,
        status,
        ...(status === 'done' ? { completedAt: date, outcome: 'solo' as const, totalMs: 20 * 60_000 } : {}),
        ...(seed.postponed ? { postponed: true } : {}),
      });
    }
    return { ...state, activities };
  }

  const dayTwo = (state: AppState, today = day(3)) => calendarDays(state, today)[1]!;

  it('is done when every core activity is done', () => {
    const state = stateWith(day(2), [
      { type: 'new', slug: 'two-sum', status: 'done' },
      { type: 'new', slug: 'valid-anagram', status: 'done' },
    ]);
    expect(dayTwo(state)).toMatchObject({ coreCount: 2, coreDoneCount: 2, planDone: true });
  });

  it('is not done with one of two core activities done, and skipped ones count as not done', () => {
    const open = stateWith(day(2), [
      { type: 'new', slug: 'two-sum', status: 'done' },
      { type: 'new', slug: 'valid-anagram' },
    ]);
    expect(dayTwo(open)).toMatchObject({ coreCount: 2, coreDoneCount: 1, planDone: false });
    const skipped = stateWith(day(2), [
      { type: 'new', slug: 'two-sum', status: 'done' },
      { type: 'new', slug: 'valid-anagram', status: 'skipped' },
    ]);
    expect(dayTwo(skipped)).toMatchObject({ coreCount: 2, coreDoneCount: 1, planDone: false });
  });

  it('reaches 80% with four of five done', () => {
    const state = stateWith(day(2), [
      { type: 'benchmark', slug: 'two-sum', status: 'done' },
      { type: 'benchmark', slug: 'valid-anagram', status: 'done' },
      { type: 'resolve', slug: 'contains-duplicate', status: 'done' },
      { type: 'resolve', slug: 'group-anagrams', status: 'done' },
      { type: 'resolve', slug: 'top-k-frequent-elements' },
    ]);
    expect(dayTwo(state)).toMatchObject({ coreCount: 5, coreDoneCount: 4, planDone: true });
  });

  it('leaves out the unstarted bonus, postponed problems and optional practice', () => {
    const state = stateWith(day(2), [
      { type: 'new', slug: 'two-sum', status: 'done' },
      { type: 'new', slug: 'valid-anagram', status: 'done' },
      { type: 'new', slug: 'top-k-frequent-elements' }, // unstarted third problem, not Easy: the bonus
      { type: 'new', slug: 'group-anagrams', status: 'skipped', postponed: true },
      { type: 'blind', slug: 'two-sum', status: 'done', extra: true },
      { type: 'blind', slug: 'valid-anagram', extra: true },
    ]);
    expect(dayTwo(state)).toMatchObject({ coreCount: 2, coreDoneCount: 2, planDone: true });
  });

  it('counts a third Easy new problem as core, not as the bonus', () => {
    const state = stateWith(day(2), [
      { type: 'new', slug: 'two-sum', status: 'done' },
      { type: 'new', slug: 'valid-anagram', status: 'done' },
      { type: 'new', slug: 'valid-palindrome' }, // Easy: the soft-overflow third problem
    ]);
    expect(dayTwo(state)).toMatchObject({ coreCount: 3, coreDoneCount: 2, planDone: false });
  });

  it('is neither done nor counted on a day without core activities', () => {
    const empty = dayTwo(newState());
    expect(empty).toMatchObject({ coreCount: 0, coreDoneCount: 0, planDone: false });
    const onlyOptional = stateWith(day(2), [{ type: 'blind', slug: 'two-sum', status: 'done', extra: true }]);
    expect(dayTwo(onlyOptional)).toMatchObject({ coreCount: 0, planDone: false });
  });

  it('counts a day with only the benchmark pair', () => {
    const pair = [
      { type: 'benchmark' as const, slug: 'contains-duplicate' },
      { type: 'benchmark' as const, slug: 'two-sum' },
    ];
    const half = stateWith(day(2), [{ ...pair[0]!, status: 'done' as const }, pair[1]!]);
    expect(dayTwo(half)).toMatchObject({ coreCount: 2, coreDoneCount: 1, planDone: false });
    const both = stateWith(day(2), pair.map((p) => ({ ...p, status: 'done' as const })));
    expect(dayTwo(both)).toMatchObject({ coreCount: 2, coreDoneCount: 2, planDone: true });
  });

  it('judges the current day by its progress so far, and never a future day', () => {
    const fresh = calendarDays(newState(), day(1))[0]!;
    expect(fresh).toMatchObject({ kind: 'today', planDone: false });
    expect(fresh.coreCount).toBeGreaterThan(0);
    expect(fresh.coreDoneCount).toBe(0);
    const done = simulateDay(newState(), day(1)).state;
    const today = calendarDays(done, day(1))[0]!;
    expect(today).toMatchObject({ kind: 'today', planDone: true });
    expect(today.coreDoneCount).toBe(today.coreCount);
    const future = calendarDays(newState(), day(1))[1]!;
    expect(future).toMatchObject({ kind: 'future', coreCount: 0, planDone: false });
  });

  it('does not count a review finished after its day', () => {
    let state = simulateDay(newState(), day(1)).state;
    const plan3 = planDay(state, day(3));
    state = materializePlan(state, plan3);
    const late = plan3.items.find((i) => i.activity.type === 'recall' && i.activity.dueDate === day(2))!;
    state = complete(state, late.activity.id, 'solo', day(3));
    const second = calendarDays(state, day(3))[1]!;
    expect(second.coreDoneCount).toBe(0);
    expect(second.planDone).toBe(false);
  });
});

describe('bonus-pool problems in the calendar', () => {
  it('flags the bonus entries, does not plan them or let them be postponed, and keeps the program counter', () => {
    const base = materializePlan(newState(), planDay(newState(), day(1)));
    const today = calendarDays(base, day(1))[0]!;
    const bonus = today.entries.filter((e) => e.bonus);
    expect(bonus).toHaveLength(2);
    expect(bonus[0]).toMatchObject({ type: 'new', postponable: false, state: 'open' });
    expect(today.entries.filter((e) => e.type === 'new' && !e.bonus).every((e) => e.postponable)).toBe(true);
    expect(today.plannedCount).toBe(planDay(base, day(1)).items.length);

    const done = simulateDay(newState(), day(1), { bonus: true }).state;
    expect(programProgress(done, day(2)).learned).toBe(2);
    const doneBonus = done.activities.find((a) => a.id === bonus[0]!.id)!;
    expect(doneBonus.status).toBe('done');

    const later = calendarDays(done, day(3))[0]!;
    expect(later.entries.find((e) => e.bonus)).toMatchObject({ id: bonus[0]!.id, state: 'done' });
  });

  it('keeps offers and finished bonuses out of planned, core and plan-done counts', () => {
    const base = materializePlan(newState(), planDay(newState(), day(1)));
    const plan = planDay(base, day(1));
    const before = calendarDays(base, day(1))[0]!;
    expect(before.plannedCount).toBe(plan.items.length);
    expect(before.plannedMinutes).toBe(plan.plannedMinutes);
    expect(before.coreCount).toBe(plan.items.length);

    // Finish both offers and one core item: only the core item counts for the plan-done ratio.
    let state = base;
    for (const offer of plan.bonuses) state = complete(state, offer.activity.id, 'solo', day(1), 30);
    state = complete(state, plan.items[0]!.activity.id, 'solo', day(1), 10);
    const after = calendarDays(state, day(1))[0]!;
    expect(after.plannedCount).toBe(plan.items.length);
    expect(after.plannedMinutes).toBe(plan.plannedMinutes);
    expect(after.coreCount).toBe(plan.items.length);
    expect(after.coreDoneCount).toBe(1);
    expect(after.planDone).toBe(false);
    // Their time is logged and they are listed as done bonus entries on the day they were completed.
    expect(after.doneCount).toBe(3);
    expect(after.loggedMinutes).toBe(70);
    expect(after.entries.filter((e) => e.bonus && e.state === 'done')).toHaveLength(2);
  });

  it('lists a bonus on the day it was completed, not on the day an older offer was created', () => {
    const base = materializePlan(newState(), planDay(newState(), day(1)));
    const offer = planDay(base, day(5)).bonuses[0]!;
    const state = complete(base, offer.activity.id, 'solo', day(5), 30);
    const days = calendarDays(state, day(6));
    const entriesOf = (n: number) => days[n - 1]!.entries.filter((e) => e.id === offer.activity.id);
    expect(entriesOf(1)).toHaveLength(0);
    expect(entriesOf(5)).toMatchObject([{ state: 'done', bonus: true }]);
  });
});
