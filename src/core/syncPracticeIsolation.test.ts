import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { emptyChecklist } from './practice';
import type { DrillSessionRecord, SimulationRecord } from './practiceTypes';
import { planDay } from './planner';
import { programQueue } from './queue';
import { computeStreak, defaultState, loggedTotals, validateState } from './state';
import { mergeStates, publishableState } from './syncMerge';
import type { AppState, RoadmapFilters } from './types';
import { weeklySummary } from './weekly';
import { workedTotals } from './worked';

const TODAY = '2025-01-07';
const filters: RoadmapFilters = { search: '', category: '', difficulty: 'Hard', status: '', access: '', scope: '', technique: '', structure: '', company: '', favoritesOnly: false };
const simulation: SimulationRecord = { id: 'sim', createdAt: 1000, endedAt: 3000, slug: 'two-sum', mode: 'global', checklist: emptyChecklist(), outcome: 'solved', reflection: '', durationMs: 2000, targetMinutes: 25 };
const drill: DrillSessionRecord = { id: 'drill', createdAt: 1000, endedAt: 3000, includeUnworked: false, score: 1, total: 1, answers: [{ slug: 'two-sum', kind: 'technique', correct: true }] };

function programState(): AppState {
  const review = createActivity([], { slug: 'valid-anagram', type: 'resolve', dueDate: TODAY, createdAt: TODAY });
  return {
    ...defaultState('2025-01-01'),
    activities: [{ ...review, status: 'done', completedAt: TODAY, outcome: 'solo', totalMs: 1_800_000 }],
    problemStatus: { 'valid-anagram': 'learning' },
  };
}

/** Everything the learning program derives from a state; optional practice and presentation fields must not move it. */
function programView(state: AppState) {
  return {
    queue: programQueue(state),
    plan: planDay(state, TODAY),
    worked: workedTotals(state),
    streak: computeStreak(state, TODAY),
    logged: loggedTotals(state, TODAY),
    weekly: weeklySummary(state, TODAY),
  };
}

describe('syncing optional practice and presentation records', () => {
  it('merges practice, favorites, saved filters and focus from the other device without moving program metrics', () => {
    const base = programState();
    const local = base;
    const remote: AppState = {
      ...base,
      favorites: { 'two-sum': true },
      savedRoadmapFilters: { f1: { name: 'Hard', filters } },
      simulations: { sim: simulation },
      drillSessions: { drill },
      settings: { ...base.settings, sidePanelFocus: true },
    };
    const result = mergeStates(base, local, remote);
    expect(result.conflicts).toEqual([]);
    expect(result.state).toEqual(validateState(remote));
    expect(programView(result.state)).toEqual(programView(base));
    expect(programQueue(result.state)).toHaveLength(50);
  });

  it('propagates an explicit unstar and a deleted saved filter, but asks when one side edits what the other deleted', () => {
    const base: AppState = { ...programState(), favorites: { a: true, b: true }, savedRoadmapFilters: { f1: { name: 'One', filters }, f2: { name: 'Two', filters } } };
    const local: AppState = { ...base, favorites: { a: false, b: true }, savedRoadmapFilters: { f2: { name: 'Two', filters } } };
    const remote: AppState = { ...base, savedRoadmapFilters: { f1: { name: 'One', filters }, f2: { name: 'Renamed', filters } } };
    const result = mergeStates(base, local, remote);
    expect(result.state.favorites).toEqual({ a: false, b: true });
    expect(result.state.savedRoadmapFilters).toEqual({ f2: { name: 'Renamed', filters } });
    expect(result.conflicts).toEqual([]);
    const edited: AppState = { ...base, savedRoadmapFilters: { f1: { name: 'Edited', filters }, f2: base.savedRoadmapFilters!.f2! } };
    const conflict = mergeStates(base, local, edited);
    expect(conflict.conflicts.map((c) => c.path)).toEqual(['savedRoadmapFilters/f1']);
    expect(conflict.state.savedRoadmapFilters).toEqual({ f2: { name: 'Two', filters } });
    expect(publishableState(conflict.state, conflict.conflicts).savedRoadmapFilters?.f1).toEqual({ name: 'Edited', filters });
  });

  it('treats a same-ID simulation with different content as a conflict and never overwrites it', () => {
    const base = programState();
    const local: AppState = { ...base, simulations: { sim: simulation } };
    const remote: AppState = { ...base, simulations: { sim: { ...simulation, outcome: 'partial' } } };
    const result = mergeStates(base, local, remote);
    expect(result.conflicts.map((c) => c.path)).toEqual(['simulations/sim']);
    expect(result.state.simulations).toEqual({ sim: simulation });
    expect(programView(result.state)).toEqual(programView(base));
  });

  it('keeps optional fields absent when neither device has them (data from before these features)', () => {
    const base = programState();
    const result = mergeStates(base, base, base);
    for (const field of ['favorites', 'savedRoadmapFilters', 'simulations', 'drillSessions'] as const) expect(field in result.state).toBe(false);
    expect('sidePanelFocus' in result.state.settings).toBe(false);
  });
});
