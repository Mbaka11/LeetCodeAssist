/**
 * What the 60-day plan will have covered by its last day, per catalog, difficulty and category (Roadmap).
 * "Planned" = problems already worked plus the problems the planner would start from today to day 60 if every
 * day is done as planned (the same forward run as the Calendar forecast: solo, on budget, no bonus).
 */
import { catalogProblems, type CatalogId } from './catalog';
import { addDays, compareDates } from './dates';
import { materializePlan, planDay } from './planner';
import { applyOutcome } from './reviews';
import { getProblemStatus } from './state';
import type { AppState, Difficulty } from './types';
import { PROGRAM_LENGTH_DAYS } from '../data/program';

export interface PlanCounts {
  total: number;
  /** Worked already: status is not `untouched`, or ticked by hand (same rule as the Roadmap counters). */
  worked: number;
  /** Worked already, or first started by the plan before the end of day 60. Always >= worked. */
  planned: number;
}

export interface RoadmapPlan {
  /** Last date of the program (day 60). */
  endDate: string;
  /** Problems not worked yet that the plan starts by `endDate`, with the date it would start them. */
  upcoming: ReadonlyMap<string, string>;
  overall: PlanCounts;
  byDifficulty: Record<Difficulty, PlanCounts>;
  byCategory: ReadonlyMap<string, PlanCounts>;
}

/**
 * First date each not-yet-worked problem appears in a plan from `today` through `endDate` (inclusive), when
 * every planned item is done solo on budget. Pure.
 */
export function upcomingFirstDates(state: AppState, today: string, endDate: string): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Set(state.activities.map((a) => a.slug));
  let projected = state;
  for (let d = today; compareDates(d, endDate) <= 0; d = addDays(d, 1)) {
    const plan = planDay(projected, d);
    for (const item of plan.items) {
      const slug = item.activity.slug;
      if (!seen.has(slug)) {
        seen.add(slug);
        out.set(slug, d);
      }
    }
    if (d === endDate) break;
    projected = materializePlan(projected, { ...plan, bonuses: [] });
    for (const item of plan.items) {
      if (item.activity.status === 'done') continue;
      projected = applyOutcome(projected, item.activity.id, { outcome: 'solo', completedDate: d, now: 0, totalMs: item.minutes * 60_000 });
    }
  }
  return out;
}

const empty = (): PlanCounts => ({ total: 0, worked: 0, planned: 0 });

export function programEndDate(state: Pick<AppState, 'settings'>): string {
  return addDays(state.settings.startDate, PROGRAM_LENGTH_DAYS - 1);
}

/** Counts for one catalog. Pass `upcoming` to reuse one forward run for both catalogs. */
export function roadmapPlan(
  state: AppState,
  catalog: CatalogId,
  today: string,
  upcoming: ReadonlyMap<string, string> = upcomingFirstDates(state, today, programEndDate(state)),
): RoadmapPlan {
  const overall = empty();
  const byDifficulty: Record<Difficulty, PlanCounts> = { Easy: empty(), Medium: empty(), Hard: empty() };
  const byCategory = new Map<string, PlanCounts>();
  for (const problem of catalogProblems(catalog)) {
    if (!byCategory.has(problem.category)) byCategory.set(problem.category, empty());
    const worked = getProblemStatus(state, problem.slug) !== 'untouched' || state.checked[problem.slug] === true;
    const planned = worked || upcoming.has(problem.slug);
    for (const bucket of [overall, byDifficulty[problem.difficulty], byCategory.get(problem.category)!]) {
      bucket.total += 1;
      if (worked) bucket.worked += 1;
      if (planned) bucket.planned += 1;
    }
  }
  return { endDate: programEndDate(state), upcoming, overall, byDifficulty, byCategory };
}
