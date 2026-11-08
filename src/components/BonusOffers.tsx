import type { DayPlan, PlanItem } from '../core/planner';
import type { BudgetOverrides } from '../core/types';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { bonusTimeImpact } from '../lib/bonusTime';
import { OUTCOME_LABELS } from '../lib/instructions';
import type { Activity } from '../core/types';
import { ActivityCard } from './ActivityCard';
import { ProblemActivities } from './ProblemActivities';
import { Card } from './Card';

/**
 * The optional bonus offers of today (at most two), outside the core plan. A started offer keeps its timer
 * controls; a planned one says how much time it would add against the target and the cap, counting the core
 * plan plus bonus problems already finished or started today. Finished bonus
 * problems are only listed in one line: they live in Logs and Calendar, not in today's checklist.
 */
export function BonusOffers({
  plan,
  targetMinutes,
  now,
  actions,
  budgets,
  reviews = [],
  history = [],
}: {
  plan: DayPlan;
  targetMinutes: number;
  now: number;
  actions: AppActions;
  budgets: BudgetOverrides | undefined;
  /** Due reviews of finished bonus problems: still scheduled and counted in the plan time, listed here. */
  reviews?: readonly PlanItem[];
  history?: readonly Activity[];
}) {
  const { bonuses, completedBonuses, bonusHold } = plan;
  if (bonuses.length === 0 && completedBonuses.length === 0 && !bonusHold && reviews.length === 0) return null;
  const doneMinutes = completedBonuses.reduce((sum, item) => sum + item.minutes, 0);
  const startedMinutes = bonuses
    .filter((item) => item.activity.status !== 'planned')
    .reduce((sum, item) => sum + item.minutes, 0);
  const countedMinutes = plan.plannedMinutes + doneMinutes + startedMinutes;
  const impacts = bonuses.map((item) =>
    item.activity.status === 'planned'
      ? bonusTimeImpact({ countedMinutes, offerMinutes: item.minutes, targetMinutes, capMinutes: plan.capMinutes })
      : null,
  );
  // When every offer has the same time note, say it once above them instead of once per offer.
  const first = impacts[0];
  const sharedImpact = first && impacts.every((i) => i !== null && i.message === first.message && i.level === first.level) ? first : null;

  return (
    <Card title={`Optional bonus problems (${bonuses.length} offered)`} className="bonus-offers">
      <details className="explain">
        <summary>Optional extra work, never debt. How bonuses work</summary>
        <p>
          Optional: not included in today&apos;s core plan time, pace or reminders, and never debt. Finishing one
          comes back twice as a rebuild (about 2 and 6 days later) and that is all. Skip freely: another one takes its place.
        </p>
      </details>
      {bonuses.length > 0 ? (
        <div className="stack-tight">
          {sharedImpact ? (
            <p className={`bonus-impact bonus-impact-${sharedImpact.level}`}>
              <span aria-hidden="true">{sharedImpact.level === 'within-target' ? '○' : '⚠'}</span>{' '}
              {bonuses.length > 1 ? `Each: ${sharedImpact.message}` : sharedImpact.message}
            </p>
          ) : null}
          {bonuses.map((item, index) => {
            const impact = sharedImpact ? null : impacts[index];
            return (
              <div key={item.activity.id} className="bonus-offer">
                {impact ? (
                  <p className={`bonus-impact bonus-impact-${impact.level}`}>
                    <span aria-hidden="true">{impact.level === 'within-target' ? '○' : '⚠'}</span>{' '}
                    {impact.message}
                  </p>
                ) : null}
                <ActivityCard
                  activity={item.activity}
                  now={now}
                  actions={actions}
                  variant="bonus"
                  inOptionalSection
                  budgets={budgets}
                />
              </div>
            );
          })}
        </div>
      ) : null}
      {bonusHold ? <p className="muted bonus-hold">{bonusHold.message}</p> : null}
      {completedBonuses.length > 0 ? (
        <p className="muted bonus-done">
          Finished today ({completedBonuses.length}):{' '}
          {completedBonuses
            .map((item) => {
              const title = getProblem(item.activity.slug)?.title ?? item.activity.slug;
              return item.activity.outcome ? `${title} (${OUTCOME_LABELS[item.activity.outcome]})` : title;
            })
            .join(', ')}
          . They stay in Logs and the Calendar.
        </p>
      ) : null}
      {reviews.length > 0 ? (
        <div className="stack-tight bonus-reviews">
          <h3 className="small">Reviews of finished bonus problems ({reviews.length})</h3>
          <p className="muted small">Still part of today&apos;s planned time; kept here so the core list stays program-only.</p>
          <ProblemActivities items={reviews} history={history} now={now} actions={actions} budgets={budgets} unfinishedFirst />
        </div>
      ) : null}
    </Card>
  );
}
