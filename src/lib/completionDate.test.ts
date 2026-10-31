import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { calendarDays } from '../core/calendar';
import { buildLogRows } from '../core/logs';
import { planDay } from '../core/planner';
import { confirmResultCorrection, prepareResultCorrection } from '../core/resultCorrection';
import { dayProgress, defaultState, deserializeState, serializeState, validateState } from '../core/state';
import { mergeStates } from '../core/syncMerge';
import { START, day, newState } from '../core/testing';
import { workedTotals } from '../core/worked';
import { BENCHMARKS } from '../data/program';
import { createActions } from './actions';
import * as commands from './commands';
import { createTestApp } from './testing';

function at(date: string, hour = 12, minute = 0): number {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
}

function overnight() {
  const state = commands.materializeToday(newState(), at(START, 23, 40));
  const activity = state.activities.find((a) => a.type === 'new')!;
  return { state: commands.startActivity(state, activity.id, at(START, 23, 40)), activity, now: at(day(2), 0, 10) };
}

describe('automatic 04:00 training dates', () => {
  it('credits an overnight completion to the previous training day and keeps the actual timestamp', () => {
    const { state, activity, now } = overnight();
    const next = commands.completeActivity(state, activity.id, { outcome: 'solo' }, now);
    expect(next.activities.find((a) => a.id === activity.id)).toMatchObject({
      id: activity.id, dueDate: START, createdAt: START, completedAt: START, completedAtMs: now,
      status: 'done', totalMs: 30 * 60_000,
      timer: { running: false, startedAt: null, accumulatedMs: 30 * 60_000 },
    });
    expect(next.activities.filter((a) => a.slug === activity.slug && a.type !== 'new').map((a) => [a.type, a.dueDate])).toEqual([
      ['recall', day(2)], ['rebuild', day(4)], ['resolve', day(8)], ['blind', day(22)],
    ]);
    expect(dayProgress(next, START)).toMatchObject({ doneCount: 1, loggedMs: 30 * 60_000, streakQualified: true });
    expect(dayProgress(next, day(2))).toMatchObject({ doneCount: 0, loggedMs: 0 });
    expect(buildLogRows(next).find((row) => row.id === activity.id)).toMatchObject({ date: START, completedAtMs: now });
    expect(calendarDays(next, START).find((d) => d.date === START)!.entries.find((e) => e.id === activity.id)?.state).toBe('done');
    expect(workedTotals(next)).toMatchObject({ program: 1, total: 1 });
    expect(deserializeState(serializeState(next))).toEqual(next);
    expect(mergeStates(undefined, newState(), next).state).toEqual(next);
  });

  it('does not regenerate the plan or activate D+1 reviews at midnight', () => {
    const { state, activity, now } = overnight();
    const next = commands.completeActivity(state, activity.id, { outcome: 'solo' }, now);
    const stillSameDay = commands.materializeToday(next, at(day(2), 3, 59));
    expect(stillSameDay).toBe(next);
    expect(planDay(stillSameDay, START).items.some((i) => i.activity.type === 'recall')).toBe(false);
    const afterCutoff = commands.materializeToday(next, at(day(2), 4));
    expect(planDay(afterCutoff, day(2)).items.some((i) => i.activity.type === 'recall' && i.activity.slug === activity.slug)).toBe(true);
  });

  it.each([[3, 59, START], [4, 0, day(2)], [14, 0, day(2)]])(
    'assigns a save at %s:%s to %s, regardless of when the timer started', (hour, minute, expected) => {
      const { state, activity } = overnight();
      const now = at(day(2), Number(hour), Number(minute));
      const done = commands.completeActivity(state, activity.id, { outcome: 'hint' }, now).activities.find((a) => a.id === activity.id)!;
      expect(done.completedAt).toBe(expected);
      expect(done.completedAtMs).toBe(now);
      expect(done.totalMs).toBe(now - at(START, 23, 40));
    },
  );

  it('allows starting both day-15 benchmarks after midnight without changing their identity', () => {
    const date = day(15);
    const original = commands.materializeToday(newState(), at(date, 23, 50));
    const overnight = commands.materializeToday(original, at(day(16), 1));
    expect(overnight).toBe(original);
    for (const slug of [BENCHMARKS[1]!.easy, BENCHMARKS[1]!.medium]) {
      const activity = original.activities.find((a) => a.type === 'benchmark' && a.slug === slug)!;
      const started = commands.startActivity(overnight, activity.id, at(day(16), 1));
      const next = commands.completeActivity(started, activity.id, { outcome: 'solo' }, at(day(16), 1, 30));
      expect(next.activities.find((a) => a.id === activity.id)).toMatchObject({ completedAt: date, totalMs: 30 * 60_000 });
    }
  });

  it('keeps missed benchmarks accessible after 04:00 without retroactive credit or a forced budget', () => {
    const original = commands.materializeToday(newState(), at(START));
    const plan = planDay(original, day(2));
    expect(plan.missedBenchmarks).toHaveLength(2);
    expect(plan.items.some((i) => i.activity.type === 'benchmark')).toBe(false);
    const activity = plan.missedBenchmarks[0]!.activity;
    const started = commands.startActivity(original, activity.id, at(day(2), 14));
    const next = commands.completeActivity(started, activity.id, { outcome: 'solo' }, at(day(2), 14, 30));
    expect(next.activities.find((a) => a.id === activity.id)).toMatchObject({ dueDate: START, completedAt: day(2) });
    expect(planDay(next, day(2)).missedBenchmarks).toHaveLength(1);
    expect(dayProgress(next, START).doneCount).toBe(0);
  });

  it('recovers unmaterialized benchmarks once, without reviving skipped or finished records', () => {
    const state = commands.materializeToday(newState(), at(day(16), 1));
    expect(state.activities.filter((a) => a.type === 'benchmark')).toHaveLength(4);
    expect(commands.materializeToday(state, at(day(16), 1))).toBe(state);
    const original = state.activities.find((a) => a.type === 'benchmark' && a.dueDate === START)!;
    const skipped = commands.skipActivity(state, original.id, at(day(16), 1));
    expect(planDay(skipped, day(15)).missedBenchmarks.some((i) => i.activity.id === original.id)).toBe(false);
  });

  it.each([['2024-03-01', '2024-02-29'], ['2025-11-03', '2025-11-02'], ['2026-01-01', '2025-12-31']])(
    'uses calendar arithmetic across %s before 04:00', (calendarToday, creditedDate) => {
      const state = commands.materializeToday(defaultState(creditedDate), at(creditedDate, 23, 50));
      const activity = state.activities.find((a) => a.type === 'new')!;
      const started = commands.startActivity(state, activity.id, at(creditedDate, 23, 50));
      const next = commands.completeActivity(started, activity.id, { outcome: 'solo' }, at(calendarToday, 1));
      expect(next.activities.find((a) => a.id === activity.id)?.completedAt).toBe(creditedDate);
      expect(next.activities.find((a) => a.slug === activity.slug && a.type === 'recall')?.dueDate).toBe(calendarToday);
    },
  );

  it('rejects date overrides and stale forms without modifying data', async () => {
    const { state, activity } = overnight();
    const { store } = createTestApp(state);
    const actions = createActions(store, () => at(day(2), 14));
    await expect(actions.completeActivity(activity.id, 'solo', undefined, START)).rejects.toThrow(/04:00/);
    expect(await store.readState()).toEqual(state);
    await actions.completeActivity(activity.id, 'solo');
    expect((await store.readState()).activities.find((a) => a.id === activity.id)?.completedAt).toBe(day(2));
  });

  it('does not re-offer unopened new-problem duplicates left by an older midnight-based build', () => {
    const original = commands.materializeToday(newState(), at(START));
    const activity = original.activities.find((a) => a.type === 'new')!;
    const duplicate = createActivity(original.activities, { slug: activity.slug, type: 'new', dueDate: day(2), createdAt: day(2) });
    const loaded = { ...original, activities: [...original.activities, duplicate] };
    const started = commands.startActivity(loaded, activity.id, at(day(2), 1));
    const currentPlan = planDay(started, day(2));
    expect(currentPlan.items.filter((i) => i.activity.type === 'new' && i.activity.slug === activity.slug).map((i) => i.activity.id)).toEqual([activity.id]);
    expect(calendarDays(started, day(2)).find((d) => d.date === day(2))!.entries.some((e) => e.id === duplicate.id)).toBe(false);
    const done = commands.completeActivity(started, activity.id, { outcome: 'solo' }, at(day(2), 1, 30));
    expect(planDay(done, day(2)).items.some((i) => i.activity.type === 'new' && i.activity.slug === activity.slug)).toBe(false);
    expect(calendarDays(done, day(2)).find((d) => d.date === day(2))!.entries.some((e) => e.id === duplicate.id)).toBe(false);
    expect(done.activities.find((a) => a.id === duplicate.id)).toEqual(duplicate);
  });

  it('starts the original missed benchmark rather than creating extra practice for it', () => {
    const state = commands.materializeToday(newState(), at(START));
    const activity = state.activities.find((a) => a.type === 'benchmark')!;
    const started = commands.startExtraPractice(state, activity.slug, at(day(2), 14));
    expect(started.activityId).toBe(activity.id);
    expect(started.state.activities.find((a) => a.id === activity.id)?.status).toBe('in_progress');
    expect(started.state.activities.some((a) => a.slug === activity.slug && a.extra)).toBe(false);
  });

  it('does not resurrect benchmark pairs after editing the program start date', () => {
    const state = commands.materializeToday(newState(), at(START));
    const easy = state.activities.find((a) => a.type === 'benchmark')!;
    const medium = state.activities.find((a) => a.type === 'benchmark' && a.id !== easy.id)!;
    const done = commands.completeActivity(state, easy.id, { outcome: 'solo' }, at(START));
    const skipped = commands.skipActivity(done, medium.id, at(START));
    const moved = { ...skipped, settings: { ...skipped.settings, startDate: day(2) } };
    expect(planDay(moved, day(2)).items.filter((i) => i.activity.type === 'benchmark')).toEqual([]);
    expect(planDay(moved, day(3)).missedBenchmarks).toEqual([]);
    const materialized = commands.materializeToday(moved, at(day(3)));
    expect(materialized.activities.filter((a) => a.type === 'benchmark')).toHaveLength(2);
    expect(materialized.activities.find((a) => a.id === easy.id)).toEqual(done.activities.find((a) => a.id === easy.id));
    // Older versions may have left a planned duplicate before the terminal record in storage.
    const withDuplicate = { ...moved, activities: [{ ...easy, id: `${easy.id}:duplicate`, dueDate: day(2) }, ...moved.activities] };
    expect(planDay(withDuplicate, day(3)).missedBenchmarks).toEqual([]);
  });

  it('allows correcting a legacy civil-date result before 04:00 without permitting new future dates', () => {
    const { state, activity } = overnight();
    const legacy = { ...activity, status: 'done' as const, completedAt: day(2), outcome: 'solo' as const, totalMs: 60_000 };
    const before = { ...state, activities: state.activities.map((a) => a.id === activity.id ? legacy : a) };
    const edit = { completedDate: day(2), totalMs: 120_000, outcome: 'hint' as const };
    const { state: corrected } = prepareResultCorrection(before, activity.id, edit, at(day(2), 1));
    expect(corrected.activities.find((a) => a.id === activity.id)).toMatchObject({ completedAt: day(2), totalMs: 120_000 });
    expect(() => prepareResultCorrection(before, activity.id, { ...edit, completedDate: day(3) }, at(day(2), 1))).toThrow(/completion date/);
  });

  it('rejects malformed actual timestamps while keeping the field optional for old data', () => {
    const { state, activity, now } = overnight();
    const next = commands.completeActivity(state, activity.id, { outcome: 'solo' }, now);
    for (const completedAtMs of [-1, NaN, Infinity, 'yesterday']) {
      expect(() => validateState({ ...next, activities: next.activities.map((a) => a.id === activity.id ? { ...a, completedAtMs } : a) })).toThrow(/completedAtMs/);
    }
  });

  it('preserves legacy dates and the actual timestamp during audited corrections', () => {
    const { state, activity, now } = overnight();
    const next = commands.completeActivity(state, activity.id, { outcome: 'solo' }, now);
    const saved = next.activities.find((a) => a.id === activity.id)!;
    const edit = { completedDate: day(2), totalMs: saved.totalMs!, outcome: 'solo' as const };
    const { preview } = prepareResultCorrection(next, activity.id, edit, at(day(3)));
    const corrected = confirmResultCorrection(next, activity.id, edit, preview.fingerprint, at(day(3)));
    expect(corrected.activities.find((a) => a.id === activity.id)).toMatchObject({ completedAt: day(2), completedAtMs: now, corrections: [{ previousDate: START }] });
    const { completedAtMs: _timestamp, ...legacy } = saved;
    const legacyState = { ...next, activities: next.activities.map((a) => a.id === activity.id ? legacy : a) };
    expect(validateState(legacyState)).toEqual(legacyState);
    expect(commands.materializeToday(legacyState, now).activities.find((a) => a.id === activity.id)).toEqual(legacy);
    expect(() => commands.completeActivity(next, activity.id, { outcome: 'solo' }, now)).toThrow(/already done/);
  });
});
