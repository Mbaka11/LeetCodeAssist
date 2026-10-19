// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { buildLogRows } from '../core/logs';
import { planDay } from '../core/planner';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { workedTotals } from '../core/worked';
import { TodayView } from '../dashboard/TodayView';
import { createActions, type AppActions } from '../lib/actions';
import * as commands from '../lib/commands';
import type { SubmissionEvent } from '../lib/leetcodeSubmissions';
import type { AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { ProblemPanel } from '../sidepanel/ProblemPanel';

const SLUG = 'best-time-to-buy-and-sell-stock';
const TITLE = 'Best Time to Buy And Sell Stock';
const group = () => screen.getByRole('region', { name: new RegExp('Best Time to Buy.*Sell Stock activities', 'i') });
afterEach(cleanup);

function repeatedState() {
  const today = localDateFromTimestamp(Date.now());
  const yesterday = addDays(today, -1);
  const now = new Date(`${today}T12:00:00`).getTime();
  const base = defaultState(yesterday);
  const learned = createActivity([], { slug: SLUG, type: 'new', dueDate: yesterday, createdAt: yesterday });
  let state: AppState = commands.completeActivity({ ...base, activities: [learned] }, learned.id,
    { outcome: 'solo', totalMs: 20 * 60_000 }, new Date(`${yesterday}T12:00:00`).getTime());
  const recall = state.activities.find((a) => a.slug === SLUG && a.type === 'recall')!;
  state = commands.completeActivity(state, recall.id, { outcome: 'solo', totalMs: 5 * 60_000 }, now);
  for (let i = 0; i < 2; i++) {
    const extra = commands.startExtraPractice(state, SLUG, now);
    state = commands.completeActivity(extra.state, extra.activityId, { outcome: 'solo', totalMs: (8 + i) * 60_000 }, now);
  }
  return { state, now, today };
}

function Harness({ store, actions, now, view, events = [] }: {
  store: AppStore; actions: AppActions; now: number; view: 'today' | 'panel' | 'checklist'; events?: readonly SubmissionEvent[];
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (snapshot.status !== 'ready') return null;
  return view === 'today' ? <TodayView state={snapshot.state} actions={actions} /> : <ProblemPanel
    state={snapshot.state} actions={actions} slug={view === 'checklist' ? null : SLUG} now={now} submissionEvents={events}
    openDashboard={() => undefined} openProblem={() => undefined} />;
}

describe('one problem card with independent attempts', () => {
  it.each(['today', 'panel'] as const)('groups Recall → Re-solve → Re-solve in %s without changing logs, counts or reviews', async (view) => {
    const initial = repeatedState();
    const { store } = createTestApp(initial.state);
    const clock = { now: initial.now };
    const actions = createActions(store, () => clock.now);
    const beforePlan = planDay(initial.state, initial.today);
    render(<Harness store={store} actions={actions} now={clock.now} view={view} />);
    await waitFor(() => expect(within(group()).getByText('3 activities · 3 done')).toBeTruthy());
    expect(group().querySelectorAll('.activity-title')).toHaveLength(1);
    expect(group().querySelectorAll('.activity-attempt')).toHaveLength(3);
    expect([...group().querySelectorAll('article')].map((a) => a.getAttribute('aria-label'))).toEqual([
      'Attempt 1: Recall', 'Attempt 2: Re-solve', 'Attempt 3: Re-solve',
    ]);
    expect(within(group()).getAllByText('Extra practice')).toHaveLength(2);
    expect(group().querySelectorAll('.instruction')).toHaveLength(0);
    const after = await store.readState();
    expect(buildLogRows(after)).toEqual(buildLogRows(initial.state));
    expect(workedTotals(after)).toEqual(workedTotals(initial.state));
    expect(planDay(after, initial.today).plannedMinutes).toBe(beforePlan.plannedMinutes);
    expect(after.activities.filter((a) => a.slug === SLUG)).toEqual(initial.state.activities.filter((a) => a.slug === SLUG));

    // A fourth attempt grows the existing group, without replacing or resetting the completed rows.
    if (view === 'panel') fireEvent.click(within(group()).getByRole('button', { name: 'Start as extra practice' }));
    else await act(async () => { await actions.startExtraPractice(SLUG); });
    await waitFor(() => expect(within(group()).getByText('4 activities · 3 done')).toBeTruthy());
    expect(group().querySelectorAll('.activity-title')).toHaveLength(1);
    expect(within(group()).getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(within(group()).getAllByRole('article')).toHaveLength(4);
    fireEvent.click(within(group()).getByRole('button', { name: 'Finish' }));
    fireEvent.click(within(group()).getByRole('radio', { name: /Solo/ }));
    expect(within(group()).getByRole('combobox', { name: 'Completed on' })).toBeTruthy();
    fireEvent.click(within(group()).getByRole('button', { name: 'Save result' }));
    await waitFor(() => expect(within(group()).getByText('4 activities · 4 done')).toBeTruthy());
    const final = await store.readState();
    expect(final.activities.filter((a) => a.slug === SLUG && a.status === 'done' && a.completedAt === initial.today)).toHaveLength(4);
    expect(workedTotals(final).total).toBe(workedTotals(initial.state).total);
    // The title is deliberately not repeated in each nested attempt.
    expect(within(group()).getByRole('link', { name: new RegExp(TITLE, 'i') })).toBeTruthy();
  });

  it('summarizes repeats as one checklist row with separate type counts and one Open button', async () => {
    const initial = repeatedState();
    const { store } = createTestApp(initial.state);
    const actions = createActions(store, () => initial.now);
    render(<Harness store={store} actions={actions} now={initial.now} view="checklist" />);
    const open = await screen.findByRole('button', { name: /Open Best Time to Buy.*Sell Stock on LeetCode/i });
    const row = open.closest('li')!;
    expect(within(row).getByText('Recall')).toBeTruthy();
    expect(within(row).getByText('Re-solve ×2')).toBeTruthy();
    expect(within(row).getByText('3/3 done')).toBeTruthy();
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Open Best Time to Buy.*Sell Stock on LeetCode/i })).toHaveLength(1);
  });

  it('keeps an open Finish form stable when a grouped list rerenders and routes fresh Accepted only to the current attempt', async () => {
    const initial = repeatedState();
    const { store } = createTestApp(initial.state);
    const clock = { now: initial.now };
    const actions = createActions(store, () => clock.now);
    const props = { store, actions, view: 'panel' as const };
    const page = render(<Harness {...props} now={clock.now} />);
    await screen.findByRole('button', { name: 'Start as extra practice' });
    fireEvent.click(within(group()).getByRole('button', { name: 'Start as extra practice' }));
    await waitFor(() => expect(within(group()).getByRole('button', { name: 'Pause' })).toBeTruthy());
    clock.now += 60_000;
    const events: SubmissionEvent[] = [{ type: 'check', slug: SLUG, state: 'SUCCESS', status_msg: 'Accepted', lang: 'python', at: clock.now }];
    page.rerender(<Harness {...props} now={clock.now} events={events} />);
    await within(group()).findByText('How did it go?');
    expect(within(group()).getAllByText('How did it go?')).toHaveLength(1);
    expect(group().querySelectorAll('.activity-attempt')).toHaveLength(4);
    fireEvent.click(within(group()).getByRole('radio', { name: /Hint/ }));
    page.rerender(<Harness {...props} now={clock.now + 1000} events={[...events]} />);
    expect((within(group()).getByRole('radio', { name: /Hint/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(group()).getByRole('button', { name: 'Cancel' }));
    page.rerender(<Harness {...props} now={clock.now + 2000} events={[...events]} />);
    expect(within(group()).queryByText('How did it go?')).toBeNull();
    expect(within(group()).getByText('4 activities · 3 done')).toBeTruthy();
  });
});
