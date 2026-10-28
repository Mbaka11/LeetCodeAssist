import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { emptyChecklist } from './practice';
import type { DrillSessionRecord, InterviewPrep, SimulationRecord } from './practiceTypes';
import { defaultState, validateState } from './state';
import { applyRecords, isUntouchedState, mergeStates, stateRecords } from './syncMerge';
import type { AppState, RoadmapFilters, Settings } from './types';

/**
 * Integration guard: every optional `AppState` field and every `Settings` field must travel through the sync merge.
 * The `Record<..., true>` maps below stop compiling when a field is added without being listed here, which is the
 * reminder to extend `stateRecords` / `applyRecords` (or to document the field as device-local).
 */
const appStateFields: Record<Exclude<keyof AppState, 'version'>, true> = {
  settings: true, activities: true, notes: true, problemStatus: true, checked: true, favorites: true,
  savedRoadmapFilters: true, simulations: true, drillSessions: true, interviewPrep: true, queue: true,
};
const settingsFields: Record<keyof Settings, true> = {
  startDate: true, dailyTargetMin: true, dailyCapMin: true, morningNotify: true, eveningNotify: true, language: true,
  roadmapView: true, roadmapCatalog: true, roadmapDetail: true, roadmapGroup: true, roadmapHideTechniques: true,
  sidePanelFocus: true, eveningOnlyIfOpen: true, budgets: true,
};

const filters: RoadmapFilters = { search: '', category: '', difficulty: 'Hard', status: '', access: '', scope: '', technique: '', structure: '', company: '', favoritesOnly: false };
const simulation: SimulationRecord = { id: 'sim', createdAt: 1000, endedAt: 3000, slug: 'two-sum', mode: 'global', checklist: emptyChecklist(), outcome: 'solved', reflection: '', durationMs: 2000, targetMinutes: 25 };
const sessionParts: SimulationRecord[] = [1, 2].map((part) => ({ ...simulation, id: `session-${part}`, sessionId: 'session', part: part as 1 | 2,
  targetMinutes: 45, ...(part === 2 ? { sessionReflection: 'Overall.' } : {}) }));
const drill: DrillSessionRecord = { id: 'drill', createdAt: 1000, endedAt: 3000, includeUnworked: false, score: 1, total: 1, answers: [{ slug: 'two-sum', kind: 'technique', correct: true }] };
const prep: InterviewPrep = { companyId: 'google', date: '2025-02-01', createdAt: 1000 };

function fullState(): AppState {
  const base = defaultState('2025-01-01');
  const activity = createActivity([], { slug: 'valid-anagram', type: 'resolve', dueDate: '2025-01-07', createdAt: '2025-01-07' });
  return validateState({
    ...base,
    settings: { ...base.settings, roadmapView: 'all', roadmapCatalog: 'blind75', roadmapDetail: 'detailed', roadmapGroup: 'company',
      roadmapHideTechniques: true, sidePanelFocus: true, eveningOnlyIfOpen: false, budgets: { new: { Easy: 20 } } },
    activities: [activity],
    notes: { 'two-sum': { slug: 'two-sum', trigger: 'Pair', principle: 'Map', pitfall: 'Reuse', complexity: 'O(n)', updatedAt: '2025-01-02' } },
    problemStatus: { 'two-sum': 'learning' },
    checked: { 'two-sum': true },
    favorites: { 'two-sum': true },
    savedRoadmapFilters: { saved: { name: 'Hard only', filters } },
    simulations: { sim: simulation, 'session-1': sessionParts[0]!, 'session-2': sessionParts[1]! },
    drillSessions: { drill },
    interviewPrep: prep,
    queue: ['valid-anagram', 'two-sum'],
  });
}

describe('sync merge covers every optional state field', () => {
  it('lists every AppState and Settings field of a fully populated state', () => {
    const state = fullState();
    expect(Object.keys(state).filter((key) => key !== 'version').sort()).toEqual(Object.keys(appStateFields).sort());
    expect(Object.keys(state.settings).sort()).toEqual(Object.keys(settingsFields).sort());
  });

  it('round-trips a fully populated state through stateRecords and applyRecords unchanged', () => {
    const state = fullState();
    const empty = defaultState('2025-01-01');
    expect(applyRecords(empty, stateRecords(state))).toEqual(state);
    expect(isUntouchedState(state)).toBe(false);
  });

  it('adopts every record from the other device and keeps a fully populated state stable when both sides match', () => {
    const state = fullState();
    const base = defaultState('2025-01-01');
    const adopted = mergeStates(base, base, state);
    expect(adopted.conflicts).toEqual([]);
    expect(adopted.state).toEqual(state);
    const same = mergeStates(state, state, state);
    expect(same.conflicts).toEqual([]);
    expect(same.state).toEqual(state);
  });

  it('propagates the removal of every optional single-value field', () => {
    const state = fullState();
    const { interviewPrep: _prep, queue: _queue, ...withoutValues } = state;
    const removed = mergeStates(state, withoutValues, state);
    expect(removed.conflicts).toEqual([]);
    expect(removed.state.interviewPrep).toBeUndefined();
    expect(removed.state.queue).toBeUndefined();
  });
});
