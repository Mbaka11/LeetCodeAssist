import { useSyncExternalStore } from 'react';
import { createActions, type AppActions } from './actions';
import { chromeStorageBackend, createAppStore, type StoreSnapshot } from './storage';

/** One store per extension page; all pages share the data through chrome.storage. */
const store = createAppStore(chromeStorageBackend());
const actions = createActions(store);

export interface AppStateHook {
  snapshot: StoreSnapshot;
  actions: AppActions;
}

export function useAppState(): AppStateHook {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { snapshot, actions };
}
