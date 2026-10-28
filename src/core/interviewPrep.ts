/** Read-only view for the optional pre-interview prep. Never creates, moves or schedules any activity. */
import { COMPANIES, companyInterviewEnabled, companyInterviewSlugs, type CompanyId } from '../data/companies';
import { getProblem } from '../data/neetcode150';
import { isReviewType } from './activities';
import { addDays, diffDays } from './dates';
import { median } from './pace';
import { workedSlugs } from './practice';
import type { InterviewPrep } from './practiceTypes';
import { getProblemStatus } from './state';
import type { ActivityType, AppState, ProblemStatus } from './types';
import { weeklySummary } from './weekly';

export const PREP_MAX_DAYS_AHEAD = 365;
/** Selectable interview dates: today through 365 days ahead. */
export function prepDateRange(today: string): { min: string; max: string } {
  return { min: today, max: addDays(today, PREP_MAX_DAYS_AHEAD) };
}

export interface PrepProblem {
  slug: string;
  title: string;
  status: ProblemStatus;
  /** Started/completed work, a learned status or a solved check (the Practice "worked" rule). */
  worked: boolean;
  /** Median logged minutes over completed activities with logged time; absent without samples. */
  medianMinutes?: number;
  samples: number;
}
export interface PrepScheduledReview { id: string; slug: string; title: string; type: ActivityType; dueDate: string; overdue: boolean }
export interface PrepView {
  companyId: CompanyId;
  companyName: string;
  date: string;
  /** Whole days from today to the interview; negative once it has passed. */
  daysLeft: number;
  passed: boolean;
  /** False when the documented data no longer reaches the five-problem threshold (shown, never hidden). */
  companyEnabled: boolean;
  problems: PrepProblem[];
  untouched: PrepProblem[];
  /** Longest median logged time first (not adjusted for difficulty), at most three. */
  slowest: PrepProblem[];
  fragile: { slug: string; title: string; reason: string }[];
  /** Planned or in-progress scheduled reviews already due before the interview date (empty for a passed date). */
  scheduledBefore: PrepScheduledReview[];
}

export function interviewPrepView(state: AppState, prep: InterviewPrep, today: string): PrepView {
  const slugs = new Set(companyInterviewSlugs(prep.companyId));
  const worked = workedSlugs(state);
  const titleOf = (slug: string): string => getProblem(slug)?.title ?? slug;
  const problems = [...slugs]
    .filter((slug) => getProblem(slug))
    .sort((a, b) => getProblem(a)!.neetcodeOrder - getProblem(b)!.neetcodeOrder)
    .map((slug): PrepProblem => {
      const minutes = state.activities
        .filter((a) => a.slug === slug && a.status === 'done' && (a.totalMs ?? 0) > 0)
        .map((a) => a.totalMs! / 60_000);
      const mid = median(minutes);
      return { slug, title: titleOf(slug), status: getProblemStatus(state, slug), worked: worked.has(slug), samples: minutes.length,
        ...(mid !== undefined ? { medianMinutes: mid } : {}) };
    });
  const daysLeft = diffDays(today, prep.date);
  const passed = daysLeft < 0;
  return {
    companyId: prep.companyId,
    companyName: COMPANIES.find((c) => c.id === prep.companyId)!.name,
    date: prep.date,
    daysLeft,
    passed,
    companyEnabled: companyInterviewEnabled(prep.companyId),
    problems,
    untouched: problems.filter((p) => !p.worked),
    slowest: problems
      .filter((p) => p.medianMinutes !== undefined)
      .sort((a, b) => b.medianMinutes! - a.medianMinutes! || a.slug.localeCompare(b.slug))
      .slice(0, 3),
    fragile: weeklySummary(state, today).fragile
      .filter((f) => slugs.has(f.slug))
      .map((f) => ({ slug: f.slug, title: titleOf(f.slug), reason: f.reason })),
    scheduledBefore: passed ? [] : state.activities
      .filter((a) => (a.status === 'planned' || a.status === 'in_progress') && isReviewType(a.type) && slugs.has(a.slug) && a.dueDate < prep.date)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.slug.localeCompare(b.slug))
      .map((a) => ({ id: a.id, slug: a.slug, title: titleOf(a.slug), type: a.type, dueDate: a.dueDate, overdue: a.dueDate < today })),
  };
}
