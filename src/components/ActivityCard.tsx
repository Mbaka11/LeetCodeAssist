import { useState, type MouseEvent } from 'react';
import { estimatedMinutes, isReviewType } from '../core/activities';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { elapsedMs, formatElapsed } from '../core/timer';
import type { Activity, BudgetOverrides } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { getProblem, problemUrl } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { MAX_MOVE_DAYS } from '../lib/commands';
import { formatDate, formatMinutes, formatMs } from '../lib/format';
import { ACTIVITY_INSTRUCTIONS, ACTIVITY_LABELS, OUTCOME_LABELS, difficultyTone } from '../lib/instructions';
import { acceptedPromptText, formatClockTime, type AcceptedPrompt } from '../lib/leetcodeSubmissions';
import { problemHref } from '../lib/route';
import { Badge } from './Badge';
import { hintsLabel } from './AttemptHistory';
import { Button } from './Button';
import { LeetCodeLink } from './LeetCodeLink';
import { MoveForm } from './MoveForm';
import { OutcomeForm } from './OutcomeForm';
import { TimerBadge } from './TimerBadge';

export type CardVariant = 'planned' | 'bonus' | 'carried';

export function ActivityCard({
  activity,
  now,
  actions,
  variant = 'planned',
  compact = false,
  openProblemSheet,
  budgets,
  accepted,
}: {
  activity: Activity;
  now: number;
  actions: AppActions;
  variant?: CardVariant;
  /** Side panel layout: no category and no LeetCode link (the problem is already open). */
  compact?: boolean;
  /** Replaces the default in-page link to the problem sheet (the side panel opens the dashboard). */
  openProblemSheet?: (slug: string) => void;
  /** `settings.budgets`, so the shown estimate follows the user's overrides. */
  budgets?: BudgetOverrides | undefined;
  /** A detected Accepted verdict for this problem (side panel): offers to finish, never finishes by itself. */
  accepted?: AcceptedPrompt | undefined;
}) {
  const [finishing, setFinishing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = getProblem(activity.slug);
  const url = problem?.url ?? problemUrl(activity.slug);
  const elapsed = elapsedMs(activity.timer, now);
  const budgetMin = estimatedMinutes(activity.type, activity.slug, budgets);
  const running = activity.timer.running;
  const inProgress = activity.status === 'in_progress';
  const open = activity.status === 'planned' || inProgress;
  // A bonus-pool problem is extra work outside the program: it is labelled and can only be skipped (it
  // returns to the pool).
  const bonus = variant === 'bonus' || (activity.type === 'new' && isBonusProblem(activity.slug));
  // New problems are postponed (back in the queue, never dropped); planned reviews are moved to another
  // day; benchmarks, optional practice and bonus problems can only be skipped.
  const postponable = activity.type === 'new' && !activity.extra && !isBonusProblem(activity.slug);
  const movable = isReviewType(activity.type) && !activity.extra && activity.status === 'planned';
  const today = localDateFromTimestamp(now);

  const startFinishing = (): void => {
    if (running) run(actions.pause(activity.id));
    setFinishing(true);
  };

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
        {bonus ? <Badge tone="warn">Bonus</Badge> : null}
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
        <span className="muted">~{formatMinutes(budgetMin)}</span>
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
            <TimerBadge
              elapsedMs={elapsed}
              budgetMin={budgetMin}
              running={running}
              showHelpLadder={activity.type === 'new'}
            />
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
            <Button onClick={startFinishing}>Finish</Button>
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

      {inProgress && accepted && !finishing ? (
        <div className="accepted-prompt" role="status">
          <p>
            <strong>{acceptedPromptText(accepted)}</strong>
            {accepted.attemptsBefore > 0
              ? ` After ${accepted.attemptsBefore} other ${accepted.attemptsBefore === 1 ? 'attempt' : 'attempts'}.`
              : ''}
          </p>
          {accepted.python ? null : (
            <p className="muted">
              This program is meant to be practised in Python. You may want to re-solve it in Python
              before you finish, but that is up to you.
            </p>
          )}
          <div className="row">
            <Button variant="primary" onClick={startFinishing}>
              Finish this activity…
            </Button>
          </div>
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
          {...(accepted && !activity.hintsUsed
            ? {
                initialOutcome: 'solo' as const,
                detectedNote: `Accepted was detected at ${formatClockTime(accepted.acceptedAt)}, and you used no hints, so “Solo” is pre-selected. Change it if that is not how it went.`,
              }
            : {})}
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
