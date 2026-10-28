import { describe, expect, it } from 'vitest';
import { defaultState, deserializeState, serializeState, validateState } from '../core/state';
import { createActions } from './actions';
import {
  BackupSectionError,
  LEETCODE_SETTINGS_KEY,
  readLeetCodeSettingsSection,
  restoreLeetCodeSettings,
  validateLeetCodeSettingsSection,
  withLeetCodeSettings,
} from './backupFile';
import {
  LEETCODE_PREFS_KEY,
  PROFILE_CACHE_KEY,
  SUBMISSION_EVENTS_KEY,
  createLeetCodeStorage,
} from './leetcodeStorage';
import { createMockChromeStorage, createTestApp } from './testing';
import { STORAGE_KEY } from './storage';
import { SYNC_CONFIG } from './sync';

const START = '2025-01-06';

async function exportWith(prefs: { detectionEnabled: boolean; username?: string; showDetectionStatus?: boolean }) {
  const { actions, store, mock } = createTestApp(defaultState(START));
  await actions.toggleChecked('two-sum');
  return { actions, store, mock, json: withLeetCodeSettings(await actions.exportJson(), prefs) };
}

describe('LeetCode settings in the JSON backup', () => {
  it('adds a top-level section with only the three preferences', async () => {
    const { json } = await exportWith({ detectionEnabled: false, username: 'some.user-1', showDetectionStatus: true });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed[LEETCODE_SETTINGS_KEY]).toEqual({ username: 'some.user-1', detectionEnabled: false, showDetectionStatus: true });
    expect(parsed.version).toBe(1);
  });

  it('omits the username when none is set and writes explicit booleans', async () => {
    const { json } = await exportWith({ detectionEnabled: true });
    expect((JSON.parse(json) as Record<string, unknown>)[LEETCODE_SETTINGS_KEY]).toEqual({ detectionEnabled: true, showDetectionStatus: false });
  });

  it('never exports submission events, the profile cache, the sync configuration or other storage keys', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ username: 'alice', detectionEnabled: true });
    await storage.appendEvent({ type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Accepted', lang: 'python', at: 1_700_000_000_000 });
    await storage.writeProfile({ username: 'alice', fetchedAt: 1, attemptedAt: 1, calendar: { streak: 9, totalActiveDays: 9, activeYears: [2025], submissionCalendar: { '1700000000': 4 } } } as never);
    mock.data[SYNC_CONFIG] = { enabled: true, deviceName: 'secret-laptop' };
    const { actions } = createTestApp(defaultState(START));
    const json = withLeetCodeSettings(await actions.exportJson(), await storage.readPrefs());
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([LEETCODE_SETTINGS_KEY, 'activities', 'checked', 'notes', 'problemStatus', 'settings', 'version'].sort());
    for (const needle of ['SUCCESS', 'Accepted', 'submissionCalendar', 'secret-laptop', 'cookie', 'csrf', 'token', SUBMISSION_EVENTS_KEY, PROFILE_CACHE_KEY, SYNC_CONFIG]) {
      expect(json.toLowerCase()).not.toContain(needle.toLowerCase());
    }
    expect(Object.keys(parsed[LEETCODE_SETTINGS_KEY] as object).sort()).toEqual(['detectionEnabled', 'showDetectionStatus', 'username']);
  });

  it('keeps the state part byte-for-byte compatible: serialize/deserialize/validate ignore the section and never keep it', async () => {
    const { json, store } = await exportWith({ detectionEnabled: false, username: 'alice' });
    const original = await store.readState();
    const parsedState = deserializeState(json);
    expect(parsedState).toEqual(original);
    expect(parsedState).not.toHaveProperty(LEETCODE_SETTINGS_KEY);
    expect(validateState(JSON.parse(json))).not.toHaveProperty(LEETCODE_SETTINGS_KEY);
    expect(serializeState(parsedState)).not.toContain(LEETCODE_SETTINGS_KEY);
    expect(serializeState(parsedState)).toBe(serializeState(original));
  });

  it('imports a legacy file without the section exactly as before and reports no section', async () => {
    const { actions, store } = createTestApp(defaultState('2024-01-01'));
    const legacy = serializeState({ ...defaultState(START), checked: { x: true } });
    expect(readLeetCodeSettingsSection(legacy)).toBeNull();
    await actions.importJson(legacy);
    expect((await store.readState()).checked).toEqual({ x: true });
  });

  it('imports a file with the section into the app state (state part only) through importJson', async () => {
    const { json, store } = await exportWith({ detectionEnabled: false, username: 'alice' });
    const target = createTestApp(defaultState('2024-01-01'));
    await target.actions.importJson(json);
    expect(await target.store.readState()).toEqual(await store.readState());
    expect(JSON.stringify(await target.store.readState())).not.toContain('alice');
  });

  it('reads the section back strictly through the same normalizer', async () => {
    const { json } = await exportWith({ detectionEnabled: false, username: ' alice ', showDetectionStatus: true });
    expect(readLeetCodeSettingsSection(json)).toEqual({ detectionEnabled: false, showDetectionStatus: true, username: 'alice' });
    expect(readLeetCodeSettingsSection(JSON.stringify({ [LEETCODE_SETTINGS_KEY]: { detectionEnabled: true, showDetectionStatus: false } })))
      .toEqual({ detectionEnabled: true });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'alice'],
    ['a number', 1],
    ['missing detectionEnabled', { username: 'alice' }],
    ['non-boolean detectionEnabled', { detectionEnabled: 'yes' }],
    ['non-boolean showDetectionStatus', { detectionEnabled: true, showDetectionStatus: 1 }],
    ['non-string username', { detectionEnabled: true, username: 42 }],
    ['empty username', { detectionEnabled: true, username: '  ' }],
    ['invalid username characters', { detectionEnabled: true, username: 'bad name!' }],
    ['too long username', { detectionEnabled: true, username: 'a'.repeat(41) }],
    ['smuggled events', { detectionEnabled: true, events: [{ type: 'check' }] }],
    ['smuggled profile', { detectionEnabled: true, profile: { streak: 3 } }],
    ['smuggled sync config', { detectionEnabled: true, syncConfig: { enabled: true } }],
    ['smuggled cookie', { detectionEnabled: true, cookie: 'x' }],
  ])('rejects a malformed section: %s', (_label, section) => {
    expect(() => validateLeetCodeSettingsSection(section)).toThrow(BackupSectionError);
    const file = JSON.stringify({ ...defaultState(START), [LEETCODE_SETTINGS_KEY]: section });
    expect(() => readLeetCodeSettingsSection(file)).toThrow(BackupSectionError);
  });

  it('refuses a whole import with a malformed section before touching the state or the LeetCode storage', async () => {
    const before = { ...defaultState('2024-01-01'), checked: { before: true } };
    const { actions, store, mock } = createTestApp(before);
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ username: 'keep-me', detectionEnabled: true });
    const file = JSON.stringify({ ...defaultState(START), checked: { imported: true }, [LEETCODE_SETTINGS_KEY]: { detectionEnabled: 'maybe' } });
    await expect(actions.importJson(file)).rejects.toThrow(/leetcodeSettings/);
    expect(await store.readState()).toEqual(before);
    expect(mock.data[STORAGE_KEY]).toEqual(before);
    expect(await storage.readPrefs()).toEqual({ detectionEnabled: true, username: 'keep-me' });
  });

  it('a section with an invalid state still reports the state error and changes nothing', async () => {
    const before = defaultState('2024-01-01');
    const { actions, store } = createTestApp(before);
    await expect(actions.importJson(JSON.stringify({ version: 1, [LEETCODE_SETTINGS_KEY]: { detectionEnabled: true } }))).rejects.toThrow();
    expect(await store.readState()).toEqual(before);
  });

  it('restores exactly the file values, replacing and clearing what was there, and leaves events and profile alone', async () => {
    const mock = createMockChromeStorage();
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ username: 'old-name', detectionEnabled: false, showDetectionStatus: true });
    await storage.appendEvent({ type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Accepted', lang: 'python', at: 5 });
    await restoreLeetCodeSettings(storage, { detectionEnabled: true });
    expect(await storage.readPrefs()).toEqual({ detectionEnabled: true });
    expect(mock.data[LEETCODE_PREFS_KEY]).toEqual({ detectionEnabled: true });
    expect(await storage.readEvents()).toHaveLength(1);
    await restoreLeetCodeSettings(storage, { detectionEnabled: false, showDetectionStatus: true, username: 'new.name' });
    expect(await storage.readPrefs()).toEqual({ detectionEnabled: false, showDetectionStatus: true, username: 'new.name' });
  });

  it('round-trips through export, import and restore on a second profile', async () => {
    const source = createMockChromeStorage();
    const sourceStorage = createLeetCodeStorage(source.area);
    await sourceStorage.updatePrefs({ username: 'roundtrip', detectionEnabled: false, showDetectionStatus: true });
    const { actions } = createTestApp(defaultState(START));
    const json = withLeetCodeSettings(await actions.exportJson(), await sourceStorage.readPrefs());

    const targetApp = createTestApp();
    const targetStorage = createLeetCodeStorage(targetApp.mock.area);
    const prefs = readLeetCodeSettingsSection(json)!;
    await createActions(targetApp.store).importJson(json);
    expect(await targetStorage.readPrefs()).toEqual({ detectionEnabled: true }); // nothing restored until the user confirms
    await restoreLeetCodeSettings(targetStorage, prefs);
    expect(await targetStorage.readPrefs()).toEqual({ detectionEnabled: false, showDetectionStatus: true, username: 'roundtrip' });
  });
});
