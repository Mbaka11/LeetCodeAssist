import { describe, expect, it } from 'vitest';
import { emptyChecklist } from '../core/practice';
import { createActivity } from '../core/activities';
import { weeklySummary } from '../core/weekly';
import type { SimulationRecord, DrillSessionRecord } from '../core/practiceTypes';
import { computeStreak, defaultState, loggedTotals } from '../core/state';
import { createTestApp } from './testing';

const simulation: SimulationRecord = { id: 'sim', createdAt: 1000, endedAt: 3000, slug: 'two-sum', mode: 'global', checklist: emptyChecklist(), outcome: 'solved', reflection: 'Explain more clearly.', durationMs: 2000, targetMinutes: 25 };
const drill: DrillSessionRecord = { id: 'drill', createdAt: 1000, endedAt: 3000, includeUnworked: true, score: 1, total: 1, answers: [{ slug: 'two-sum', kind: 'technique', correct: true }] };

describe('practice save actions', () => {
  it('merges immutable sessions by ID with no activity, status, count, streak or scheduling mutation', async () => {
    const initial = defaultState('2025-01-01');
    initial.favorites = { 'two-sum': true };
    const review = createActivity([], { slug: 'valid-anagram', type: 'resolve', dueDate: '2025-01-01', createdAt: '2025-01-01' });
    initial.activities = [{ ...review, status: 'done', completedAt: '2025-01-01', outcome: 'solo', totalMs: 1_800_000 },
      { ...review, id: 'running', slug: 'two-sum', status: 'in_progress', timer: { startedAt: 500, running: true, accumulatedMs: 100 } }];
    initial.problemStatus = { 'two-sum': 'learning', 'valid-anagram': 'reviewed' };
    const { store, actions } = createTestApp(initial);
    await Promise.all([actions.saveSimulation(simulation), actions.saveSimulation({ ...simulation, id: 'sim-2' }), actions.saveDrillSession(drill)]);
    const after = await store.readState();
    expect(after).toEqual({ ...initial, simulations: { sim: simulation, 'sim-2': { ...simulation, id: 'sim-2' } }, drillSessions: { drill } });
    expect(loggedTotals(after, '2025-01-01')).toEqual(loggedTotals(initial, '2025-01-01'));
    expect(computeStreak(after, '2025-01-01')).toEqual(computeStreak(initial, '2025-01-01'));
    expect(weeklySummary(after, '2025-01-01')).toEqual(weeklySummary(initial, '2025-01-01'));
    await expect(actions.saveSimulation({ ...simulation, reflection: 'overwrite' })).rejects.toThrow('already saved');
    await expect(actions.saveDrillSession(drill)).rejects.toThrow('already saved');
    expect(await store.readState()).toEqual(after);
    await actions.importJson(await actions.exportJson());
    expect(await store.readState()).toEqual(after);
  });
  it('rejects malformed practice without touching stored data', async () => {
    const initial = defaultState('2025-01-01');
    const { store, actions } = createTestApp(initial);
    await expect(actions.saveSimulation({ ...simulation, durationMs: -1 })).rejects.toThrow();
    await expect(actions.saveDrillSession({ ...drill, score: 0 })).rejects.toThrow();
    expect(await store.readState()).toEqual(initial);
  });
});
