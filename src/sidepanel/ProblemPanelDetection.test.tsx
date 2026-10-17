import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { localDateFromTimestamp } from '../core/dates';
import { planDay } from '../core/planner';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import type { SubmissionEvent } from '../lib/leetcodeSubmissions';
import { ProblemPanel } from './ProblemPanel';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const now = new Date(2025, 0, 6, 23, 30).getTime();
const today = localDateFromTimestamp(now);
const noop = (): void => undefined;

function started(): { state: AppState; slug: string } {
  const base = defaultState(today);
  const planned = planDay(base, today).items.find((i) => i.activity.type === 'new')!;
  const activity = {
    ...planned.activity,
    status: 'in_progress' as const,
    timer: { startedAt: now - 600_000, accumulatedMs: 0, running: true },
  };
  return { state: { ...base, activities: [activity] }, slug: activity.slug };
}

function render(state: AppState, slug: string, submissionEvents?: readonly SubmissionEvent[]): string {
  return renderToStaticMarkup(
    <ProblemPanel
      state={state}
      actions={actions}
      slug={slug}
      now={now}
      openDashboard={noop}
      openProblem={noop}
      {...(submissionEvents ? { submissionEvents } : {})}
    />,
  );
}

describe('ProblemPanel Accepted detection', () => {
  const event = (slug: string, at: number, status_msg = 'Accepted', lang = 'python3'): SubmissionEvent => ({
    type: 'check',
    slug,
    state: 'SUCCESS',
    status_msg,
    lang,
    at,
  });

  it('falls back to manual completion when nothing was detected', () => {
    const { state, slug } = started();
    const html = render(state, slug);
    expect(html).not.toContain('Accepted at');
    expect(html).toContain('>Finish<');
  });

  it('offers to finish an open activity after an Accepted verdict for the same problem', () => {
    const { state, slug } = started();
    const html = render(state, slug, [
      event(slug, new Date(2025, 0, 6, 23, 10).getTime(), 'Wrong Answer'),
      event(slug, new Date(2025, 0, 6, 23, 14).getTime()),
    ]);
    expect(html).toContain('Accepted at 23:14 (Python3) — finish this activity?');
    expect(html).toContain('After 1 other attempt.');
  });

  it('ignores verdicts for other problems and from before today', () => {
    const { state, slug } = started();
    expect(render(state, slug, [event('valid-anagram', new Date(2025, 0, 6, 23, 14).getTime())])).not.toContain('Accepted at');
    expect(render(state, slug, [event(slug, new Date(2025, 0, 5, 23, 14).getTime())])).not.toContain('Accepted at');
  });
});
