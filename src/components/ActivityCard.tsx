import { useState, type MouseEvent } from 'react';
import { estimatedMinutes, isReviewType } from '../core/activities';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { elapsedMs, formatElapsed } from '../core/timer';
import type { Activity } from '../core/types';
import { getProblem, problemUrl } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { MAX_MOVE_DAYS } from '../lib/commands';
import { formatDate, formatMinutes, formatMs } from '../lib/format';
import { ACTIVITY_INSTRUCTIONS, ACTIVITY_LABELS, OUTCOME_LABELS, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { Badge } from './Badge';
import { hintsLabel } from './AttemptHistory';
import { Button } from './Button';
import { LeetCodeLink } from './LeetCodeLink';
import { MoveForm } from './MoveForm';
import { OutcomeForm } from './OutcomeForm';

export type CardVariant = 'planned' | 'bonus' | 'carried';

export function ActivityCard({
  activity,
  now,
  actions,
  variant = 'planned',
  compact = false,
  openProblemSheet,
}: {
  activity: Activity;
  now: number;
  actions: AppActions;
  variant?: CardVariant;
  /** Side panel layout: no category and no LeetCode link (the problem is already open). */
  compact?: boolean;
  /** Replaces the default in-page link to the problem sheet (the side panel opens the dashboard). */
  openProblemSheet?: (slug: string) => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = getProblem(activity.slug);
  const url = problem?.url ?? problemUrl(activity.slug);
  const elapsed = elapsedMs(activity.timer, now);
  const running = activity.timer.running;
  const inProgress = activity.status === 'in_progress';
  const open = activity.status === 'planned' || inProgress;
  // New problems are postponed (back in the queue, never dropped); planned reviews are moved to another
  // day; benchmarks and optional practice can only be skipped.
  const postponable = activity.type === 'new' && !activity.extra;
  const movable = isReviewType(activity.type) && !activity.extra && activity.status === 'planned';
  const today = localDateFromTimestamp(now);

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
        <a
          className="activity-title"
          href={problemHref(activity.slug)}
          {...(openProblemSheet
            ? {
                onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  openProblemSheet(activity.slug);
                },
              }
            : {})}
        >
          {problem?.title ?? activity.slug}
        </a>
        {problem ? (
          <Badge tone={difficultyTone(problem.difficulty)}>
            {problem.difficulty}
          </Badge>
        ) : null}
        {problem && !compact ? <span className="muted">{problem.category}</span> : null}
        <span className="spacer" />
        <span className="muted">~{formatMinutes(estimatedMinutes(activity.type, activity.slug))}</span>
        {compact ? null : (
          <a className="link-out" href={url} target="_blank" rel="noreferrer">
            LeetCode ↗
          </a>
        )}
      </div>

      {open ? <p className="instruction">{ACTIVITY_INSTRUCTIONS[activity.type]}</p> : null}

      {activity.status === 'done' ? (
        <p className="muted">
          {`Done · ${activity.outcome ? OUTCOME_LABELS[activity.outcome] : ''} · ${formatMs(activity.totalMs ?? 0)}`}
          {activity.approachMs !== undefined
            ? ` · approach at ${formatElapsed(activity.approachMs)}`
            : ''}
          {activity.hintsUsed ? ` · ${hintsLabel(activity.hintsUsed)}` : ''}
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
          {postponable ? (
            <Button
              variant="ghost"
              title="Moves this problem back in the queue, behind the next two. It stays in the program."
              onClick={() => run(actions.postpone(activity.id))}
            >
              Postpone
            </Button>
          ) : movable ? (
            <Button variant="ghost" aria-expanded={moving} onClick={() => setMoving(!moving)}>
              Move…
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => run(actions.skip(activity.id))}>
              {isReviewType(activity.type) && !activity.extra ? 'Stop, redo tomorrow' : 'Skip'}
            </Button>
          )}
        </div>
      ) : null}

      {moving && movable && !finishing ? (
        <MoveForm
          minDate={today}
          maxDate={addDays(today, MAX_MOVE_DAYS)}
          initialDate={addDays(today, 1)}
          onMove={(date) => actions.moveReview(activity.id, date)}
          onCancel={() => setMoving(false)}
        />
      ) : null}

      {finishing ? (
        <OutcomeForm
          initialMinutes={Math.round(elapsed / 60_000)}
          hintsUsed={activity.hintsUsed}
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
