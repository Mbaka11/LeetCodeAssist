import { describe, expect, it } from 'vitest';
import { findActivity } from '../core/activities';
import { planDay } from '../core/planner';
import { StateValidationError } from '../core/state';
import { START, day, newState } from '../core/testing';
import type { AppState } from '../core/types';
import * as commands from './commands';

function at(date: string, hour = 10): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, 0, 0).getTime();
}

/** Day 1 state with today's plan persisted; returns the ids of the new problems. */
function dayOne(): { state: AppState; newIds: string[]; now: number } {
  const now = at(START);
  const state = commands.materializeToday(newState(), now);
  const newIds = state.activities.filter((a) => a.type === 'new').map((a) => a.id);
  return { state, newIds, now };
}

describe('materializeToday', () => {
  it('persists the benchmark pair and the new problems, and is idempotent', () => {
    const { state, now } = dayOne();
    const types = state.activities.map((a) => a.type);
    expect(types.filter((t) => t === 'benchmark')).toHaveLength(2);
    expect(types.filter((t) => t === 'new').length).toBeGreaterThanOrEqual(2);
    expect(planDay(state, START).items.every((i) => i.persisted)).toBe(true);
    expect(commands.materializeToday(state, now)).toBe(state);
  });

  it('does nothing before the start date', () => {
    const state = newState();
    expect(commands.materializeToday(state, at(day(0)))).toBe(state);
  });
});

describe('timer commands', () => {
  it('starts an activity and pauses any other running one', () => {
    const { state, newIds, now } = dayOne();
    const [first, second] = newIds as [string, string];
    let next = commands.startActivity(state, first, now);
    expect(findActivity(next, first)).toMatchObject({ status: 'in_progress', timer: { running: true } });

    next = commands.startActivity(next, second, now + 60_000);
    expect(findActivity(next, first)).toMatchObject({
      status: 'in_progress',
      timer: { running: false, accumulatedMs: 60_000 },
    });
    expect(findActivity(next, second)?.timer.running).toBe(true);
  });

  it('pauses and resumes using timestamps', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(state, id, now);
    next = commands.pauseActivity(next, id, now + 120_000);
    next = commands.resumeActivity(next, id, now + 500_000);
    next = commands.pauseActivity(next, id, now + 560_000);
    expect(findActivity(next, id)?.timer).toEqual({
      startedAt: null,
      accumulatedMs: 180_000,
      running: false,
    });
  });

  it('cannot resume or mark an approach before starting', () => {
    const { state, newIds, now } = dayOne();
    expect(() => commands.resumeActivity(state, newIds[0]!, now)).toThrow(/not started/);
    expect(() => commands.recordApproachFound(state, newIds[0]!, now)).toThrow(/not started/);
  });

  it('records the approach time once', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(state, id, now);
    next = commands.recordApproachFound(next, id, now + 600_000);
    next = commands.recordApproachFound(next, id, now + 900_000);
    expect(findActivity(next, id)?.approachMs).toBe(600_000);
  });
});

describe('completeActivity', () => {
  it('completes with the timer total and schedules the review cycle from today', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const slug = findActivity(state, id)!.slug;
    let next = commands.startActivity(state, id, now);
    next = commands.completeActivity(next, id, { outcome: 'solo' }, now + 25 * 60_000);
    expect(findActivity(next, id)).toMatchObject({
      status: 'done',
      outcome: 'solo',
      completedAt: START,
      totalMs: 25 * 60_000,
    });
    const reviews = next.activities.filter((a) => a.slug === slug && a.type !== 'new');
    expect(reviews.map((a) => [a.type, a.dueDate])).toEqual([
      ['recall', day(2)],
      ['rebuild', day(4)],
      ['resolve', day(8)],
      ['blind', day(22)],
    ]);
    expect(next.problemStatus[slug]).toBe('learning');
  });

  it('lets the user override the logged time', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(state, id, now);
    next = commands.completeActivity(
      next,
      id,
      { outcome: 'hint', totalMs: 30 * 60_000 },
      now + 9 * 3_600_000,
    );
    expect(findActivity(next, id)?.totalMs).toBe(30 * 60_000);
  });

  it('rejects completing an activity twice', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const done = commands.completeActivity(state, id, { outcome: 'solo', totalMs: 60_000 }, now);
    expect(() => commands.completeActivity(done, id, { outcome: 'solo' }, now)).toThrow(/already done/);
  });
});

describe('skipActivity', () => {
  it('skips a new problem without replacing it', () => {
    const { state, newIds, now } = dayOne();
    const next = commands.skipActivity(state, newIds[0]!, now);
    expect(findActivity(next, newIds[0]!)?.status).toBe('skipped');
    expect(next.activities).toHaveLength(state.activities.length);
  });

  it('postpones a review to tomorrow instead of dropping it', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const slug = findActivity(state, id)!.slug;
    const done = commands.completeActivity(state, id, { outcome: 'solo', totalMs: 60_000 }, now);
    const recall = done.activities.find((a) => a.slug === slug && a.type === 'recall')!;

    const tomorrow = at(day(2));
    const next = commands.skipActivity(done, recall.id, tomorrow);
    expect(findActivity(next, recall.id)?.status).toBe('skipped');
    const replacement = next.activities.find(
      (a) => a.slug === slug && a.type === 'recall' && a.status === 'planned',
    );
    expect(replacement?.dueDate).toBe(day(3));
  });
});

describe('notes, checks and settings', () => {
  const fields = { trigger: 'Click', principle: 'p', pitfall: 'f', complexity: 'O(n)', code: '' };

  it('saves a note with the local date and omits an empty snippet', () => {
    const next = commands.saveNote(newState(), 'two-sum', fields, at(START));
    const note = next.notes['two-sum']!;
    expect(note).toMatchObject({ slug: 'two-sum', trigger: 'Click', updatedAt: START });
    expect('code' in note).toBe(false);
    const withCode = commands.saveNote(next, 'two-sum', { ...fields, code: 'def f(): pass' }, at(START));
    expect(withCode.notes['two-sum']?.code).toBe('def f(): pass');
  });

  it('toggles a checkbox on and off', () => {
    const on = commands.toggleChecked(newState(), 'two-sum');
    expect(on.checked).toEqual({ 'two-sum': true });
    expect(commands.toggleChecked(on, 'two-sum').checked).toEqual({});
  });

  it('validates settings changes', () => {
    const state = newState();
    expect(commands.updateSettings(state, { dailyTargetMin: 120 }).settings.dailyTargetMin).toBe(120);
    expect(() => commands.updateSettings(state, { dailyCapMin: 100 })).toThrow(StateValidationError);
    expect(() => commands.updateSettings(state, { startDate: '2025-13-40' })).toThrow(/startDate/);
    expect(() => commands.updateSettings(state, { morningNotify: '8:30' })).toThrow(/morningNotify/);
  });
});
