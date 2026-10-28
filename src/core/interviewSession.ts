/** Pure helpers for the two-problem interview session in Practice. Never touches activities or the program. */
import type { CompanyId } from '../data/companies';
import { drawSimulation } from './practice';
import { INTERVIEW_STEPS, type SimulationOutcome, type SimulationRecord } from './practiceTypes';
import type { Problem } from './types';

/** Per-problem reminder length of a two-problem session; the timer keeps running after it. */
export const SESSION_REMINDER_MINUTES = 45;
export const SESSION_BREAK_MINUTES = 5;

/** Two different problems from one pool, drawn up front but revealed one at a time. Needs at least two. */
export function drawSimulationPair(pool: readonly Problem[], companyId?: CompanyId, random = Math.random): [Problem, Problem] | undefined {
  const first = drawSimulation(pool, companyId, random);
  if (!first) return undefined;
  const second = drawSimulation(pool.filter((p) => p.slug !== first.slug), companyId, random);
  return second ? [first, second] : undefined;
}

export interface SessionSummary {
  totalMs: number;
  checklistDone: number;
  checklistTotal: number;
  outcomes: SimulationOutcome[];
}
export function summarizeSession(records: readonly Pick<SimulationRecord, 'durationMs' | 'checklist' | 'outcome'>[]): SessionSummary {
  return {
    totalMs: records.reduce((sum, r) => sum + r.durationMs, 0),
    checklistDone: records.reduce((sum, r) => sum + Object.values(r.checklist).filter(Boolean).length, 0),
    checklistTotal: records.length * Object.keys(INTERVIEW_STEPS).length,
    outcomes: records.map((r) => r.outcome),
  };
}

export type SimulationHistoryEntry =
  | { kind: 'single'; record: SimulationRecord; endedAt: number }
  | { kind: 'session'; sessionId: string; records: SimulationRecord[]; complete: boolean; endedAt: number };

/** Newest first; records sharing a `sessionId` form one entry ordered by part (an entry can be incomplete after a partial sync). */
export function groupSimulationHistory(records: readonly SimulationRecord[]): SimulationHistoryEntry[] {
  const sessions = new Map<string, SimulationRecord[]>();
  const entries: SimulationHistoryEntry[] = [];
  for (const record of records) {
    if (record.sessionId === undefined) { entries.push({ kind: 'single', record, endedAt: record.endedAt }); continue; }
    sessions.set(record.sessionId, [...(sessions.get(record.sessionId) ?? []), record]);
  }
  for (const [sessionId, group] of sessions) {
    const sorted = [...group].sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
    entries.push({ kind: 'session', sessionId, records: sorted, complete: sorted.some((r) => r.part === 1) && sorted.some((r) => r.part === 2),
      endedAt: Math.max(...sorted.map((r) => r.endedAt)) });
  }
  return entries.sort((a, b) => b.endedAt - a.endedAt);
}
