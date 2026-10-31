import { createActivity, isReviewType } from './activities';
import { isValidDateString, trainingDateFromTimestamp } from './dates';
import { applyOutcome } from './reviews';
import type { Activity, AppState, Outcome, ProblemStatus } from './types';

export interface ResultEdit { completedDate: string; totalMs: number; outcome: Outcome }
export interface CorrectionPreview {
  fingerprint: string;
  before: Activity;
  after: Activity;
  retired: Activity[];
  added: Activity[];
  statusBefore: ProblemStatus;
  statusAfter: ProblemStatus;
  changed: boolean;
  scheduleRecalculated: boolean;
}

function completions(state: AppState, slug: string): Activity[] {
  // Sort is stable: same-day ties retain the saved activity order, not lexical ID order.
  return state.activities.filter((a) => a.slug === slug && a.status === 'done')
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
}

function targetOf(state: AppState, id: string): Activity {
  const activity = state.activities.find((a) => a.id === id);
  if (!activity || activity.status !== 'done' || !activity.completedAt) throw new Error('Only a completed result can be corrected.');
  return activity;
}

export function correctionDateBounds(state: AppState, id: string, today: string): { min: string; max: string } {
  const target = targetOf(state, id);
  const history = completions(state, target.slug);
  const index = history.findIndex((a) => a.id === id);
  const earliest = target.completedAt! < state.settings.startDate ? target.completedAt! : state.settings.startDate;
  const min = history[index - 1]?.completedAt ?? earliest;
  const next = history[index + 1]?.completedAt;
  // Legacy midnight-based results can be dated one civil day ahead before 04:00. Keep their
  // unchanged date editable, without allowing a correction to move anything further into the future.
  const latest = target.completedAt! > today ? target.completedAt! : today;
  return { min, max: next && next < latest ? next : latest };
}

function fingerprint(state: AppState, target: Activity, now: number): string {
  return JSON.stringify({ today: trainingDateFromTimestamp(now), settings: state.settings,
    status: state.problemStatus[target.slug], activities: state.activities.filter((a) => a.slug === target.slug) });
}

/** Replay completed attempts to derive unstarted scheduled reviews, never editing those real attempts. */
function replayProblem(state: AppState, target: Activity, edited: Activity): AppState {
  let replay: AppState = { ...state, activities: [], problemStatus: { [target.slug]: 'untouched' } };
  for (const original of completions(state, target.slug)) {
    const completed = original.id === target.id ? edited : original;
    // A completed scheduled review consumes the earliest planned review of its type, even if it was
    // done early. Extra attempts must not consume the scheduled counterpart.
    if (isReviewType(completed.type) && !completed.extra) {
      const pending = replay.activities.filter((a) => a.type === completed.type && a.status === 'planned')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      if (pending) replay = { ...replay, activities: replay.activities.filter((a) => a.id !== pending.id) };
    }
    // Real IDs can collide with temporary generated IDs. Only replay state is disposable.
    replay = { ...replay, activities: [...replay.activities.filter((a) => a.id !== completed.id),
      { ...completed, status: 'in_progress', timer: { running: false, startedAt: null, accumulatedMs: completed.totalMs ?? 0 } }] };
    replay = applyOutcome(replay, completed.id, { outcome: completed.outcome!,
      completedDate: completed.completedAt!, totalMs: completed.totalMs ?? 0, now: 0 });
  }
  return replay;
}

/** Pure preview; the commit path recomputes this against current storage and checks its fingerprint. */
export function prepareResultCorrection(state: AppState, id: string, edit: ResultEdit, now: number): {
  preview: CorrectionPreview; state: AppState;
} {
  const target = targetOf(state, id);
  const today = trainingDateFromTimestamp(now);
  const bounds = correctionDateBounds(state, id, today);
  if (!isValidDateString(edit.completedDate) || edit.completedDate < bounds.min || edit.completedDate > bounds.max) {
    throw new Error(`Choose a completion date from ${bounds.min} to ${bounds.max}; the order of completed attempts must stay unchanged.`);
  }
  if (!Number.isSafeInteger(edit.totalMs) || edit.totalMs < 0) throw new Error('Logged time must be a non-negative, finite duration.');
  if (target.approachMs !== undefined && edit.totalMs < target.approachMs) throw new Error('Logged time cannot be less than the recorded approach time.');
  if (!['solo', 'hint', 'solution', 'stuck'].includes(edit.outcome)) throw new Error('Choose a valid outcome.');
  const changed = target.completedAt !== edit.completedDate || target.totalMs !== edit.totalMs || target.outcome !== edit.outcome;
  const scheduleRecalculated = target.completedAt !== edit.completedDate || target.outcome !== edit.outcome;
  const after: Activity = changed ? { ...target, completedAt: edit.completedDate, totalMs: edit.totalMs, outcome: edit.outcome,
    corrections: [...(target.corrections ?? []), { at: now, previousDate: target.completedAt!,
      ...(target.totalMs !== undefined ? { previousTotalMs: target.totalMs } : {}),
      ...(target.outcome !== undefined ? { previousOutcome: target.outcome } : {}) }] } : target;
  let activities = state.activities.map((a) => a.id === id ? after : a);
  const retired: Activity[] = [];
  const added: Activity[] = [];
  const statusBefore = state.problemStatus[target.slug] ?? 'untouched';
  let statusAfter = statusBefore;
  if (scheduleRecalculated) {
    // Unknown outcomes cannot be faithfully replayed. Duration-only correction is still safe.
    if (completions(state, target.slug).some((a) => a.id !== id && !a.outcome)) {
      throw new Error('Another completed attempt has no recorded outcome. Correct its outcome first, or change only the duration.');
    }
    const replay = replayProblem(state, target, after);
    statusAfter = replay.problemStatus[target.slug] ?? 'untouched';
    const active = state.activities.filter((a) => a.slug === target.slug && a.status === 'in_progress' && isReviewType(a.type));
    let wanted = replay.activities.filter((a) => a.status === 'planned' && isReviewType(a.type) && !a.extra);
    // Preserve started scheduled reviews and consume their replay counterpart, so correcting history
    // cannot add a second copy of the review currently being performed.
    for (const current of active.filter((a) => !a.extra)) {
      const match = wanted.filter((a) => a.type === current.type).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      if (match) wanted = wanted.filter((a) => a.id !== match.id);
    }
    wanted = wanted.filter((a) => !active.some((b) => b.dueDate === a.dueDate));
    const pending = state.activities.filter((a) => a.slug === target.slug && a.status === 'planned' && isReviewType(a.type) && !a.extra);
    const retained = new Set<string>();
    for (const candidate of wanted) {
      const existing = pending.find((a) => !retained.has(a.id) && a.type === candidate.type && a.dueDate === candidate.dueDate);
      if (existing) retained.add(existing.id);
      else {
        const next = createActivity([...activities, ...added], { type: candidate.type, slug: target.slug,
          dueDate: candidate.dueDate, createdAt: today });
        added.push(next);
      }
    }
    retired.push(...pending.filter((a) => !retained.has(a.id)));
    const retiredIds = new Set(retired.map((a) => a.id));
    activities = [...activities.map((a) => retiredIds.has(a.id) ? { ...a, status: 'skipped' as const } : a), ...added];
  }
  const next = changed ? { ...state, activities,
    problemStatus: { ...state.problemStatus, ...(scheduleRecalculated ? { [target.slug]: statusAfter } : {}) } } : state;
  return { preview: { fingerprint: fingerprint(state, target, now), before: target, after,
    retired, added, statusBefore, statusAfter, changed, scheduleRecalculated }, state: next };
}

export function confirmResultCorrection(state: AppState, id: string, edit: ResultEdit, expected: string, now: number): AppState {
  const target = targetOf(state, id);
  if (fingerprint(state, target, now) !== expected) throw new Error('Data or date changed since this preview. Refresh the preview before confirming.');
  return prepareResultCorrection(state, id, edit, now).state;
}
