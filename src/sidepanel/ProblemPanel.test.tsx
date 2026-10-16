import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { localDateFromTimestamp } from '../core/dates';
import { planDay } from '../core/planner';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import { ProblemPanel } from './ProblemPanel';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const now = Date.now();
const today = localDateFromTimestamp(now);
const noop = (): void => undefined;

function render(state: AppState, slug: string | null): string {
  return renderToStaticMarkup(
    <ProblemPanel state={state} actions={actions} slug={slug} now={now} openDashboard={noop} />,
  );
}

describe('ProblemPanel (render smoke test)', () => {
  const base = defaultState(today);

  it('shows today\'s activity with its instruction, timer controls and the problem sheet link', () => {
    const planned = planDay(base, today).items.find((i) => i.activity.type === 'new')!;
    const html = render(base, planned.activity.slug);
    expect(html).toContain('Start');
    expect(html).toContain('Search, code, understand, write notes');
    expect(html).toContain('Open the problem sheet');
    expect(html).not.toContain('Start as extra practice');
    expect(html).toContain('Python snippet');
  });

  it('offers extra practice for a problem that is not in today\'s plan', () => {
    const html = render(base, 'median-of-two-sorted-arrays');
    expect(html).toContain('Median of Two Sorted Arrays');
    expect(html).toContain('Start as extra practice');
    expect(html).toContain('Untouched');
  });

  it('hides the notes behind Reveal while a review is due', () => {
    const due = createActivity(base.activities, { type: 'recall', slug: 'two-sum', dueDate: today, createdAt: today });
    const html = render({ ...base, activities: [due] }, 'two-sum');
    expect(html).toContain('Recall');
    expect(html).toContain('Reveal notes');
    expect(html).not.toContain('Python snippet');
    expect(html).toContain('Next review');
  });

  it('explains what to do away from a problem page and for unknown problems', () => {
    const idle = render(base, null);
    expect(idle).toContain('Open a problem on leetcode.com');
    expect(idle).toContain('Open the dashboard');
    const unknown = render(base, 'not-a-neetcode-problem');
    expect(unknown).toContain('Not in the NeetCode 150');
  });
});
