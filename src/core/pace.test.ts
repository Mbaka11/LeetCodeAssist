import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { localDateFromTimestamp } from './dates';
import { PACE_GUIDELINE_MINUTES, PACE_MAX_MONTHS, median, paceData } from './pace';
import { emptyChecklist } from './practice';
import type { SimulationRecord } from './practiceTypes';
import { defaultState } from './state';
import type { Activity, ActivityType, AppState } from './types';

let counter = 0;
function done(slug: string, type: ActivityType, completedAt: string, minutes: number | undefined, extra: Partial<Activity> = {}): Activity {
  const a = createActivity([], { slug, type, dueDate: completedAt, createdAt: completedAt });
  return { ...a, id: `a${counter++}`, status: 'done', completedAt, outcome: 'solo', ...(minutes !== undefined ? { totalMs: minutes * 60_000 } : {}), ...extra };
}
const stateWith = (activities: Activity[], simulations?: Record<string, SimulationRecord>): AppState => ({ ...defaultState('2025-01-01'), activities, ...(simulations ? { simulations } : {}) });
const panel = (data: ReturnType<typeof paceData>, difficulty: string) => data.panels.find((p) => p.difficulty === difficulty)!;
// two-sum: Easy, group-anagrams: Medium, trapping-rain-water: Hard.
const EASY = 'two-sum', MEDIUM = 'group-anagrams', HARD = 'trapping-rain-water';

describe('median', () => {
  it('handles empty, odd, even and unsorted input', () => {
    expect(median([])).toBeUndefined();
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('paceData', () => {
  it('reports an empty state with the three editorial guidelines and no rows', () => {
    const data = paceData(stateWith([]));
    expect(data.hasData).toBe(false);
    expect(data.months).toEqual([]);
    expect(data.panels.map((p) => [p.difficulty, p.guidelineMinutes, p.rows.length])).toEqual([['Easy', 15, 0], ['Medium', 30, 0], ['Hard', 45, 0]]);
    expect(PACE_GUIDELINE_MINUTES).toEqual({ Easy: 15, Medium: 30, Hard: 45 });
  });
  it('separates first attempts from reviews, with median and sample count per month and difficulty', () => {
    const data = paceData(stateWith([
      done(EASY, 'new', '2025-03-02', 10), done(EASY, 'new', '2025-03-03', 20), done(EASY, 'new', '2025-03-04', 40),
      done(EASY, 'recall', '2025-03-05', 6), done(EASY, 'resolve', '2025-03-06', 8),
      done(MEDIUM, 'new', '2025-03-07', 33), done(HARD, 'blind', '2025-03-09', 50),
    ]));
    expect(data.months).toEqual(['2025-03']);
    expect(panel(data, 'Easy').rows[0]).toEqual({ month: '2025-03', first: { median: 20, count: 3 }, review: { median: 7, count: 2 } });
    expect(panel(data, 'Medium').rows[0]).toEqual({ month: '2025-03', first: { median: 33, count: 1 } });
    expect(panel(data, 'Hard').rows[0]).toEqual({ month: '2025-03', review: { median: 50, count: 1 } });
    expect(data.counts).toEqual({ first: 4, review: 3, simulation: 0 });
  });
  it('keeps months contiguous (gaps stay empty), orders them across years, and does not invent values', () => {
    const data = paceData(stateWith([done(EASY, 'new', '2024-11-30', 12), done(EASY, 'new', '2025-02-01', 18)]));
    expect(data.months).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
    expect(panel(data, 'Easy').rows.map((r) => r.first?.median)).toEqual([12, undefined, undefined, 18]);
  });
  it('shows at most the last 12 months ending at the latest month with data', () => {
    const data = paceData(stateWith([done(EASY, 'new', '2023-01-05', 5), done(EASY, 'new', '2025-02-01', 18)]));
    expect(data.months).toHaveLength(PACE_MAX_MONTHS);
    expect(data.months.at(-1)).toBe('2025-02');
    expect(data.months[0]).toBe('2024-03');
    expect(data.counts.first).toBe(1);
  });
  it('ignores activities without logged time, unfinished or skipped ones, benchmarks and uncatalogued problems', () => {
    const data = paceData(stateWith([
      done(EASY, 'new', '2025-03-02', undefined), done(EASY, 'new', '2025-03-02', 0),
      done(EASY, 'new', '2025-03-02', 9, { status: 'skipped' }), done(EASY, 'benchmark', '2025-03-02', 9),
      done('not-in-the-catalog', 'new', '2025-03-02', 9),
    ]));
    expect(data.hasData).toBe(false);
  });
  it('overlays simulation durations as a separate series without altering activity samples', () => {
    const endedAt = new Date(2025, 2, 15, 12).getTime();
    const sim = (id: string, slug: string, minutes: number): SimulationRecord => ({ id, createdAt: endedAt - minutes * 60_000, endedAt, durationMs: minutes * 60_000, slug, mode: 'global', outcome: 'solved', checklist: emptyChecklist(), targetMinutes: 35, reflection: '' });
    const activities = [done(MEDIUM, 'new', '2025-03-02', 31)];
    const without = paceData(stateWith(activities));
    const data = paceData(stateWith(activities, { a: sim('a', MEDIUM, 28), b: sim('b', MEDIUM, 40), c: sim('c', 'unknown-slug', 5) }));
    expect(localDateFromTimestamp(endedAt).slice(0, 7)).toBe('2025-03');
    expect(panel(data, 'Medium').rows[0]).toEqual({ month: '2025-03', first: { median: 31, count: 1 }, simulation: { median: 34, count: 2 } });
    expect(panel(data, 'Medium').rows[0]!.first).toEqual(panel(without, 'Medium').rows[0]!.first);
    expect(data.counts.simulation).toBe(2);
    expect(paceData(stateWith([], { a: sim('a', EASY, 12) })).hasData).toBe(true);
  });
  it('does not change the input state', () => {
    const state = stateWith([done(EASY, 'new', '2025-03-02', 10)]);
    const copy = structuredClone(state);
    paceData(state);
    expect(state).toEqual(copy);
  });
});
