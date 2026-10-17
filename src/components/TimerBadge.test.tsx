import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import type { Activity } from '../core/types';
import type { AppActions } from '../lib/actions';
import { acceptedPrompt, type SubmissionEvent } from '../lib/leetcodeSubmissions';
import { ActivityCard } from './ActivityCard';
import { TimerBadge } from './TimerBadge';

const min = (m: number): number => m * 60_000;
const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const now = new Date(2025, 0, 6, 22, 30).getTime();

describe('TimerBadge', () => {
  it('shows "on pace" under 75% and spells the state out in text', () => {
    const html = renderToStaticMarkup(<TimerBadge elapsedMs={min(10)} budgetMin={40} running />);
    expect(html).toContain('timer-tone-good');
    expect(html).toContain('on pace');
    expect(html).toContain('10:00');
  });

  it('shows "near limit" from 75% and "over budget" past 100%', () => {
    expect(renderToStaticMarkup(<TimerBadge elapsedMs={min(31)} budgetMin={40} running />)).toContain('near limit');
    const over = renderToStaticMarkup(<TimerBadge elapsedMs={min(41)} budgetMin={40} running />);
    expect(over).toContain('over budget');
    expect(over).toContain('timer-tone-bad');
  });

  it('is neutral and silent while paused', () => {
    const html = renderToStaticMarkup(<TimerBadge elapsedMs={min(90)} budgetMin={40} running={false} />);
    expect(html).toContain('timer-neutral');
    expect(html).not.toContain('over budget');
    expect(html).not.toContain('timer-tone');
  });

  it('shows the help-ladder cues at 15 and 35 minutes only when asked', () => {
    const plain = renderToStaticMarkup(<TimerBadge elapsedMs={min(1)} budgetMin={40} running />);
    expect(plain).not.toContain('consider a hint');
    const html = renderToStaticMarkup(<TimerBadge elapsedMs={min(20)} budgetMin={40} running showHelpLadder />);
    expect(html).toContain('15 min: consider a hint');
    expect(html).toContain('35 min: read the solution, then re-code it');
    expect(html.match(/timer-cue-reached/g)).toHaveLength(1);
  });
});

function openCard(type: 'new' | 'recall', accepted?: ReturnType<typeof acceptedPrompt>, patch: Partial<Activity> = {}): string {
  const activity: Activity = {
    ...createActivity([], { type, slug: 'two-sum', dueDate: '2025-01-06', createdAt: '2025-01-06' }),
    status: 'in_progress',
    timer: { startedAt: now - min(20), accumulatedMs: 0, running: true },
    ...patch,
  };
  return renderToStaticMarkup(<ActivityCard activity={activity} now={now} actions={actions} accepted={accepted ?? undefined} />);
}

describe('ActivityCard timer and Accepted prompt', () => {
  const event = (at: number, patch: Partial<SubmissionEvent> = {}): SubmissionEvent => ({
    type: 'check',
    slug: 'two-sum',
    state: 'SUCCESS',
    status_msg: 'Accepted',
    lang: 'python3',
    at,
    ...patch,
  });
  const since = new Date(2025, 0, 6).getTime();
  const at = new Date(2025, 0, 6, 23, 14).getTime();

  it('uses the budget shown on the card: 20 min of the 25 min Easy budget is near the limit, with help-ladder cues', () => {
    const html = openCard('new');
    expect(html).toContain('~25 min');
    expect(html).toContain('near limit');
    expect(html).toContain('consider a hint');
  });

  it('has no help-ladder cues for a review', () => {
    expect(openCard('recall')).not.toContain('consider a hint');
  });

  it('shows no prompt when nothing was detected', () => {
    const html = openCard('new');
    expect(html).not.toContain('Accepted at');
    expect(html).toContain('>Finish<');
  });

  it('offers to finish with the detected Accepted verdict and the failed attempts before it', () => {
    const prompt = acceptedPrompt(
      [event(at - 600_000, { status_msg: 'Wrong Answer' }), event(at - 300_000, { status_msg: 'Time Limit Exceeded' }), event(at)],
      { slug: 'two-sum', since },
    );
    const html = openCard('new', prompt);
    expect(html).toContain('Accepted at 23:14 (Python3) — finish this activity?');
    expect(html).toContain('After 2 other attempts.');
    expect(html).toContain('Finish this activity…');
    expect(html).not.toContain('Python. You may want'); // Python: no language note
    expect(html).not.toContain('outcome-form'); // never opens or completes by itself
  });

  it('adds a gentle note for a non-Python language', () => {
    const prompt = acceptedPrompt([event(at, { lang: 'cpp' })], { slug: 'two-sum', since });
    const html = openCard('new', prompt);
    expect(html).toContain('(C++)');
    expect(html).toContain('meant to be practised in Python');
  });

  it('does not prompt for an activity that was not started', () => {
    const prompt = acceptedPrompt([event(at)], { slug: 'two-sum', since });
    const html = openCard('new', prompt, { status: 'planned', timer: { startedAt: null, accumulatedMs: 0, running: false } });
    expect(html).not.toContain('Accepted at');
  });
});
