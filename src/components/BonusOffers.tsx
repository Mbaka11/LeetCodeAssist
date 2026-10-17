import type { DayPlan } from '../core/planner';
import type { BudgetOverrides } from '../core/types';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { bonusTimeImpact } from '../lib/bonusTime';
import { OUTCOME_LABELS } from '../lib/instructions';
import { ActivityCard } from './ActivityCard';
import { Card } from './Card';

/**
 * The optional bonus offers of today (at most two), outside the core plan. A started offer keeps its timer
 * controls; a planned one says how much time it would add against the target and the cap. Finished bonus
 * problems are only listed in one line: they live in Logs and Calendar, not in today's checklist.
 */
export function BonusOffers({
  plan,
  targetMinutes,
  now,
  actions,
  budgets,
}: {
  plan: DayPlan;
  targetMinutes: number;
  now: number;
  actions: AppActions;
  budgets: BudgetOverrides | undefined;
}) {
  const { bonuses, completedBonuses, bonusHold } = plan;
  if (bonuses.length === 0 && completedBonuses.length === 0 && !bonusHold) return null;
  const doneMinutes = completedBonuses.reduce((sum, item) => sum + item.minutes, 0);
  const countedMinutes = plan.plannedMinutes + doneMinutes;

  return (
    <Card title={`Optional bonus problems (${bonuses.length} offered)`} className="bonus-offers">
      <p className="muted">
        Optional: not included in today&apos;s core plan time, pace or reminders, and never debt. Finishing one
        adds its own later reviews (day +1, +3, +7, +21). Skip freely: another one takes its place.
      </p>
      {bonuses.length > 0 ? (
        <div className="stack-tight">
          {bonuses.map((item) => {
            const impact =
              item.activity.status === 'planned'
                ? bonusTimeImpact({
                    countedMinutes,
                    offerMinutes: item.minutes,
                    targetMinutes,
                    capMinutes: plan.capMinutes,
                  })
                : null;
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
    </Card>
  );
}
