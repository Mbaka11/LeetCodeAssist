import { isReviewType } from './activities';
import { addDays, isValidDateString } from './dates';
import type { Activity, AppState } from './types';
import { getProblem } from '../data/neetcode150';

export interface WeeklyCategory {
  category: string;
  attempts: number;
  rated: number;
  helped: number;
  firstWorked: number;
  independentReviewProblems: number;
  previousIndependentReviewProblems: number;
}
export interface WeeklyPeriod {
  from: string; to: string; attempts: number; distinct: number; totalMs: number; firstWorked: number;
}
export interface FragileProblem { slug: string; evidence: Activity; reason: string }
export interface WeeklySummary {
  current: WeeklyPeriod;
  previous: WeeklyPeriod;
  categories: WeeklyCategory[];
  fragile: FragileProblem[];
}
const knownOutcome = (a: Activity): boolean => a.outcome !== undefined;
export const usedHelp = (a: Activity): boolean => (a.hintsUsed ?? 0) > 0 || a.outcome === 'hint' || a.outcome === 'solution';
const independentReview = (a: Activity): boolean => isReviewType(a.type) && !a.extra && a.outcome === 'solo' && !usedHelp(a);
const inPeriod = (a: Activity, from: string, to: string): boolean => a.completedAt! >= from && a.completedAt! <= to;
const categoryOf = (slug: string): string => getProblem(slug)?.category ?? 'Other / uncatalogued';

/** Informational only: uses dated completion evidence, never plans or modifies an activity. */
export function weeklySummary(state: AppState, end: string): WeeklySummary {
  if (!isValidDateString(end)) throw new Error('Choose a valid period end date.');
  const start = addDays(end, -6);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(start, -7);
  const done = state.activities.filter((a) => a.status === 'done' && a.completedAt && a.completedAt <= end)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
  const first = new Map<string, string>();
  for (const a of done) if (!first.has(a.slug)) first.set(a.slug, a.completedAt!);
  const current = done.filter((a) => inPeriod(a, start, end));
  const previous = done.filter((a) => inPeriod(a, previousStart, previousEnd));
  const period = (items: Activity[], from: string, to: string): WeeklyPeriod => ({
    from, to, attempts: items.length, distinct: new Set(items.map((a) => a.slug)).size,
    totalMs: items.reduce((sum, a) => sum + (a.totalMs ?? 0), 0),
    firstWorked: [...first.values()].filter((date) => date >= from && date <= to).length,
  });
  const categories = [...new Set([...current, ...previous].map((a) => categoryOf(a.slug)))].sort().map((category) => {
    const items = current.filter((a) => categoryOf(a.slug) === category);
    const before = previous.filter((a) => categoryOf(a.slug) === category);
    return { category, attempts: items.length,
      rated: items.filter((a) => knownOutcome(a) || usedHelp(a)).length,
      helped: items.filter(usedHelp).length,
      firstWorked: [...first].filter(([slug, date]) => categoryOf(slug) === category && date >= start && date <= end).length,
      independentReviewProblems: new Set(items.filter(independentReview).map((a) => a.slug)).size,
      previousIndependentReviewProblems: new Set(before.filter(independentReview).map((a) => a.slug)).size,
    };
  });
  const byProblem = new Map<string, Activity[]>();
  for (const a of done) { const list = byProblem.get(a.slug) ?? []; list.push(a); byProblem.set(a.slug, list); }
  const fragile: FragileProblem[] = [];
  for (const [slug, attempts] of byProblem) {
    const scheduledReviews = attempts.filter((a) => isReviewType(a.type) && !a.extra && (knownOutcome(a) || usedHelp(a)));
    // An immediate optional repeat cannot erase the evidence of the latest scheduled test.
    const evidence = scheduledReviews.at(-1) ?? attempts.filter((a) => !isReviewType(a.type) && (knownOutcome(a) || usedHelp(a))).at(-1)
      ?? attempts.filter((a) => knownOutcome(a) || usedHelp(a)).at(-1);
    if (!evidence) continue;
    if (evidence.outcome !== 'stuck' && !usedHelp(evidence)) continue;
    const reason = evidence.outcome === 'stuck' ? 'Latest eligible attempt was Stuck'
      : scheduledReviews.length > 0 ? 'Latest scheduled review needed help' : 'Help used; no independent scheduled review recorded yet';
    fragile.push({ slug, evidence, reason });
  }
  fragile.sort((a, b) => b.evidence.completedAt!.localeCompare(a.evidence.completedAt!) || a.slug.localeCompare(b.slug));
  return { current: period(current, start, end), previous: period(previous, previousStart, previousEnd), categories, fragile };
}
