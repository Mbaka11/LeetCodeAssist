/**
 * Message handling of the LeetCode features in the background worker, with its dependencies injected.
 * Two messages are understood: a submission event relayed by the content script, and a profile refresh
 * requested by an extension page. Everything else is ignored.
 */
import {
  fetchUserCalendar,
  refreshProfile,
  type FetchCalendarResult,
  type ProfileCache,
} from './leetcodeProfile';
import { RUNTIME_SUBMISSION_KIND, validateSubmissionEvent } from './leetcodeSubmissions';
import type { LeetCodeStorage } from './leetcodeStorage';

export const REFRESH_PROFILE_KIND = 'leetcode-assist:refresh-profile';

export interface MessageSender {
  id?: string | undefined;
  url?: string | undefined;
}

export interface LeetCodeBackgroundDeps {
  storage: LeetCodeStorage;
  /** `chrome.runtime.id`. */
  extensionId: string;
  /** `chrome.runtime.getURL('')`, the prefix of every extension page URL. */
  extensionUrlPrefix: string;
  fetchCalendar?: (username: string) => Promise<FetchCalendarResult>;
  now(): number;
}

export type RefreshResponse = { ok: true; cache: ProfileCache | null } | { ok: false; message: string };

export interface LeetCodeBackground {
  /** The reply of a handled message, or null when the message is not for this module (nothing to reply to). */
  handleMessage(message: unknown, sender: MessageSender): Promise<unknown> | null;
}

export function createLeetCodeBackground(deps: LeetCodeBackgroundDeps): LeetCodeBackground {
  const fetchCalendar = deps.fetchCalendar ?? ((username: string) => fetchUserCalendar(username));
  let refreshing: Promise<ProfileCache | null> | null = null;

  const handleSubmission = async (event: unknown): Promise<{ stored: boolean }> => {
    const valid = validateSubmissionEvent(event);
    if (!valid) return { stored: false };
    const prefs = await deps.storage.readPrefs();
    if (!prefs.detectionEnabled) return { stored: false };
    // The observation time is the time of receipt: the page's clock is not trusted.
    await deps.storage.appendEvent({ ...valid, at: deps.now() });
    return { stored: true };
  };

  const handleRefresh = async (force: boolean): Promise<RefreshResponse> => {
    const { username } = await deps.storage.readPrefs();
    if (!username) return { ok: true, cache: null };
    // One request at a time: concurrent callers share the running refresh.
    refreshing ??= refreshProfile(
      {
        read: () => deps.storage.readProfile(),
        write: (cache) => deps.storage.writeProfile(cache),
        fetchCalendar,
        now: deps.now,
      },
      username,
      force,
    ).finally(() => {
      refreshing = null;
    });
    return { ok: true, cache: await refreshing };
  };

  return {
    handleMessage(message, sender) {
      if (typeof message !== 'object' || message === null) return null;
      const { kind } = message as { kind?: unknown };
      if (sender.id !== deps.extensionId) return null;
      if (kind === RUNTIME_SUBMISSION_KIND) {
        // Only the content script on a LeetCode problem page may report events.
        if (typeof sender.url !== 'string' || !sender.url.startsWith('https://leetcode.com/problems/')) return null;
        return handleSubmission((message as { event?: unknown }).event);
      }
      if (kind === REFRESH_PROFILE_KIND) {
        // Only the extension's own pages may trigger a request.
        if (typeof sender.url !== 'string' || !sender.url.startsWith(deps.extensionUrlPrefix)) return null;
        return handleRefresh((message as { force?: unknown }).force === true).catch(
          (error: unknown): RefreshResponse => ({
            ok: false,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return null;
    },
  };
}
