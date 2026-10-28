import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { emptyChecklist } from '../core/practice';
import type { SimulationRecord } from '../core/practiceTypes';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { createActions } from './actions';
import { createTestApp } from './testing';

const NOW = new Date(2025, 5, 10, 12).getTime();
const part = (id: string, n: 1 | 2, change: Partial<SimulationRecord> = {}): SimulationRecord => ({ id, createdAt: 1000 * n, endedAt: 1000 * n + 500, durationMs: 500, slug: 'two-sum', mode: 'global', outcome: 'solved',
  checklist: emptyChecklist(), targetMinutes: 45, reflection: '', sessionId: 's', part: n, ...change });
function app(initial: AppState = defaultState('2025-01-01')) {
  const created = createTestApp(initial);
  return { ...created, actions: createActions(created.store, () => NOW) };
}

describe('saveSimulationSession', () => {
  it('saves both linked records in one write and leaves everything else untouched', async () => {
    const review = createActivity([], { slug: 'valid-anagram', type: 'resolve', dueDate: '2025-06-10', createdAt: '2025-06-10' });
    const initial: AppState = { ...defaultState('2025-01-01'), activities: [review], problemStatus: { 'valid-anagram': 'learning' } };
    const { store, actions } = app(initial);
    await actions.saveSimulationSession([part('a', 1), part('b', 2, { sessionReflection: 'Overall.' })]);
    expect(await store.readState()).toEqual({ ...initial, simulations: { a: part('a', 1), b: part('b', 2, { sessionReflection: 'Overall.' }) } });
  });
  it('rejects duplicates, unlinked pairs and invalid records without saving either of them', async () => {
    const initial = defaultState('2025-01-01');
    const { store, actions } = app(initial);
    await expect(actions.saveSimulationSession([part('a', 1), part('a', 2)])).rejects.toThrow();
    await expect(actions.saveSimulationSession([part('a', 1), part('b', 2, { sessionId: 'other' })])).rejects.toThrow('two linked records');
    await expect(actions.saveSimulationSession([part('b', 2), part('a', 1)])).rejects.toThrow('two linked records');
    await expect(actions.saveSimulationSession([part('a', 1), part('b', 2, { durationMs: -1 })])).rejects.toThrow();
    expect(await store.readState()).toEqual(initial);
    await actions.saveSimulationSession([part('a', 1), part('b', 2)]);
    await expect(actions.saveSimulationSession([part('c', 1), part('b', 2)])).rejects.toThrow('already saved');
    expect(Object.keys((await store.readState()).simulations!)).toEqual(['a', 'b']);
  });
  it('keeps single simulations working next to sessions', async () => {
    const { store, actions } = app();
    const { sessionId: _s, part: _p, ...single } = part('single', 1);
    await actions.saveSimulation(single);
    await actions.saveSimulationSession([part('a', 1), part('b', 2)]);
    expect(Object.keys((await store.readState()).simulations!).sort()).toEqual(['a', 'b', 'single']);
  });
});

describe('interview prep actions', () => {
  it('sets, edits (keeping createdAt) and clears the prep without touching other data', async () => {
    const initial: AppState = { ...defaultState('2025-01-01'), checked: { 'two-sum': true } };
    const { store, actions } = app(initial);
    await actions.saveInterviewPrep({ companyId: 'google', date: '2025-06-10' });
    expect((await store.readState()).interviewPrep).toEqual({ companyId: 'google', date: '2025-06-10', createdAt: NOW });
    const later = createActions(store, () => NOW + 5000);
    await later.saveInterviewPrep({ companyId: 'amazon', date: '2026-06-10' });
    expect(await store.readState()).toEqual({ ...initial, interviewPrep: { companyId: 'amazon', date: '2026-06-10', createdAt: NOW } });
    await actions.clearInterviewPrep();
    const cleared = await store.readState();
    expect('interviewPrep' in cleared).toBe(false);
    expect(cleared).toEqual(initial);
    await actions.clearInterviewPrep();
    expect(await store.readState()).toEqual(initial);
  });
  it('accepts today and +365 days only; rejects past, later or malformed dates and unknown companies', async () => {
    const { store, actions } = app();
    for (const date of ['2025-06-09', '2026-06-11', '2025-02-30', 'soon', '']) {
      await expect(actions.saveInterviewPrep({ companyId: 'google', date })).rejects.toThrow('Choose an interview date');
    }
    await expect(actions.saveInterviewPrep({ companyId: 'nope' as 'google', date: '2025-07-01' })).rejects.toThrow();
    expect((await store.readState()).interviewPrep).toBeUndefined();
    await actions.saveInterviewPrep({ companyId: 'google', date: '2026-06-10' });
    await actions.saveInterviewPrep({ companyId: 'google', date: '2025-06-10' });
  });
  it('survives a JSON export and import', async () => {
    const { store, actions } = app();
    await actions.saveInterviewPrep({ companyId: 'meta', date: '2025-07-01' });
    const before = await store.readState();
    await actions.importJson(await actions.exportJson());
    expect(await store.readState()).toEqual(before);
  });
});
