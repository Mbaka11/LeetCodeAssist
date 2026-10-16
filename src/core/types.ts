/** Data model shared by the pure core, the background worker and the UI (SPEC §5). */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** Static NeetCode 150 problem record (src/data/neetcode150.ts). Facts only. */
export interface Problem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  url: string;
  neetcodeOrder: number;
}

export type ActivityType =
  | 'new'
  | 'recall'
  | 'rebuild'
  | 'resolve'
  | 'blind'
  | 'retry'
  | 'benchmark';

/** Activity types that are spaced reviews of an already-learned problem. */
export type ReviewType = 'recall' | 'rebuild' | 'resolve' | 'blind' | 'retry';

export type Outcome = 'solo' | 'hint' | 'solution' | 'stuck';

export type ActivityStatus = 'planned' | 'in_progress' | 'done' | 'skipped';

export type ProblemStatus =
  | 'untouched'
  | 'learning'
  | 'consolidating'
  | 'reviewed'
  | 'mastered';

/** Timer derived from timestamps (ms since epoch), never from tick counting. */
export interface TimerState {
  startedAt: number | null;
  accumulatedMs: number;
  running: boolean;
}

export interface Activity {
  id: string;
  slug: string;
  type: ActivityType;
  /** Local calendar date, YYYY-MM-DD. */
  dueDate: string;
  status: ActivityStatus;
  timer: TimerState;
  approachMs?: number;
  totalMs?: number;
  outcome?: Outcome;
  /** Local calendar date (YYYY-MM-DD) on which the activity was completed. */
  completedAt?: string;
  /** Local calendar date (YYYY-MM-DD) on which the activity was created. */
  createdAt: string;
  /**
   * Optional practice the planner added for the day it is due (consolidation-day blind practice).
   * If it is not done it goes stale instead of becoming overdue debt.
   */
  extra?: boolean;
}

export interface Note {
  slug: string;
  /** Short recognition cue, e.g. "Click". */
  trigger: string;
  principle: string;
  pitfall: string;
  complexity: string;
  /** Python snippet. */
  code?: string;
  updatedAt: string;
}

export interface Settings {
  /** Local calendar date of program day 1, YYYY-MM-DD. */
  startDate: string;
  dailyTargetMin: number;
  dailyCapMin: number;
  /** "HH:MM", 24h. */
  morningNotify: string;
  /** "HH:MM", 24h. */
  eveningNotify: string;
  language: 'python';
}

export interface AppState {
  version: 1;
  settings: Settings;
  /** Append-only history: activities are never deleted. */
  activities: Activity[];
  notes: Record<string, Note>;
  problemStatus: Record<string, ProblemStatus>;
  checked: Record<string, boolean>;
}
