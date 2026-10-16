import { describe, expect, it } from 'vitest';
import { calendarDays } from './calendar';
import { materializePlan, planDay } from './planner';
import { START, day, newState, simulateDay } from './testing';
import { applyOutcome } from './reviews';

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
    expect(first.goalMet).toBe(true);
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

  it('keeps goal met and streak qualified as separate flags', () => {
    // 4 activities x 10 minutes: counts for the streak (>= 30) but not for the 150 minute goal.
    const state = simulateDay(newState(), day(1), { minutes: 10 }).state;
    const first = calendarDays(state, day(2))[0]!;
    expect(first.streakQualified).toBe(true);
    expect(first.goalMet).toBe(false);
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
