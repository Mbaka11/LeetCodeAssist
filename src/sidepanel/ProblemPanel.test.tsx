import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { trainingDateFromTimestamp } from '../core/dates';
import { materializePlan, planDay } from '../core/planner';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { BONUS_POOL } from '../data/bonus';
import { PROGRAM_QUEUE } from '../data/program';
import { startExtraPractice } from '../lib/commands';
import type { AppActions } from '../lib/actions';
import { ProblemPanel } from './ProblemPanel';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const now = Date.now();
const today = trainingDateFromTimestamp(now);
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
    expect(opens).toHaveLength(plan.items.length + plan.bonuses.length + plan.carriedOver.length);
  });

  it('lists both optional bonus offers in the checklist and matches either one by slug', () => {
    const plan = planDay(base, today);
    expect(plan.bonuses).toHaveLength(2);
    const idle = render(base, null);
    expect(idle.split('Optional bonus</span>').length - 1).toBe(2);
    expect(idle).toContain('Optional: ');
    for (const offer of plan.bonuses) {
      const html = render(base, offer.activity.slug);
      expect(html).toContain('badge-warn">Bonus</span>');
      expect(html).toContain('>Optional</span>');
      expect(html).toContain('>Start</button>');
      expect(html).not.toContain('Start as extra practice');
    }
  });

  it('keeps a started bonus offer in the checklist and its timer controls on the problem page', () => {
    const materialized = materializePlan(base, planDay(base, today));
    const second = planDay(materialized, today).bonuses[1]!;
    const started = startExtraPractice(materialized, second.activity.slug, now).state;
    const idle = render(started, null);
    expect(idle).toContain('In progress: ');
    const html = render(started, second.activity.slug);
    expect(html).toContain('>Pause</button>');
    expect(html).toContain('>Finish</button>');
  });

  it('describes a pool problem that is not offered as optional extra practice', () => {
    const offered = new Set(planDay(base, today).bonuses.map((b) => b.activity.slug));
    const other = BONUS_POOL.find((slug) => !offered.has(slug))!;
    const html = render(base, other);
    expect(html).toContain('Start as extra practice');
    expect(html).toContain('bonus-pool problem');
    expect(html).toContain('not part of the core plan time');
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
