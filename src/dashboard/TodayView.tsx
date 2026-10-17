import { useEffect, useMemo, useState } from 'react';
import { ActivityCard } from '../components/ActivityCard';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import { diffDays, localDateFromTimestamp } from '../core/dates';
import { planDay, type PlanItem } from '../core/planner';
import { needsBenchmarkBackfill } from '../core/reviews';
import { computeStreak, dailyTargetMinutes } from '../core/state';
import { elapsedMs } from '../core/timer';
import type { AppState } from '../core/types';
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
  const today = localDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);
  const [actionError, setActionError] = useState<string | null>(null);

  const report = (task: Promise<void>): void => {
    setActionError(null);
    task.catch((e: unknown) => setActionError(e instanceof Error ? e.message : String(e)));
  };

  const needsMaterializing =
    plan.items.some((i) => !i.persisted) ||
    (plan.bonus !== null && !plan.bonus.persisted) ||
    needsBenchmarkBackfill(state);
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
    .reduce((sum, a) => sum + elapsedMs(a.timer, now), 0);
  const loggedMin = (doneMs + runningMs) / 60_000;
  const streak = computeStreak(state, today);

  const runningItem = plan.items.find((i) => i.activity.timer.running);
  const nextItem =
    plan.items.find((i) => i.activity.status === 'in_progress') ??
    plan.items.find((i) => i.activity.status === 'planned');
  const remaining = plan.items.filter(isOpen).length;
  const paceTone = plan.pace.delta > 0 ? 'good' : plan.pace.delta < 0 ? 'warn' : undefined;
  const dayTitle =
    plan.dayIndex <= PROGRAM_LENGTH_DAYS
      ? `Day ${plan.dayIndex} of ${PROGRAM_LENGTH_DAYS}`
      : `Day ${plan.dayIndex} (after the 30-day program)`;

  const startNext = (item: PlanItem): void => {
    const id = item.activity.id;
    report(item.activity.status === 'in_progress' ? actions.resume(id) : actions.startActivity(id));
  };

  return (
    <div className="stack">
      <div className="day-header">
        <h1>{dayTitle}</h1>
        <span className="muted">{formatDate(today)}</span>
        {plan.isConsolidationDay ? <Badge tone="resolve">Consolidation day</Badge> : null}
        {plan.isBenchmarkDay ? <Badge tone="benchmark">Benchmark day</Badge> : null}
      </div>

      <Card>
        <div className="stats">
          <Stat
            label="Planned"
            value={formatMinutes(plan.plannedMinutes)}
            hint={`target ${formatMinutes(target)} · cap ${formatMinutes(plan.capMinutes)}`}
          />
          <Stat
            label="Logged"
            value={formatMinutes(loggedMin)}
            hint={loggedMin >= target ? 'daily goal met' : `${formatMinutes(target - loggedMin)} to the goal`}
            {...(loggedMin >= target ? { tone: 'good' as const } : {})}
          />
          <Stat
            label="Pace"
            value={plan.pace.label}
            hint={`${plan.pace.actual} new done · ${plan.pace.expected} expected`}
            {...(paceTone ? { tone: paceTone } : {})}
          />
          <Stat
            label="Streak"
            value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`}
            hint={`longest ${streak.longest} · needs 30 min logged`}
          />
        </div>
        <ProgressBar value={loggedMin} max={target} done={loggedMin >= target} />
      </Card>

      <Card
        title={`Today's activities (${plan.items.length - remaining}/${plan.items.length} done)`}
        actions={
          runningItem ? (
            <span className="muted">Timer running: {titleOf(runningItem)}</span>
          ) : nextItem ? (
            <Button variant="primary" onClick={() => startNext(nextItem)}>
              Start next activity
            </Button>
          ) : null
        }
      >
        {actionError ? <p className="error">{actionError}</p> : null}
        {plan.items.length === 0 ? (
          <p className="muted">Nothing is scheduled today.</p>
        ) : (
          <div className="stack-tight">
            {nextItem && !runningItem ? <p className="muted">Next: {titleOf(nextItem)}</p> : null}
            {plan.items.map((item) => (
              <ActivityCard key={item.activity.id} activity={item.activity} now={now} actions={actions} />
            ))}
            {remaining === 0 ? <p className="tone-good">All planned activities are done.</p> : null}
          </div>
        )}
      </Card>

      {plan.bonus ? (
        <Card title="Bonus (optional)">
          <p className="muted">It fits under the cap and never becomes debt: postpone it freely.</p>
          <ActivityCard activity={plan.bonus.activity} now={now} actions={actions} variant="bonus" />
        </Card>
      ) : null}

      {plan.carriedOver.length > 0 ? (
        <Card title={`Carried over (${plan.carriedOver.length})`}>
          <p className="muted">
            Reviews that did not fit under today&apos;s cap. They are planned again tomorrow; start one
            now if you have spare time.
          </p>
          <div className="stack-tight">
            {plan.carriedOver.map((item) => (
              <ActivityCard
                key={item.activity.id}
                activity={item.activity}
                now={now}
                actions={actions}
                variant="carried"
              />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
