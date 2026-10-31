import type { ProblemActivityItem } from '../components/ProblemActivities';
import type { DayPlan } from '../core/planner';

/** The same priority is used for hints, Accepted auto-Finish and focus mode. */
export function panelMatches(plan: Pick<DayPlan, 'items' | 'bonuses' | 'carriedOver' | 'missedBenchmarks'>, slug: string): ProblemActivityItem[] {
  const matches: ProblemActivityItem[] = [];
  const seen = new Set<string>();
  for (const [items, variant] of [[plan.items, 'planned'], [plan.bonuses, 'bonus'], [plan.carriedOver, 'carried'], [plan.missedBenchmarks, 'carried']] as const) {
    for (const { activity } of items) {
      if (activity.slug !== slug || seen.has(activity.id)) continue;
      seen.add(activity.id);
      matches.push({ activity, variant });
    }
  }
  return matches;
}

export function selectedPanelActivity(matches: readonly ProblemActivityItem[]) {
  const activities = matches.map((match) => match.activity);
  return activities.find((a) => a.status === 'in_progress' && a.timer.running) ??
    activities.find((a) => a.status === 'in_progress') ?? activities.find((a) => a.status === 'planned');
}
