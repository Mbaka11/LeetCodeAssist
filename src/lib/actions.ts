import { deserializeState, defaultState } from '../core/state';
import type { Outcome, Settings } from '../core/types';
import * as commands from './commands';
import type { AppStore } from './storage';

export type Clock = () => number;

export interface AppActions {
  /** First-run setup: creates an empty program starting on `startDate`. */
  initialize(startDate: string): Promise<void>;
  /** Persists today's plan so its activities (and their timers) survive reloads. */
  materializeToday(): Promise<void>;
  startActivity(id: string): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  markApproachFound(id: string): Promise<void>;
  completeActivity(id: string, outcome: Outcome, totalMs?: number): Promise<void>;
  skip(id: string): Promise<void>;
  saveNote(slug: string, fields: commands.NoteFields): Promise<void>;
  toggleChecked(slug: string): Promise<void>;
  updateSettings(change: Partial<Settings>): Promise<void>;
  /** Validates and replaces all data. Rejects with `StateValidationError` on invalid input. */
  importJson(raw: string): Promise<void>;
  exportJson(): Promise<string>;
  reset(): Promise<void>;
}

/** Binds the pure commands to a store. `now` is injectable for tests. */
export function createActions(store: AppStore, now: Clock = Date.now): AppActions {
  return {
    initialize: (startDate) => store.replace(defaultState(startDate)),
    materializeToday: () => store.update((s) => commands.materializeToday(s, now())),
    startActivity: (id) => {
      const t = now();
      return store.update((s) => commands.startActivity(commands.materializeToday(s, t), id, t));
    },
    pause: (id) => store.update((s) => commands.pauseActivity(s, id, now())),
    resume: (id) => store.update((s) => commands.resumeActivity(s, id, now())),
    markApproachFound: (id) => store.update((s) => commands.recordApproachFound(s, id, now())),
    completeActivity: (id, outcome, totalMs) =>
      store.update((s) =>
        commands.completeActivity(s, id, { outcome, ...(totalMs !== undefined ? { totalMs } : {}) }, now()),
      ),
    skip: (id) => {
      const t = now();
      return store.update((s) => commands.skipActivity(commands.materializeToday(s, t), id, t));
    },
    saveNote: (slug, fields) => store.update((s) => commands.saveNote(s, slug, fields, now())),
    toggleChecked: (slug) => store.update((s) => commands.toggleChecked(s, slug)),
    updateSettings: (change) => store.update((s) => commands.updateSettings(s, change)),
    importJson: async (raw) => store.replace(deserializeState(raw)),
    exportJson: async () => commands.exportState(await store.readState()),
    reset: () => store.reset(),
  };
}
