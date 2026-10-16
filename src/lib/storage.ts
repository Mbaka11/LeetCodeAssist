/**
 * Persistence of the single `AppState` in `chrome.storage.local`, plus a small observable store
 * so every extension surface (dashboard, side panel, background) stays in sync through
 * `chrome.storage.onChanged`.
 */
import { StateValidationError, validateState } from '../core/state';
import type { AppState } from '../core/types';

/** Single versioned storage key (bump the suffix together with `STATE_VERSION`). */
export const STORAGE_KEY = 'leetcodeAssist.state.v1';

export interface StorageBackend {
  /** Raw stored value, or undefined when nothing is stored. */
  read(): Promise<unknown>;
  write(state: AppState): Promise<void>;
  clear(): Promise<void>;
  /** Calls `listener` with the new raw value (undefined when cleared). Returns an unsubscribe function. */
  onChange(listener: (raw: unknown) => void): () => void;
}

export interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface StorageChangedEventLike {
  addListener(
    listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void,
  ): void;
  removeListener(
    listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void,
  ): void;
}

export function chromeStorageBackend(
  area: StorageAreaLike = chrome.storage.local,
  changed: StorageChangedEventLike = chrome.storage.onChanged,
): StorageBackend {
  return {
    async read() {
      return (await area.get(STORAGE_KEY))[STORAGE_KEY];
    },
    write: (state) => area.set({ [STORAGE_KEY]: state }),
    clear: () => area.remove(STORAGE_KEY),
    onChange(listener) {
      const handler = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
        const change = changes[STORAGE_KEY];
        if (areaName === 'local' && change) listener(change.newValue);
      };
      changed.addListener(handler);
      return () => changed.removeListener(handler);
    },
  };
}

export type StoreSnapshot =
  | { status: 'loading' }
  /** Nothing stored yet: first run. */
  | { status: 'empty' }
  | { status: 'ready'; state: AppState }
  /** Stored data failed validation. It is left untouched until the user resets or imports. */
  | { status: 'error'; message: string };

function snapshotFromRaw(raw: unknown): StoreSnapshot {
  if (raw === undefined || raw === null) return { status: 'empty' };
  try {
    return { status: 'ready', state: validateState(raw) };
  } catch (error) {
    if (error instanceof StateValidationError) return { status: 'error', message: error.message };
    throw error;
  }
}

export interface AppStore {
  getSnapshot(): StoreSnapshot;
  /** Subscribes to snapshot changes. The first subscriber loads the state and starts listening for storage changes. */
  subscribe(listener: () => void): () => void;
  /** Reads the latest stored state (not the cached one). Throws if there is none. */
  readState(): Promise<AppState>;
  /** Read-modify-write on the latest stored state, serialized across callers and extension contexts. */
  update(change: (state: AppState) => AppState): Promise<void>;
  /** Replaces everything (first-run setup, JSON import). The state is validated first. */
  replace(state: AppState): Promise<void>;
  /** Removes all stored data (back to first-run setup). */
  reset(): Promise<void>;
}

const LOCK_NAME = 'leetcode-assist-state';

export function createAppStore(backend: StorageBackend): AppStore {
  let snapshot: StoreSnapshot = { status: 'loading' };
  const listeners = new Set<() => void>();
  let stopListening: (() => void) | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const publish = (next: StoreSnapshot): void => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  /** Runs `task` one at a time in this context, and under a Web Lock across contexts when available. */
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = async (): Promise<T> => {
      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
      return locks ? await locks.request(LOCK_NAME, () => task()) : await task();
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };

  const start = (): void => {
    stopListening = backend.onChange((raw) => publish(snapshotFromRaw(raw)));
    backend.read().then(
      (raw) => publish(snapshotFromRaw(raw)),
      (error: unknown) =>
        publish({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    );
  };

  const readState = async (): Promise<AppState> => {
    const current = snapshotFromRaw(await backend.read());
    if (current.status === 'ready') return current.state;
    throw new Error(
      current.status === 'error' ? `Stored data is invalid: ${current.message}` : 'No program has been set up yet',
    );
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopListening?.();
          stopListening = undefined;
          snapshot = { status: 'loading' };
        }
      };
    },
    readState,
    update: (change) =>
      exclusive(async () => {
        const state = await readState();
        const next = change(state);
        if (next === state) return;
        const validated = validateState(next);
        await backend.write(validated);
        publish({ status: 'ready', state: validated });
      }),
    replace: (state) =>
      exclusive(async () => {
        const validated = validateState(state);
        await backend.write(validated);
        publish({ status: 'ready', state: validated });
      }),
    reset: () =>
      exclusive(async () => {
        await backend.clear();
        publish({ status: 'empty' });
      }),
  };
}

