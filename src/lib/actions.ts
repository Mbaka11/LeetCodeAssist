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
  /** Starts practice on a problem outside today's plan; see `commands.startExtraPractice`. */
  startExtraPractice(slug: string): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  markApproachFound(id: string): Promise<void>;
  /** Saves an open activity on today (default) or an explicit today/yesterday date; timer uses the real clock. */
  completeActivity(id: string, outcome: Outcome, totalMs?: number, completedDate?: string): Promise<void>;
  skip(id: string): Promise<void>;
  /** Moves a planned review to `newDate` (>= today); see `commands.rescheduleReview`. */
  moveReview(id: string, newDate: string): Promise<void>;
  /** Moves a new problem back in the queue without dropping it; see `commands.postponeNew`. */
  postpone(id: string): Promise<void>;
  /** Records that hint `level` (1-3) was revealed during an open activity. */
  revealHint(id: string, level: number): Promise<void>;
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
    startExtraPractice: (slug) =>
      store.update((s) => commands.startExtraPractice(s, slug, now()).state),
    pause: (id) => store.update((s) => commands.pauseActivity(s, id, now())),
    resume: (id) => store.update((s) => commands.resumeActivity(s, id, now())),
    markApproachFound: (id) => store.update((s) => commands.recordApproachFound(s, id, now())),
    completeActivity: (id, outcome, totalMs, completedDate) =>
      store.update((s) =>
        commands.completeActivity(s, id, {
          outcome,
          ...(totalMs !== undefined ? { totalMs } : {}),
          ...(completedDate !== undefined ? { completedDate } : {}),
        }, now()),
      ),
    skip: (id) => {
      const t = now();
      return store.update((s) => commands.skipActivity(commands.materializeToday(s, t), id, t));
    },
    moveReview: (id, newDate) => store.update((s) => commands.rescheduleReview(s, id, newDate, now())),
    postpone: (id) => {
      const t = now();
      return store.update((s) => commands.postponeNew(commands.materializeToday(s, t), id, t));
    },
    revealHint: (id, level) => {
      const t = now();
      return store.update((s) => commands.revealHint(commands.materializeToday(s, t), id, level));
    },
    saveNote: (slug, fields) => store.update((s) => commands.saveNote(s, slug, fields, now())),
    toggleChecked: (slug) => store.update((s) => commands.toggleChecked(s, slug)),
    updateSettings: (change) => store.update((s) => commands.updateSettings(s, change)),
    importJson: async (raw) => store.replace(deserializeState(raw)),
    exportJson: async () => commands.exportState(await store.readState()),
    reset: () => store.reset(),
  };
}
