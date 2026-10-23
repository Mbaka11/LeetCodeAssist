// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { SYNC_BACKUPS, SYNC_CONFIG, SYNC_CONFLICTS, SYNC_STATUS } from '../lib/sync';
import { SyncBackups, SyncBanner, SyncSettings } from './SyncSettings';

type Listener = (changes: Record<string, unknown>, area: string) => void;
let store: Record<string, unknown>;
let listeners: Listener[];
let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = {};
  listeners = [];
  sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (keys: string[]) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (items: Record<string, unknown>) => { Object.assign(store, items); for (const l of listeners) l(items, 'local'); },
      },
      onChanged: { addListener: (l: Listener) => listeners.push(l), removeListener: (l: Listener) => { listeners = listeners.filter((x) => x !== l); } },
    },
    runtime: { sendMessage },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const activity = (status: string, outcome?: string) => ({ id: 'a', slug: 'two-sum', type: 'new', dueDate: '2026-01-01', createdAt: '2026-01-01', status, ...(outcome ? { outcome, completedAt: '2026-01-02' } : {}), timer: { running: false, startedAt: null, accumulatedMs: 0 } });

describe('Sync settings', () => {
  it('is off by default, and enabling stores config without contacting the worker', async () => {
    render(<SyncSettings />);
    const toggle = await screen.findByLabelText(/Enable sync/);
    expect((toggle as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Status: Disabled/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Sync now' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(toggle);
    await waitFor(() => expect((store[SYNC_CONFIG] as { enabled: boolean }).enabled).toBe(true));
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it('edits the device name and shows storage use against the 100 KiB quota, last sync and errors', async () => {
    store[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    store[SYNC_STATUS] = { bytes: 90_000, lastSync: Date.UTC(2026, 0, 1), error: 'Sync paused: quota', paused: true, remoteDevice: 'Mac', remoteAt: 0 };
    render(<SyncSettings />);
    const input = await screen.findByLabelText('Sync device name');
    expect((input as HTMLInputElement).value).toBe('Windows');
    expect(screen.getByText(/90000 \/ 102400 bytes \(88%\)/)).toBeTruthy();
    expect(screen.getByText(/Last upload by Mac/)).toBeTruthy();
    expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('Manual JSON export/import is still available');
    expect(screen.getByText(/status: Paused/i)).toBeTruthy();
    fireEvent.change(input, { target: { value: ' Home Mac ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save device name' }));
    await waitFor(() => expect((store[SYNC_CONFIG] as { deviceName: string }).deviceName).toBe('Home Mac'));
  });
  it('offers Replace cloud copy only when the cloud copy is unreadable or the quota is full', async () => {
    store[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    store[SYNC_STATUS] = { error: 'Remote sync changed during merge; retry Sync now', paused: false, replaceable: false };
    const { unmount } = render(<SyncSettings />);
    await screen.findByText(/Remote sync changed during merge/);
    expect(screen.queryByRole('button', { name: /Replace cloud copy/ })).toBeNull();
    unmount();
    store[SYNC_STATUS] = { error: 'Sync paused: quota', paused: true, replaceable: true };
    render(<SyncSettings />);
    fireEvent.click(await screen.findByRole('button', { name: /Replace cloud copy/ }));
    expect(sendMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace cloud copy' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ kind: 'lca-sync-replace-cloud' }));
  });
  it('lists conflicts with both versions summarized and sends per-record and keep-all choices', async () => {
    store[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    store[SYNC_CONFLICTS] = [{ path: 'activities/a', local: activity('done', 'solo'), remote: activity('skipped') }];
    render(<SyncSettings />);
    expect(await screen.findByText(/Two Sum · new · done · outcome solo · completed 2026-01-02/)).toBeTruthy();
    expect(screen.getByText(/Two Sum · new · skipped · due 2026-01-01/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take other device' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ kind: 'lca-sync-resolve', choices: { 'activities/a': 'remote' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this device' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep all from this device' }));
    await waitFor(() => expect(sendMessage).toHaveBeenLastCalledWith({ kind: 'lca-sync-resolve', choices: { 'activities/a': 'local' } }));
  });
  it('shows a dashboard banner only for an enabled device with conflicts or errors', async () => {
    const { container, rerender } = render(<SyncBanner />);
    expect(container.textContent).toBe('');
    store[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    store[SYNC_CONFLICTS] = [{ path: 'checked/x', local: true, remote: false }];
    rerender(<SyncBanner key="again" />);
    expect(await screen.findByText(/1 record\(s\) were changed differently/)).toBeTruthy();
  });
  it('offers backup restore with confirmation and routes it through the worker', async () => {
    const backup: { id: string; at: number; state: AppState } = { id: 'b1', at: 0, state: defaultState('2026-01-01') };
    store[SYNC_BACKUPS] = [backup];
    render(<SyncBackups />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(sendMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ kind: 'lca-sync-restore', id: 'b1' }));
  });
});
