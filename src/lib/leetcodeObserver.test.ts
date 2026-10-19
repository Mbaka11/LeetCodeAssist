import { describe, expect, it } from 'vitest';
import { installSubmissionObserver, type ObservedWindow } from './leetcodeObserver';
import type { SubmissionEvent } from './leetcodeSubmissions';

const PAGE = 'https://leetcode.com/problems/two-sum/description/';
const acceptedBody = JSON.stringify({ state: 'SUCCESS', status_msg: 'Accepted', lang: 'python3', secret: 'ignored' });

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup(fetchImpl: typeof fetch) {
  const events: SubmissionEvent[] = [];
  let clock = 1_000;
  class FakeXhr {
    status = 200;
    responseType = '';
    responseText = '';
    private listeners: Record<string, Array<() => void>> = {};
    opened: unknown[] = [];
    sent: unknown[] = [];
    open(...args: unknown[]): string {
      this.opened = args;
      return 'open-result';
    }
    send(...args: unknown[]): string {
      this.sent = args;
      return 'send-result';
    }
    addEventListener(name: string, listener: () => void): void {
      (this.listeners[name] ??= []).push(listener);
    }
    finish(text: string): void {
      this.responseText = text;
      for (const listener of this.listeners.load ?? []) listener();
    }
  }
  const win: ObservedWindow = {
    location: { href: PAGE },
    fetch: fetchImpl,
    XMLHttpRequest: FakeXhr as unknown as typeof XMLHttpRequest,
  };
  installSubmissionObserver(win, (event) => events.push(event), () => (clock += 1000));
  return { win, events, FakeXhr };
}

const jsonResponse = (body: string, status = 200): Response => new Response(body, { status });

describe('installSubmissionObserver (fetch)', () => {
  it('notes a submit and emits only whitelisted fields of the final verdict', async () => {
    const calls: unknown[][] = [];
    const response = jsonResponse(acceptedBody);
    const original = ((...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(response);
    }) as typeof fetch;
    const { win, events } = setup(original);

    const submitResult = await win.fetch!('https://leetcode.com/problems/two-sum/submit/', { method: 'POST', body: 'code' });
    expect(submitResult).toBe(response); // the page gets the original result untouched
    expect(calls[0]).toEqual(['https://leetcode.com/problems/two-sum/submit/', { method: 'POST', body: 'code' }]);

    const checkResult = await win.fetch!('/submissions/detail/123/check/');
    await flush();
    expect(checkResult).toBe(response);
    // The page can still read its own body: the observer used a clone.
    expect(response.bodyUsed).toBe(false);
    expect(events.map((e) => [e.type, e.slug, e.status_msg])).toEqual([
      ['submit', 'two-sum', ''],
      ['check', 'two-sum', 'Accepted'],
    ]);
    expect(Object.keys(events[1]!).sort()).toEqual(['at', 'lang', 'slug', 'state', 'status_msg', 'type']);
  });

  it('does not emit for pending polls and reports a finished check once', async () => {
    let n = 0;
    const original = (() => {
      n += 1;
      return Promise.resolve(jsonResponse(n < 3 ? JSON.stringify({ state: 'PENDING' }) : acceptedBody));
    }) as typeof fetch;
    const { win, events } = setup(original);
    for (let i = 0; i < 4; i += 1) await win.fetch!('/submissions/detail/77/check/');
    await flush();
    expect(events.filter((e) => e.type === 'check')).toHaveLength(1);
  });

  it('observes v2 polls and deduplicates the same final check across both route versions', async () => {
    const { win, events } = setup((() => Promise.resolve(jsonResponse(acceptedBody))) as typeof fetch);
    await win.fetch!('/submissions/detail/123/v2/check/');
    await flush();
    expect(events).toMatchObject([{ type: 'check', slug: 'two-sum', status_msg: 'Accepted' }]);
    await win.fetch!('/submissions/detail/123/check/');
    await win.fetch!('/submissions/detail/123/v2/check');
    await flush();
    expect(events).toHaveLength(1);
  });

  it('ignores pending v2 polls without treating SUCCESS alone as Accepted', async () => {
    let body = JSON.stringify({ state: 'PENDING' });
    const { win, events } = setup((() => Promise.resolve(jsonResponse(body))) as typeof fetch);
    await win.fetch!('/submissions/detail/124/v2/check/');
    await flush();
    body = JSON.stringify({ state: 'SUCCESS', status_msg: 'Wrong Answer', lang: 'python' });
    await win.fetch!('/submissions/detail/124/v2/check/');
    await flush();
    expect(events).toHaveLength(1);
    expect(events[0]?.status_msg).toBe('Wrong Answer');
  });

  it('falls back to the page slug when no recent submit was seen', async () => {
    const { win, events } = setup((() => Promise.resolve(jsonResponse(acceptedBody))) as typeof fetch);
    await win.fetch!('/submissions/detail/5/check/');
    await flush();
    expect(events[0]).toMatchObject({ type: 'check', slug: 'two-sum' });
  });

  it('ignores other requests, failed responses and malformed bodies, and never throws into the page', async () => {
    const bodies = [jsonResponse('{oops'), jsonResponse('{}', 500), jsonResponse(acceptedBody)];
    let i = 0;
    const { win, events } = setup((() => Promise.resolve(bodies[i++ % 3]!)) as typeof fetch);
    await win.fetch!('/submissions/detail/1/check/');
    await win.fetch!('/submissions/detail/2/check/');
    await win.fetch!('https://example.com/submissions/detail/3/check/'); // other host: not observed
    await win.fetch!(new URL('https://leetcode.com/graphql'));
    await flush();
    expect(events).toEqual([]);
  });

  it('passes a rejected fetch through unchanged', async () => {
    const failure = new Error('offline');
    const { win } = setup((() => Promise.reject(failure)) as typeof fetch);
    await expect(win.fetch!('/submissions/detail/9/check/')).rejects.toBe(failure);
    await flush();
  });

  it('does not read a response that declares a body over the limit', async () => {
    const big = new Response('x', { headers: { 'content-length': String(10 * 1024 * 1024) } });
    const { win, events } = setup((() => Promise.resolve(big)) as typeof fetch);
    await win.fetch!('/submissions/detail/4/check/');
    await flush();
    expect(events).toEqual([]);
  });
});

describe('installSubmissionObserver (XMLHttpRequest)', () => {
  it.each(['check', 'v2/check'])('observes %s through the load event and keeps open/send results', (route) => {
    const { win, events, FakeXhr } = setup((() => Promise.reject(new Error('unused'))) as typeof fetch);
    const xhr = new (win.XMLHttpRequest as unknown as typeof FakeXhr)();
    expect(xhr.open('GET', `/submissions/detail/8/${route}/`)).toBe('open-result');
    expect(xhr.opened).toEqual(['GET', `/submissions/detail/8/${route}/`]);
    expect(xhr.send('body')).toBe('send-result');
    expect(xhr.sent).toEqual(['body']);
    xhr.finish(acceptedBody);
    expect(events).toMatchObject([{ type: 'check', slug: 'two-sum', status_msg: 'Accepted', lang: 'python3' }]);
  });

  it('notes submits and ignores unrelated or failed requests', () => {
    const { win, events, FakeXhr } = setup((() => Promise.reject(new Error('unused'))) as typeof fetch);
    const Xhr = win.XMLHttpRequest as unknown as typeof FakeXhr;

    const submit = new Xhr();
    submit.open('POST', '/problems/two-sum/submit/');
    submit.send('code');
    expect(events).toMatchObject([{ type: 'submit', slug: 'two-sum' }]);

    const other = new Xhr();
    other.open('GET', '/api/other');
    other.send();
    const failed = new Xhr();
    failed.status = 500;
    failed.open('GET', '/submissions/detail/6/check/');
    failed.send();
    failed.finish(acceptedBody);
    const blob = new Xhr();
    blob.responseType = 'blob';
    blob.open('GET', '/submissions/detail/7/check/');
    blob.send();
    blob.finish(acceptedBody);
    expect(events).toHaveLength(1);
  });
});
