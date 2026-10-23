import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import { SYNC_BASE, SYNC_CONFIG } from './sync';
import { STORAGE_KEY } from './storage';
import { registerSyncBackground } from './syncBackground';
import { SYNC_MANIFEST } from './syncTransport';

type Changed = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
type Message = (message: unknown, sender: { id?: string; url?: string }, reply: (r: unknown) => void) => boolean;

let local: Record<string, unknown>;
let alarms: Map<string, unknown>;
let onChanged: Changed;
let onAlarm: (alarm: { name: string }) => void;
let onMessage: Message;

beforeEach(() => {
  local = {};
  alarms = new Map();
  const area = {
    get: async (keys: null | string | string[]) => {
      const list = keys === null ? Object.keys(local) : Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in local).map((k) => [k, local[k]]));
    },
    set: async (items: Record<string, unknown>) => { Object.assign(local, items); },
    remove: async (keys: string | string[]) => { for (const k of Array.isArray(keys) ? keys : [keys]) delete local[k]; },
  };
  vi.stubGlobal('chrome', {
    storage: { local: area, sync: { ...area, get: async () => ({}), set: async () => undefined, remove: async () => undefined }, onChanged: { addListener: (l: Changed) => { onChanged = l; } } },
    alarms: {
      get: async (name: string) => alarms.get(name),
      create: async (name: string, info: unknown) => { alarms.set(name, info); },
      clear: async (name: string) => alarms.delete(name),
      onAlarm: { addListener: (l: typeof onAlarm) => { onAlarm = l; } },
    },
    runtime: { id: 'me', getURL: () => 'chrome-extension://me/', onMessage: { addListener: (l: Message) => { onMessage = l; } } },
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllGlobals());

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe('sync background worker', () => {
  it('schedules nothing while sync is disabled, and debounced alarms once enabled', async () => {
    registerSyncBackground();
    await flush();
    expect(alarms.size).toBe(0);
    local[STORAGE_KEY] = defaultState('2026-01-01');
    local[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    onChanged({ [STORAGE_KEY]: { newValue: local[STORAGE_KEY] } }, 'local');
    await flush();
    expect([...alarms.keys()].sort()).toEqual(['lca-sync', 'lca-sync-poll']);
    expect(alarms.get('lca-sync')).toMatchObject({ when: expect.any(Number) });
  });
  it('forgets the sync base when the local program is reset', async () => {
    registerSyncBackground();
    local[SYNC_BASE] = defaultState('2026-01-01');
    onChanged({ [STORAGE_KEY]: { newValue: undefined } }, 'local');
    await flush();
    expect(local[SYNC_BASE]).toBeUndefined();
  });
  it('merges when the other device publishes a manifest, and ignores unrelated sync changes', async () => {
    registerSyncBackground();
    local[SYNC_CONFIG] = { enabled: true, deviceName: 'Windows' };
    local[STORAGE_KEY] = defaultState('2026-01-01');
    onChanged({ other: {} }, 'sync');
    await flush();
    expect(local['lca.sync.status.v1']).toBeUndefined();
    onChanged({ [SYNC_MANIFEST]: {} }, 'sync');
    await vi.waitFor(() => expect(local['lca.sync.status.v1']).toMatchObject({ lastSync: expect.any(Number) }));
  });
  it('accepts messages only from this extension’s own pages', async () => {
    registerSyncBackground();
    const reply = vi.fn();
    expect(onMessage({ kind: 'lca-sync-now' }, { id: 'other', url: 'chrome-extension://me/dashboard.html' }, reply)).toBe(false);
    expect(onMessage({ kind: 'lca-sync-now' }, { id: 'me', url: 'https://leetcode.com/problems/x' }, reply)).toBe(false);
    expect(onMessage({ kind: 'lca-sync-resolve', choices: { x: 'bogus' } }, { id: 'me', url: 'chrome-extension://me/dashboard.html' }, reply)).toBe(false);
    expect(onMessage({ kind: 'lca-sync-now' }, { id: 'me', url: 'chrome-extension://me/dashboard.html' }, reply)).toBe(true);
    await flush();
    expect(reply).toHaveBeenCalledWith({ ok: true });
    expect(onAlarm).toBeTypeOf('function');
  });
});
