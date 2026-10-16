/** Helpers shared by the unit tests (not part of the extension bundle). */
import { addDays } from './dates';
import { materializePlan, planDay, type DayPlan } from './planner';
import { applyOutcome } from './reviews';
import { defaultState } from './state';
import type { Activity, ActivityType, AppState, Outcome } from './types';

export const START = '2025-01-06';

/** Calendar date of program day `n` (day 1 = START). */
export function day(n: number): string {
  return addDays(START, n - 1);
}

export function newState(): AppState {
  return defaultState(START);
}

export function activitiesOf(state: AppState, slug: string, type?: ActivityType): Activity[] {
  return state.activities.filter((a) => a.slug === slug && (type === undefined || a.type === type));
}

export function plannedOf(state: AppState, slug: string, type: ActivityType): Activity[] {
  return activitiesOf(state, slug, type).filter((a) => a.status === 'planned');
}

/** Completes an activity on `date`, logging its budgeted minutes unless `minutes` is given. */
export function complete(
  state: AppState,
  id: string,
  outcome: Outcome,
  date: string,
  minutes = 20,
): AppState {
  return applyOutcome(state, id, {
    outcome,
    completedDate: date,
    now: 0,
    totalMs: minutes * 60_000,
  });
}

/** Plans and persists a day, then completes the activity of `slug`/`type` on that day. */
export function planAndComplete(
  state: AppState,
  date: string,
  slug: string,
  type: ActivityType,
  outcome: Outcome,
  minutes = 20,
): AppState {
  const plan = planDay(state, date);
  const next = materializePlan(state, plan);
  const target = [...plan.items, ...(plan.bonus ? [plan.bonus] : [])].find(
    (i) => i.activity.slug === slug && i.activity.type === type,
  );
  if (!target) throw new Error(`No ${type} for ${slug} in the plan of ${date}`);
  return complete(next, target.activity.id, outcome, date, minutes);
}

export interface SimulatedDay {
  plan: DayPlan;
  state: AppState;
}

/** Plans, persists and completes every planned item of `date` (optionally the bonus too). */
export function simulateDay(
  state: AppState,
  date: string,
  options: { outcome?: Outcome; bonus?: boolean; minutes?: number } = {},
): SimulatedDay {
  const plan = planDay(state, date);
  let next = materializePlan(state, plan);
  const items = [...plan.items, ...(options.bonus && plan.bonus ? [plan.bonus] : [])];
  for (const item of items) {
    if (item.activity.status === 'done') continue;
    next = complete(next, item.activity.id, options.outcome ?? 'solo', date, options.minutes ?? item.minutes);
  }
  return { plan, state: next };
}
