import { describe, expect, it } from 'vitest';
import {
  CSV_HEADER,
  buildLogRows,
  filterLogRows,
  logRowsToCsv,
  summarizeLogRows,
  type LogRow,
} from './logs';
import { START, day, newState, planAndComplete, simulateDay } from './testing';
import type { Activity, AppState } from './types';

function withActivity(
  state: AppState,
  activity: Partial<Activity> & Pick<Activity, 'id' | 'slug' | 'type'>,
): AppState {
  const full: Activity = {
    dueDate: day(1),
    status: 'skipped',
    timer: { startedAt: null, accumulatedMs: 0, running: false },
    createdAt: START,
    ...activity,
  };
  return { ...state, activities: [...state.activities, full] };
}

/**
 * Day 1: two-sum (Easy) solo in 20 min and valid-anagram (Easy) with a hint in 30 min, both done;
 * group-anagrams (Medium) postponed; a recall of two-sum skipped on day 2.
 */
function sampleState(): AppState {
  let state = newState();
  state = planAndComplete(state, day(1), 'two-sum', 'new', 'solo', 20);
  state = planAndComplete(state, day(1), 'valid-anagram', 'new', 'hint', 30);
  state = withActivity(state, {
    id: 'new:group-anagrams:postponed',
    slug: 'group-anagrams',
    type: 'new',
    postponed: true,
  });
  state = withActivity(state, {
    id: 'recall:two-sum:skipped',
    slug: 'two-sum',
    type: 'recall',
    dueDate: day(2),
  });
  return state;
}

describe('buildLogRows', () => {
  it('lists done and skipped activities, newest first, and ignores open ones', () => {
    const state = withActivity(sampleState(), {
      id: 'new:top-k:planned',
      slug: 'top-k-frequent-elements',
      type: 'new',
      status: 'planned',
    });
    const rows = buildLogRows(state);
    expect(rows.map((r) => r.id)).toEqual([
      'recall:two-sum:skipped',
      'new:group-anagrams:postponed',
      `new:valid-anagram:${day(1)}`,
      `new:two-sum:${day(1)}`,
    ]);
    expect(rows.map((r) => r.date)).toEqual([day(2), day(1), day(1), day(1)]);
  });

  it('fills problem facts, program day, logged time, budget and delta', () => {
    const row = buildLogRows(sampleState()).find((r) => r.slug === 'valid-anagram')!;
    expect(row).toMatchObject({
      type: 'new',
      title: 'Valid Anagram',
      difficulty: 'Easy',
      category: 'Arrays & Hashing',
      programDay: 1,
      loggedMinutes: 30,
      budgetMinutes: 25,
      deltaMinutes: 5,
      outcome: 'hint',
      hintsUsed: 0,
      status: 'done',
    });
  });

  it('marks skipped and postponed activities without logged time', () => {
    const rows = buildLogRows(sampleState());
    const postponed = rows.find((r) => r.status === 'postponed')!;
    expect(postponed.slug).toBe('group-anagrams');
    expect(postponed.loggedMinutes).toBeUndefined();
    expect(postponed.deltaMinutes).toBeUndefined();
    const skipped = rows.find((r) => r.status === 'skipped')!;
    expect(skipped).toMatchObject({ type: 'recall', programDay: 2, budgetMinutes: 5 });
  });

  it('uses the budget overrides from the settings', () => {
    const state = sampleState();
    const custom: AppState = { ...state, settings: { ...state.settings, budgets: { new: { Easy: 10 } } } };
    const row = buildLogRows(custom).find((r) => r.slug === 'two-sum' && r.type === 'new')!;
    expect(row.budgetMinutes).toBe(10);
    expect(row.deltaMinutes).toBe(10);
  });

  it('keeps approach time and hints used, and tolerates unknown problems', () => {
    const state = withActivity(newState(), {
      id: 'new:made-up:1',
      slug: 'made-up',
      type: 'new',
      status: 'done',
      completedAt: day(3),
      totalMs: 60_000,
      approachMs: 30_000,
      hintsUsed: 2,
      outcome: 'solution',
    });
    const [row] = buildLogRows(state);
    expect(row).toMatchObject({
      title: 'made-up',
      approachMinutes: 0.5,
      hintsUsed: 2,
      budgetMinutes: 40,
      programDay: 3,
    });
    expect(row?.difficulty).toBeUndefined();
    expect(row?.category).toBeUndefined();
  });

  it('is empty for a fresh state', () => {
    expect(buildLogRows(newState())).toEqual([]);
  });
});

describe('filterLogRows', () => {
  const rows = buildLogRows(sampleState());

  it('returns everything without filters', () => {
    expect(filterLogRows(rows, {})).toHaveLength(rows.length);
    expect(filterLogRows(rows, { search: '   ' })).toHaveLength(rows.length);
  });

  it('filters by type, difficulty, outcome and category', () => {
    expect(filterLogRows(rows, { type: 'recall' }).map((r) => r.slug)).toEqual(['two-sum']);
    expect(filterLogRows(rows, { difficulty: 'Hard' })).toEqual([]);
    expect(filterLogRows(rows, { difficulty: 'Easy' })).toHaveLength(3);
    expect(filterLogRows(rows, { difficulty: 'Medium' }).map((r) => r.slug)).toEqual(['group-anagrams']);
    expect(filterLogRows(rows, { outcome: 'hint' }).map((r) => r.slug)).toEqual(['valid-anagram']);
    expect(filterLogRows(rows, { category: 'Two Pointers' })).toEqual([]);
    expect(filterLogRows(rows, { category: 'Arrays & Hashing' })).toHaveLength(4);
  });

  it('filters by an inclusive date range', () => {
    expect(filterLogRows(rows, { from: day(2) })).toHaveLength(1);
    expect(filterLogRows(rows, { to: day(1) })).toHaveLength(3);
    expect(filterLogRows(rows, { from: day(1), to: day(1) })).toHaveLength(3);
    expect(filterLogRows(rows, { from: day(3) })).toEqual([]);
  });

  it('searches the title case-insensitively and combines filters', () => {
    expect(
      filterLogRows(rows, { search: 'ANAGRAM' })
        .map((r) => r.slug)
        .sort(),
    ).toEqual(['group-anagrams', 'valid-anagram']);
    expect(filterLogRows(rows, { search: 'anagram', type: 'new', outcome: 'hint' })).toHaveLength(1);
    expect(filterLogRows(rows, { search: 'nothing-like-this' })).toEqual([]);
  });
});

describe('summarizeLogRows', () => {
  it('counts rows and averages over the done ones only', () => {
    const summary = summarizeLogRows(buildLogRows(sampleState()));
    expect(summary.count).toBe(4);
    expect(summary.doneCount).toBe(2);
    expect(summary.totalMinutes).toBe(50);
    expect(summary.averageMinutes).toBe(25);
    expect(summary.averageBudgetMinutes).toBe(25);
    expect(summary.averageDeltaMinutes).toBe(0);
    expect(summary.soloRate).toBe(0.5);
  });

  it('has no averages without done rows', () => {
    const skippedOnly = buildLogRows(sampleState()).filter((r) => r.status !== 'done');
    expect(summarizeLogRows(skippedOnly)).toEqual({
      count: 2,
      doneCount: 0,
      totalMinutes: 0,
      averageMinutes: null,
      averageBudgetMinutes: null,
      averageDeltaMinutes: null,
      soloRate: null,
    });
    expect(summarizeLogRows([]).count).toBe(0);
  });

  it('follows the filtered set', () => {
    const rows = filterLogRows(buildLogRows(sampleState()), { outcome: 'solo' });
    expect(summarizeLogRows(rows)).toMatchObject({
      count: 1,
      totalMinutes: 20,
      soloRate: 1,
      averageDeltaMinutes: -5,
    });
  });
});

describe('logRowsToCsv', () => {
  it('writes the header and one CRLF-terminated line per row', () => {
    const lines = logRowsToCsv(buildLogRows(sampleState())).split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines).toHaveLength(1 + 4 + 1); // header, four rows, empty tail after the final CRLF
    expect(lines[lines.length - 1]).toBe('');
    expect(lines).toContain(
      `${day(1)},1,new,Valid Anagram,valid-anagram,Easy,Arrays & Hashing,30,,25,5,hint,0,done`,
    );
    expect(lines).toContain(`${day(2)},2,recall,Two Sum,two-sum,Easy,Arrays & Hashing,,,5,,,0,skipped`);
  });

  it('only has the header for no rows', () => {
    expect(logRowsToCsv([])).toBe(`${CSV_HEADER.join(',')}\r\n`);
  });

  it('quotes fields with commas, quotes or line breaks', () => {
    const row: LogRow = {
      id: 'x',
      date: day(1),
      programDay: 1,
      type: 'new',
      slug: 'odd',
      title: 'Say "hi", then\nleave',
      budgetMinutes: 40,
      hintsUsed: 0,
      status: 'skipped',
    };
    expect(logRowsToCsv([row]).split('\r\n')[1]).toBe(
      `${day(1)},1,new,"Say ""hi"", then\nleave",odd,,,,,40,,,0,skipped`,
    );
  });

  it('rounds minutes to one decimal', () => {
    const [row] = buildLogRows(
      withActivity(newState(), {
        id: 'a',
        slug: 'two-sum',
        type: 'recall',
        status: 'done',
        completedAt: day(2),
        totalMs: 100_000,
        outcome: 'solo',
      }),
    );
    expect(logRowsToCsv([row!])).toContain(',1.7,,5,-3.3,solo,');
  });
});

describe('logs of a simulated program', () => {
  it('lists every completed activity and sums to the logged time', () => {
    let state = newState();
    for (let d = 1; d <= 5; d += 1) state = simulateDay(state, day(d)).state;
    const rows = buildLogRows(state);
    expect(rows).toHaveLength(state.activities.filter((a) => a.status === 'done').length);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i - 1]!.date >= rows[i]!.date).toBe(true);
    const total = state.activities.reduce((n, a) => n + (a.totalMs ?? 0), 0) / 60_000;
    expect(summarizeLogRows(rows).totalMinutes).toBeCloseTo(total);
    expect(summarizeLogRows(rows).soloRate).toBe(1);
  });
});
