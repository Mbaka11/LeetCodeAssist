import { useEffect, useMemo, useState } from 'react';
import { ProblemActivities } from '../components/ProblemActivities';
import { Badge } from '../components/Badge';
import { BonusOffers } from '../components/BonusOffers';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import { WorkedTotal } from '../components/WorkedTotal';
import { isReviewType } from '../core/activities';
import { diffDays, trainingDateFromTimestamp, trainingDayStart } from '../core/dates';
import { planDay, type PlanItem } from '../core/planner';
import { needsBenchmarkBackfill, needsBonusSimplify } from '../core/reviews';
import { computeStreak, dailyTargetMinutes } from '../core/state';
import { elapsedMs } from '../core/timer';
import type { AppState } from '../core/types';
import { workedTotals } from '../core/worked';
import { isBonusProblem } from '../data/bonus';
import { getProblem } from '../data/neetcode150';
import { PROGRAM_LENGTH_DAYS } from '../data/program';
import type { AppActions } from '../lib/actions';
import { formatDate, formatMinutes } from '../lib/format';
import { ACTIVITY_LABELS } from '../lib/instructions';
import { useNow } from '../lib/useNow';

function isOpen(item: PlanItem): boolean {
  return item.activity.status === 'planned' || item.activity.status === 'in_progress';
}

function titleOf(item: PlanItem): string {
  const title = getProblem(item.activity.slug)?.title ?? item.activity.slug;
  return `${ACTIVITY_LABELS[item.activity.type]} · ${title}`;
}

export function TodayView({ state, actions }: { state: AppState; actions: AppActions }) {
  const anyRunning = state.activities.some((a) => a.timer.running);
  // Re-render every second only while a timer runs; the displayed time is derived from timestamps.
  const now = useNow(anyRunning ? 1000 : 30_000);
  const today = trainingDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);
  const worked = useMemo(() => workedTotals(state), [state]);
  const [actionError, setActionError] = useState<string | null>(null);

  const report = (task: Promise<void>): void => {
    setActionError(null);
    task.catch((e: unknown) => setActionError(e instanceof Error ? e.message : String(e)));
  };

  const needsMaterializing =
    plan.items.some((i) => !i.persisted) ||
    plan.bonuses.some((offer) => !offer.persisted) ||
    plan.missedBenchmarks.some((item) => !item.persisted) ||
    needsBenchmarkBackfill(state) ||
    needsBonusSimplify(state);
  useEffect(() => {
    if (needsMaterializing) actions.materializeToday().catch(console.error);
  }, [needsMaterializing, actions, state, today]);

  if (plan.dayIndex < 1) {
    const daysLeft = diffDays(today, state.settings.startDate);
    return (
      <Card title="No plan yet">
        <p>
          Your program starts on <strong>{formatDate(state.settings.startDate)}</strong> (
          {daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}). There is nothing to do before then.
        </p>
        <div className="row">
          <Button variant="primary" onClick={() => report(actions.updateSettings({ startDate: today }))}>
            Start today instead
          </Button>
          <a href="#/settings">Change the start date in Settings</a>
        </div>
        {actionError ? <p className="error">{actionError}</p> : null}
      </Card>
    );
  }

  const target = dailyTargetMinutes(state.settings, today);
  const doneMs = state.activities
    .filter((a) => a.status === 'done' && a.completedAt === today)
    .reduce((sum, a) => sum + (a.totalMs ?? 0), 0);
  const runningMs = state.activities
    .filter((a) => a.status === 'in_progress')
    .reduce((sum, a) => sum + Math.min(elapsedMs(a.timer, now), now - trainingDayStart(now)), 0);
  const loggedMin = (doneMs + runningMs) / 60_000;
  const streak = computeStreak(state, today);

  // A running optional bonus also counts: its timer must stay visible even though it is not a core item.
  const runningItem = [...plan.items, ...plan.bonuses].find((i) => i.activity.timer.running);
  // Reviews of bonus-pool problems stay scheduled (and counted in the planned time) but are listed with the
  // bonus section, so the core checklist only holds program work.
  const isBonusReview = (i: PlanItem): boolean => isReviewType(i.activity.type) && isBonusProblem(i.activity.slug);
  const coreItems = plan.items.filter((i) => !isBonusReview(i));
  const bonusReviews = plan.items.filter(isBonusReview);
  const nextItem =
    coreItems.find((i) => i.activity.status === 'in_progress') ??
    coreItems.find((i) => i.activity.status === 'planned') ??
    bonusReviews.find((i) => i.activity.status === 'in_progress') ??
    bonusReviews.find((i) => i.activity.status === 'planned');
  const remaining = coreItems.filter(isOpen).length;
  const paceTone = plan.pace.delta > 0 ? 'good' : plan.pace.delta < 0 ? 'warn' : undefined;
  const dayTitle =
    plan.dayIndex <= PROGRAM_LENGTH_DAYS
      ? `Day ${plan.dayIndex} of ${PROGRAM_LENGTH_DAYS}`
      : `Day ${plan.dayIndex} (after the 60-day program)`;

  const startNext = (item: PlanItem): void => {
    const id = item.activity.id;
    report(item.activity.status === 'in_progress' ? actions.resume(id) : actions.startActivity(id));
  };

  // A problem stays in the open list while any of its activities is open, so its attempts stay on one card.
  const openSlugs = new Set(coreItems.filter(isOpen).map((item) => item.activity.slug));
  const openItems = coreItems.filter((item) => openSlugs.has(item.activity.slug));
  const finishedItems = coreItems.filter((item) => !openSlugs.has(item.activity.slug));
  const budgets = state.settings.budgets;

  return (
    <div className="today-layout">
      <header className="day-header today-header">
        <h1>{dayTitle}</h1>
        <span className="muted" title="Training day changes at 04:00. Results are dated automatically when you save.">{formatDate(today)}</span>
        {plan.isConsolidationDay ? <Badge tone="resolve">Consolidation day</Badge> : null}
        {plan.isBenchmarkDay ? <Badge tone="benchmark">Benchmark day</Badge> : null}
      </header>

      <aside className="today-aside stack">
        <Card className="today-stats">
          <div className="stats stats-compact">
            <Stat
              label="Logged"
              value={formatMinutes(loggedMin)}
              hint={loggedMin >= target ? 'daily goal met' : `${formatMinutes(target - loggedMin)} to the goal`}
              {...(loggedMin >= target ? { tone: 'good' as const } : {})}
            />
            <Stat
              label="Planned"
              value={formatMinutes(plan.plannedMinutes)}
              title={`Target ${formatMinutes(target)} · cap ${formatMinutes(plan.capMinutes)}`}
            />
            <Stat
              label="Pace"
              value={plan.pace.label}
              hint={`${plan.pace.actual}/${plan.pace.due} new problems`}
              title={`${plan.pace.actual} program problems done; ${plan.pace.due} were due by the end of yesterday and ${plan.pace.expected - plan.pace.due} more are due today. Bonus problems do not count.`}
              {...(paceTone ? { tone: paceTone } : {})}
            />
            <Stat
              label="Streak"
              value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`}
              title={`Longest ${streak.longest} days. A day counts with 1+ activity done and 30+ min logged.`}
            />
          </div>
          <ProgressBar value={loggedMin} max={target} done={loggedMin >= target} />
          <WorkedTotal totals={worked} />
        </Card>
      </aside>

      <div className="today-main stack">
        <Card
          title={`Today's activities (${coreItems.length - remaining}/${coreItems.length} done)`}
          actions={
            runningItem ? (
              <span className="muted">
                Timer running: {plan.bonuses.includes(runningItem) ? 'Optional bonus · ' : ''}
                {titleOf(runningItem)}
              </span>
            ) : nextItem ? (
              <Button variant="primary" onClick={() => startNext(nextItem)} title={`Next: ${titleOf(nextItem)}`}>
                Start next activity
              </Button>
            ) : null
          }
        >
          {actionError ? <p className="error">{actionError}</p> : null}
          {coreItems.length === 0 ? (
            <p className="muted">Nothing is scheduled today.</p>
          ) : (
            <div className="stack-tight">
              {openItems.length > 0 ? (
                <ProblemActivities items={openItems} history={state.activities} now={now} unfinishedFirst
                  actions={actions} budgets={budgets} />
              ) : (
                <p className="tone-good">All planned activities are done.</p>
              )}
              {finishedItems.length > 0 ? (
                <details className="done-section" open={openItems.length === 0}>
                  <summary>
                    Finished today ({finishedItems.length})
                  </summary>
                  <ProblemActivities items={finishedItems} history={state.activities} now={now}
                    actions={actions} budgets={budgets} />
                </details>
              ) : null}
            </div>
          )}
        </Card>

        <BonusOffers
          plan={plan}
          targetMinutes={target}
          now={now}
          actions={actions}
          budgets={budgets}
          reviews={bonusReviews}
          history={state.activities}
        />

        {plan.missedBenchmarks.length > 0 ? (
          <Card title={`Missed benchmarks (${plan.missedBenchmarks.length})`}>
            <p className="muted">These benchmarks are still available outside today&apos;s core plan. Finishing one credits the current training day, not its original date.</p>
            <ProblemActivities items={plan.missedBenchmarks.map((item) => ({ ...item, variant: 'carried' as const }))}
              history={state.activities} now={now} actions={actions} budgets={budgets} unfinishedFirst />
          </Card>
        ) : null}

        {plan.carriedOver.length > 0 ? (
          <Card title={`Carried over (${plan.carriedOver.length})`}>
            <p className="muted">
              Reviews that did not fit under today&apos;s cap. They are planned again tomorrow; start one
              now if you have spare time.
            </p>
            <div className="stack-tight">
              <ProblemActivities items={plan.carriedOver.map((item) => ({ ...item, variant: 'carried' as const }))}
                history={state.activities} now={now} actions={actions} budgets={budgets} unfinishedFirst />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
