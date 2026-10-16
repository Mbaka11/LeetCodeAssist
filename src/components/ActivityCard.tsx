import { useState } from 'react';
import { estimatedMinutes } from '../core/activities';
import { elapsedMs, formatElapsed } from '../core/timer';
import type { Activity } from '../core/types';
import { getProblem, problemUrl } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { formatDate, formatMinutes, formatMs } from '../lib/format';
import { ACTIVITY_INSTRUCTIONS, ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { Badge } from './Badge';
import { Button } from './Button';
import { OutcomeForm } from './OutcomeForm';

export type CardVariant = 'planned' | 'bonus' | 'carried';

export function ActivityCard({
  activity,
  now,
  actions,
  variant = 'planned',
}: {
  activity: Activity;
  now: number;
  actions: AppActions;
  variant?: CardVariant;
}) {
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = getProblem(activity.slug);
  const url = problem?.url ?? problemUrl(activity.slug);
  const elapsed = elapsedMs(activity.timer, now);
  const running = activity.timer.running;
  const inProgress = activity.status === 'in_progress';
  const open = activity.status === 'planned' || inProgress;
  const skipLabel =
    activity.type === 'new' || activity.type === 'benchmark' || activity.extra ? 'Skip' : 'Postpone';

  const run = (task: Promise<void>): void => {
    setError(null);
    task.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const classes = ['activity', `activity-${activity.status}`];
  if (running) classes.push('running');

  return (
    <article className={classes.join(' ')}>
      <div className="activity-head">
        <Badge tone={activity.type}>{ACTIVITY_LABELS[activity.type]}</Badge>
        {variant === 'bonus' ? <Badge tone="warn">Bonus</Badge> : null}
        {variant === 'carried' ? (
          <Badge tone="bad">{`Due ${formatDate(activity.dueDate)}`}</Badge>
        ) : null}
        <a className="activity-title" href={problemHref(activity.slug)}>
          {problem?.title ?? activity.slug}
        </a>
        {problem ? (
          <Badge tone={problem.difficulty === 'Easy' ? 'easy' : problem.difficulty === 'Medium' ? 'medium' : 'hard'}>
            {problem.difficulty}
          </Badge>
        ) : null}
        {problem ? <span className="muted">{problem.category}</span> : null}
        <span className="spacer" />
        <span className="muted">~{formatMinutes(estimatedMinutes(activity.type, activity.slug))}</span>
        <a className="link-out" href={url} target="_blank" rel="noreferrer">
          LeetCode ↗
        </a>
      </div>

      {open ? <p className="instruction">{ACTIVITY_INSTRUCTIONS[activity.type]}</p> : null}

      {activity.status === 'done' ? (
        <p className="muted">
          {`Done · ${activity.outcome ? OUTCOME_LABELS[activity.outcome] : ''} · ${formatMs(activity.totalMs ?? 0)}`}
          {activity.approachMs !== undefined
            ? ` · approach at ${formatElapsed(activity.approachMs)}`
            : ''}
        </p>
      ) : null}
      {activity.status === 'skipped' ? <p className="muted">Skipped</p> : null}

      {open && !finishing ? (
        <div className="row">
          {inProgress ? (
            <span className={running ? 'timer timer-running' : 'timer'} aria-label="Elapsed time">
              {formatElapsed(elapsed)}
            </span>
          ) : null}
          {!inProgress ? (
            <Button variant="primary" onClick={() => run(actions.startActivity(activity.id))}>
              {variant === 'carried' ? 'Do now' : 'Start'}
            </Button>
          ) : running ? (
            <Button onClick={() => run(actions.pause(activity.id))}>Pause</Button>
          ) : (
            <Button variant="primary" onClick={() => run(actions.resume(activity.id))}>
              Resume
            </Button>
          )}
          {inProgress && activity.approachMs === undefined ? (
            <Button onClick={() => run(actions.markApproachFound(activity.id))}>Approach found</Button>
          ) : null}
          {inProgress && activity.approachMs !== undefined ? (
            <span className="muted">Approach found at {formatElapsed(activity.approachMs)}</span>
          ) : null}
          {inProgress ? (
            <Button
              onClick={() => {
                if (running) run(actions.pause(activity.id));
                setFinishing(true);
              }}
            >
              Finish
            </Button>
          ) : null}
          <span className="spacer" />
          <Button variant="ghost" onClick={() => run(actions.skip(activity.id))}>
            {skipLabel}
          </Button>
        </div>
      ) : null}

      {finishing ? (
        <OutcomeForm
          initialMinutes={Math.round(elapsed / 60_000)}
          onCancel={() => setFinishing(false)}
          onSubmit={(outcome, totalMs) => {
            setFinishing(false);
            run(actions.completeActivity(activity.id, outcome, totalMs));
          }}
        />
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}
