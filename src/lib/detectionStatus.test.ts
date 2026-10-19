import { describe, expect, it } from 'vitest';
import { detectionSnapshot } from './detectionStatus';
import type { SubmissionEvent } from './leetcodeSubmissions';

function event(type: 'submit' | 'check', at: number, slug = 'two-sum', status = 'Accepted'): SubmissionEvent {
  return { type, slug, at, state: type === 'submit' ? 'SUBMITTED' : 'SUCCESS',
    status_msg: type === 'submit' ? '' : status, lang: type === 'submit' ? '' : 'python' };
}

describe('saved detection snapshot', () => {
  it('has no observations before an event is recorded', () => {
    expect(detectionSnapshot([])).toEqual({ lastSubmit: null, lastAccepted: null, lastResult: null, waitingForResult: false });
  });

  it('finds the latest receipt timestamp rather than relying on array order and keeps the input untouched', () => {
    const events = [event('submit', 400), event('check', 500), event('submit', 100), event('check', 200)];
    const copy = structuredClone(events);
    const result = detectionSnapshot(events);
    expect(result.lastSubmit?.at).toBe(400);
    expect(result.lastAccepted?.at).toBe(500);
    expect(result.waitingForResult).toBe(false);
    expect(events).toEqual(copy);
  });

  it('does not use an old Accepted as evidence of a result for a new Submit', () => {
    const result = detectionSnapshot([event('check', 100), event('submit', 200)]);
    expect(result.lastAccepted?.at).toBe(100);
    expect(result.waitingForResult).toBe(true);
  });

  it('does not answer one problem’s Submit with another problem’s Accepted', () => {
    const events = [event('submit', 100), event('check', 200, 'valid-anagram')];
    expect(detectionSnapshot(events).waitingForResult).toBe(true);
    expect(detectionSnapshot(events, 'two-sum').lastAccepted).toBeNull();
    expect(detectionSnapshot(events, 'valid-anagram').lastAccepted?.at).toBe(200);
    expect(detectionSnapshot(events, 'missing-problem').lastSubmit).toBeNull();
  });

  it('preserves the last Accepted while showing a newer unsuccessful final result', () => {
    const result = detectionSnapshot([event('check', 100), event('submit', 200), event('check', 300, 'two-sum', 'Wrong Answer')]);
    expect(result.lastAccepted?.at).toBe(100);
    expect(result.lastResult?.status_msg).toBe('Wrong Answer');
    expect(result.waitingForResult).toBe(false);
  });

  it('accepts a final result stamped in the same millisecond and prefers the last stored event on ties', () => {
    const first = event('check', 200, 'two-sum', 'Wrong Answer');
    const second = event('check', 200);
    const result = detectionSnapshot([event('submit', 200), first, second]);
    expect(result.lastResult).toBe(second);
    expect(result.waitingForResult).toBe(false);
  });
});
