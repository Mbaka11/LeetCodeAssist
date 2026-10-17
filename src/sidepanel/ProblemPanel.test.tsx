import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { localDateFromTimestamp } from '../core/dates';
import { planDay } from '../core/planner';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { ProblemPanel } from './ProblemPanel';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const now = Date.now();
const today = localDateFromTimestamp(now);
const noop = (): void => undefined;

function render(state: AppState, slug: string | null): string {
  return renderToStaticMarkup(
    <ProblemPanel state={state} actions={actions} slug={slug} now={now} openDashboard={noop} openProblem={noop} />,
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

  it('shows a clear "Open a LeetCode problem" state with today\'s checklist away from a problem page', () => {
    const idle = render(base, null);
    expect(idle).toContain('Open a LeetCode problem');
    expect(idle).toContain('Today&#x27;s checklist');
    expect(idle).toContain('Day 1');
    expect(idle).toContain('Contains Duplicate');
    expect(idle).toContain('aria-label="Open Contains Duplicate on LeetCode"');
    expect(idle).toContain('To do: ');
    expect(idle).toContain('Open the dashboard');
    // One Open button per planned item.
    const plan = planDay(base, today);
    const opens = idle.match(/aria-label="Open [^"]* on LeetCode"/g) ?? [];
    expect(opens).toHaveLength(plan.items.length + (plan.bonus ? 1 : 0) + plan.carriedOver.length);
  });

  it('marks finished items in the checklist as done', () => {
    const plan = planDay(base, today);
    const first = plan.items[0]!;
    const done = {
      ...base,
      activities: [{ ...first.activity, status: 'done' as const, completedAt: today, outcome: 'solo' as const, totalMs: 60_000 }],
    };
    const html = render(done, null);
    expect(html).toContain('Done: ');
    expect(html).toContain('check-done');
  });

  it('keeps the checklist for problems outside the NeetCode 150', () => {
    const unknown = render(base, 'not-a-neetcode-problem');
    expect(unknown).toContain('Not in the NeetCode 150');
    expect(unknown).toContain('Today&#x27;s checklist');
  });

  it('shows the full problem context: position, category, status, attempts, next review and hints', () => {
    const planned = planDay(base, today).items.find((i) => i.activity.type === 'new')!;
    const slug = planned.activity.slug;
    const html = render(base, slug);
    expect(html).toContain('Program problem');
    expect(html).toContain(`of ${PROGRAM_QUEUE.length}`);
    expect(html).toContain('Untouched');
    expect(html).toContain('Search, code, understand, write notes');
    expect(html).toContain('Hints');
    expect(html).toContain('Reveal hint 1');
    expect(html).toContain('Attempt history');
    expect(html).toContain('No completed attempts yet.');
    expect(html).toContain('No review scheduled');
  });

  it('shows hints used in the attempt history and the revealed hints of the open activity', () => {
    const done = {
      ...createActivity([], { type: 'new', slug: 'two-sum', dueDate: today, createdAt: today }),
      status: 'done' as const,
      completedAt: today,
      outcome: 'hint' as const,
      totalMs: 25 * 60_000,
      hintsUsed: 2,
    };
    const html = render({ ...base, activities: [done] }, 'two-sum');
    expect(html).toContain('2 hints');
    expect(html).toContain('1 attempt');
    const open = createActivity([done], { type: 'recall', slug: 'two-sum', dueDate: today, createdAt: today });
    const withHint = render({ ...base, activities: [done, { ...open, hintsUsed: 1 }] }, 'two-sum');
    expect(withHint).toContain('Hint 1 · Nudge');
    expect(withHint).not.toContain('Hint 2 · Insight');
  });
});
