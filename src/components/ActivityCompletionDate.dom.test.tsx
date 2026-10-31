// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createActions, type AppActions } from '../lib/actions';
import { materializeToday, startActivity } from '../lib/commands';
import type { AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { defaultState } from '../core/state';
import { ActivityCard } from './ActivityCard';

afterEach(cleanup);
const START = new Date(2025, 0, 6, 23, 40).getTime();
const NOW = new Date(2025, 0, 7, 0, 10).getTime();

function Harness({ store, actions, id, now }: { store: AppStore; actions: AppActions; id: string; now: number }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const activity = snapshot.status === 'ready' ? snapshot.state.activities.find((a) => a.id === id) : undefined;
  return activity ? <ActivityCard activity={activity} actions={actions} now={now} /> : null;
}

async function setup() {
  const planned = materializeToday(defaultState('2025-01-06'), START);
  const original = planned.activities.find((a) => a.type === 'new')!;
  const { store } = createTestApp(startActivity(planned, original.id, START));
  const clock = { now: NOW };
  const actions = createActions(store, () => clock.now);
  const element = () => <Harness store={store} actions={actions} id={original.id} now={clock.now} />;
  const view = render(element());
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  await waitFor(async () => expect((await store.readState()).activities.find((a) => a.id === original.id)?.timer.running).toBe(false));
  return { store, clock, original, update: () => view.rerender(element()) };
}

describe('Finish date through real actions and storage', () => {
  it('automatically saves the previous training day with the real overnight timer total', async () => {
    const { store, original } = await setup();
    fireEvent.click(screen.getByRole('radio', { name: /Solo/ }));
    expect(screen.queryByRole('combobox', { name: 'Completed on' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(async () => expect((await store.readState()).activities.find((a) => a.id === original.id)).toMatchObject({
      status: 'done', completedAt: '2025-01-06', completedAtMs: NOW, totalMs: 30 * 60_000,
    }));
    expect((await store.readState()).activities.find((a) => a.slug === original.slug && a.type === 'recall')?.dueDate).toBe('2025-01-07');
    await waitFor(() => expect(screen.queryByText('How did it go?')).toBeNull());
  });

  it('keeps the form, chosen outcome and time after a save-time validation failure, then lets the user correct it', async () => {
    const { store, clock, original, update } = await setup();
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time logged (min)' }), { target: { value: '22' } });
    const before = await store.readState();
    // Simulate a suspended tab: the real date advanced before the UI clock got a chance to refresh.
    clock.now = new Date(2025, 0, 7, 4, 0).getTime();
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await screen.findByText('The training day changed at 04:00. Please save again; dates are assigned automatically.');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save result' }) as HTMLButtonElement).disabled).toBe(false));
    expect(await store.readState()).toEqual(before);
    expect((screen.getByRole('radio', { name: /Hint/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('spinbutton', { name: 'Time logged (min)' }) as HTMLInputElement).value).toBe('22');
    expect(screen.getByText('2025-01-06')).toBeTruthy();
    update();
    expect(screen.getByText('2025-01-07')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(async () => expect((await store.readState()).activities.find((a) => a.id === original.id)).toMatchObject({
      status: 'done', completedAt: '2025-01-07', outcome: 'hint', totalMs: 22 * 60_000,
    }));
  });
});
