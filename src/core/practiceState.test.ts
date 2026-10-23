import { describe, expect, it } from 'vitest';
import { emptyChecklist } from './practice';
import type { DrillSessionRecord, SimulationRecord } from './practiceTypes';
import { defaultState, deserializeState, serializeState, validateState } from './state';

const simulation: SimulationRecord = { id: 'mock-1', createdAt: 1000, endedAt: 2000, slug: 'two-sum', mode: 'global', outcome: 'partial', checklist: emptyChecklist(), durationMs: 1000, targetMinutes: 35, reflection: 'Check empty input.' };
const drill: DrillSessionRecord = { id: 'drill-1', createdAt: 1000, endedAt: 2000, includeUnworked: false, score: 1, total: 2, answers: [{ slug: 'two-sum', kind: 'outline', correct: true }, { slug: 'two-sum', kind: 'technique', correct: false }] };
const base = () => defaultState('2025-01-01');
describe('practice state validation (version 1)', () => {
  it('preserves legacy absence and round-trips both empty and populated optional collections', () => {
    expect(deserializeState(serializeState(base()))).toEqual(base());
    for (const collections of [{ simulations: {}, drillSessions: {} }, { simulations: { [simulation.id]: simulation }, drillSessions: { [drill.id]: drill } }]) {
      const state = { ...base(), ...collections };
      expect(deserializeState(serializeState(state))).toEqual(state);
      expect(state.version).toBe(1);
    }
  });
  it('accepts company mode only with a known company and preserves every checklist flag', () => {
    const record = { ...simulation, mode: 'company', companyId: 'google', checklist: { ...simulation.checklist, clarify: true } };
    expect(validateState({ ...base(), simulations: { [simulation.id]: record } }).simulations?.[simulation.id]).toEqual(record);
  });
  it.each([
    { id: 'different' }, { id: '' }, { createdAt: -1 }, { createdAt: 3000 }, { endedAt: Infinity },
    { endedAt: 9e15 }, { durationMs: -1 }, { durationMs: 1001 }, { slug: ' ' }, { mode: 'other' },
    { mode: 'company' }, { mode: 'company', companyId: 'unknown' }, { companyId: 'amazon' },
    { outcome: 'solo' }, { checklist: {} }, { checklist: { ...simulation.checklist, test: 1 } },
    { targetMinutes: 30 }, { reflection: null }, { reflection: 'a'.repeat(1001) },
  ])('rejects invalid simulation fields %j', (change) => {
    expect(() => validateState({ ...base(), simulations: { [simulation.id]: { ...simulation, ...change } } })).toThrow();
  });
  it.each([
    { id: 'different' }, { createdAt: NaN }, { endedAt: 0 }, { includeUnworked: 'yes' },
    { score: 0 }, { score: 1.5 }, { total: 1 }, { answers: [] },
    { answers: Array.from({ length: 21 }, () => drill.answers[0]) },
    { answers: [drill.answers[0], drill.answers[0]], score: 2 },
    { answers: [{ slug: '', kind: 'outline', correct: true }], total: 1 },
    { answers: [{ slug: 'two-sum', kind: 'solution', correct: true }], total: 1 },
    { answers: [{ slug: 'two-sum', kind: 'outline', correct: 1 }], total: 1 },
  ])('rejects invalid drill records %j', (change) => {
    expect(() => validateState({ ...base(), drillSessions: { [drill.id]: { ...drill, ...change } } })).toThrow();
  });
  it('rejects non-object collections and empty record keys', () => {
    for (const field of ['simulations', 'drillSessions']) {
      for (const value of [null, [], 'bad', { '': simulation }]) {
        expect(() => validateState({ ...base(), [field]: value })).toThrow();
      }
    }
  });
});
