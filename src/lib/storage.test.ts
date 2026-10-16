import { describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import { STORAGE_KEY, chromeStorageBackend, createAppStore, type AppStore } from './storage';
import { createMockChromeStorage, flush } from './testing';

function setup() {
  const mock = createMockChromeStorage();
  const open = (): AppStore => createAppStore(chromeStorageBackend(mock.area, mock.changed));
  return { mock, open };
}

describe('app store', () => {
  it('starts loading, then reports an empty first run', async () => {
    const { open } = setup();
    const store = open();
    expect(store.getSnapshot().status).toBe('loading');
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot()).toEqual({ status: 'empty' });
  });

  it('persists the state under the single versioned key and loads it back', async () => {
    const { mock, open } = setup();
    const store = open();
    store.subscribe(() => {});
    await store.replace(defaultState('2025-01-06'));
    expect(Object.keys(mock.data)).toEqual([STORAGE_KEY]);

    const other = open();
    other.subscribe(() => {});
    await flush();
    expect(other.getSnapshot()).toMatchObject({
      status: 'ready',
      state: { version: 1, settings: { startDate: '2025-01-06' } },
    });
  });

  it('keeps every surface in sync through storage change events', async () => {
    const { open } = setup();
    const dashboard = open();
    const sidePanel = open();
    dashboard.subscribe(() => {});
    sidePanel.subscribe(() => {});
    await dashboard.replace(defaultState('2025-01-06'));
    await flush();
    expect(sidePanel.getSnapshot().status).toBe('ready');

    await dashboard.update((s) => ({ ...s, checked: { 'two-sum': true } }));
    await flush();
    const snapshot = sidePanel.getSnapshot();
    expect(snapshot.status === 'ready' && snapshot.state.checked).toEqual({ 'two-sum': true });

    await dashboard.reset();
    await flush();
    expect(sidePanel.getSnapshot().status).toBe('empty');
  });

  it('notifies subscribers and stops listening after the last unsubscribe', async () => {
    const { mock, open } = setup();
    const store = open();
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));
    expect(mock.listenerCount()).toBe(1);
    await store.replace(defaultState('2025-01-06'));
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    expect(mock.listenerCount()).toBe(0);
  });

  it('serializes concurrent updates without losing any', async () => {
    const { open } = setup();
    const store = open();
    store.subscribe(() => {});
    await store.replace(defaultState('2025-01-06'));
    const slugs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    await Promise.all(
      slugs.map((slug) => store.update((s) => ({ ...s, checked: { ...s.checked, [slug]: true } }))),
    );
    const state = await store.readState();
    expect(Object.keys(state.checked).sort()).toEqual(slugs);
  });

  it('rejects updates before the program is set up', async () => {
    const { open } = setup();
    const store = open();
    await expect(store.update((s) => s)).rejects.toThrow(/No program/);
  });

  it('reports invalid stored data and leaves it untouched', async () => {
    const { mock, open } = setup();
    mock.data[STORAGE_KEY] = { version: 99 };
    const store = open();
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot()).toMatchObject({ status: 'error' });
    await expect(store.update((s) => s)).rejects.toThrow(/invalid/);
    expect(mock.data[STORAGE_KEY]).toEqual({ version: 99 });
  });

  it('does not write a state that fails validation', async () => {
    const { mock, open } = setup();
    const store = open();
    store.subscribe(() => {});
    await store.replace(defaultState('2025-01-06'));
    const before = structuredClone(mock.data[STORAGE_KEY]);
    await expect(
      store.update((s) => ({ ...s, settings: { ...s.settings, startDate: 'nope' } })),
    ).rejects.toThrow(/startDate/);
    expect(mock.data[STORAGE_KEY]).toEqual(before);
    // The queue keeps working after a failed update.
    await store.update((s) => ({ ...s, checked: { x: true } }));
    expect((await store.readState()).checked).toEqual({ x: true });
  });
});
