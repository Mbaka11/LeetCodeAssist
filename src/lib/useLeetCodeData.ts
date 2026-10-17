import { useSyncExternalStore } from 'react';
import { normalizeProfileCache, type ProfileCache } from './leetcodeProfile';
import { REFRESH_PROFILE_KIND } from './leetcodeBackground';
import {
  DEFAULT_PREFS,
  LEETCODE_PREFS_KEY,
  PROFILE_CACHE_KEY,
  SUBMISSION_EVENTS_KEY,
  createWatchedValue,
  normalizePrefs,
  type LeetCodePrefs,
  type WatchedValue,
} from './leetcodeStorage';
import { normalizeEvents, type SubmissionEvent } from './leetcodeSubmissions';

/** Each value is shared by every component of an extension page and follows `chrome.storage` changes. */
const prefsValue = createWatchedValue<LeetCodePrefs>(LEETCODE_PREFS_KEY, normalizePrefs, DEFAULT_PREFS);
const NO_EVENTS: readonly SubmissionEvent[] = [];
const eventsValue = createWatchedValue<readonly SubmissionEvent[]>(SUBMISSION_EVENTS_KEY, normalizeEvents, NO_EVENTS);
const profileValue = createWatchedValue<ProfileCache | null>(PROFILE_CACHE_KEY, normalizeProfileCache, null);

function useWatched<T>(value: WatchedValue<T>): T {
  return useSyncExternalStore(value.subscribe, value.getSnapshot, value.getSnapshot);
}

export const useLeetCodePrefs = (): LeetCodePrefs => useWatched(prefsValue);
export const useSubmissionEvents = (): readonly SubmissionEvent[] => useWatched(eventsValue);
export const useProfileCache = (): ProfileCache | null => useWatched(profileValue);

/** Asks the background worker to refresh the streak data (it decides whether a request is allowed). */
export function requestProfileRefresh(force: boolean): Promise<void> {
  return chrome.runtime.sendMessage({ kind: REFRESH_PROFILE_KIND, force }).then(() => undefined);
}
