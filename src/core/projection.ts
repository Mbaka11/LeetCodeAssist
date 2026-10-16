/** Projection of a future day with the pure planner, assuming nothing else changes. */
import { compareDates, diffDays, addDays } from './dates';
import { materializePlan, planDay } from './planner';
import { applyOutcome } from './reviews';
import type { ActivityType, AppState } from './types';

export interface ProjectedItem {
  type: ActivityType;
  slug: string;
  /** Budgeted minutes. */
  minutes: number;
}

export interface DayProjection {
  date: string;
  items: ProjectedItem[];
  /** Budgeted minutes of `items`. */
  totalMinutes: number;
  /** Reviews that would not fit under the cap that day and move on. */
  carriedOverCount: number;
}

/**
 * What `date` would hold if you did exactly what each day from `today` on plans, solving everything
 * alone and on budget. Reviews follow from those completions (recall D+1, rebuild D+3, ...), and
 * the queue advances. Pure: `state` is not changed. For `today` or an earlier date this is simply the
 * plan of that day.
 */
export function projectDay(state: AppState, date: string, today: string): DayProjection {
  let projected = state;
  if (compareDates(date, today) > 0) {
    const days = diffDays(today, date);
    for (let offset = 0; offset < days; offset += 1) {
      const d = addDays(today, offset);
      const plan = planDay(projected, d);
      projected = materializePlan(projected, plan);
      for (const item of plan.items) {
        if (item.activity.status === 'done') continue;
        projected = applyOutcome(projected, item.activity.id, {
          outcome: 'solo',
          completedDate: d,
          now: 0,
          totalMs: item.minutes * 60_000,
        });
      }
    }
  }
  const plan = planDay(projected, date);
  return {
    date,
    items: plan.items.map((i) => ({ type: i.activity.type, slug: i.activity.slug, minutes: i.minutes })),
    totalMinutes: plan.plannedMinutes,
    carriedOverCount: plan.carriedOver.length,
  };
}
