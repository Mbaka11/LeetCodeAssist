import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import {
  StateValidationError,
  computeStreak,
  dailyTargetMinutes,
  dayProgress,
  defaultState,
  deserializeState,
  getProblemStatus,
  isPlanDone,
  loggedTotals,
  problemStats,
  serializeState,
  validateState,
} from './state';
import { START, complete, day, newState, simulateDay } from './testing';
import type { AppState } from './types';

/** Adds a completed activity of `minutes` on `date` (pretending it was done on that day). */
function withDone(state: AppState, slug: string, date: string, minutes: number): AppState {
  const activity = createActivity(state.activities, {
    type: 'resolve',
    slug,
    dueDate: date,
    createdAt: date,
  });
  return complete({ ...state, activities: [...state.activities, activity] }, activity.id, 'solo', date, minutes);
}

describe('defaultState', () => {
  it('uses the SPEC defaults', () => {
    const state = defaultState(START);
    expect(state).toEqual({
      version: 1,
      settings: {
        startDate: START,
        dailyTargetMin: 150,
        dailyCapMin: 180,
        morningNotify: '08:30',
        eveningNotify: '20:00',
        language: 'python',
      },
      activities: [],
      notes: {},
      problemStatus: {},
      checked: {},
    });
  });

  it('rejects an invalid start date', () => {
    expect(() => defaultState('2025-02-30')).toThrow();
  });
});

describe('serializeState / deserializeState', () => {
  it('round-trips a rich state exactly', () => {
    let state = newState();
    for (let d = 1; d <= 12; d += 1) state = simulateDay(state, day(d), { outcome: d % 4 === 0 ? 'hint' : 'solo' }).state;
    state = {
      ...state,
      notes: {
        'two-sum': {
          slug: 'two-sum',
          trigger: 'Click',
          principle: 'Complement lookup',
          pitfall: 'Same index twice',
          complexity: 'O(n) time, O(n) space',
          code: 'def f():\n    pass',
          updatedAt: day(2),
        },
        'valid-anagram': {
          slug: 'valid-anagram',
          trigger: 'Counts',
          principle: 'p',
          pitfall: 'q',
          complexity: 'O(n)',
          updatedAt: day(3),
        },
      },
      checked: { 'two-sum': true, '3sum': false },
    };
    const restored = deserializeState(serializeState(state));
    expect(restored).toEqual(state);
  });

  it('keeps running timers and optional fields', () => {
    const state = newState();
    const activity = {
      ...createActivity([], { type: 'new', slug: 'two-sum', dueDate: day(1), createdAt: day(1) }),
      status: 'in_progress' as const,
      timer: { startedAt: 1_700_000_000_000, accumulatedMs: 5000, running: true },
      approachMs: 1234,
    };
    const restored = deserializeState(serializeState({ ...state, activities: [activity] }));
    expect(restored.activities[0]).toEqual(activity);
  });

  it('rejects invalid JSON', () => {
    expect(() => deserializeState('{nope')).toThrow(StateValidationError);
  });

  it('rejects unsupported or missing versions', () => {
    const base = JSON.parse(serializeState(newState())) as Record<string, unknown>;
    expect(() => deserializeState(JSON.stringify({ ...base, version: 2 }))).toThrow(/Unsupported state version: 2/);
    expect(() => deserializeState(JSON.stringify({ ...base, version: undefined }))).toThrow(/version/);
    expect(() => deserializeState('[]')).toThrow(StateValidationError);
    expect(() => deserializeState('null')).toThrow(StateValidationError);
  });

  it('rejects malformed content with a path in the message', () => {
    const base = JSON.parse(serializeState(simulateDay(newState(), day(1)).state)) as AppState;
    const mutate = (fn: (s: any) => void): string => {
      const copy = JSON.parse(JSON.stringify(base));
      fn(copy);
      return JSON.stringify(copy);
    };
    expect(() => deserializeState(mutate((s) => (s.settings.startDate = '2025-13-40')))).toThrow(/settings\.startDate/);
    expect(() => deserializeState(mutate((s) => (s.settings.dailyCapMin = 10)))).toThrow(/dailyCapMin/);
    expect(() => deserializeState(mutate((s) => (s.settings.morningNotify = '25:00')))).toThrow(/morningNotify/);
    expect(() => deserializeState(mutate((s) => (s.settings.language = 'rust')))).toThrow(/language/);
    expect(() => deserializeState(mutate((s) => (s.activities[0].type = 'oops')))).toThrow(/activities\[0\]\.type/);
    expect(() => deserializeState(mutate((s) => (s.activities[0].status = 'x')))).toThrow(/status/);
    expect(() => deserializeState(mutate((s) => (s.activities[0].dueDate = 'tomorrow')))).toThrow(/dueDate/);
    expect(() => deserializeState(mutate((s) => (s.activities[0].timer.accumulatedMs = -1)))).toThrow(/accumulatedMs/);
    expect(() => deserializeState(mutate((s) => (s.activities[0].timer = { startedAt: null, accumulatedMs: 0, running: true })))).toThrow(/startedAt/);
    expect(() => deserializeState(mutate((s) => (s.activities[0].outcome = 'perfect')))).toThrow(/outcome/);
    expect(() => deserializeState(mutate((s) => (s.activities[1] = s.activities[0])))).toThrow(/duplicate/);
    expect(() => deserializeState(mutate((s) => delete s.activities[0].completedAt))).toThrow(/completedAt/);
    expect(() => deserializeState(mutate((s) => (s.activities = {})))).toThrow(/activities/);
    expect(() => deserializeState(mutate((s) => (s.problemStatus['two-sum'] = 'great')))).toThrow(/problemStatus/);
    expect(() => deserializeState(mutate((s) => (s.checked['two-sum'] = 'yes')))).toThrow(/checked/);
    expect(() => deserializeState(mutate((s) => (s.notes['x'] = { slug: 'x' })))).toThrow(/notes\.x/);
    expect(() => deserializeState(mutate((s) => delete s.notes))).toThrow(/notes/);
  });

  it('validateState normalizes by dropping unknown fields', () => {
    const state = validateState({ ...newState(), extraneous: true });
    expect(state).toEqual(newState());
    expect('extraneous' in state).toBe(false);
  });
});

describe('daily progress and goal', () => {
  it('sums logged time of activities completed on a date', () => {
    let state = newState();
    state = withDone(state, 'two-sum', day(2), 20);
    state = withDone(state, 'valid-anagram', day(2), 15);
    state = withDone(state, 'valid-anagram', day(3), 5);
    const progress = dayProgress(state, day(2));
    expect(progress.doneCount).toBe(2);
    expect(progress.loggedMs).toBe(35 * 60_000);
    expect(progress.streakQualified).toBe(true);
    expect(dayProgress(state, day(3)).streakQualified).toBe(false);
    expect(dayProgress(state, day(4))).toMatchObject({ doneCount: 0, loggedMs: 0, streakQualified: false });
  });

  it('uses the configured target, and 90 minutes on consolidation days', () => {
    expect(dailyTargetMinutes(newState().settings, day(2))).toBe(150);
    expect(dailyTargetMinutes(newState().settings, day(7))).toBe(90);
  });
});

describe('isPlanDone', () => {
  it('needs at least 80% of a non-empty set of core activities done', () => {
    expect(isPlanDone(0, 0)).toBe(false);
    expect(isPlanDone(1, 1)).toBe(true);
    expect(isPlanDone(4, 5)).toBe(true);
    expect(isPlanDone(3, 4)).toBe(false);
    expect(isPlanDone(1, 2)).toBe(false);
    expect(isPlanDone(8, 10)).toBe(true);
    expect(isPlanDone(7, 10)).toBe(false);
    expect(isPlanDone(0, 3)).toBe(false);
  });
});

describe('loggedTotals', () => {
  it('sums the last 7 days (today included) and all time', () => {
    let state = newState();
    state = withDone(state, 'two-sum', day(1), 30);
    state = withDone(state, 'valid-anagram', day(2), 20);
    state = withDone(state, 'valid-anagram', day(8), 10);
    state = withDone(state, 'two-sum', day(9), 5);
    expect(loggedTotals(state, day(8))).toEqual({ last7DaysMs: 30 * 60_000, allTimeMs: 65 * 60_000 });
    expect(loggedTotals(state, day(7))).toEqual({ last7DaysMs: 50 * 60_000, allTimeMs: 65 * 60_000 });
    expect(loggedTotals(newState(), day(1))).toEqual({ last7DaysMs: 0, allTimeMs: 0 });
  });
});

describe('computeStreak', () => {
  it('is zero without activity', () => {
    expect(computeStreak(newState(), day(5))).toEqual({ current: 0, longest: 0 });
  });

  it('counts consecutive qualifying days ending today', () => {
    let state = newState();
    for (const d of [1, 2, 3]) state = withDone(state, 'two-sum', day(d), 30);
    expect(computeStreak(state, day(3))).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive until the end of today', () => {
    let state = newState();
    for (const d of [1, 2, 3]) state = withDone(state, 'two-sum', day(d), 45);
    expect(computeStreak(state, day(4))).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(state, day(5))).toEqual({ current: 0, longest: 3 });
  });

  it('requires 30 logged minutes and breaks on gaps', () => {
    let state = newState();
    state = withDone(state, 'two-sum', day(1), 30);
    state = withDone(state, 'two-sum', day(2), 29); // too short
    state = withDone(state, 'two-sum', day(3), 20);
    state = withDone(state, 'valid-anagram', day(3), 10); // 30 in total
    state = withDone(state, 'two-sum', day(4), 60);
    expect(computeStreak(state, day(4))).toEqual({ current: 2, longest: 2 });
    state = withDone(state, 'two-sum', day(6), 60);
    state = withDone(state, 'two-sum', day(7), 60);
    state = withDone(state, 'two-sum', day(8), 60);
    expect(computeStreak(state, day(8))).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(state, day(9))).toEqual({ current: 3, longest: 3 });
  });

  it('ignores skipped and planned activities', () => {
    let state = newState();
    const activity = createActivity([], { type: 'recall', slug: 'two-sum', dueDate: day(1), createdAt: day(1) });
    state = { ...state, activities: [activity, { ...activity, id: 'x', status: 'skipped' }] };
    expect(computeStreak(state, day(1))).toEqual({ current: 0, longest: 0 });
  });
});

describe('problemStats', () => {
  it('counts worked, solo-in-review and consolidating per category and difficulty', () => {
    const state: AppState = {
      ...newState(),
      problemStatus: {
        'two-sum': 'learning', // Easy, Arrays & Hashing
        'valid-anagram': 'reviewed', // Easy, Arrays & Hashing
        'group-anagrams': 'consolidating', // Medium, Arrays & Hashing
        '3sum': 'mastered', // Medium, Two Pointers
        'trapping-rain-water': 'untouched', // Hard
      },
      checked: { 'contains-duplicate': true, 'two-sum': true, 'trapping-rain-water': true },
    };
    const stats = problemStats(state);
    expect(stats.overall).toEqual({ total: 150, worked: 6, soloInReview: 2, consolidating: 1 });
    const arrays = stats.byCategory[0]!;
    expect(arrays).toEqual({ category: 'Arrays & Hashing', total: 9, worked: 4, soloInReview: 1, consolidating: 1 });
    const twoPointers = stats.byCategory[1]!;
    expect(twoPointers).toEqual({ category: 'Two Pointers', total: 5, worked: 2, soloInReview: 1, consolidating: 0 });
    expect(stats.byCategory).toHaveLength(18);
    expect(stats.byCategory.reduce((n, c) => n + c.total, 0)).toBe(150);
    expect(stats.byDifficulty.Easy.worked).toBe(3); // two-sum, valid-anagram, contains-duplicate
    expect(stats.byDifficulty.Medium.worked).toBe(2);
    expect(stats.byDifficulty.Hard.worked).toBe(1);
    expect(stats.byDifficulty.Easy.total + stats.byDifficulty.Medium.total + stats.byDifficulty.Hard.total).toBe(150);
  });

  it('is all zero on a fresh state', () => {
    const stats = problemStats(newState());
    expect(stats.overall).toEqual({ total: 150, worked: 0, soloInReview: 0, consolidating: 0 });
    expect(getProblemStatus(newState(), 'two-sum')).toBe('untouched');
  });
});

describe('hintsUsed, postponed, roadmapView and queue (additive fields)', () => {
  const base = newState();
  const withActivity = (patch: Record<string, unknown>): unknown => {
    const activity = createActivity([], { type: 'new', slug: 'two-sum', dueDate: day(1), createdAt: day(1) });
    return { ...base, activities: [{ ...activity, ...patch }] };
  };

  it('round-trips hintsUsed, postponed, roadmapView and queue', () => {
    const activity = {
      ...createActivity([], { type: 'new', slug: 'two-sum', dueDate: day(1), createdAt: day(1) }),
      hintsUsed: 2,
      postponed: true,
      status: 'skipped' as const,
    };
    const state: AppState = {
      ...base,
      settings: { ...base.settings, roadmapView: 'grid' },
      activities: [activity],
      queue: ['valid-anagram', 'two-sum'],
    };
    expect(deserializeState(serializeState(state))).toEqual(state);
  });

  it('accepts data saved before these fields existed and does not add them', () => {
    const legacy = JSON.parse(serializeState(simulateDay(newState(), day(1)).state)) as AppState;
    const restored = validateState(legacy);
    expect(restored).toEqual(legacy);
    expect('queue' in restored).toBe(false);
    expect('roadmapView' in restored.settings).toBe(false);
    expect(restored.activities.every((a) => !('hintsUsed' in a) && !('postponed' in a))).toBe(true);
  });

  it('rejects invalid values with a path', () => {
    expect(() => validateState(withActivity({ hintsUsed: 4 }))).toThrow(/hintsUsed/);
    expect(() => validateState(withActivity({ hintsUsed: 1.5 }))).toThrow(/hintsUsed/);
    expect(() => validateState(withActivity({ hintsUsed: -1 }))).toThrow(/hintsUsed/);
    expect(() => validateState(withActivity({ hintsUsed: '2' }))).toThrow(/hintsUsed/);
    expect(() => validateState(withActivity({ postponed: 'yes' }))).toThrow(/postponed/);
    expect(() => validateState({ ...base, settings: { ...base.settings, roadmapView: 'list' } })).toThrow(/roadmapView/);
    expect(() => validateState({ ...base, queue: 'two-sum' })).toThrow(/queue/);
    expect(() => validateState({ ...base, queue: ['a', 'a'] })).toThrow(/duplicate/);
    expect(() => validateState({ ...base, queue: [1] })).toThrow(/queue\[0\]/);
  });
});
