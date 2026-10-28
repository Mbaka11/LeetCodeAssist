import { describe, expect, it } from 'vitest';
import { drawSimulationPair, groupSimulationHistory, summarizeSession } from './interviewSession';
import { emptyChecklist } from './practice';
import type { SimulationRecord } from './practiceTypes';
import { defaultState, deserializeState, serializeState, validateState } from './state';
import { NEETCODE_150 } from '../data/neetcode150';

const checklist = (done: number) => Object.fromEntries(Object.keys(emptyChecklist()).map((key, i) => [key, i < done])) as SimulationRecord['checklist'];
const record = (id: string, change: Partial<SimulationRecord> = {}): SimulationRecord => ({ id, createdAt: 1000, endedAt: 4000, durationMs: 3000, slug: 'two-sum', mode: 'global', outcome: 'solved', checklist: checklist(3), targetMinutes: 45, reflection: '', ...change });
const part1 = record('p1', { sessionId: 's1', part: 1 });
const part2 = record('p2', { sessionId: 's1', part: 2, createdAt: 5000, endedAt: 9000, durationMs: 4000, slug: 'valid-anagram', outcome: 'partial', checklist: checklist(5), sessionReflection: 'Slow start.' });
const base = () => defaultState('2025-01-01');

describe('drawSimulationPair', () => {
  const pool = NEETCODE_150.slice(0, 5);
  it('returns two different problems from the pool, whatever the random values', () => {
    for (const value of [0, 0.3, 0.99]) {
      const pair = drawSimulationPair(pool, undefined, () => value)!;
      expect(pair[0].slug).not.toBe(pair[1].slug);
      expect(pool).toContain(pair[0]);
      expect(pool).toContain(pair[1]);
    }
  });
  it('needs at least two problems', () => {
    expect(drawSimulationPair([], undefined)).toBeUndefined();
    expect(drawSimulationPair(pool.slice(0, 1), undefined)).toBeUndefined();
    expect(drawSimulationPair(pool.slice(0, 2), undefined, () => 0.9)!.map((p) => p.slug).sort()).toEqual(pool.slice(0, 2).map((p) => p.slug).sort());
  });
});

describe('summarizeSession', () => {
  it('adds total time and checklist completion of both problems and keeps both outcomes', () => {
    expect(summarizeSession([part1, part2])).toEqual({ totalMs: 7000, checklistDone: 8, checklistTotal: 16, outcomes: ['solved', 'partial'] });
  });
});

describe('groupSimulationHistory', () => {
  it('lists singles and linked sessions newest first, ordering parts and flagging a missing partner', () => {
    const single = record('single', { endedAt: 9500, createdAt: 9000, durationMs: 500 });
    const [first, session, orphan] = groupSimulationHistory([part2, single, part1, record('o', { sessionId: 's2', part: 2, endedAt: 100, createdAt: 50, durationMs: 50 })]);
    expect(first).toMatchObject({ kind: 'single', record: { id: 'single' } });
    expect(session).toMatchObject({ kind: 'session', sessionId: 's1', complete: true });
    expect(session!.kind === 'session' && session!.records.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(orphan).toMatchObject({ kind: 'session', sessionId: 's2', complete: false });
  });
});

describe('session fields on simulation records (state validation)', () => {
  it('keeps legacy records without session fields byte-for-byte equal and round-trips linked records', () => {
    const legacy = { ...base(), simulations: { single: record('single') } };
    const parsed = deserializeState(serializeState(legacy));
    expect(parsed).toEqual(legacy);
    expect('sessionId' in parsed.simulations!.single!).toBe(false);
    const linked = { ...base(), simulations: { p1: part1, p2: part2 } };
    expect(deserializeState(serializeState(linked))).toEqual(linked);
    expect(linked.version).toBe(1);
  });
  it.each([
    ['part without session id', { part: 1 }],
    ['session id without part', { sessionId: 's' }],
    ['part 3', { sessionId: 's', part: 3 }],
    ['string part', { sessionId: 's', part: '1' }],
    ['empty session id', { sessionId: ' ', part: 1 }],
    ['over-long session id', { sessionId: 'x'.repeat(101), part: 1 }],
    ['session reflection on part 1', { sessionId: 's', part: 1, sessionReflection: 'x' }],
    ['session reflection without a session', { sessionReflection: 'x' }],
    ['over-long session reflection', { sessionId: 's', part: 2, sessionReflection: 'x'.repeat(1001) }],
    ['non-string session reflection', { sessionId: 's', part: 2, sessionReflection: 4 }],
  ])('rejects %s', (_label, change) => {
    expect(() => validateState({ ...base(), simulations: { x: record('x', change as Partial<SimulationRecord>) } })).toThrow();
  });
  it('accepts the 45 minute session target with company mode', () => {
    const company = record('c', { mode: 'company', companyId: 'google', sessionId: 's', part: 2, sessionReflection: '' });
    expect(validateState({ ...base(), simulations: { c: company } }).simulations!.c).toEqual(company);
  });
});
