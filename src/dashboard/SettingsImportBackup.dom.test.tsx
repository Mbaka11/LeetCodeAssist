// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import { STORAGE_KEY } from '../lib/storage';
import { SYNC_BACKUPS, SYNC_CONFIG } from '../lib/sync';
import { SettingsView } from './SettingsView';

let store: Record<string, unknown>;
let importJson: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = {};
  importJson = vi.fn(async () => undefined);
  const noop = { addListener: () => undefined, removeListener: () => undefined };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (keys: null | string | string[]) => {
          const list = keys === null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
        },
        set: async (items: Record<string, unknown>) => { Object.assign(store, items); },
        remove: async () => undefined,
      },
      onChanged: noop,
    },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })), onMessage: noop },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function importFile(): Promise<void> {
  const actions = { importJson } as unknown as AppActions;
  const { container } = render(<SettingsView state={defaultState('2026-01-01')} actions={actions} />);
  const file = new File([JSON.stringify(defaultState('2026-02-02'))], 'old.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(defaultState('2026-02-02')) });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Import and replace' }));
  await waitFor(() => expect(importJson).toHaveBeenCalled());
}

describe('Settings import with sync', () => {
  it('saves the current data as a local backup before replacing it when sync is enabled', async () => {
    const current: AppState = { ...defaultState('2026-01-01'), checked: { before: true } };
    store[STORAGE_KEY] = current;
    store[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    await importFile();
    expect((store[SYNC_BACKUPS] as { state: AppState }[])[0]!.state.checked).toEqual({ before: true });
  });
  it('makes no backup when sync is off', async () => {
    store[STORAGE_KEY] = defaultState('2026-01-01');
    await importFile();
    expect(store[SYNC_BACKUPS]).toBeUndefined();
  });
});
