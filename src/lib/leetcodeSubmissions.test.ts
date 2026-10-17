import { describe, expect, it } from 'vitest';
import {
  MAX_CHECK_RESPONSE_CHARS,
  MAX_STORED_EVENTS,
  acceptedPrompt,
  acceptedPromptText,
  appendEvent,
  classifyRequestUrl,
  detectionDiagnostics,
  eventFromWindowMessage,
  formatClockTime,
  isPythonLang,
  languageLabel,
  normalizeEvents,
  parseCheckResponse,
  parseCheckResponseText,
  slugFromPageUrl,
  validateSubmissionEvent,
  windowMessage,
  type SubmissionEvent,
} from './leetcodeSubmissions';

// Synthetic fixtures shaped like the inferred contract in docs/leetcode-api.md (not captured traffic).
const accepted = {
  state: 'SUCCESS',
  status_msg: 'Accepted',
  lang: 'python3',
  status_runtime: '47 ms',
  status_memory: '17.6 MB',
  run_success: true,
  code_output: 'ignored',
};
const finals = ['Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compile Error'] as const;
const BASE = 'https://leetcode.com/problems/two-sum/description/';

function check(overrides: Partial<SubmissionEvent> & { at: number }): SubmissionEvent {
  return { type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Accepted', lang: 'python3', ...overrides };
}

describe('classifyRequestUrl', () => {
  it('recognises the submit and check routes (absolute and relative)', () => {
    expect(classifyRequestUrl('https://leetcode.com/problems/two-sum/submit/', BASE)).toEqual({
      kind: 'submit',
      slug: 'two-sum',
    });
    expect(classifyRequestUrl('/problems/valid-anagram/submit', BASE)).toEqual({
      kind: 'submit',
      slug: 'valid-anagram',
    });
    expect(classifyRequestUrl('/submissions/detail/1234567890/check/', BASE)).toEqual({ kind: 'check' });
    expect(classifyRequestUrl('https://leetcode.com/submissions/detail/9/check/?x=1', BASE)).toEqual({ kind: 'check' });
  });

  it('ignores other routes, hosts, schemes and malformed input', () => {
    expect(classifyRequestUrl('/problems/two-sum/interpret_solution/', BASE)).toBeNull();
    expect(classifyRequestUrl('/graphql', BASE)).toBeNull();
    expect(classifyRequestUrl('https://example.com/problems/two-sum/submit/', BASE)).toBeNull();
    expect(classifyRequestUrl('https://leetcode.com.evil.test/problems/two-sum/submit/', BASE)).toBeNull();
    expect(classifyRequestUrl('http://leetcode.com/problems/two-sum/submit/', BASE)).toBeNull();
    expect(classifyRequestUrl('/problems/Two Sum!/submit/', BASE)).toBeNull();
    expect(classifyRequestUrl('/problems/%/submit/', BASE)).toBeNull();
    expect(classifyRequestUrl('/submissions/detail/abc/check/', BASE)).toBeNull();
    expect(classifyRequestUrl('http://[bad', 'not a url')).toBeNull();
  });
});

describe('slugFromPageUrl', () => {
  it('reads the slug of a problem page', () => {
    expect(slugFromPageUrl('https://leetcode.com/problems/two-sum/description/')).toBe('two-sum');
    expect(slugFromPageUrl('https://leetcode.com/problemset/')).toBeNull();
    expect(slugFromPageUrl('nonsense')).toBeNull();
  });
});

describe('parseCheckResponse', () => {
  it('extracts only the whitelisted fields of an Accepted verdict', () => {
    expect(parseCheckResponse(accepted)).toEqual({
      kind: 'final',
      state: 'SUCCESS',
      status_msg: 'Accepted',
      lang: 'python3',
      status_runtime: '47 ms',
      status_memory: '17.6 MB',
    });
  });

  it.each(finals)('reads the %s verdict', (status_msg) => {
    const parsed = parseCheckResponse({ state: 'SUCCESS', status_msg, lang: 'python3' });
    expect(parsed).toEqual({ kind: 'final', state: 'SUCCESS', status_msg, lang: 'python3' });
  });

  it('reads a non-Python language as is', () => {
    expect(parseCheckResponse({ ...accepted, lang: 'cpp' })).toMatchObject({ kind: 'final', lang: 'cpp' });
  });

  it('treats pending states as "poll again"', () => {
    expect(parseCheckResponse({ state: 'PENDING' })).toEqual({ kind: 'pending' });
    expect(parseCheckResponse({ state: 'STARTED', status_msg: '' })).toEqual({ kind: 'pending' });
  });

  it('rejects malformed payloads', () => {
    for (const bad of [null, 5, 'x', [], {}, { state: 5 }, { state: 'SUCCESS' }, { state: 'SUCCESS', status_msg: 7 }]) {
      expect(parseCheckResponse(bad)).toEqual({ kind: 'invalid' });
    }
  });

  it('rejects oversized or unsafe field values', () => {
    expect(parseCheckResponse({ ...accepted, status_msg: 'A'.repeat(65) })).toEqual({ kind: 'invalid' });
    expect(parseCheckResponse({ ...accepted, status_msg: '<script>alert(1)</script>' })).toEqual({ kind: 'invalid' });
    // An unusable language or metric is dropped, not fatal.
    expect(parseCheckResponse({ ...accepted, lang: 'x'.repeat(40), status_runtime: 'y'.repeat(40) })).toEqual({
      kind: 'final',
      state: 'SUCCESS',
      status_msg: 'Accepted',
      lang: '',
      status_memory: '17.6 MB',
    });
  });

  it('parses text and rejects invalid JSON or oversized text', () => {
    expect(parseCheckResponseText(JSON.stringify(accepted))).toMatchObject({ kind: 'final' });
    expect(parseCheckResponseText('{not json')).toEqual({ kind: 'invalid' });
    expect(parseCheckResponseText('')).toEqual({ kind: 'invalid' });
    expect(parseCheckResponseText(' '.repeat(MAX_CHECK_RESPONSE_CHARS + 1))).toEqual({ kind: 'invalid' });
  });
});

describe('validateSubmissionEvent and window messages', () => {
  const valid = check({ at: 1_700_000_000_000 });

  it('accepts a valid event and drops unknown keys', () => {
    expect(validateSubmissionEvent({ ...valid, code: 'secret', cookie: 'x' })).toEqual(valid);
    expect(
      validateSubmissionEvent({ type: 'submit', slug: 'two-sum', state: 'SUBMITTED', status_msg: '', lang: '', at: 5 }),
    ).not.toBeNull();
  });

  it('rejects bad shapes', () => {
    expect(validateSubmissionEvent(null)).toBeNull();
    expect(validateSubmissionEvent([])).toBeNull();
    expect(validateSubmissionEvent({ ...valid, type: 'other' })).toBeNull();
    expect(validateSubmissionEvent({ ...valid, slug: '../etc' })).toBeNull();
    expect(validateSubmissionEvent({ ...valid, status_msg: '' })).toBeNull(); // a verdict needs its text
    expect(validateSubmissionEvent({ ...valid, at: 'now' })).toBeNull();
    expect(validateSubmissionEvent({ ...valid, at: Number.NaN })).toBeNull();
    expect(validateSubmissionEvent({ ...valid, lang: 'x'.repeat(100) })).toBeNull();
  });

  it('unwraps only well-formed window messages', () => {
    expect(eventFromWindowMessage(windowMessage(valid))).toEqual(valid);
    expect(eventFromWindowMessage({ ...windowMessage(valid), source: 'other' })).toBeNull();
    expect(eventFromWindowMessage({ ...windowMessage(valid), kind: 'x' })).toBeNull();
    expect(eventFromWindowMessage({ source: 'leetcode-assist', kind: 'submission-event', event: 'nope' })).toBeNull();
    expect(eventFromWindowMessage('hello')).toBeNull();
    expect(eventFromWindowMessage(undefined)).toBeNull();
  });
});

describe('event list', () => {
  it('caps the list at 200 and drops the oldest', () => {
    let events: SubmissionEvent[] = [];
    for (let i = 0; i < MAX_STORED_EVENTS + 25; i += 1) {
      events = appendEvent(events, check({ at: i * 10_000, status_msg: `Wrong Answer ${i}` }));
    }
    expect(events).toHaveLength(MAX_STORED_EVENTS);
    expect(events[0]?.at).toBe(25 * 10_000);
    expect(events.at(-1)?.status_msg).toBe(`Wrong Answer ${MAX_STORED_EVENTS + 24}`);
  });

  it('skips an identical event seen twice within three seconds', () => {
    const first = appendEvent([], check({ at: 1000 }));
    expect(appendEvent(first, check({ at: 2500 }))).toHaveLength(1);
    expect(appendEvent(first, check({ at: 5000 }))).toHaveLength(2);
  });

  it('normalises a stored list defensively', () => {
    expect(normalizeEvents('nope')).toEqual([]);
    expect(normalizeEvents([check({ at: 1 }), { junk: true }, null])).toEqual([check({ at: 1 })]);
    const many = Array.from({ length: 300 }, (_, i) => check({ at: i }));
    expect(normalizeEvents(many)).toHaveLength(MAX_STORED_EVENTS);
  });
});

describe('acceptedPrompt', () => {
  const t = (minutes: number): number => new Date(2025, 0, 6, 22, minutes).getTime();
  const since = new Date(2025, 0, 6).getTime();

  it('returns null when nothing was detected or nothing is Accepted', () => {
    expect(acceptedPrompt([], { slug: 'two-sum', since })).toBeNull();
    expect(acceptedPrompt([check({ at: t(1), status_msg: 'Wrong Answer' })], { slug: 'two-sum', since })).toBeNull();
  });

  it('counts the failed attempts before the first Accepted and ignores other problems and old events', () => {
    const events = [
      check({ at: since - 1000, status_msg: 'Accepted' }), // before the activity: ignored
      check({ at: t(1), status_msg: 'Wrong Answer' }),
      check({ at: t(2), slug: 'valid-anagram', status_msg: 'Wrong Answer' }),
      check({ at: t(3), status_msg: 'Time Limit Exceeded' }),
      { ...check({ at: t(4) }), type: 'submit' as const, status_msg: '' },
      check({ at: t(14), lang: 'python3' }),
      check({ at: t(20), lang: 'java' }),
    ];
    expect(acceptedPrompt(events, { slug: 'two-sum', since })).toEqual({
      acceptedAt: t(14),
      lang: 'python3',
      python: true,
      attemptsBefore: 2,
    });
  });

  it('flags a non-Python language', () => {
    const prompt = acceptedPrompt([check({ at: t(5), lang: 'cpp' })], { slug: 'two-sum', since });
    expect(prompt).toMatchObject({ python: false, attemptsBefore: 0 });
  });

  it('formats the prompt text', () => {
    const prompt = acceptedPrompt([check({ at: t(14) })], { slug: 'two-sum', since })!;
    expect(acceptedPromptText(prompt)).toBe('Accepted at 22:14 (Python3) — finish this activity?');
    expect(formatClockTime(new Date(2025, 0, 6, 7, 5).getTime())).toBe('07:05');
  });
});

describe('language helpers', () => {
  it('recognises Python and labels languages', () => {
    expect(isPythonLang('python3')).toBe(true);
    expect(isPythonLang('python')).toBe(true);
    expect(isPythonLang('cpp')).toBe(false);
    expect(languageLabel('python3')).toBe('Python3');
    expect(languageLabel('cpp')).toBe('C++');
    expect(languageLabel('')).toBe('unknown language');
    expect(languageLabel('brainfuck')).toBe('Brainfuck');
  });
});

describe('detectionDiagnostics', () => {
  it('summarises counts, the last statuses and the last event time without bodies', () => {
    const events: SubmissionEvent[] = [
      { type: 'submit', slug: 'two-sum', state: 'SUBMITTED', status_msg: '', lang: '', at: 1 },
      check({ at: 2, status_msg: 'Wrong Answer' }),
      check({ at: 3, status_msg: 'Wrong Answer' }),
      check({ at: 4, status_msg: 'Accepted' }),
    ];
    expect(detectionDiagnostics(events)).toEqual({
      total: 4,
      submits: 1,
      verdicts: 3,
      accepted: 1,
      lastEventAt: 4,
      recentStatuses: ['Accepted', 'Wrong Answer'],
    });
    expect(detectionDiagnostics([])).toEqual({
      total: 0,
      submits: 0,
      verdicts: 0,
      accepted: 0,
      lastEventAt: null,
      recentStatuses: [],
    });
  });
});
