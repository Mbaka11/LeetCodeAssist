/**
 * Passive observer for LeetCode's submit and result requests, installed in the page's own (MAIN) world.
 *
 * It never changes a request or a response: the original `fetch` / `XMLHttpRequest` methods are called
 * with the page's own arguments and their results are returned untouched. Only requests to the two
 * recognised routes are inspected, and for result polls a *clone* of the response is read (bounded) and
 * reduced to the whitelisted fields. Nothing is sent anywhere from here: matching observations are
 * handed to `emit`.
 */
import { readBoundedText } from './leetcodeBody';
import {
  classifyRequestUrl,
  parseCheckResponseText,
  slugFromPageUrl,
  type SubmissionEvent,
} from './leetcodeSubmissions';

/** Result responses are small; anything larger is not read. */
export const MAX_OBSERVED_BODY_BYTES = 256 * 1024;
/** A result poll is attributed to the last submit of this page when that was recent. */
const SUBMIT_ATTRIBUTION_MS = 10 * 60 * 1000;
const MAX_SEEN_CHECKS = 50;

export interface ObservedWindow {
  location: { href: string };
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
}

const noop = (): void => undefined;

function requestUrl(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  if (typeof input === 'object' && input !== null && 'url' in input) {
    const { url } = input as { url: unknown };
    return typeof url === 'string' ? url : null;
  }
  return null;
}

/** Both route versions and an optional trailing slash identify the same submission check. */
function checkKey(url: string, base: string): string {
  return new URL(url, base).pathname.replace(/\/(?:v2\/)?check\/?$/, '/check/');
}

export function installSubmissionObserver(
  win: ObservedWindow,
  emit: (event: SubmissionEvent) => void,
  now: () => number = Date.now,
): void {
  let lastSubmit: { slug: string; at: number } | null = null;
  const seenChecks: string[] = [];

  const noteSubmit = (slug: string): void => {
    const at = now();
    lastSubmit = { slug, at };
    emit({ type: 'submit', slug, state: 'SUBMITTED', status_msg: '', lang: '', at });
  };

  const handleCheckText = (checkUrl: string, text: string): void => {
    const parsed = parseCheckResponseText(text);
    if (parsed.kind !== 'final') return;
    // The same finished check is reported once, even if both transports saw it.
    if (seenChecks.includes(checkUrl)) return;
    seenChecks.push(checkUrl);
    if (seenChecks.length > MAX_SEEN_CHECKS) seenChecks.shift();
    const at = now();
    const slug =
      lastSubmit !== null && at - lastSubmit.at <= SUBMIT_ATTRIBUTION_MS
        ? lastSubmit.slug
        : slugFromPageUrl(win.location.href);
    if (!slug) return;
    emit({
      type: 'check',
      slug,
      state: parsed.state,
      status_msg: parsed.status_msg,
      lang: parsed.lang,
      at,
      ...(parsed.status_runtime ? { status_runtime: parsed.status_runtime } : {}),
      ...(parsed.status_memory ? { status_memory: parsed.status_memory } : {}),
    });
  };

  if (typeof win.fetch === 'function') {
    const originalFetch = win.fetch;
    win.fetch = function observedFetch(this: unknown, ...args: Parameters<typeof fetch>) {
      const result = originalFetch.apply(this, args);
      try {
        const url = requestUrl(args[0]);
        const request = url === null ? null : classifyRequestUrl(url, win.location.href);
        if (request?.kind === 'submit') noteSubmit(request.slug);
        if (request?.kind === 'check' && url !== null) {
          const checkUrl = checkKey(url, win.location.href);
          Promise.resolve(result)
            .then((response) =>
              response.ok ? readBoundedText(response.clone(), MAX_OBSERVED_BODY_BYTES) : null,
            )
            .then((text) => {
              if (text !== null) handleCheckText(checkUrl, text);
            })
            .catch(noop);
        }
      } catch {
        // Observation must never affect the page.
      }
      return result;
    };
  }

  if (typeof win.XMLHttpRequest === 'function') {
    const proto = win.XMLHttpRequest.prototype;
    const originalOpen = proto.open as (...args: unknown[]) => void;
    const originalSend = proto.send as (...args: unknown[]) => void;
    const urls = new WeakMap<object, string>();
    proto.open = function observedOpen(this: XMLHttpRequest, ...args: unknown[]) {
      try {
        const url = requestUrl(args[1]);
        if (url !== null) urls.set(this, url);
      } catch {
        // ignored
      }
      return originalOpen.apply(this, args);
    } as typeof proto.open;
    proto.send = function observedSend(this: XMLHttpRequest, ...args: unknown[]) {
      try {
        const url = urls.get(this);
        const request = url === undefined ? null : classifyRequestUrl(url, win.location.href);
        if (request?.kind === 'submit') noteSubmit(request.slug);
        if (request?.kind === 'check' && url !== undefined) {
          const checkUrl = checkKey(url, win.location.href);
          this.addEventListener('load', () => {
            try {
              if (this.status < 200 || this.status >= 300) return;
              if (this.responseType !== '' && this.responseType !== 'text') return;
              const text = this.responseText;
              if (text.length <= MAX_OBSERVED_BODY_BYTES) handleCheckText(checkUrl, text);
            } catch {
              // ignored
            }
          });
        }
      } catch {
        // Observation must never affect the page.
      }
      return originalSend.apply(this, args);
    } as typeof proto.send;
  }
}
