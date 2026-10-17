import { describe, expect, it } from 'vitest';
import { REFRESH_PROFILE_KIND, createLeetCodeBackground } from './leetcodeBackground';
import { errorFromStatus, type FetchCalendarResult } from './leetcodeProfile';
import { createLeetCodeStorage } from './leetcodeStorage';
import { RUNTIME_SUBMISSION_KIND } from './leetcodeSubmissions';
import { createMockChromeStorage } from './testing';

const EXT_ID = 'abcdefghijklmnop';
const EXT_URL = 'chrome-extension://abcdefghijklmnop/';
const PAGE_SENDER = { id: EXT_ID, url: 'https://leetcode.com/problems/two-sum/description/' };
const EXT_SENDER = { id: EXT_ID, url: `${EXT_URL}dashboard.html#/calendar` };
const event = { type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Accepted', lang: 'python3', at: 1 };
const okResult: FetchCalendarResult = {
  ok: true,
  calendar: { reportedStreak: null, reportedActiveDays: null, activeYears: [], days: {} },
};

function setup(fetchResult: FetchCalendarResult = okResult, now = () => 5_000_000) {
  const mock = createMockChromeStorage();
  const storage = createLeetCodeStorage(mock.area);
  const fetches: string[] = [];
  const background = createLeetCodeBackground({
    storage,
    extensionId: EXT_ID,
    extensionUrlPrefix: EXT_URL,
    fetchCalendar: async (username) => {
      fetches.push(username);
      return fetchResult;
    },
    now,
  });
  return { storage, background, fetches };
}

describe('submission events', () => {
  it('stores a valid event stamped with the time of receipt', async () => {
    const { background, storage } = setup();
    const reply = await background.handleMessage({ kind: RUNTIME_SUBMISSION_KIND, event }, PAGE_SENDER);
    expect(reply).toEqual({ stored: true });
    expect(await storage.readEvents()).toEqual([{ ...event, at: 5_000_000 }]);
  });

  it('drops invalid events and events while detection is off', async () => {
    const { background, storage } = setup();
    expect(await background.handleMessage({ kind: RUNTIME_SUBMISSION_KIND, event: { ...event, slug: '../x' } }, PAGE_SENDER)).toEqual({
      stored: false,
    });
    await storage.updatePrefs({ detectionEnabled: false });
    expect(await background.handleMessage({ kind: RUNTIME_SUBMISSION_KIND, event }, PAGE_SENDER)).toEqual({ stored: false });
    expect(await storage.readEvents()).toEqual([]);
  });

  it('ignores messages from other extensions, other pages and non-objects', () => {
    const { background } = setup();
    const message = { kind: RUNTIME_SUBMISSION_KIND, event };
    expect(background.handleMessage(message, { id: 'someone-else', url: PAGE_SENDER.url })).toBeNull();
    expect(background.handleMessage(message, { id: EXT_ID, url: 'https://example.com/problems/x/' })).toBeNull();
    expect(background.handleMessage(message, { id: EXT_ID })).toBeNull();
    expect(background.handleMessage('hello', PAGE_SENDER)).toBeNull();
    expect(background.handleMessage({ kind: 'unknown' }, PAGE_SENDER)).toBeNull();
  });
});

describe('profile refresh', () => {
  const refresh = { kind: REFRESH_PROFILE_KIND, force: false };

  it('does nothing without a username', async () => {
    const { background, fetches } = setup();
    expect(await background.handleMessage(refresh, EXT_SENDER)).toEqual({ ok: true, cache: null });
    expect(fetches).toEqual([]);
  });

  it('fetches once, then serves the cache within the hour', async () => {
    const { background, storage, fetches } = setup();
    await storage.updatePrefs({ username: 'Neo' });
    await background.handleMessage(refresh, EXT_SENDER);
    await background.handleMessage(refresh, EXT_SENDER);
    expect(fetches).toEqual(['Neo']);
    expect(await storage.readProfile()).toMatchObject({ username: 'Neo', fetchedAt: 5_000_000 });
  });

  it('shares one request between concurrent callers', async () => {
    const { background, storage, fetches } = setup();
    await storage.updatePrefs({ username: 'Neo' });
    await Promise.all([background.handleMessage(refresh, EXT_SENDER), background.handleMessage(refresh, EXT_SENDER)]);
    expect(fetches).toHaveLength(1);
  });

  it('stores an error and does not retry after a 429', async () => {
    const { background, storage, fetches } = setup({ ok: false, error: errorFromStatus(429) });
    await storage.updatePrefs({ username: 'Neo' });
    await background.handleMessage({ kind: REFRESH_PROFILE_KIND, force: true }, EXT_SENDER);
    await background.handleMessage({ kind: REFRESH_PROFILE_KIND, force: true }, EXT_SENDER);
    expect(fetches).toHaveLength(1);
    expect((await storage.readProfile())?.error?.kind).toBe('rate-limited');
  });

  it('only extension pages may request a refresh', async () => {
    const { background, storage, fetches } = setup();
    await storage.updatePrefs({ username: 'Neo' });
    expect(background.handleMessage(refresh, PAGE_SENDER)).toBeNull();
    expect(background.handleMessage(refresh, { id: EXT_ID, url: 'https://evil.test/' })).toBeNull();
    expect(fetches).toEqual([]);
  });
});
