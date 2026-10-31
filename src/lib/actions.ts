import { addDays, isValidDateString, localDateFromTimestamp } from '../core/dates';
import { deserializeState, defaultState, validateState } from '../core/state';
import type { Outcome, Settings, SavedRoadmapFilter } from '../core/types';
import type { DrillSessionRecord, InterviewPrep, SimulationRecord } from '../core/practiceTypes';
import { confirmResultCorrection, type ResultEdit } from '../core/resultCorrection';
import { readLeetCodeSettingsSection } from './backupFile';
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
  /** Saves on the automatic 04:00 training date; optional completedDate is a race guard, not a date override. */
  completeActivity(id: string, outcome: Outcome, totalMs?: number, completedDate?: string): Promise<void>;
  /** Apply only a confirmed, current preview of a saved-result correction. */
  correctResult(id: string, edit: ResultEdit, fingerprint: string): Promise<void>;
  skip(id: string): Promise<void>;
  /** Moves a planned review to `newDate` (>= today); see `commands.rescheduleReview`. */
  moveReview(id: string, newDate: string): Promise<void>;
  /** Moves a new problem back in the queue without dropping it; see `commands.postponeNew`. */
  postpone(id: string): Promise<void>;
  /** Records that hint `level` (1-3) was revealed during an open activity. */
  revealHint(id: string, level: number): Promise<void>;
  saveNote(slug: string, fields: commands.NoteFields): Promise<void>;
  toggleChecked(slug: string): Promise<void>;
  toggleFavorite(slug: string): Promise<void>;
  saveRoadmapFilter(id: string, entry: SavedRoadmapFilter): Promise<void>;
  deleteRoadmapFilter(id: string): Promise<void>;
  saveSimulation(record: SimulationRecord): Promise<void>;
  /** Saves both records of a two-problem session in one write (all or nothing). */
  saveSimulationSession(records: readonly [SimulationRecord, SimulationRecord]): Promise<void>;
  /** Sets or edits the optional interview prep; the date must be today..+365 days. Never schedules anything. */
  saveInterviewPrep(prep: Pick<InterviewPrep, 'companyId' | 'date'>): Promise<void>;
  clearInterviewPrep(): Promise<void>;
  saveDrillSession(record: DrillSessionRecord): Promise<void>;
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
    correctResult: (id, edit, fingerprint) => store.update((s) => confirmResultCorrection(s, id, edit, fingerprint, now())),
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
    toggleFavorite: (slug) => store.update((s) => ({ ...s,
      favorites: { ...s.favorites, [slug]: s.favorites?.[slug] !== true },
    })),
    saveRoadmapFilter: (id, entry) => store.update((s) => validateState({ ...s,
      savedRoadmapFilters: { ...s.savedRoadmapFilters, [id]: entry },
    })),
    deleteRoadmapFilter: (id) => store.update((s) => {
      const savedRoadmapFilters = { ...s.savedRoadmapFilters };
      delete savedRoadmapFilters[id];
      return { ...s, savedRoadmapFilters };
    }),
    saveSimulation: (record) => store.update((s) => {
      if (Object.hasOwn(s.simulations ?? {}, record.id)) throw new Error('Simulation already saved');
      return validateState({ ...s, simulations: { ...s.simulations, [record.id]: record } });
    }),
    saveSimulationSession: (records) => store.update((s) => {
      for (const record of records) if (Object.hasOwn(s.simulations ?? {}, record.id)) throw new Error('Simulation already saved');
      if (records[0].id === records[1].id || records[0].sessionId === undefined || records[0].sessionId !== records[1].sessionId ||
        records[0].part !== 1 || records[1].part !== 2) throw new Error('A session needs two linked records (part 1 and part 2)');
      return validateState({ ...s, simulations: { ...s.simulations, [records[0].id]: records[0], [records[1].id]: records[1] } });
    }),
    saveInterviewPrep: (prep) => store.update((s) => {
      const t = now();
      const today = localDateFromTimestamp(t);
      if (!isValidDateString(prep.date) || prep.date < today || prep.date > addDays(today, 365)) throw new Error('Choose an interview date from today up to 365 days ahead.');
      return validateState({ ...s, interviewPrep: { companyId: prep.companyId, date: prep.date, createdAt: s.interviewPrep?.createdAt ?? t } });
    }),
    clearInterviewPrep: () => store.update((s) => {
      const { interviewPrep: _removed, ...rest } = s;
      return rest;
    }),
    saveDrillSession: (record) => store.update((s) => {
      if (Object.hasOwn(s.drillSessions ?? {}, record.id)) throw new Error('Drill session already saved');
      return validateState({ ...s, drillSessions: { ...s.drillSessions, [record.id]: record } });
    }),
    updateSettings: (change) => store.update((s) => commands.updateSettings(s, change)),
    importJson: async (raw) => {
      // A malformed LeetCode settings section refuses the whole import before anything is changed.
      readLeetCodeSettingsSection(raw);
      return store.replace(deserializeState(raw));
    },
    exportJson: async () => commands.exportState(await store.readState()),
    reset: () => store.reset(),
  };
}
