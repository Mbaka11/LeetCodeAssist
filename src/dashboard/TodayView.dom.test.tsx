// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { trainingDateFromTimestamp } from '../core/dates';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { STORAGE_KEY, type AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { TodayView } from './TodayView';

afterEach(cleanup);

function Harness({ store, actions }: { store: AppStore; actions: AppActions }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? <TodayView state={snapshot.state} actions={actions} /> : null;
}

const today = (): string => trainingDateFromTimestamp(Date.now());
const offers = (container: HTMLElement): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('.bonus-offer')];
const slugsOf = (state: AppState): string[] =>
  state.activities.filter((a) => a.type === 'new' && isBonusProblem(a.slug)).map((a) => a.slug);

describe('TodayView bonus offers (DOM)', () => {
  it('persists exactly two offers, starts one with a timer and replenishes it after finishing', async () => {
    const { mock, store, actions } = createTestApp(defaultState(today()));
    const { container } = render(<Harness store={store} actions={actions} />);

    // Both offers render and are persisted once (no per-render records).
    await waitFor(() => expect(offers(container)).toHaveLength(2));
    await waitFor(() => expect(slugsOf(mock.data[STORAGE_KEY] as AppState)).toHaveLength(2));
    const firstSlugs = slugsOf(mock.data[STORAGE_KEY] as AppState);
    expect(screen.getByText('Today\'s activities (0/4 done)')).toBeTruthy();
    expect(screen.getByText(/Optional bonus problems \(2 offered\)/)).toBeTruthy();

    // Start the first offer: its timer controls appear and the header names the running bonus.
    fireEvent.click(within(offers(container)[0]!).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(within(offers(container)[0]!).getByRole('button', { name: 'Pause' })).toBeTruthy());
    expect(within(offers(container)[0]!).getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(screen.getByText(/Timer running: Optional bonus/)).toBeTruthy();
    expect(offers(container)).toHaveLength(2);

    // Finish it: the slot is refilled at once with a different problem, and the core list is unchanged.
    fireEvent.click(within(offers(container)[0]!).getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('radio', { name: /Solo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(() => expect(screen.getByText(/Finished today \(1\):/)).toBeTruthy());
    await waitFor(() => expect(slugsOf(mock.data[STORAGE_KEY] as AppState)).toHaveLength(3));
    expect(offers(container)).toHaveLength(2);
    const after = mock.data[STORAGE_KEY] as AppState;
    const finished = after.activities.find((a) => a.status === 'done' && isBonusProblem(a.slug))!;
    expect(firstSlugs).toContain(finished.slug);
    const open = after.activities.filter(
      (a) => a.type === 'new' && isBonusProblem(a.slug) && (a.status === 'planned' || a.status === 'in_progress'),
    );
    expect(open).toHaveLength(2);
    expect(open.some((a) => a.slug === finished.slug)).toBe(false);
    expect(new Set(open.map((a) => a.slug)).size).toBe(2);
    expect(screen.getByText('Today\'s activities (0/4 done)')).toBeTruthy();

    // Skipping the second offer also refills the slot; history keeps the skipped record.
    const second = open.find((a) => a.status === 'planned')!;
    const secondTitle = getProblem(second.slug)!.title;
    const secondCard = offers(container).find((offer) => offer.textContent?.includes(secondTitle))!;
    fireEvent.click(within(secondCard).getByRole('button', { name: 'Skip' }));
    await waitFor(() => {
      const state = mock.data[STORAGE_KEY] as AppState;
      expect(state.activities.some((a) => a.id === second.id && a.status === 'skipped')).toBe(true);
    });
    await waitFor(() => expect(offers(container)).toHaveLength(2));
    const final = mock.data[STORAGE_KEY] as AppState;
    expect(
      final.activities.filter(
        (a) => a.type === 'new' && isBonusProblem(a.slug) && (a.status === 'planned' || a.status === 'in_progress'),
      ),
    ).toHaveLength(2);
  });

  it('finishing both offers shows the next two and a worked total of 2 bonus problems', async () => {
    const { mock, store, actions } = createTestApp(defaultState(today()));
    const { container } = render(<Harness store={store} actions={actions} />);
    await waitFor(() => expect(offers(container)).toHaveLength(2));
    for (let round = 0; round < 2; round += 1) {
      fireEvent.click(within(offers(container)[0]!).getByRole('button', { name: 'Start' }));
      await waitFor(() => expect(within(offers(container)[0]!).getByRole('button', { name: 'Finish' })).toBeTruthy());
      fireEvent.click(within(offers(container)[0]!).getByRole('button', { name: 'Finish' }));
      fireEvent.click(screen.getByRole('radio', { name: /Solo/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
      await waitFor(() => expect(screen.getByText(`Finished today (${round + 1}):`, { exact: false })).toBeTruthy());
      await waitFor(() => expect(offers(container)).toHaveLength(2));
    }
    const worked = container.querySelector('.worked-total')!;
    expect(within(worked as HTMLElement).getByText(/Bonus 2/)).toBeTruthy();
    expect(within(worked as HTMLElement).getByText(/Program 0\/50/)).toBeTruthy();
    const state = mock.data[STORAGE_KEY] as AppState;
    const doneSlugs = state.activities.filter((a) => a.status === 'done').map((a) => a.slug);
    expect(new Set(doneSlugs).size).toBe(2);
  });
});
