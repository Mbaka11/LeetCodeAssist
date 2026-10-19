import { describe, expect, it } from 'vitest';
import { defaultState, serializeState } from './state';
import type { Activity, ActivityType, Outcome } from './types';
import { weeklySummary } from './weekly';

let nextId = 0;
function done(slug: string, type: ActivityType, date: string, outcome?: Outcome, extra = false, hintsUsed = 0): Activity {
  return { id: `test-${nextId++}`, slug, type, status: 'done', dueDate: date, createdAt: date, completedAt: date,
    timer: { running: false, startedAt: null, accumulatedMs: 0 }, totalMs: 600_000,
    ...(outcome ? { outcome } : {}), ...(extra ? { extra: true } : {}), hintsUsed };
}
const state = (activities: Activity[]) => ({ ...defaultState('2025-01-01'), activities });

describe('read-only rolling weekly learning evidence', () => {
  it('compares exact local 7-day windows, counts distinct first-worked problems and leaves history untouched', () => {
    const source = state([
      done('two-sum', 'new', '2025-01-01', 'solo'), done('two-sum', 'recall', '2025-01-10', 'solo'),
      done('two-sum', 'rebuild', '2025-01-15', 'solo'), done('two-sum', 'resolve', '2025-01-16', 'solo', true),
      done('two-sum', 'resolve', '2025-01-16', 'solo', true), done('valid-anagram', 'new', '2025-01-17', 'hint'),
      done('valid-anagram', 'resolve', '2025-01-18', undefined, true), done('3sum', 'new', '2025-01-21', 'solo'),
    ]);
    const before = serializeState(source);
    const report = weeklySummary(source, '2025-01-20');
    expect(report.current).toEqual({ from: '2025-01-14', to: '2025-01-20', attempts: 5, distinct: 2, firstWorked: 1, totalMs: 3_000_000 });
    expect(report.previous).toMatchObject({ from: '2025-01-07', to: '2025-01-13', attempts: 1, distinct: 1, firstWorked: 0 });
    expect(report.categories[0]).toMatchObject({ category: 'Arrays & Hashing', attempts: 5, rated: 4, helped: 1,
      independentReviewProblems: 1, previousIndependentReviewProblems: 1, firstWorked: 1 });
    expect(serializeState(source)).toBe(before);
  });

  it('does not allow immediate extra successes or unrated attempts to erase a fragile scheduled review', () => {
    const source = state([done('two-sum', 'new', '2025-01-01', 'solo'),
      done('two-sum', 'recall', '2025-01-15', 'hint'), done('two-sum', 'rebuild', '2025-01-19'),
      done('two-sum', 'resolve', '2025-01-20', 'solo', true), done('two-sum', 'resolve', '2025-01-21', 'solo')]);
    expect(weeklySummary(source, '2025-01-20').fragile[0]?.evidence.type).toBe('recall');
    expect(weeklySummary(source, '2025-01-21').fragile).toHaveLength(0);
  });

  it('a Solo label with recorded hints is help-dependent, not an independent review success', () => {
    const report = weeklySummary(state([done('two-sum', 'recall', '2025-01-20', 'solo', false, 1)]), '2025-01-20');
    expect(report.categories[0]).toMatchObject({ rated: 1, helped: 1, independentReviewProblems: 0 });
    expect(report.fragile).toHaveLength(1);
  });

  it('uses initial assistance before a scheduled review exists and handles stuck, unknown and uncatalogued records', () => {
    const report = weeklySummary(state([done('two-sum', 'new', '2025-01-20', 'solution'),
      done('valid-anagram', 'new', '2025-01-20', 'stuck'), done('outside-list', 'new', '2025-01-20')]), '2025-01-20');
    expect(report.fragile.map((f) => f.slug).sort()).toEqual(['two-sum', 'valid-anagram']);
    expect(report.categories.find((c) => c.category === 'Other / uncatalogued')).toMatchObject({ rated: 0, helped: 0 });
    expect(report.current.firstWorked).toBe(3);
  });

  it('includes boundary days and reflects a corrected completion date without counting audit entries', () => {
    const a = done('two-sum', 'new', '2025-01-14', 'solo');
    const source = state([a, done('valid-anagram', 'new', '2025-01-20', 'solo')]);
    expect(weeklySummary(source, '2025-01-20').current.attempts).toBe(2);
    const edited = state([{ ...a, completedAt: '2025-01-13', corrections: [{ at: 1, previousDate: '2025-01-14' }] }, source.activities[1]!]);
    const report = weeklySummary(edited, '2025-01-20');
    expect(report.current.attempts).toBe(1);
    expect(report.previous.attempts).toBe(1);
  });

  it('handles empty periods and calendar/year boundaries without invented rates or progress', () => {
    const report = weeklySummary(state([]), '2026-01-03');
    expect(report.current).toMatchObject({ from: '2025-12-28', to: '2026-01-03', attempts: 0, totalMs: 0 });
    expect(report.categories).toEqual([]);
    expect(report.fragile).toEqual([]);
    expect(() => weeklySummary(state([]), 'invalid')).toThrow();
  });
});
