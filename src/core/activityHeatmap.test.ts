import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { activityHeatDays } from './activityHeatmap';
import { defaultState } from './state';
import type { Activity } from './types';

function entry(id: string, patch: Partial<Activity>): Activity {
  return { ...createActivity([], { slug: 'two-sum', type: 'resolve', dueDate: '2025-03-08', createdAt: '2025-03-08' }), id, ...patch };
}

describe('activityHeatDays', () => {
  it('sums only completed log minutes on the completion date, including optional attempts', () => {
    const state = { ...defaultState('2025-03-08'), activities: [
      entry('a', { status: 'done', completedAt: '2025-03-09', totalMs: 10 * 60_000 }),
      entry('b', { status: 'done', completedAt: '2025-03-09', totalMs: 20 * 60_000, extra: true }),
      entry('c', { status: 'skipped', totalMs: 90 * 60_000 }),
      entry('d', { status: 'in_progress', timer: { startedAt: 0, running: true, accumulatedMs: 60_000 } }),
    ] };
    const before = structuredClone(state);
    expect(activityHeatDays(state, '2025-03-08', 3, '2025-03-09')).toEqual([
      { date: '2025-03-08', minutes: 0, level: 0, future: false },
      { date: '2025-03-09', minutes: 30, level: 2, future: false },
      { date: '2025-03-10', minutes: 0, level: 0, future: true },
    ]);
    expect(state).toEqual(before);
  });
  it.each([[0, 0], [0.5, 1], [29, 1], [30, 2], [59, 2], [60, 3], [119, 3], [120, 4], [240, 4]])('uses the legend threshold at %s minutes', (minutes, level) => {
    const state = { ...defaultState('2025-03-08'), activities: [entry('a', { status: 'done', completedAt: '2025-03-08', totalMs: minutes * 60_000 })] };
    expect(activityHeatDays(state, '2025-03-08', 1, '2025-03-08')[0]!.level).toBe(level);
  });
});
