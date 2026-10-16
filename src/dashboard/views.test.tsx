import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import { ProblemView } from './ProblemView';
import { SettingsView } from './SettingsView';
import { SetupView } from './SetupView';
import { TodayView } from './TodayView';

// Server-side render smoke tests: the views mount without a browser and show the key SPEC §6 elements.
const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const today = localDateFromTimestamp(Date.now());

describe('dashboard views (render smoke tests)', () => {
  it('Today shows the plan, stats and the start button on day 1', () => {
    const html = renderToStaticMarkup(<TodayView state={defaultState(today)} actions={actions} />);
    expect(html).toContain('Day 1 of 30');
    expect(html).toContain('Benchmark day');
    expect(html).toContain('Start next activity');
    expect(html).toContain('Planned');
    expect(html).toContain('Pace');
    expect(html).toContain('Streak');
    expect(html).toContain('LeetCode ↗');
    expect(html).toContain('Contains Duplicate');
  });

  it('Today shows the "no plan before the start date" state', () => {
    const html = renderToStaticMarkup(
      <TodayView state={defaultState(addDays(today, 3))} actions={actions} />,
    );
    expect(html).toContain('No plan yet');
    expect(html).toContain('in 3 days');
    expect(html).not.toContain('Start next activity');
  });

  it('first-run setup offers today, tomorrow and a custom date', () => {
    const html = renderToStaticMarkup(<SetupView actions={actions} />);
    expect(html).toContain('Today (');
    expect(html).toContain('Tomorrow (');
    expect(html).toContain('Pick a date');
    expect(html).toContain('Start the program');
  });

  it('Problem sheet hides notes behind Reveal while a review is due', () => {
    const base: AppState = defaultState(today);
    const due = createActivity(base.activities, {
      type: 'recall',
      slug: 'two-sum',
      dueDate: today,
      createdAt: today,
    });
    const locked = renderToStaticMarkup(
      <ProblemView slug="two-sum" state={{ ...base, activities: [due] }} actions={actions} />,
    );
    expect(locked).toContain('Reveal notes');
    expect(locked).not.toContain('Python snippet');

    const open = renderToStaticMarkup(<ProblemView slug="two-sum" state={base} actions={actions} />);
    expect(open).not.toContain('Reveal notes');
    expect(open).toContain('Trigger');
    expect(open).toContain('Principle');
    expect(open).toContain('Pitfall');
    expect(open).toContain('Complexity');
    expect(open).toContain('Python snippet');
  });

  it('Problem sheet shows program position, hints and hints used in the attempt history', () => {
    const base: AppState = defaultState(today);
    const done = {
      ...createActivity([], { type: 'new', slug: 'two-sum', dueDate: today, createdAt: today }),
      status: 'done' as const,
      completedAt: today,
      outcome: 'hint' as const,
      totalMs: 20 * 60_000,
      hintsUsed: 3,
    };
    const html = renderToStaticMarkup(
      <ProblemView slug="two-sum" state={{ ...base, activities: [done] }} actions={actions} />,
    );
    expect(html).toContain('Program position');
    expect(html).toContain('3 hints');
    expect(html).toContain('Hints used');
    expect(html).toContain('Reveal hint 1');
    const none = renderToStaticMarkup(<ProblemView slug="median-of-two-sorted-arrays" state={base} actions={actions} />);
    expect(none).toContain('Not in the 30-day program');
    expect(none).not.toContain('Reveal hint');
  });

  it('Problem sheet handles an unknown slug', () => {
    const html = renderToStaticMarkup(
      <ProblemView slug="nope" state={defaultState(today)} actions={actions} />,
    );
    expect(html).toContain('Problem not found');
  });

  it('Settings shows budgets, notification times and data controls', () => {
    const html = renderToStaticMarkup(<SettingsView state={defaultState(today)} actions={actions} />);
    expect(html).toContain('Daily target');
    expect(html).toContain('Daily cap');
    expect(html).toContain('Morning summary');
    expect(html).toContain('Export JSON');
    expect(html).toContain('Import JSON');
    expect(html).toContain('Reset all data');
  });
});
