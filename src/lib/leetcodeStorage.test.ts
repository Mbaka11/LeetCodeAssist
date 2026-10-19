import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  LEETCODE_PREFS_KEY,
  PROFILE_CACHE_KEY,
  SUBMISSION_EVENTS_KEY,
  createLeetCodeStorage,
  createWatchedValue,
  normalizePrefs,
} from './leetcodeStorage';
import { MAX_STORED_EVENTS, normalizeEvents, type SubmissionEvent } from './leetcodeSubmissions';
import { createMockChromeStorage, flush } from './testing';

const event = (at: number, patch: Partial<SubmissionEvent> = {}): SubmissionEvent => ({
  type: 'check',
  slug: 'two-sum',
  state: 'SUCCESS',
  status_msg: 'Accepted',
  lang: 'python3',
  at,
  ...patch,
});

describe('LeetCode prefs', () => {
  it('defaults to detection on and no username', async () => {
    const mock = createMockChromeStorage();
    expect(await createLeetCodeStorage(mock.area).readPrefs()).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs('junk')).toEqual(DEFAULT_PREFS);
  });

  it('defaults the side-panel indicator off and changes visibility independently of detection and username', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    expect((await storage.readPrefs()).showDetectionStatus ?? false).toBe(false);
    expect(normalizePrefs({ detectionEnabled: true }).showDetectionStatus ?? false).toBe(false);
    await storage.updatePrefs({ username: 'Neo', showDetectionStatus: true });
    expect(await storage.readPrefs()).toMatchObject({ detectionEnabled: true, username: 'Neo', showDetectionStatus: true });
    await storage.updatePrefs({ showDetectionStatus: false });
    expect(await storage.readPrefs()).toEqual({ detectionEnabled: true, username: 'Neo' });
    await storage.updatePrefs({ detectionEnabled: false, showDetectionStatus: true });
    expect(await storage.readPrefs()).toMatchObject({ detectionEnabled: false, showDetectionStatus: true });
  });

  it('updates and clears fields, validating the username', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    expect(await storage.updatePrefs({ username: 'Neo' })).toEqual({ detectionEnabled: true, username: 'Neo' });
    expect(await storage.updatePrefs({ detectionEnabled: false })).toEqual({ detectionEnabled: false, username: 'Neo' });
    expect(await storage.updatePrefs({ username: 'bad name!' })).toEqual({ detectionEnabled: false });
    expect(await storage.updatePrefs({ username: 'Neo' })).toMatchObject({ username: 'Neo' });
    expect(await storage.updatePrefs({ username: null })).toEqual({ detectionEnabled: false });
    expect(mock.data[LEETCODE_PREFS_KEY]).toEqual({ detectionEnabled: false });
  });
});

describe('submission event log', () => {
  it('appends concurrently without losing events (atomic read-modify-write)', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    await Promise.all(Array.from({ length: 30 }, (_, i) => storage.appendEvent(event(10_000 * (i + 1), { status_msg: `Msg ${i}` }))));
    const events = await storage.readEvents();
    expect(events).toHaveLength(30);
    expect(new Set(events.map((e) => e.status_msg)).size).toBe(30);
  });

  it('keeps at most 200 events, newest last, in its own storage key', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    for (let i = 0; i < MAX_STORED_EVENTS + 5; i += 1) await storage.appendEvent(event(10_000 * (i + 1), { status_msg: `Msg ${i}` }));
    const events = await storage.readEvents();
    expect(events).toHaveLength(MAX_STORED_EVENTS);
    expect(events.at(-1)?.status_msg).toBe(`Msg ${MAX_STORED_EVENTS + 4}`);
    expect(Object.keys(mock.data)).toEqual([SUBMISSION_EVENTS_KEY]);
  });

  it('clears the list, and drops invalid stored entries when reading', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    mock.data[SUBMISSION_EVENTS_KEY] = [event(1), { junk: true }, 'x'];
    expect(await storage.readEvents()).toEqual([event(1)]);
    await storage.clearEvents();
    expect(await storage.readEvents()).toEqual([]);
    expect(normalizeEvents(undefined)).toEqual([]);
  });

  it('clearAll removes prefs, events and the profile cache but nothing else', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    mock.data['leetcodeAssist.state.v1'] = { keep: true };
    await storage.updatePrefs({ username: 'Neo' });
    await storage.appendEvent(event(1));
    await storage.writeProfile({ username: 'Neo', fetchedAt: 1, attemptedAt: 1 });
    expect(Object.keys(mock.data).sort()).toEqual(
      ['leetcodeAssist.state.v1', LEETCODE_PREFS_KEY, PROFILE_CACHE_KEY, SUBMISSION_EVENTS_KEY].sort(),
    );
    await storage.clearAll();
    expect(Object.keys(mock.data)).toEqual(['leetcodeAssist.state.v1']);
  });
});

describe('createWatchedValue', () => {
  it('loads the stored value and follows storage changes, unsubscribing cleanly', async () => {
    const mock = createMockChromeStorage();
    mock.data[SUBMISSION_EVENTS_KEY] = [event(1)];
    const watched = createWatchedValue<readonly SubmissionEvent[]>(SUBMISSION_EVENTS_KEY, normalizeEvents, [], () => ({
      area: mock.area,
      changed: mock.changed,
    }));
    expect(watched.getSnapshot()).toEqual([]);
    let notified = 0;
    const stop = watched.subscribe(() => (notified += 1));
    await flush();
    expect(watched.getSnapshot()).toEqual([event(1)]);
    await createLeetCodeStorage(mock.area).appendEvent(event(60_000));
    await flush();
    expect(watched.getSnapshot()).toHaveLength(2);
    expect(notified).toBeGreaterThanOrEqual(2);
    stop();
    expect(mock.listenerCount()).toBe(0);
  });
});
