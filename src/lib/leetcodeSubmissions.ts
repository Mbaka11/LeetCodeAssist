/**
 * Pure parsing and validation for the passive "Accepted" detection (see docs/leetcode-api.md).
 *
 * Only a handful of fields of LeetCode's submission-result responses are ever looked at (`state`,
 * `status_msg`, `lang`, `status_runtime`, `status_memory`); everything else is ignored. The endpoint
 * contract is inferred from public knowledge and not verified against live traffic, so every parser here
 * fails closed: anything unexpected yields null / "invalid" and the user simply completes the activity by
 * hand.
 */

/** Cap of the stored event list. */
export const MAX_STORED_EVENTS = 200;
/** Identical events closer together than this are one event seen twice. */
export const DUPLICATE_WINDOW_MS = 3000;

/** Window message envelope between the page-world observer and the isolated relay. */
export const WINDOW_MESSAGE_SOURCE = 'leetcode-assist';
export const WINDOW_MESSAGE_KIND = 'submission-event';
/** `chrome.runtime` message from the relay to the background worker. */
export const RUNTIME_SUBMISSION_KIND = 'leetcode-assist:submission-event';

const MAX_STATUS_MSG_LENGTH = 64;
const MAX_LANG_LENGTH = 32;
const MAX_STATE_LENGTH = 24;
const MAX_METRIC_LENGTH = 32;
/** Largest response text the parser accepts (characters). */
export const MAX_CHECK_RESPONSE_CHARS = 256 * 1024;

export type SubmissionEventType = 'submit' | 'check';

/** One stored observation. `check` events are final verdicts; `submit` events only note that a submit happened. */
export interface SubmissionEvent {
  type: SubmissionEventType;
  slug: string;
  state: string;
  status_msg: string;
  lang: string;
  /** Epoch milliseconds, set by the background worker when it receives the event. */
  at: number;
  status_runtime?: string;
  status_memory?: string;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const PENDING_STATES: ReadonlySet<string> = new Set(['PENDING', 'STARTED']);
const SAFE_TEXT = /^[\p{L}\p{N} .,+#_()/:-]*$/u;
const LEETCODE_HOSTS: ReadonlySet<string> = new Set(['leetcode.com', 'www.leetcode.com']);

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

export type ObservedRequest = { kind: 'submit'; slug: string } | { kind: 'check' };

/**
 * Recognises the two observed routes: `/problems/<slug>/submit/` and `/submissions/detail/<id>/check/`.
 * Anything on another host or path is ignored.
 */
export function classifyRequestUrl(url: string, base: string): ObservedRequest | null {
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !LEETCODE_HOSTS.has(parsed.hostname)) return null;
  const submit = /^\/problems\/([^/]+)\/submit\/?$/.exec(parsed.pathname);
  if (submit?.[1]) {
    let slug: string;
    try {
      slug = decodeURIComponent(submit[1]);
    } catch {
      return null;
    }
    return isValidSlug(slug) ? { kind: 'submit', slug } : null;
  }
  if (/^\/submissions\/detail\/\d{1,20}\/check\/?$/.test(parsed.pathname)) return { kind: 'check' };
  return null;
}

/** The slug of `/problems/<slug>/...` for a page URL, or null. */
export function slugFromPageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = /^\/problems\/([^/]+)/.exec(parsed.pathname);
    if (!match?.[1]) return null;
    const slug = decodeURIComponent(match[1]);
    return isValidSlug(slug) ? slug : null;
  } catch {
    return null;
  }
}

export interface FinalCheckResult {
  kind: 'final';
  state: string;
  status_msg: string;
  lang: string;
  status_runtime?: string;
  status_memory?: string;
}

export type CheckParse = { kind: 'pending' } | FinalCheckResult | { kind: 'invalid' };

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength || !SAFE_TEXT.test(trimmed)) return null;
  return trimmed;
}

function optionalMetric(value: unknown): string | undefined {
  const text = boundedText(value, MAX_METRIC_LENGTH);
  return text ? text : undefined;
}

/**
 * Reads a parsed `/submissions/detail/<id>/check/` response. A pending response (`PENDING` / `STARTED`)
 * only means "poll again"; a final one carries the verdict in `status_msg`.
 */
export function parseCheckResponse(payload: unknown): CheckParse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return { kind: 'invalid' };
  const record = payload as Record<string, unknown>;
  const state = boundedText(record.state, MAX_STATE_LENGTH);
  if (!state) return { kind: 'invalid' };
  if (PENDING_STATES.has(state)) return { kind: 'pending' };
  const statusMsg = boundedText(record.status_msg, MAX_STATUS_MSG_LENGTH);
  if (!statusMsg) return { kind: 'invalid' };
  const lang = boundedText(record.lang, MAX_LANG_LENGTH) ?? '';
  const runtime = optionalMetric(record.status_runtime);
  const memory = optionalMetric(record.status_memory);
  return {
    kind: 'final',
    state,
    status_msg: statusMsg,
    lang,
    ...(runtime ? { status_runtime: runtime } : {}),
    ...(memory ? { status_memory: memory } : {}),
  };
}

/** `parseCheckResponse` for raw response text; oversized or non-JSON text is invalid. */
export function parseCheckResponseText(text: string): CheckParse {
  if (text.length === 0 || text.length > MAX_CHECK_RESPONSE_CHARS) return { kind: 'invalid' };
  try {
    return parseCheckResponse(JSON.parse(text) as unknown);
  } catch {
    return { kind: 'invalid' };
  }
}

/**
 * Strict shape check of an event (window message, runtime message or stored value). Unknown keys are
 * dropped; null means the event is rejected.
 */
export function validateSubmissionEvent(raw: unknown): SubmissionEvent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const type = record.type;
  if (type !== 'submit' && type !== 'check') return null;
  if (!isValidSlug(record.slug)) return null;
  const state = boundedText(record.state, MAX_STATE_LENGTH);
  if (!state) return null;
  const statusMsg = boundedText(record.status_msg, MAX_STATUS_MSG_LENGTH);
  const lang = boundedText(record.lang, MAX_LANG_LENGTH);
  if (statusMsg === null || lang === null) return null;
  // A verdict needs its text; a submit note has none.
  if (type === 'check' && statusMsg === '') return null;
  const at = record.at;
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > 8.64e15) return null;
  const runtime = optionalMetric(record.status_runtime);
  const memory = optionalMetric(record.status_memory);
  return {
    type,
    slug: record.slug,
    state,
    status_msg: statusMsg,
    lang,
    at: Math.round(at),
    ...(runtime ? { status_runtime: runtime } : {}),
    ...(memory ? { status_memory: memory } : {}),
  };
}

/** The event inside a window message, or null if the envelope or the event is not valid. */
export function eventFromWindowMessage(data: unknown): SubmissionEvent | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.source !== WINDOW_MESSAGE_SOURCE || record.kind !== WINDOW_MESSAGE_KIND) return null;
  return validateSubmissionEvent(record.event);
}

export function windowMessage(event: SubmissionEvent): { source: string; kind: string; event: SubmissionEvent } {
  return { source: WINDOW_MESSAGE_SOURCE, kind: WINDOW_MESSAGE_KIND, event };
}

/** Parses a stored list defensively: invalid entries are dropped, the cap is enforced. */
export function normalizeEvents(raw: unknown): SubmissionEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: SubmissionEvent[] = [];
  for (const item of raw) {
    const event = validateSubmissionEvent(item);
    if (event) events.push(event);
  }
  return events.slice(-MAX_STORED_EVENTS);
}

/** Appends `event` (oldest dropped past the cap). A near-identical event within three seconds is skipped. */
export function appendEvent(events: readonly SubmissionEvent[], event: SubmissionEvent): SubmissionEvent[] {
  const duplicate = events.some(
    (e) =>
      e.type === event.type &&
      e.slug === event.slug &&
      e.status_msg === event.status_msg &&
      e.lang === event.lang &&
      Math.abs(event.at - e.at) < DUPLICATE_WINDOW_MS,
  );
  if (duplicate) return [...events];
  return [...events, event].slice(-MAX_STORED_EVENTS);
}

export function isAccepted(event: SubmissionEvent): boolean {
  return event.type === 'check' && event.status_msg === 'Accepted';
}

export function isPythonLang(lang: string): boolean {
  return /^python/i.test(lang);
}

const LANG_LABELS: Readonly<Record<string, string>> = {
  python3: 'Python3',
  python: 'Python',
  cpp: 'C++',
  java: 'Java',
  c: 'C',
  csharp: 'C#',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  golang: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
  swift: 'Swift',
  ruby: 'Ruby',
  scala: 'Scala',
  php: 'PHP',
};

export function languageLabel(lang: string): string {
  if (lang === '') return 'unknown language';
  return LANG_LABELS[lang.toLowerCase()] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}

/** "23:14" in the user's local time. */
export function formatClockTime(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export interface AcceptedPrompt {
  acceptedAt: number;
  lang: string;
  python: boolean;
  /** Final non-Accepted verdicts for the problem between `since` and the Accepted one. */
  attemptsBefore: number;
}

/**
 * The earliest Accepted verdict for `slug` at or after `since` (epoch ms), with the number of failed
 * verdicts before it. Null when nothing was detected, so the activity is finished by hand as always.
 */
export function acceptedPrompt(
  events: readonly SubmissionEvent[],
  query: { slug: string; since: number },
): AcceptedPrompt | null {
  const relevant = events
    .filter((e) => e.type === 'check' && e.slug === query.slug && e.at >= query.since)
    .sort((a, b) => a.at - b.at);
  const accepted = relevant.find(isAccepted);
  if (!accepted) return null;
  return {
    acceptedAt: accepted.at,
    lang: accepted.lang,
    python: isPythonLang(accepted.lang),
    attemptsBefore: relevant.filter((e) => e.at < accepted.at && !isAccepted(e)).length,
  };
}

export function acceptedPromptText(prompt: AcceptedPrompt): string {
  return `Accepted at ${formatClockTime(prompt.acceptedAt)} (${languageLabel(prompt.lang)}) — finish this activity?`;
}

export interface DetectionDiagnostics {
  total: number;
  submits: number;
  verdicts: number;
  accepted: number;
  lastEventAt: number | null;
  /** Most recent distinct `status_msg` values, newest first. */
  recentStatuses: string[];
}

export function detectionDiagnostics(events: readonly SubmissionEvent[], maxStatuses = 5): DetectionDiagnostics {
  const verdicts = events.filter((e) => e.type === 'check');
  const recentStatuses: string[] = [];
  for (const event of [...verdicts].reverse()) {
    if (!recentStatuses.includes(event.status_msg)) recentStatuses.push(event.status_msg);
    if (recentStatuses.length >= maxStatuses) break;
  }
  return {
    total: events.length,
    submits: events.length - verdicts.length,
    verdicts: verdicts.length,
    accepted: verdicts.filter(isAccepted).length,
    lastEventAt: events.reduce<number | null>((latest, e) => (latest === null || e.at > latest ? e.at : latest), null),
    recentStatuses,
  };
}
