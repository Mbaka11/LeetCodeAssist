// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import { applyOutcome } from '../core/reviews';
import { defaultState } from '../core/state';
import { createActions, type AppActions } from '../lib/actions';
import type { AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { LogsView } from './LogsView';

const NOW = new Date(2025, 0, 30, 12).getTime();
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Harness({ store, actions }: { store: AppStore; actions: AppActions }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? <LogsView state={snapshot.state} actions={actions} /> : null;
}
async function setup() {
  const a = createActivity([], { slug: 'two-sum', type: 'new', dueDate: '2025-01-06', createdAt: '2025-01-06' });
  const state = applyOutcome({ ...defaultState('2025-01-06'), activities: [a] }, a.id,
    { outcome: 'solo', completedDate: '2025-01-06', totalMs: 600_000, now: 0 });
  const { store } = createTestApp(state);
  const actions = createActions(store, () => NOW);
  render(<Harness store={store} actions={actions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Correct Two Sum result on 2025-01-06' }));
  return { store, id: a.id, before: await store.readState() };
}
const dialog = () => screen.getByRole('dialog');

describe('confirmed result correction from Logs', () => {
  it('previews a date correction without writing, then commits only after explicit confirmation', async () => {
    const { store, id, before } = await setup();
    fireEvent.change(within(dialog()).getByLabelText('Completion date'), { target: { value: '2025-01-07' } });
    expect(within(dialog()).queryByRole('button', { name: 'Confirm correction' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Preview changes' }));
    const preview = within(dialog()).getByRole('region', { name: 'Correction preview' });
    expect(within(preview).getByText('Remove from plan (4)')).toBeTruthy();
    expect(within(preview).getByText('Add to plan (4)')).toBeTruthy();
    expect(await store.readState()).toEqual(before);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Confirm correction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const after = await store.readState();
    expect(after.activities.find((a) => a.id === id)).toMatchObject({ completedAt: '2025-01-07', totalMs: 600_000,
      corrections: [{ at: NOW, previousDate: '2025-01-06', previousOutcome: 'solo', previousTotalMs: 600_000 }] });
    expect(after.activities.filter((a) => a.status === 'planned').map((a) => a.dueDate)).toEqual(['2025-01-08', '2025-01-10', '2025-01-14', '2025-01-28']);
  });

  it('cancels without saving and invalidates preview whenever an input changes', async () => {
    const { store, before } = await setup();
    fireEvent.change(within(dialog()).getByLabelText('Logged minutes'), { target: { value: '15' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Preview changes' }));
    expect(within(dialog()).getByText('Review schedule and learning status stay unchanged.')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Logged minutes'), { target: { value: '16' } });
    expect(within(dialog()).queryByRole('button', { name: 'Confirm correction' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await store.readState()).toEqual(before);
  });

  it('refuses a stale preview and permits a fresh preview instead of overwriting another context', async () => {
    const { store, id } = await setup();
    fireEvent.change(within(dialog()).getByLabelText('Logged minutes'), { target: { value: '15' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Preview changes' }));
    await act(async () => { await store.update((s) => ({ ...s, settings: { ...s.settings, dailyTargetMin: 151 } })); });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Confirm correction' }));
    await within(dialog()).findByRole('alert');
    expect(within(dialog()).getByRole('alert').textContent).toContain('changed since this preview');
    expect((await store.readState()).activities.find((a) => a.id === id)?.totalMs).toBe(600_000);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Preview changes' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Confirm correction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const after = await store.readState();
    expect(after.settings.dailyTargetMin).toBe(151);
    expect(after.activities.find((a) => a.id === id)?.totalMs).toBe(900_000);
  });
});
