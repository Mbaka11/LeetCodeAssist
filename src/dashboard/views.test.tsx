import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { simulateDay } from '../core/testing';
import { addDays, trainingDateFromTimestamp as localDateFromTimestamp } from '../core/dates';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import { ProblemView } from './ProblemView';
import { LogsView } from './LogsView';
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

  it('Today shows the distinct worked total and two optional bonus offers outside the core list', () => {
    const html = renderToStaticMarkup(<TodayView state={defaultState(today)} actions={actions} />);
    expect(html).toContain('class="worked-total"');
    expect(html).toContain('Program 0/50 · Benchmarks 0/6 · Bonus 0');
    expect(html).toContain('Reviews never add to it');
    expect(html).toContain('Optional bonus problems (2 offered)');
    expect(html.match(/class="bonus-offer"/g)).toHaveLength(2);
    // The core list still has just the day's four items.
    expect(html).toContain('Today&#x27;s activities (0/4 done)');
  });

  it('Today keeps a finished bonus out of the core list and offers the next two', () => {
    const state = simulateDay(defaultState(today), today, { bonus: true }).state;
    const html = renderToStaticMarkup(<TodayView state={state} actions={actions} />);
    expect(html).toContain('Today&#x27;s activities (4/4 done)');
    expect(html).toContain('Finished today (2):');
    expect(html).toContain('Bonus 2');
    expect(html.match(/class="bonus-offer"/g)).toHaveLength(2);
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

  it('Settings shows the budget table with the defaults and a reset button', () => {
    const html = renderToStaticMarkup(<SettingsView state={defaultState(today)} actions={actions} />);
    expect(html).toContain('Time budgets');
    expect(html).toContain('Reset to defaults');
    expect(html).toContain('Save budgets');
    for (const label of ['Easy', 'Medium', 'Hard']) expect(html).toContain(`<th>${label}</th>`);
    expect(html).toContain('aria-label="Recall Medium budget in minutes" value="8"');
    expect(html).toContain('aria-label="New Hard budget in minutes" value="50"');
    expect(html.match(/budget in minutes/g)).toHaveLength(18);
  });

  it('Settings shows saved budget overrides', () => {
    const state = defaultState(today);
    const custom: AppState = { ...state, settings: { ...state.settings, budgets: { recall: { Medium: 12 } } } };
    const html = renderToStaticMarkup(<SettingsView state={custom} actions={actions} />);
    expect(html).toContain('aria-label="Recall Medium budget in minutes" value="12"');
    expect(html).toContain('aria-label="Recall Easy budget in minutes" value="5"');
  });

  it('Logs shows the empty state with the filters and a disabled export', () => {
    const html = renderToStaticMarkup(<LogsView state={defaultState(today)} />);
    expect(html).toContain('Nothing logged yet');
    expect(html).toContain('Search title');
    expect(html).toContain('Export CSV (0)');
    expect(html).toContain('Solo rate');
  });

  it('Logs lists completed activities with links, budget and delta', () => {
    const start = addDays(today, -1);
    let state = defaultState(start);
    state = simulateDay(state, start, { minutes: 30 }).state;
    const html = renderToStaticMarkup(<LogsView state={state} />);
    expect(html).toContain('href="#/problem/two-sum"');
    expect(html).toContain('Two Sum');
    expect(html).toContain('Arrays &amp; Hashing');
    expect(html).toContain('+5 min'); // Easy new, 30 min logged against a 25 min budget
    expect(html).toContain('Done');
    expect(html).toContain('Total time');
    expect(html).not.toContain('Nothing logged yet');
  });
});
