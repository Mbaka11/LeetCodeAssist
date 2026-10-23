// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import { createActions, type AppActions } from '../lib/actions';
import { materializeToday, startActivity } from '../lib/commands';
import type { SubmissionEvent } from '../lib/leetcodeSubmissions';
import type { AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { ProblemPanel } from './ProblemPanel';

const NOW = new Date(2025, 0, 7, 10).getTime();
afterEach(cleanup);
function Harness({ store, actions, slug, events = [], now = NOW }: {
  store: AppStore; actions: AppActions; slug: string | null; events?: readonly SubmissionEvent[]; now?: number;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? <ProblemPanel state={snapshot.state} actions={actions} slug={slug} now={now}
    submissionEvents={events} openDashboard={() => undefined} openProblem={() => undefined} /> : null;
}
function started() {
  const planned = materializeToday(defaultState('2025-01-06'), NOW - 600_000);
  const activity = planned.activities.find((a) => a.type === 'new')!;
  const initial = startActivity(planned, activity.id, NOW - 600_000);
  const app = createTestApp(initial);
  return { ...app, actions: createActions(app.store, () => NOW), activity, initial };
}

describe('side-panel focus mode', () => {
  it('persists focus, keeps timers unchanged and preserves Finish edits through both toggle directions', async () => {
    const { store, actions, activity } = started();
    render(<Harness store={store} actions={actions} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    const before = (await store.readState()).activities.find((a) => a.id === activity.id)!;
    expect(screen.getByRole('button', { name: 'Focus mode', pressed: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Focus mode' }));
    await screen.findByRole('button', { name: 'Focus mode', pressed: true });
    expect((await store.readState()).settings.sidePanelFocus).toBe(true);
    expect((await store.readState()).activities.find((a) => a.id === activity.id)!.timer).toEqual(before.timer);
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Attempt history' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Problem metadata' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Postpone' })).toBeNull();
    expect(screen.getByRole('link', { name: 'LeetCode ↗' })).toBeTruthy();
    expect(document.querySelector('.instruction')!.textContent).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const minutes = screen.getByRole('spinbutton', { name: 'Time logged (min)' });
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    fireEvent.change(minutes, { target: { value: '17' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Completed on' }), { target: { value: '2025-01-06' } });
    for (const pressedBefore of [true, false]) {
      // One stable label; only aria-pressed changes.
      fireEvent.click(screen.getByRole('button', { name: 'Focus mode', pressed: pressedBefore }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Focus mode', pressed: !pressedBefore })).toBeTruthy());
      expect(screen.getByRole('spinbutton', { name: 'Time logged (min)' })).toBe(minutes);
      expect(minutes).toHaveProperty('value', '17');
      expect(screen.getByRole('radio', { name: /Hint/ })).toHaveProperty('checked', true);
      expect(screen.getByRole('combobox', { name: 'Completed on' })).toHaveProperty('value', '2025-01-06');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(async () => expect((await store.readState()).activities.find((a) => a.id === activity.id)).toMatchObject({ status: 'done', outcome: 'hint', totalMs: 17 * 60_000, completedAt: '2025-01-06' }));
  });

  it('still auto-opens Finish for a fresh Accepted while focused and saves nothing before confirmation', async () => {
    const { store, actions, activity } = started();
    await store.update((s) => ({ ...s, settings: { ...s.settings, sidePanelFocus: true } }));
    const page = render(<Harness store={store} actions={actions} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    const events: SubmissionEvent[] = [{ type: 'check', slug: activity.slug, state: 'SUCCESS', status_msg: 'Accepted', lang: 'python', at: NOW + 1000 }];
    page.rerender(<Harness store={store} actions={actions} slug={activity.slug} events={events} now={NOW + 1000} />);
    await screen.findByText('How did it go?');
    await waitFor(async () => expect((await store.readState()).activities.find((a) => a.id === activity.id)!.timer.running).toBe(false));
    expect((await store.readState()).activities.find((a) => a.id === activity.id)!.status).toBe('in_progress');
    expect(screen.getByRole('radio', { name: /Solo/ })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    page.rerender(<Harness store={store} actions={actions} slug={activity.slug} events={events} now={NOW + 2000} />);
    expect(screen.queryByText('How did it go?')).toBeNull();
  });

  it.each([null, 'unknown-problem', 'two-sum'])('explains nothing to focus for %s and leaves the normal panel visible', async (slug) => {
    const initial = defaultState('2025-02-01');
    initial.settings.sidePanelFocus = true;
    const { store, actions } = createTestApp(initial);
    render(<Harness store={store} actions={actions} slug={slug} />);
    await screen.findByText(/Nothing to focus on/);
    expect(screen.getByRole('button', { name: 'Focus mode', pressed: true })).toBeTruthy();
    if (slug === 'two-sum') expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();
    else expect(screen.getByRole('heading', { name: "Today's checklist" })).toBeTruthy();
  });
});
