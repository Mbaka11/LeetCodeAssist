import type { CompanyId } from '../data/companies';

export const INTERVIEW_STEPS = {
  clarify: 'Clarify requirements',
  examples: 'Examples / edge cases',
  bruteForce: 'Brute force',
  optimize: 'Optimize',
  complexity: 'Complexity',
  code: 'Code',
  test: 'Test / dry-run',
  communicate: 'Communicate',
} as const;
export type InterviewStep = keyof typeof INTERVIEW_STEPS;
export type InterviewChecklist = Record<InterviewStep, boolean>;
export type SimulationOutcome = 'solved' | 'partial' | 'not';

/** Completed voluntary practice only; never an Activity or a scheduling input. */
export interface SimulationRecord {
  id: string;
  createdAt: number;
  endedAt: number;
  slug: string;
  mode: 'global' | 'company';
  companyId?: CompanyId;
  outcome: SimulationOutcome;
  checklist: InterviewChecklist;
  durationMs: number;
  targetMinutes: 25 | 35 | 45;
  reflection: string;
}
export type DrillKind = 'technique' | 'structure' | 'outline';
export interface DrillAnswer {
  slug: string;
  kind: DrillKind;
  correct: boolean;
}
export interface DrillSessionRecord {
  id: string;
  createdAt: number;
  endedAt: number;
  includeUnworked: boolean;
  answers: DrillAnswer[];
  score: number;
  total: number;
}
