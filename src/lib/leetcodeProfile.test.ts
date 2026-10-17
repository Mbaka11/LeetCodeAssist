import { describe, expect, it } from 'vitest';
import {
  BLOCK_MS,
  GRAPHQL_URL,
  MANUAL_COOLDOWN_MS,
  REFRESH_INTERVAL_MS,
  computeStreakStats,
  errorFromStatus,
  fetchUserCalendar,
  formatAgo,
  heatGrid,
  heatLevel,
  normalizeProfileCache,
  parseCalendarResponse,
  parseSubmissionCalendar,
  profileUrl,
  refreshProfile,
  shouldRefresh,
  utcDayStart,
  validateUsername,
  type FetchCalendarResult,
  type ProfileCache,
  type RefreshDeps,
} from './leetcodeProfile';

const DAY = 86_400;
/** 2025-03-12 (a Wednesday) at 15:30 UTC. */
const NOW = Date.UTC(2025, 2, 12, 15, 30);
const TODAY = utcDayStart(NOW);
const key = (offsetDays: number): string => String(TODAY + offsetDays * DAY);
function calendar(offsets: Record<number, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(offsets).map(([o, c]) => [key(Number(o)), c]));
}

describe('validateUsername', () => {
  it('accepts letters, digits, underscore, hyphen and dot up to 40 characters', () => {
    for (const name of ['a', 'Neo_99', 'a.b-c', 'x'.repeat(40)]) {
      expect(validateUsername(name)).toEqual({ ok: true, username: name });
    }
    expect(validateUsername('  padded  ')).toEqual({ ok: true, username: 'padded' });
  });

  it('rejects empty, too long and unsafe names', () => {
    for (const name of ['', '   ', 'x'.repeat(41), 'a b', 'a/b', 'é', 'a?b=1', '../x', '<b>']) {
      expect(validateUsername(name).ok, name).toBe(false);
    }
  });

  it('builds the public profile link', () => {
    expect(profileUrl('Neo_99')).toBe('https://leetcode.com/u/Neo_99/');
  });
});

describe('parseSubmissionCalendar', () => {
  it('parses the JSON string of day-start seconds to counts', () => {
    const raw = JSON.stringify({ [key(0)]: 3, [key(-1)]: 1 });
    expect(parseSubmissionCalendar(raw)).toEqual({ [key(0)]: 3, [key(-1)]: 1 });
  });

  it('snaps timestamps to the UTC day and merges them', () => {
    const noon = String(TODAY + 12 * 3600);
    expect(parseSubmissionCalendar({ [key(0)]: 1, [noon]: 2 })).toEqual({ [key(0)]: 3 });
  });

  it('skips invalid keys and counts and survives garbage', () => {
    expect(
      parseSubmissionCalendar(JSON.stringify({ abc: 1, '-5': 1, [key(0)]: -2, [key(1)]: 'x', [key(2)]: 4.9 })),
    ).toEqual({ [key(2)]: 4 });
    for (const bad of ['{nope', '[]', 'null', 5, null, undefined, [1, 2]]) {
      expect(parseSubmissionCalendar(bad)).toEqual({});
    }
  });

  it('bounds the number of days', () => {
    const many = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [String((i + 1) * DAY), 1]));
    expect(Object.keys(parseSubmissionCalendar(many)).length).toBeLessThanOrEqual(800);
  });
});

describe('parseCalendarResponse', () => {
  const body = (userCalendar: unknown): unknown => ({ data: { matchedUser: { userCalendar } } });

  it('reads the calendar fields', () => {
    const parsed = parseCalendarResponse(
      body({
        streak: 4,
        totalActiveDays: 40,
        activeYears: [2024, 2025],
        submissionCalendar: JSON.stringify({ [key(0)]: 2 }),
      }),
    );
    expect(parsed).toEqual({
      ok: true,
      calendar: { reportedStreak: 4, reportedActiveDays: 40, activeYears: [2024, 2025], days: { [key(0)]: 2 } },
    });
  });

  it('tolerates missing optional fields', () => {
    expect(parseCalendarResponse(body({}))).toEqual({
      ok: true,
      calendar: { reportedStreak: null, reportedActiveDays: null, activeYears: [], days: {} },
    });
  });

  it('maps a null user to user-not-found and other shapes to bad-response', () => {
    expect(parseCalendarResponse({ data: { matchedUser: null }, errors: [{ message: 'x' }] })).toMatchObject({
      ok: false,
      error: { kind: 'user-not-found' },
    });
    for (const bad of [null, 'x', {}, { data: null }, { data: {} }, { data: { matchedUser: 5 } }, { data: { matchedUser: {} } }]) {
      expect(parseCalendarResponse(bad)).toMatchObject({ ok: false, error: { kind: 'bad-response' } });
    }
  });
});

describe('errorFromStatus', () => {
  it('maps HTTP statuses to clear errors', () => {
    expect(errorFromStatus(429).kind).toBe('rate-limited');
    expect(errorFromStatus(403).kind).toBe('forbidden');
    expect(errorFromStatus(401).kind).toBe('forbidden');
    expect(errorFromStatus(500).kind).toBe('server');
    expect(errorFromStatus(503).kind).toBe('server');
    expect(errorFromStatus(404).kind).toBe('http');
    expect(errorFromStatus(429).message).toMatch(/slow down/);
  });
});

describe('fetchUserCalendar', () => {
  const okBody = JSON.stringify({ data: { matchedUser: { userCalendar: { submissionCalendar: '{}' } } } });

  it('sends one anonymous POST to the GraphQL endpoint', async () => {
    const calls: Array<[string, RequestInit]> = [];
    const result = await fetchUserCalendar('Neo', {
      fetchImpl: ((url: string, init: RequestInit) => {
        calls.push([url, init]);
        return Promise.resolve(new Response(okBody));
      }) as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toBe(GRAPHQL_URL);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.redirect).toBe('error');
    expect(init.headers).toEqual({ 'content-type': 'application/json' }); // no cookie, token or csrf header
    expect(JSON.parse(init.body as string).variables).toEqual({ username: 'Neo' });
  });

  it('never retries: 429, 403 and 5xx each cost exactly one request', async () => {
    for (const [status, kind] of [
      [429, 'rate-limited'],
      [403, 'forbidden'],
      [500, 'server'],
    ] as const) {
      let calls = 0;
      const result = await fetchUserCalendar('Neo', {
        fetchImpl: (() => {
          calls += 1;
          return Promise.resolve(new Response('', { status }));
        }) as typeof fetch,
      });
      expect(result).toMatchObject({ ok: false, error: { kind } });
      expect(calls).toBe(1);
    }
  });

  it('maps network failure, timeout, oversized and invalid bodies', async () => {
    const run = (impl: typeof fetch, opts = {}) => fetchUserCalendar('Neo', { fetchImpl: impl, ...opts });
    expect(await run((() => Promise.reject(new TypeError('offline'))) as typeof fetch)).toMatchObject({
      error: { kind: 'network' },
    });
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    expect(await run(hang, { timeoutMs: 10 })).toMatchObject({ error: { kind: 'timeout' } });
    expect(await run((() => Promise.resolve(new Response('x'.repeat(500)))) as typeof fetch, { maxBytes: 100 })).toMatchObject({
      error: { kind: 'too-large' },
    });
    expect(await run((() => Promise.resolve(new Response('<html>'))) as typeof fetch)).toMatchObject({
      error: { kind: 'bad-response' },
    });
  });

  it('refuses an invalid username without a request', async () => {
    let calls = 0;
    const result = await fetchUserCalendar('bad name', {
      fetchImpl: (() => {
        calls += 1;
        return Promise.resolve(new Response(okBody));
      }) as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
  });
});

describe('computeStreakStats (UTC days)', () => {
  it('counts consecutive days ending today', () => {
    const stats = computeStreakStats(calendar({ 0: 2, [-1]: 1, [-2]: 5, [-4]: 1 }), NOW);
    expect(stats).toMatchObject({ current: 3, longest: 3, activeToday: true });
  });

  it('keeps the streak alive when today has no submission yet but yesterday has', () => {
    const stats = computeStreakStats(calendar({ [-1]: 1, [-2]: 1 }), NOW);
    expect(stats).toMatchObject({ current: 2, activeToday: false });
  });

  it('is zero after a missed day', () => {
    expect(computeStreakStats(calendar({ [-2]: 1, [-3]: 1 }), NOW).current).toBe(0);
    expect(computeStreakStats({}, NOW)).toEqual({ current: 0, longest: 0, activeDaysThisYear: 0, activeToday: false });
  });

  it('finds the longest run in the data and ignores zero counts', () => {
    const stats = computeStreakStats(calendar({ [-10]: 1, [-9]: 1, [-8]: 1, [-7]: 1, [-6]: 0, [-5]: 1, [-4]: 1, 0: 1 }), NOW);
    expect(stats.longest).toBe(4);
    expect(stats.current).toBe(1);
  });

  it('uses UTC day boundaries, not local time', () => {
    const justAfterMidnightUtc = Date.UTC(2025, 2, 12, 0, 0, 1);
    const justBeforeMidnightUtc = Date.UTC(2025, 2, 11, 23, 59, 59);
    const days = { [String(Date.UTC(2025, 2, 11) / 1000)]: 1 };
    // Just before UTC midnight: 11 March is today and active.
    expect(computeStreakStats(days, justBeforeMidnightUtc)).toMatchObject({ current: 1, activeToday: true });
    // One second later it is yesterday: the streak is still alive but today is open.
    expect(computeStreakStats(days, justAfterMidnightUtc)).toMatchObject({ current: 1, activeToday: false });
    // A day later than that the streak is broken.
    expect(computeStreakStats(days, justAfterMidnightUtc + DAY * 1000).current).toBe(0);
  });

  it('counts active days of the current UTC year only', () => {
    const lastYear = String(Date.UTC(2024, 11, 31) / 1000);
    const days = { [lastYear]: 1, [key(0)]: 1, [key(-1)]: 1 };
    expect(computeStreakStats(days, NOW).activeDaysThisYear).toBe(2);
  });
});

describe('heat grid', () => {
  it('has 16 week columns of 7 days ending with the week of today', () => {
    const grid = heatGrid(calendar({ 0: 12, [-1]: 3, [-3]: 1 }), NOW);
    expect(grid).toHaveLength(16);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    const last = grid.at(-1)!;
    // 12 March 2025 is a Wednesday: Sunday..Wednesday are past or today, Thursday..Saturday are future.
    expect(last.map((c) => c.future)).toEqual([false, false, false, false, true, true, true]);
    expect(last[3]).toMatchObject({ dayStart: TODAY, count: 12, level: 4 });
    expect(last[2]).toMatchObject({ count: 3, level: 2 });
    expect(last[0]).toMatchObject({ count: 1, level: 1 });
    expect(grid[0]![0]!.dayStart).toBe(TODAY - 3 * DAY - 15 * 7 * DAY);
  });

  it('maps counts to five levels', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 99].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('cache and refresh policy', () => {
  const cache = (patch: Partial<ProfileCache> = {}): ProfileCache => ({
    username: 'neo',
    fetchedAt: NOW - 1000,
    attemptedAt: NOW - 1000,
    ...patch,
  });

  it('refreshes at most once an hour automatically and once a minute manually', () => {
    expect(shouldRefresh(null, 'neo', false, NOW)).toBe(true);
    expect(shouldRefresh(cache(), 'neo', false, NOW)).toBe(false);
    expect(shouldRefresh(cache({ attemptedAt: NOW - REFRESH_INTERVAL_MS }), 'neo', false, NOW)).toBe(true);
    expect(shouldRefresh(cache(), 'neo', true, NOW)).toBe(false);
    expect(shouldRefresh(cache({ attemptedAt: NOW - MANUAL_COOLDOWN_MS }), 'neo', true, NOW)).toBe(true);
  });

  it('does not retry a failed refresh automatically within the hour', () => {
    const failed = cache({ fetchedAt: null, attemptedAt: NOW - 5 * 60_000, error: errorFromStatus(500) });
    expect(shouldRefresh(failed, 'neo', false, NOW)).toBe(false);
  });

  it('refreshes at once for a different username, but not while blocked', () => {
    expect(shouldRefresh(cache(), 'trinity', false, NOW)).toBe(true);
    const blocked = cache({ attemptedAt: NOW - 2 * REFRESH_INTERVAL_MS, blockedUntil: NOW + 1000 });
    expect(shouldRefresh(blocked, 'neo', true, NOW)).toBe(false);
    expect(shouldRefresh(blocked, 'trinity', true, NOW)).toBe(false);
    expect(shouldRefresh({ ...blocked, blockedUntil: NOW - 1 }, 'neo', true, NOW)).toBe(true);
  });

  function deps(stored: ProfileCache | null, result: FetchCalendarResult) {
    const calls: string[] = [];
    let current = stored;
    const d: RefreshDeps = {
      read: async () => current,
      write: async (c) => {
        current = c;
      },
      fetchCalendar: async (username) => {
        calls.push(username);
        return result;
      },
      now: () => NOW,
    };
    return { d, calls, get: () => current };
  }

  const sampleCalendar = { reportedStreak: 1, reportedActiveDays: 1, activeYears: [2025], days: { [key(0)]: 1 } };
  const okResult: FetchCalendarResult = { ok: true, calendar: sampleCalendar };

  it('stores a successful fetch', async () => {
    const t = deps(null, okResult);
    const next = await refreshProfile(t.d, 'neo', false);
    expect(next).toMatchObject({ username: 'neo', fetchedAt: NOW, attemptedAt: NOW });
    expect(next?.error).toBeUndefined();
    expect(t.calls).toEqual(['neo']);
  });

  it('keeps the previous numbers next to an error and blocks after 429 / 403', async () => {
    const old = cache({ fetchedAt: NOW - REFRESH_INTERVAL_MS - 5, attemptedAt: NOW - REFRESH_INTERVAL_MS - 5, calendar: sampleCalendar });
    const t = deps(old, { ok: false, error: errorFromStatus(429) });
    const next = await refreshProfile(t.d, 'neo', false);
    expect(next?.calendar).toBeDefined();
    expect(next?.fetchedAt).toBe(old.fetchedAt);
    expect(next?.error?.kind).toBe('rate-limited');
    expect(next?.blockedUntil).toBe(NOW + BLOCK_MS);
    // Even the Refresh button now does nothing.
    const again = await refreshProfile({ ...t.d, now: () => NOW + MANUAL_COOLDOWN_MS * 2 }, 'neo', true);
    expect(again).toBe(t.get());
    expect(t.calls).toHaveLength(1);
  });

  it('does not keep another user\'s numbers after an error', async () => {
    const old = cache({ username: 'someone', calendar: sampleCalendar });
    const t = deps(old, { ok: false, error: errorFromStatus(500) });
    const next = await refreshProfile(t.d, 'neo', false);
    expect(next?.calendar).toBeUndefined();
    expect(next?.fetchedAt).toBeNull();
    expect(next?.blockedUntil).toBeUndefined();
  });

  it('normalises a stored cache defensively', () => {
    expect(normalizeProfileCache(null)).toBeNull();
    expect(normalizeProfileCache({ username: 'bad name', attemptedAt: 1 })).toBeNull();
    expect(normalizeProfileCache({ username: 'neo', attemptedAt: 'x' })).toBeNull();
    const roundTrip = normalizeProfileCache(JSON.parse(JSON.stringify({ ...cache(), error: errorFromStatus(500) })));
    expect(roundTrip?.error?.kind).toBe('server');
    expect(normalizeProfileCache({ username: 'neo', attemptedAt: 1, error: { kind: 'made-up' } })?.error).toBeUndefined();
  });

  it('formats the age of the data', () => {
    expect(formatAgo(NOW - 20_000, NOW)).toBe('just now');
    expect(formatAgo(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(formatAgo(NOW - 3 * 3600_000, NOW)).toBe('3 h ago');
    expect(formatAgo(NOW + 5000, NOW)).toBe('just now');
  });
});
