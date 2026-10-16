/**
 * Pure state transitions behind the UI actions. Each takes the current `AppState` (and the
 * current timestamp where time matters) and returns the next one; storage lives in `storage.ts`.
 */
import { createActivity, findActivity, isReviewType, markApproachFound, updateActivity } from '../core/activities';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { materializePlan, planDay } from '../core/planner';
import { applyOutcome } from '../core/reviews';
import { validateState } from '../core/state';
import { pauseTimer, resumeTimer, startTimer } from '../core/timer';
import type { Activity, AppState, Note, Outcome, Settings } from '../core/types';

/** Persists the activities of today's plan (new problems, benchmarks, bonus) so timers can persist. */
export function materializeToday(state: AppState, now: number): AppState {
  return materializePlan(state, planDay(state, localDateFromTimestamp(now)));
}

function requireOpen(state: AppState, id: string): Activity {
  const activity = findActivity(state, id);
  if (!activity) throw new Error(`Unknown activity: ${id}`);
  if (activity.status === 'done' || activity.status === 'skipped') {
    throw new Error(`Activity ${id} is already ${activity.status}`);
  }
  return activity;
}

/** Starts (or resumes) an activity. Only one timer runs at a time: others are paused. */
export function startActivity(state: AppState, id: string, now: number): AppState {
  requireOpen(state, id);
  const paused: AppState = {
    ...state,
    activities: state.activities.map((a) =>
      a.id !== id && a.timer.running ? { ...a, timer: pauseTimer(a.timer, now) } : a,
    ),
  };
  return updateActivity(paused, id, (a) => ({
    ...a,
    status: 'in_progress',
    timer: startTimer(a.timer, now),
  }));
}

export function pauseActivity(state: AppState, id: string, now: number): AppState {
  requireOpen(state, id);
  return updateActivity(state, id, (a) => ({ ...a, timer: pauseTimer(a.timer, now) }));
}

export function resumeActivity(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  if (activity.status !== 'in_progress') throw new Error(`Activity ${id} was not started`);
  return startActivity(state, id, now);
}

export function recordApproachFound(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  if (activity.status !== 'in_progress') throw new Error(`Activity ${id} was not started`);
  return updateActivity(state, id, (a) => markApproachFound(a, now));
}

export interface CompletionInput {
  outcome: Outcome;
  /** Overrides the timer-derived time (for example after forgetting to pause). */
  totalMs?: number;
}

export function completeActivity(
  state: AppState,
  id: string,
  input: CompletionInput,
  now: number,
): AppState {
  requireOpen(state, id);
  return applyOutcome(state, id, {
    outcome: input.outcome,
    completedDate: localDateFromTimestamp(now),
    now,
    ...(input.totalMs !== undefined ? { totalMs: input.totalMs } : {}),
  });
}

/**
 * Skips an activity. A skipped review is never dropped (SPEC §4): unless it was optional practice,
 * the same review is planned again for tomorrow.
 */
export function skipActivity(state: AppState, id: string, now: number): AppState {
  const activity = requireOpen(state, id);
  const today = localDateFromTimestamp(now);
  const skipped = updateActivity(state, id, (a) => ({
    ...a,
    status: 'skipped',
    timer: pauseTimer(a.timer, now),
  }));
  if (!isReviewType(activity.type) || activity.extra) return skipped;
  const retry = createActivity(skipped.activities, {
    type: activity.type,
    slug: activity.slug,
    dueDate: addDays(today, 1),
    createdAt: today,
  });
  return { ...skipped, activities: [...skipped.activities, retry] };
}

export interface NoteFields {
  trigger: string;
  principle: string;
  pitfall: string;
  complexity: string;
  code: string;
}

export function saveNote(state: AppState, slug: string, fields: NoteFields, now: number): AppState {
  const note: Note = {
    slug,
    trigger: fields.trigger,
    principle: fields.principle,
    pitfall: fields.pitfall,
    complexity: fields.complexity,
    updatedAt: localDateFromTimestamp(now),
    ...(fields.code.trim() !== '' ? { code: fields.code } : {}),
  };
  return { ...state, notes: { ...state.notes, [slug]: note } };
}

export function toggleChecked(state: AppState, slug: string): AppState {
  const checked = { ...state.checked };
  if (checked[slug]) delete checked[slug];
  else checked[slug] = true;
  return { ...state, checked };
}

/** Applies a settings change; throws `StateValidationError` when the result is invalid. */
export function updateSettings(state: AppState, change: Partial<Settings>): AppState {
  return validateState({ ...state, settings: { ...state.settings, ...change } });
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}
