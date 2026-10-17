/**
 * Client and maths for the optional "LeetCode streak" card (see docs/leetcode-api.md).
 *
 * The client reads the *public* submission calendar of the username the user typed, anonymously
 * (`credentials: 'omit'`, no cookies, no tokens), from the background worker only. One request per
 * refresh: no retries, a hard deadline, a response-size limit, and the destination is fixed to
 * leetcode.com. Rate limiting and access denial stop everything for a while.
 */
import { BodyTooLargeError, readBoundedText } from './leetcodeBody';

export const GRAPHQL_URL = 'https://leetcode.com/graphql';
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 256 * 1024;
/** Automatic refresh at most this often. */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
/** Even the Refresh button waits this long after the previous attempt. */
export const MANUAL_COOLDOWN_MS = 60 * 1000;
/** After a 429 / 401 / 403 nothing is requested for this long. */
export const BLOCK_MS = 15 * 60 * 1000;

export const PROFILE_QUERY =
  'query userCalendar($username: String!) { matchedUser(username: $username) { userCalendar { activeYears streak totalActiveDays submissionCalendar } } }';

const DAY_SECONDS = 86_400;
const MAX_CALENDAR_DAYS = 800;
const MAX_DAY_COUNT = 100_000;

// ---------------------------------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------------------------------

export const USERNAME_MAX_LENGTH = 40;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export type UsernameCheck = { ok: true; username: string } | { ok: false; message: string };

export function validateUsername(input: string): UsernameCheck {
  const username = input.trim();
  if (username === '') return { ok: false, message: 'Enter your LeetCode username.' };
  if (username.length > USERNAME_MAX_LENGTH) {
    return { ok: false, message: `A username has at most ${USERNAME_MAX_LENGTH} characters.` };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, message: 'Use only letters, digits, underscore (_), hyphen (-) and dot (.).' };
  }
  return { ok: true, username };
}

export function profileUrl(username: string): string {
  return `https://leetcode.com/u/${encodeURIComponent(username)}/`;
}

// ---------------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------------

export type ProfileErrorKind =
  | 'rate-limited'
  | 'forbidden'
  | 'user-not-found'
  | 'server'
  | 'http'
  | 'network'
  | 'timeout'
  | 'too-large'
  | 'bad-response';

export interface ProfileError {
  kind: ProfileErrorKind;
  /** Plain-language text for the user. */
  message: string;
}

const ERROR_MESSAGES: Readonly<Record<ProfileErrorKind, string>> = {
  'rate-limited': 'LeetCode asked to slow down (too many requests). Nothing will be requested for a while.',
  forbidden: 'LeetCode refused the request (access denied). Nothing will be requested for a while.',
  'user-not-found': 'LeetCode has no public profile with that username. Check the spelling in Settings.',
  server: 'LeetCode had a server problem. Try again later.',
  http: 'LeetCode answered with an unexpected error. Try again later.',
  network: 'Could not reach leetcode.com. Check your connection and try again.',
  timeout: 'LeetCode took too long to answer. Try again later.',
  'too-large': 'LeetCode sent an unexpectedly large answer, so it was ignored.',
  'bad-response': 'LeetCode answered in a format this extension does not understand.',
};

export function profileError(kind: ProfileErrorKind): ProfileError {
  return { kind, message: ERROR_MESSAGES[kind] };
}

/** Maps a non-OK HTTP status to an error. 401 is treated like 403 (access denied). */
export function errorFromStatus(status: number): ProfileError {
  if (status === 429) return profileError('rate-limited');
  if (status === 401 || status === 403) return profileError('forbidden');
  if (status >= 500) return profileError('server');
  return profileError('http');
}

/** Rate limiting and access denial pause every request, including the Refresh button. */
export function isBlockingError(error: ProfileError): boolean {
  return error.kind === 'rate-limited' || error.kind === 'forbidden';
}

// ---------------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------------

/** Submission counts keyed by the unix time (seconds) of the start of a UTC day, as decimal strings. */
export type DayCounts = Record<string, number>;

export interface UserCalendar {
  /** Streak as reported by LeetCode, for reference only (the card computes its own). */
  reportedStreak: number | null;
  reportedActiveDays: number | null;
  activeYears: number[];
  days: DayCounts;
}

/**
 * `submissionCalendar` is a JSON string mapping day-start seconds to counts. Invalid keys or counts are
 * skipped; keys are snapped to the UTC day and the size is bounded.
 */
export function parseSubmissionCalendar(raw: unknown): DayCounts {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_RESPONSE_BYTES) return {};
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const days: DayCounts = {};
  let seen = 0;
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (++seen > MAX_CALENDAR_DAYS) break;
    if (!/^\d{1,12}$/.test(key)) continue;
    const seconds = Number(key);
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) continue;
    const dayKey = String(Math.floor(seconds / DAY_SECONDS) * DAY_SECONDS);
    days[dayKey] = Math.min(MAX_DAY_COUNT, (days[dayKey] ?? 0) + Math.floor(count));
  }
  return days;
}

function optionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : null;
}

export type CalendarParse = { ok: true; calendar: UserCalendar } | { ok: false; error: ProfileError };

/** Reads the GraphQL response body (already JSON-parsed). */
export function parseCalendarResponse(payload: unknown): CalendarParse {
  if (typeof payload !== 'object' || payload === null) return { ok: false, error: profileError('bad-response') };
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null || !('matchedUser' in data)) {
    return { ok: false, error: profileError('bad-response') };
  }
  const matchedUser = (data as { matchedUser: unknown }).matchedUser;
  if (matchedUser === null) return { ok: false, error: profileError('user-not-found') };
  if (typeof matchedUser !== 'object') return { ok: false, error: profileError('bad-response') };
  const calendar = (matchedUser as { userCalendar?: unknown }).userCalendar;
  if (typeof calendar !== 'object' || calendar === null) return { ok: false, error: profileError('bad-response') };
  const record = calendar as Record<string, unknown>;
  const years = Array.isArray(record.activeYears)
    ? record.activeYears.filter((y): y is number => Number.isInteger(y) && (y as number) > 1990 && (y as number) < 3000)
    : [];
  return {
    ok: true,
    calendar: {
      reportedStreak: optionalCount(record.streak),
      reportedActiveDays: optionalCount(record.totalActiveDays),
      activeYears: years.slice(0, 40),
      days: parseSubmissionCalendar(record.submissionCalendar),
    },
  };
}

export type FetchCalendarResult = { ok: true; calendar: UserCalendar } | { ok: false; error: ProfileError };

export interface FetchCalendarOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

/** One anonymous request. Never retries; every failure maps to a `ProfileError`. */
export async function fetchUserCalendar(
  username: string,
  options: FetchCalendarOptions = {},
): Promise<FetchCalendarResult> {
  const checked = validateUsername(username);
  if (!checked.ok) return { ok: false, error: { kind: 'bad-response', message: checked.message } };
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetchImpl(GRAPHQL_URL, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: PROFILE_QUERY, variables: { username: checked.username } }),
        signal: controller.signal,
      });
    } catch {
      return { ok: false, error: profileError(controller.signal.aborted ? 'timeout' : 'network') };
    }
    if (!response.ok) return { ok: false, error: errorFromStatus(response.status) };
    let text: string;
    try {
      text = await readBoundedText(response, options.maxBytes ?? MAX_RESPONSE_BYTES);
    } catch (error) {
      if (error instanceof BodyTooLargeError) return { ok: false, error: profileError('too-large') };
      return { ok: false, error: profileError(controller.signal.aborted ? 'timeout' : 'network') };
    }
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, error: profileError('bad-response') };
    }
    return parseCalendarResponse(json);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------------------------------
// Streak maths (UTC days, as in LeetCode's own calendar)
// ---------------------------------------------------------------------------------------------------

/** Unix seconds of the start of the UTC day containing `ms`. */
export function utcDayStart(ms: number): number {
  return Math.floor(ms / 1000 / DAY_SECONDS) * DAY_SECONDS;
}

export interface StreakStats {
  /** Consecutive active UTC days ending today, or yesterday when today has no submission yet. */
  current: number;
  /** Longest run of consecutive active days in the returned data. */
  longest: number;
  /** Active days in the UTC year of `now`. */
  activeDaysThisYear: number;
  /** Whether today already has a submission (the streak is still extendable when it does not). */
  activeToday: boolean;
}

function activeDaySet(days: DayCounts): Set<number> {
  const set = new Set<number>();
  for (const [key, count] of Object.entries(days)) if (count > 0) set.add(Number(key));
  return set;
}

export function computeStreakStats(days: DayCounts, nowMs: number): StreakStats {
  const active = activeDaySet(days);
  const today = utcDayStart(nowMs);
  const activeToday = active.has(today);
  let cursor = activeToday ? today : today - DAY_SECONDS;
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor -= DAY_SECONDS;
  }
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of [...active].sort((a, b) => a - b)) {
    run = previous !== null && day - previous === DAY_SECONDS ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const year = new Date(nowMs).getUTCFullYear();
  const activeDaysThisYear = [...active].filter((d) => new Date(d * 1000).getUTCFullYear() === year).length;
  return { current, longest, activeDaysThisYear, activeToday };
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  /** Unix seconds of the UTC day start. */
  dayStart: number;
  count: number;
  level: HeatLevel;
  future: boolean;
}

export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** Columns of weeks (oldest first), each Sunday to Saturday (UTC); the last column holds today. */
export function heatGrid(days: DayCounts, nowMs: number, weeks = 16): HeatCell[][] {
  const today = utcDayStart(nowMs);
  const weekday = new Date(today * 1000).getUTCDay();
  const lastWeekStart = today - weekday * DAY_SECONDS;
  const firstWeekStart = lastWeekStart - (weeks - 1) * 7 * DAY_SECONDS;
  const grid: HeatCell[][] = [];
  for (let week = 0; week < weeks; week += 1) {
    const column: HeatCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const dayStart = firstWeekStart + (week * 7 + day) * DAY_SECONDS;
      const count = days[String(dayStart)] ?? 0;
      column.push({ dayStart, count, level: heatLevel(count), future: dayStart > today });
    }
    grid.push(column);
  }
  return grid;
}

// ---------------------------------------------------------------------------------------------------
// Cache and refresh policy
// ---------------------------------------------------------------------------------------------------

export interface ProfileCache {
  username: string;
  /** When the data was last fetched successfully. */
  fetchedAt: number | null;
  /** When a request was last attempted (successful or not). */
  attemptedAt: number;
  calendar?: UserCalendar;
  error?: ProfileError;
  /** No request is made before this time (set after a 429 / 401 / 403). */
  blockedUntil?: number;
}

const ERROR_KINDS: ReadonlySet<string> = new Set(Object.keys(ERROR_MESSAGES));

export function normalizeProfileCache(raw: unknown): ProfileCache | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.username !== 'string' || !validateUsername(r.username).ok) return null;
  if (typeof r.attemptedAt !== 'number' || !Number.isFinite(r.attemptedAt)) return null;
  const fetchedAt = typeof r.fetchedAt === 'number' && Number.isFinite(r.fetchedAt) ? r.fetchedAt : null;
  const cache: ProfileCache = { username: r.username, fetchedAt, attemptedAt: r.attemptedAt };
  const calendar = r.calendar;
  if (typeof calendar === 'object' && calendar !== null) {
    const c = calendar as Record<string, unknown>;
    cache.calendar = {
      reportedStreak: optionalCount(c.reportedStreak),
      reportedActiveDays: optionalCount(c.reportedActiveDays),
      activeYears: Array.isArray(c.activeYears) ? c.activeYears.filter((y): y is number => Number.isInteger(y)).slice(0, 40) : [],
      days: parseSubmissionCalendar(c.days),
    };
  }
  const error = r.error;
  if (typeof error === 'object' && error !== null) {
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === 'string' && ERROR_KINDS.has(kind)) cache.error = profileError(kind as ProfileErrorKind);
  }
  if (typeof r.blockedUntil === 'number' && Number.isFinite(r.blockedUntil)) cache.blockedUntil = r.blockedUntil;
  return cache;
}

/**
 * Whether a request may be made now. Automatic refreshes happen at most once an hour (also after a
 * failure, so an error never turns into a retry loop); the Refresh button waits a minute after the last
 * attempt; a 429 / 401 / 403 blocks both for `BLOCK_MS`.
 */
export function shouldRefresh(cache: ProfileCache | null, username: string, force: boolean, now: number): boolean {
  if (cache === null) return true;
  if (cache.blockedUntil !== undefined && now < cache.blockedUntil) return false;
  if (cache.username !== username) return true;
  if (force) return now - cache.attemptedAt >= MANUAL_COOLDOWN_MS;
  return now - cache.attemptedAt >= REFRESH_INTERVAL_MS;
}

export interface RefreshDeps {
  read(): Promise<ProfileCache | null>;
  write(cache: ProfileCache): Promise<void>;
  fetchCalendar(username: string): Promise<FetchCalendarResult>;
  now(): number;
}

/** Fetches when allowed and stores the outcome; returns the cache as it is afterwards. */
export async function refreshProfile(
  deps: RefreshDeps,
  username: string,
  force: boolean,
): Promise<ProfileCache | null> {
  const cache = await deps.read();
  const now = deps.now();
  if (!shouldRefresh(cache, username, force, now)) return cache;
  const result = await deps.fetchCalendar(username);
  const sameUser = cache !== null && cache.username === username;
  let next: ProfileCache;
  if (result.ok) {
    next = { username, fetchedAt: now, attemptedAt: now, calendar: result.calendar };
  } else {
    // Old numbers stay visible next to the error, but only for the same user.
    next = {
      username,
      fetchedAt: sameUser ? cache.fetchedAt : null,
      attemptedAt: now,
      ...(sameUser && cache.calendar ? { calendar: cache.calendar } : {}),
      error: result.error,
      ...(isBlockingError(result.error) ? { blockedUntil: now + BLOCK_MS } : {}),
    };
  }
  await deps.write(next);
  return next;
}

/** "just now", "5 min ago", "3 h ago". */
export function formatAgo(fromMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - fromMs) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}
