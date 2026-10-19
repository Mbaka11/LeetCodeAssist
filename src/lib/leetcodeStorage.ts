/**
 * Storage of the LeetCode features. Each piece lives under its own `chrome.storage.local` key, separate
 * from `AppState`: the background worker appends events and refreshes the profile cache while the
 * dashboard saves settings, and separate keys cannot race with the planner's read-modify-write cycle.
 */
import type { StorageAreaLike, StorageChangedEventLike } from './storage';
import { normalizeProfileCache, validateUsername, type ProfileCache } from './leetcodeProfile';
import { appendEvent, normalizeEvents, type SubmissionEvent } from './leetcodeSubmissions';

export const LEETCODE_PREFS_KEY = 'leetcodeAssist.leetcodePrefs.v1';
export const SUBMISSION_EVENTS_KEY = 'leetcodeAssist.submissionEvents.v1';
export const PROFILE_CACHE_KEY = 'leetcodeAssist.leetcodeProfile.v1';

export interface LeetCodePrefs {
  /** Passive "Accepted" detection; on by default. */
  detectionEnabled: boolean;
  /** Visibility only; absent/false hides the side-panel status, not automatic detection. */
  showDetectionStatus?: boolean;
  /** Optional public LeetCode username for the streak card. */
  username?: string;
}

export const DEFAULT_PREFS: LeetCodePrefs = { detectionEnabled: true };

export function normalizePrefs(raw: unknown): LeetCodePrefs {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_PREFS;
  const r = raw as Record<string, unknown>;
  const username = typeof r.username === 'string' ? validateUsername(r.username) : null;
  return {
    detectionEnabled: r.detectionEnabled !== false,
    ...(r.showDetectionStatus === true ? { showDetectionStatus: true } : {}),    ...(username?.ok ? { username: username.username } : {}),
  };
}

const LOCK_NAME = 'leetcode-assist-leetcode-data';
let queue: Promise<unknown> = Promise.resolve();

/** One read-modify-write at a time, in this context and (Web Locks) across extension contexts. */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    return locks ? await locks.request(LOCK_NAME, () => task()) : await task();
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

export interface LeetCodeStorage {
  readPrefs(): Promise<LeetCodePrefs>;
  /** `username: null` clears the username. */
  updatePrefs(change: { detectionEnabled?: boolean; username?: string | null; showDetectionStatus?: boolean }): Promise<LeetCodePrefs>;
  readEvents(): Promise<SubmissionEvent[]>;
  /** Atomically appends to the capped list. */
  appendEvent(event: SubmissionEvent): Promise<void>;
  clearEvents(): Promise<void>;
  readProfile(): Promise<ProfileCache | null>;
  writeProfile(cache: ProfileCache): Promise<void>;
  /** Removes prefs, events and the profile cache (used by "Reset all data"). */
  clearAll(): Promise<void>;
}

export function createLeetCodeStorage(area: StorageAreaLike): LeetCodeStorage {
  const read = async (key: string): Promise<unknown> => (await area.get(key))[key];
  return {
    readPrefs: async () => normalizePrefs(await read(LEETCODE_PREFS_KEY)),
    updatePrefs: (change) =>
      exclusive(async () => {
        const current = normalizePrefs(await read(LEETCODE_PREFS_KEY));
        const next = normalizePrefs({
          detectionEnabled: change.detectionEnabled ?? current.detectionEnabled,
          showDetectionStatus: change.showDetectionStatus ?? current.showDetectionStatus,
          username: change.username === undefined ? current.username : change.username,
        });
        await area.set({ [LEETCODE_PREFS_KEY]: next });
        return next;
      }),
    readEvents: async () => normalizeEvents(await read(SUBMISSION_EVENTS_KEY)),
    appendEvent: (event) =>
      exclusive(async () => {
        const events = normalizeEvents(await read(SUBMISSION_EVENTS_KEY));
        await area.set({ [SUBMISSION_EVENTS_KEY]: appendEvent(events, event) });
      }),
    clearEvents: () => exclusive(() => area.remove(SUBMISSION_EVENTS_KEY)),
    readProfile: async () => normalizeProfileCache(await read(PROFILE_CACHE_KEY)),
    writeProfile: (cache) => exclusive(() => area.set({ [PROFILE_CACHE_KEY]: cache })),
    clearAll: () =>
      exclusive(async () => {
        await area.remove(LEETCODE_PREFS_KEY);
        await area.remove(SUBMISSION_EVENTS_KEY);
        await area.remove(PROFILE_CACHE_KEY);
      }),
  };
}

/** The real storage; `chrome` is only touched when this is called (never at import time). */
export function chromeLeetCodeStorage(): LeetCodeStorage {
  return createLeetCodeStorage(chrome.storage.local);
}

/** A storage key observed through `onChanged`, shaped for `useSyncExternalStore`. */
export interface WatchedValue<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export function createWatchedValue<T>(
  key: string,
  normalize: (raw: unknown) => T,
  fallback: T,
  getChrome: () => { area: StorageAreaLike; changed: StorageChangedEventLike } = () => ({
    area: chrome.storage.local,
    changed: chrome.storage.onChanged,
  }),
): WatchedValue<T> {
  let value = fallback;
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;

  const set = (next: T): void => {
    value = next;
    for (const listener of [...listeners]) listener();
  };

  const start = (): void => {
    const { area, changed } = getChrome();
    const handler = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
      const change = changes[key];
      if (areaName === 'local' && change) set(normalize(change.newValue));
    };
    changed.addListener(handler);
    stop = () => changed.removeListener(handler);
    area.get(key).then(
      (items) => set(normalize(items[key])),
      () => undefined,
    );
  };

  return {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
}
