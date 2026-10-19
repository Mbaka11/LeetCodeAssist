import { describe, expect, it } from 'vitest';
import { calendarDays } from '../core/calendar';
import { buildLogRows } from '../core/logs';
import { planDay } from '../core/planner';
import { dayProgress, defaultState, deserializeState, serializeState } from '../core/state';
import { START, day, newState } from '../core/testing';
import type { AppState } from '../core/types';
import { workedTotals } from '../core/worked';
import { BENCHMARKS } from '../data/program';
import { createActions } from './actions';
import * as commands from './commands';
import { createTestApp } from './testing';

function at(date: string, hour = 0, minute = 0): number {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
}

function overnight() {
  const state = commands.materializeToday(newState(), at(START, 23, 40));
  const activity = state.activities.find((a) => a.type === 'new')!;
  return { state: commands.startActivity(state, activity.id, at(START, 23, 40)), activity, now: at(day(2), 0, 10) };
}

function expectAbsentFromToday(state: AppState, id: string, today: string) {
  const plan = planDay(state, today);
  expect([...plan.items, ...plan.carriedOver, ...plan.bonuses].some((item) => item.activity.id === id)).toBe(false);
  expect(calendarDays(state, today).find((d) => d.date === today)!.entries.some((e) => e.id === id)).toBe(false);
}

describe('today / yesterday completion dates', () => {
  it('records an overnight activity yesterday without rewinding the clock or changing its identity', () => {
    const { state, activity, now } = overnight();
    const next = commands.completeActivity(state, activity.id, { outcome: 'solo', completedDate: START }, now);
    const done = next.activities.find((a) => a.id === activity.id)!;
    expect(done).toMatchObject({
      id: activity.id, dueDate: START, createdAt: START, completedAt: START, status: 'done',
      totalMs: 30 * 60_000, timer: { running: false, startedAt: null, accumulatedMs: 30 * 60_000 },
    });
    expect(next.activities.filter((a) => a.slug === activity.slug && a.type !== 'new').map((a) => [a.type, a.dueDate])).toEqual([
      ['recall', day(2)], ['rebuild', day(4)], ['resolve', day(8)], ['blind', day(22)],
    ]);
    expect(dayProgress(next, START)).toMatchObject({ doneCount: 1, loggedMs: 30 * 60_000, streakQualified: true });
    expect(dayProgress(next, day(2))).toMatchObject({ doneCount: 0, loggedMs: 0 });
    expect(buildLogRows(next).find((row) => row.id === activity.id)?.date).toBe(START);
    expect(calendarDays(next, day(2)).find((d) => d.date === START)!.entries.find((e) => e.id === activity.id)?.state).toBe('done');
    expectAbsentFromToday(next, activity.id, day(2));
    expect(planDay(next, day(2)).items.some((i) => i.activity.slug === activity.slug && i.activity.type === 'recall')).toBe(true);
    expect(workedTotals(next)).toMatchObject({ program: 1, total: 1 });
    expect(deserializeState(serializeState(next))).toEqual(next);
  });

  it('counts a regenerated new-problem card as fulfilling yesterday’s unstarted plan, not as done plus missed', () => {
    const yesterday = commands.materializeToday(newState(), at(START, 23, 50));
    const original = yesterday.activities.find((a) => a.type === 'new')!;
    const today = commands.materializeToday(yesterday, at(day(2), 0, 10));
    const replacement = today.activities.find((a) => a.type === 'new' && a.slug === original.slug && a.dueDate === day(2))!;
    expect(replacement.id).not.toBe(original.id);
    const next = commands.completeActivity(today, replacement.id, { outcome: 'solo', totalMs: 30 * 60_000, completedDate: START }, at(day(2), 0, 15));
    const previousDay = calendarDays(next, day(2)).find((d) => d.date === START)!;
    const entries = previousDay.entries.filter((e) => e.slug === original.slug && e.type === 'new');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: replacement.id, state: 'done' });
    expect(previousDay.coreDoneCount).toBe(1);
    expect(previousDay.coreCount).toBe(calendarDays(yesterday, START)[0]!.coreCount);
    // The unstarted planning record is retained for history, never silently deleted or rewritten.
    expect(next.activities.find((a) => a.id === original.id)).toEqual(original);
    expectAbsentFromToday(next, replacement.id, day(2));
  });

  it('does not hide a missed day when the regenerated problem is genuinely completed today', () => {
    const yesterday = commands.materializeToday(newState(), at(START, 23, 50));
    const original = yesterday.activities.find((a) => a.type === 'new')!;
    const today = commands.materializeToday(yesterday, at(day(2), 0, 10));
    const replacement = today.activities.find((a) => a.type === 'new' && a.slug === original.slug && a.dueDate === day(2))!;
    const next = commands.completeActivity(today, replacement.id, { outcome: 'solo', totalMs: 30 * 60_000 }, at(day(2), 0, 15));
    const previousDay = calendarDays(next, day(2)).find((d) => d.date === START)!;
    expect(previousDay.entries.find((e) => e.id === original.id)?.state).toBe('missed');
    expect(previousDay.coreDoneCount).toBe(0);
  });

  it('does not fold a genuinely started older attempt into a backdated result', () => {
    const yesterday = commands.materializeToday(newState(), at(START, 23, 50));
    const original = yesterday.activities.find((a) => a.type === 'new')!;
    const today = commands.materializeToday(yesterday, at(day(2), 0, 10));
    const replacement = today.activities.find((a) => a.type === 'new' && a.slug === original.slug && a.dueDate === day(2))!;
    const started = commands.startActivity(today, original.id, at(START, 23, 55));
    const next = commands.completeActivity(started, replacement.id, { outcome: 'solo', totalMs: 30 * 60_000, completedDate: START }, at(day(2), 0, 15));
    const entries = calendarDays(next, day(2)).find((d) => d.date === START)!.entries.filter((e) => e.slug === original.slug);
    expect(entries.map((e) => e.state)).toEqual(['missed', 'done']);
    expect(next.activities.find((a) => a.id === original.id)?.status).toBe('in_progress');
  });

  it.each([
    ['2024-03-01', '2024-02-29'],
    ['2025-11-03', '2025-11-02'],
    ['2026-01-01', '2025-12-31'],
  ])('uses local calendar arithmetic across the %s boundary', (today, yesterday) => {
    const state = commands.materializeToday(defaultState(yesterday), at(yesterday, 23, 50));
    const activity = state.activities.find((a) => a.type === 'new')!;
    const started = commands.startActivity(state, activity.id, at(yesterday, 23, 50));
    const next = commands.completeActivity(started, activity.id, { outcome: 'solo', totalMs: 60_000, completedDate: yesterday }, at(today, 0, 5));
    expect(next.activities.find((a) => a.id === activity.id)?.completedAt).toBe(yesterday);
    expect(next.activities.find((a) => a.slug === activity.slug && a.type === 'recall')?.dueDate).toBe(today);
  });

  it('keeps today as the default and accepts an explicit today without changing existing behavior', () => {
    const { state, activity, now } = overnight();
    const implicit = commands.completeActivity(state, activity.id, { outcome: 'hint', totalMs: 20 * 60_000 }, now);
    const explicit = commands.completeActivity(state, activity.id, { outcome: 'hint', totalMs: 20 * 60_000, completedDate: day(2) }, now);
    expect(explicit).toEqual(implicit);
    expect(implicit.activities.find((a) => a.id === activity.id)).toMatchObject({ completedAt: day(2), totalMs: 20 * 60_000 });
    expect(implicit.activities.find((a) => a.slug === activity.slug && a.type === 'recall')?.dueDate).toBe(day(3));
  });

  it.each(['2025-02-30', '', 'not-a-date', day(0), day(3)])('rejects invalid, older or future dates (%s) without mutation', (completedDate) => {
    const { state, activity, now } = overnight();
    const original = serializeState(state);
    expect(() => commands.completeActivity(state, activity.id, { outcome: 'solo', completedDate }, now)).toThrow(/today or yesterday/);
    expect(serializeState(state)).toBe(original);
  });

  it('does not allow this control to rewrite an already saved result', () => {
    const { state, activity, now } = overnight();
    const done = commands.completeActivity(state, activity.id, { outcome: 'solo' }, now);
    expect(() => commands.completeActivity(done, activity.id, { outcome: 'solo', completedDate: START }, now)).toThrow(/already done/);
    expect(done.activities.find((a) => a.id === activity.id)?.completedAt).toBe(day(2));
  });

  it('dates a bonus yesterday while its recall is real work today and the offer is replenished', () => {
    const { state, now } = overnight();
    const offer = planDay(state, START).bonuses[0]!.activity;
    const started = commands.startActivity(state, offer.id, at(START, 23, 45));
    const next = commands.completeActivity(started, offer.id, { outcome: 'solo', completedDate: START }, now);
    expectAbsentFromToday(next, offer.id, day(2));
    expect(workedTotals(next)).toMatchObject({ program: 0, bonus: 1, total: 1 });
    expect(planDay(next, day(2)).bonuses).toHaveLength(2);
    expect(next.activities.find((a) => a.slug === offer.slug && a.type === 'recall')?.dueDate).toBe(day(2));
  });

  it('schedules a failed overnight review retry from the selected day and preserves completed history', () => {
    const { state, activity } = overnight();
    const learned = commands.completeActivity(state, activity.id, { outcome: 'solo' }, at(START, 23, 55));
    const recall = learned.activities.find((a) => a.slug === activity.slug && a.type === 'recall')!;
    const started = commands.startActivity(learned, recall.id, at(day(2), 23, 55));
    const next = commands.completeActivity(started, recall.id, { outcome: 'solution', completedDate: day(2) }, at(day(3), 0, 5));
    expect(next.activities.find((a) => a.id === activity.id)).toEqual(learned.activities.find((a) => a.id === activity.id));
    expect(next.activities.find((a) => a.id === recall.id)).toMatchObject({ completedAt: day(2), totalMs: 10 * 60_000 });
    expect(next.activities.find((a) => a.slug === activity.slug && a.type === 'retry')?.dueDate).toBe(day(3));
    expectAbsentFromToday(next, recall.id, day(3));
  });

  it('removes an explicitly backdated benchmark from its original current-day checklist and calendar', () => {
    const benchmarkDay = BENCHMARKS[1]!.day;
    const today = day(benchmarkDay);
    const yesterday = day(benchmarkDay - 1);
    const state = commands.materializeToday(newState(), at(today, 0, 10));
    const activity = state.activities.find((a) => a.type === 'benchmark' && a.dueDate === today)!;
    const next = commands.completeActivity(state, activity.id, { outcome: 'solo', totalMs: 30 * 60_000, completedDate: yesterday }, at(today, 0, 15));
    expectAbsentFromToday(next, activity.id, today);
    expect(calendarDays(next, today).find((d) => d.date === yesterday)!.entries.find((e) => e.id === activity.id)?.state).toBe('done');
    expect(workedTotals(next)).toMatchObject({ benchmark: 1, total: 1 });
    expect(next.activities.find((a) => a.slug === activity.slug && a.type === 'recall')?.dueDate).toBe(today);
  });

  it('forwards the date through storage actions and checks it against the actual save-time clock', async () => {
    const { state, activity, now } = overnight();
    const { store } = createTestApp(state);
    let clock = now;
    const actions = createActions(store, () => clock);
    // A form left open too long cannot sneak in a two-days-old date.
    clock = at(day(3));
    await expect(actions.completeActivity(activity.id, 'solo', undefined, START)).rejects.toThrow(/today or yesterday/);
    expect(await store.readState()).toEqual(state);
    clock = now;
    await actions.completeActivity(activity.id, 'solo', undefined, START);
    expect((await store.readState()).activities.find((a) => a.id === activity.id)).toMatchObject({ completedAt: START, totalMs: 30 * 60_000 });
  });
});
