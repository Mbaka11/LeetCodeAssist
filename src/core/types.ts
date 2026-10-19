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

export interface ResultCorrection {
  /** Actual edit timestamp; the original values are retained for audit in JSON backups. */
  at: number;
  previousDate: string;
  previousTotalMs?: number;
  previousOutcome?: Outcome;
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
  /** Optional correction audit; absent on records saved before result editing existed. */
  corrections?: ResultCorrection[];
  /** Local calendar date (YYYY-MM-DD) on which the activity was created. */
  createdAt: string;
  /**
   * Optional practice the planner added for the day it is due (consolidation-day blind practice).
   * If it is not done it goes stale instead of becoming overdue debt.
   */
  extra?: boolean;
  /**
   * How many hints (1-3, in order: nudge, insight, sketch) were revealed during this attempt.
   * Absent means none. Additive: older saved data simply lacks it.
   */
  hintsUsed?: number;
  /**
   * Set on a skipped `new` activity that was postponed: the problem moved back in the queue and is
   * planned again later, unlike a plain skip which drops it from the program.
   */
  postponed?: boolean;
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
  /** Roadmap layout. Optional so data saved before it existed stays valid; absent means `tree`. */
  roadmapView?: RoadmapViewMode;
  /** Problem catalog the roadmap is filtered by. Optional so older saved data stays valid; absent means `neetcode150`. */
  roadmapCatalog?: RoadmapCatalog;
  /**
   * Time budget overrides in minutes per activity type and difficulty (partial: a missing entry uses the
   * default, see `DEFAULT_BUDGETS`). Optional so data saved before it existed stays valid.
   */
  budgets?: BudgetOverrides;
}

/** Activity types whose budget depends on the problem difficulty (benchmarks keep a flat budget). */
export type BudgetedType = Exclude<ActivityType, 'benchmark'>;

export type BudgetOverrides = { [T in BudgetedType]?: Partial<Record<Difficulty, number>> };

export type RoadmapViewMode = 'tree' | 'grid';

/** Catalogs the roadmap can show (see `CatalogId` in catalog.ts); Blind 75 is a subset of the NeetCode 150. */
export type RoadmapCatalog = 'neetcode150' | 'blind75';

export interface AppState {
  version: 1;
  settings: Settings;
  /** Append-only history: activities are never deleted. */
  activities: Activity[];
  notes: Record<string, Note>;
  problemStatus: Record<string, ProblemStatus>;
  checked: Record<string, boolean>;
  /**
   * Order of the new-problem queue after the user postponed problems (slugs, see `programQueue`).
   * Absent means the default `PROGRAM_QUEUE` order.
   */
  queue?: string[];
}
