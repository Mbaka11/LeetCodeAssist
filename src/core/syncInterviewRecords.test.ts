import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { emptyChecklist } from './practice';
import { planDay } from './planner';
import type { InterviewPrep, SimulationRecord } from './practiceTypes';
import { programQueue } from './queue';
import { computeStreak, defaultState, loggedTotals, validateState } from './state';
import { applyRecords, baseAfterSync, describeRecord, isUntouchedState, mergeStates, publishableState, stateRecords } from './syncMerge';
import type { AppState } from './types';
import { weeklySummary } from './weekly';
import { workedTotals } from './worked';

const TODAY = '2025-01-07';
const prep: InterviewPrep = { companyId: 'google', date: '2025-02-01', createdAt: 1000 };
const part = (id: string, n: 1 | 2): SimulationRecord => ({ id, createdAt: 1000 * n, endedAt: 1000 * n + 500, durationMs: 500, slug: 'two-sum', mode: 'global', outcome: 'solved', checklist: emptyChecklist(),
  targetMinutes: 45, reflection: '', sessionId: 'session', part: n, ...(n === 2 ? { sessionReflection: 'Overall.' } : {}) });

function programState(): AppState {
  const review = createActivity([], { slug: 'valid-anagram', type: 'resolve', dueDate: TODAY, createdAt: TODAY });
  return { ...defaultState('2025-01-01'), activities: [{ ...review, status: 'done', completedAt: TODAY, outcome: 'solo', totalMs: 1_800_000 }], problemStatus: { 'valid-anagram': 'learning' } };
}
const programView = (state: AppState) => ({ queue: programQueue(state), plan: planDay(state, TODAY), worked: workedTotals(state), streak: computeStreak(state, TODAY),
  logged: loggedTotals(state, TODAY), weekly: weeklySummary(state, TODAY) });

describe('syncing linked session records and interview prep', () => {
  it('merges the two linked records of a session by id without moving program metrics', () => {
    const base = programState();
    const remote: AppState = { ...base, simulations: { p1: part('p1', 1), p2: part('p2', 2) } };
    const result = mergeStates(base, base, remote);
    expect(result.conflicts).toEqual([]);
    expect(result.state.simulations).toEqual(remote.simulations);
    expect(programView(result.state)).toEqual(programView(base));
    // Two sessions saved on different devices keep every record.
    const local: AppState = { ...base, simulations: { q1: { ...part('q1', 1), sessionId: 'other' }, q2: { ...part('q2', 2), sessionId: 'other' } } };
    expect(Object.keys(mergeStates(base, local, remote).state.simulations!).sort()).toEqual(['p1', 'p2', 'q1', 'q2']);
    expect(describeRecord('simulations/p2', part('p2', 2))).toContain('problem 2 of a two-problem session');
  });

  it('adopts a prep set on the other device, publishes a local one, and treats equal edits as no change', () => {
    const base = programState();
    const withPrep: AppState = { ...base, interviewPrep: prep };
    expect(mergeStates(base, base, withPrep).state.interviewPrep).toEqual(prep);
    const published = mergeStates(base, withPrep, base);
    expect(published.state.interviewPrep).toEqual(prep);
    expect(published.conflicts).toEqual([]);
    expect(mergeStates(base, withPrep, withPrep).state).toEqual(validateState(withPrep));
    expect(programView(mergeStates(base, base, withPrep).state)).toEqual(programView(base));
  });

  it('merges an edited prep as one whole value and raises a conflict when both devices edit it differently', () => {
    const base: AppState = { ...programState(), interviewPrep: prep };
    const moved: AppState = { ...base, interviewPrep: { ...prep, date: '2025-03-01' } };
    expect(mergeStates(base, base, moved).state.interviewPrep).toEqual(moved.interviewPrep);
    const other: AppState = { ...base, interviewPrep: { ...prep, companyId: 'amazon' } };
    const result = mergeStates(base, moved, other);
    expect(result.conflicts.map((c) => c.path)).toEqual(['interviewPrep']);
    // The local value is kept until the user chooses; fields are never mixed together.
    expect(result.state.interviewPrep).toEqual(moved.interviewPrep);
    expect(publishableState(result.state, result.conflicts).interviewPrep).toEqual(other.interviewPrep);
    expect(describeRecord('interviewPrep', prep)).toBe('Interview prep · google · 2025-02-01');
  });

  it('propagates clearing a prep, and asks when one device clears what the other edited', () => {
    const base: AppState = { ...programState(), interviewPrep: prep };
    const cleared: AppState = { ...programState() };
    const cleaned = mergeStates(base, cleared, base);
    expect('interviewPrep' in cleaned.state).toBe(false);
    expect('interviewPrep' in mergeStates(base, base, cleared).state).toBe(false);
    const edited: AppState = { ...base, interviewPrep: { ...prep, date: '2025-03-01' } };
    const conflict = mergeStates(base, cleared, edited);
    expect(conflict.conflicts.map((c) => c.path)).toEqual(['interviewPrep']);
    expect('interviewPrep' in conflict.state).toBe(false);
  });

  it('exposes the prep as one record, and an untouched device only adopts it when it has no prep', () => {
    const state: AppState = { ...defaultState('2025-01-01'), interviewPrep: prep };
    expect(stateRecords(state).interviewPrep).toEqual(prep);
    expect(isUntouchedState(state)).toBe(false);
    expect(isUntouchedState(defaultState('2025-01-01'))).toBe(true);
    expect(mergeStates(undefined, defaultState('2025-01-01'), state).state).toEqual(state);
    expect('interviewPrep' in applyRecords(state, { interviewPrep: undefined })).toBe(false);
    expect(baseAfterSync(state, []).interviewPrep).toEqual(prep);
  });

  it('keeps both fields absent when neither device has them', () => {
    const base = programState();
    const result = mergeStates(base, base, base);
    expect('interviewPrep' in result.state).toBe(false);
    expect('simulations' in result.state).toBe(false);
  });
});
