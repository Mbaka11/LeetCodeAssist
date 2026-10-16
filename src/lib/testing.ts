/** In-memory stand-ins for `chrome.storage` used by the unit tests (not part of the extension bundle). */
import type { StorageAreaLike, StorageChangedEventLike } from './storage';

type ChangeListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;

export interface MockChromeStorage {
  area: StorageAreaLike;
  changed: StorageChangedEventLike;
  data: Record<string, unknown>;
  listenerCount(): number;
}

/** Values are structured-cloned like the real thing; `onChanged` fires asynchronously after each write. */
export function createMockChromeStorage(): MockChromeStorage {
  const data: Record<string, unknown> = {};
  const listeners = new Set<ChangeListener>();

  const fire = (changes: Record<string, { newValue?: unknown }>): void => {
    queueMicrotask(() => {
      for (const listener of [...listeners]) listener(structuredClone(changes), 'local');
    });
  };

  return {
    data,
    listenerCount: () => listeners.size,
    area: {
      async get(key) {
        return key in data ? { [key]: structuredClone(data[key]) } : {};
      },
      async set(items) {
        const changes: Record<string, { newValue?: unknown }> = {};
        for (const [key, value] of Object.entries(items)) {
          data[key] = structuredClone(value);
          changes[key] = { newValue: value };
        }
        fire(changes);
      },
      async remove(key) {
        delete data[key];
        fire({ [key]: {} });
      },
    },
    changed: {
      addListener: (listener) => void listeners.add(listener),
      removeListener: (listener) => void listeners.delete(listener),
    },
  };
}

/** Lets pending microtasks and timers (storage events) run. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
