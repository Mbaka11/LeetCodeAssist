// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { defaultState } from '../core/state';
import type { Activity, AppState } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { createActions, type AppActions } from '../lib/actions';
import { STORAGE_KEY, type AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { ProblemPanel } from './ProblemPanel';

afterEach(cleanup);

function Harness({ store, actions, now }: { store: AppStore; actions: AppActions; now: number }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? (
    <ProblemPanel
      state={snapshot.state}
      actions={actions}
      slug={null}
      now={now}
      openDashboard={() => undefined}
      openProblem={() => undefined}
    />
  ) : null;
}

function openOffers(state: AppState): Activity[] {
  return state.activities.filter(
    (a) => a.type === 'new' && isBonusProblem(a.slug) && (a.status === 'planned' || a.status === 'in_progress'),
  );
}

describe('side-panel-only bonus persistence', () => {
  it('persists two offers across midnight and replenishes after completion without opening Today', async () => {
    const today = localDateFromTimestamp(Date.now());
    let now = new Date(`${today}T12:00:00`).getTime();
    const { mock, store } = createTestApp(defaultState(today));
    const actions = createActions(store, () => now);
    const { rerender } = render(<Harness store={store} actions={actions} now={now} />);

    await waitFor(() => expect(openOffers(mock.data[STORAGE_KEY] as AppState)).toHaveLength(2));
    const first = openOffers(mock.data[STORAGE_KEY] as AppState);
    const ids = first.map((a) => a.id);
    const initialPoolRecords = (mock.data[STORAGE_KEY] as AppState).activities.filter(
      (a) => a.type === 'new' && isBonusProblem(a.slug),
    );
    expect(initialPoolRecords).toHaveLength(2);

    // Midnight with only the side panel open must not regenerate the two offered problems.
    now = new Date(`${addDays(today, 1)}T12:00:00`).getTime();
    rerender(<Harness store={store} actions={actions} now={now} />);
    await waitFor(() => {
      const state = mock.data[STORAGE_KEY] as AppState;
      expect(state.activities.some((a) => a.type === 'new' && !isBonusProblem(a.slug) && a.dueDate === addDays(today, 1))).toBe(true);
    });
    expect(openOffers(mock.data[STORAGE_KEY] as AppState).map((a) => a.id)).toEqual(ids);

    await act(async () => {
      await actions.startExtraPractice(first[0]!.slug);
      await actions.completeActivity(first[0]!.id, 'solo', 30 * 60_000);
    });
    await waitFor(() => {
      const next = openOffers(mock.data[STORAGE_KEY] as AppState);
      expect(next).toHaveLength(2);
      expect(next.some((a) => a.id === ids[0])).toBe(false);
      expect(next.some((a) => a.id === ids[1])).toBe(true);
    });
    const final = mock.data[STORAGE_KEY] as AppState;
    expect(final.activities.filter((a) => a.type === 'new' && isBonusProblem(a.slug))).toHaveLength(3);
    expect(final.activities.filter((a) => a.slug === first[0]!.slug && a.status === 'done')).toHaveLength(1);
    expect(final.activities.filter((a) => a.slug === first[0]!.slug && a.type === 'recall')).toHaveLength(1);
  });
});
