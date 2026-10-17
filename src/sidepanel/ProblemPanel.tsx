import { useEffect, useMemo, useState } from 'react';
import { ActivityCard, type CardVariant } from '../components/ActivityCard';
import { AttemptHistory } from '../components/AttemptHistory';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HintsSection } from '../components/HintsSection';
import { LeetCodeLink } from '../components/LeetCodeLink';
import { NotesForm } from '../components/NotesForm';
import { localDateFromTimestamp } from '../core/dates';
import { planDay, type PlanItem } from '../core/planner';
import { attemptHistory, isNotesLocked, nextReview } from '../core/problemSheet';
import { programQueue, queuePosition } from '../core/queue';
import { getProblemStatus } from '../core/state';
import type { Activity, AppState } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { getProblem, problemUrl } from '../data/neetcode150';
import { BENCHMARKS } from '../data/program';
import type { AppActions } from '../lib/actions';
import { formatDate, formatMinutes } from '../lib/format';
import { ACTIVITY_LABELS, STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { acceptedPrompt, type SubmissionEvent } from '../lib/leetcodeSubmissions';
import { problemHref } from '../lib/route';

export interface ProblemPanelProps {
  state: AppState;
  actions: AppActions;
  /** Slug of the problem open in the active tab, or null on any other page. */
  slug: string | null;
  now: number;
  /** Opens (or focuses) the dashboard at a hash such as `#/problem/two-sum`. */
  openDashboard: (hash: string) => void;
  /** Opens a problem on LeetCode: in the active tab when it is a LeetCode or empty page, else in a new tab. */
  openProblem: (slug: string) => void;
  /** Passively detected submission events (empty when detection is off or nothing was seen). */
  submissionEvents?: readonly SubmissionEvent[];
}

interface Match {
  activity: Activity;
  variant: CardVariant;
}

function DashboardLink({
  hash,
  openDashboard,
  children,
}: {
  hash: string;
  openDashboard: (hash: string) => void;
  children: string;
}) {
  return (
    <a
      href={hash}
      onClick={(event) => {
        event.preventDefault();
        openDashboard(hash);
      }}
    >
      {children}
    </a>
  );
}

function NotesSection({
  state,
  actions,
  slug,
  locked,
}: {
  state: AppState;
  actions: AppActions;
  slug: string;
  locked: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Card title="Notes">
      {locked && !revealed ? (
        <div className="locked">
          <p>
            A review of this problem is in progress or due, so your notes are hidden. Try to recall them
            first.
          </p>
          <Button variant="primary" onClick={() => setRevealed(true)}>
            Reveal notes
          </Button>
        </div>
      ) : (
        <NotesForm note={state.notes[slug]} onSave={(fields) => actions.saveNote(slug, fields)} />
      )}
    </Card>
  );
}

const BENCHMARK_SLUGS: ReadonlySet<string> = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));

function ExtraPractice({
  state,
  actions,
  slug,
  today,
}: {
  state: AppState;
  actions: AppActions;
  slug: string;
  today: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const learned = state.activities.some((a) => a.slug === slug && a.type === 'new' && a.status === 'done');
  const doneToday = state.activities.some(
    (a) => a.slug === slug && a.status === 'done' && a.completedAt === today,
  );
  if (BENCHMARK_SLUGS.has(slug)) {
    return (
      <Card title="Reserved for a benchmark">
        <p className="muted">
          This problem is kept unseen for a benchmark day (1, 15 or 30), so it is not offered as practice.
        </p>
      </Card>
    );
  }
  return (
    <Card title={doneToday ? 'Done today' : "Not in today's plan"}>
      <p className="muted">
        {doneToday
          ? 'You already finished this problem today. You can still start an optional extra attempt.'
          : learned
            ? 'You have learned this problem already. Start an extra re-solve: it is optional and never becomes debt.'
            : isBonusProblem(slug)
              ? 'This is a bonus-pool problem. Starting it is optional: it is not part of the core plan time, and finishing it adds its own later reviews.'
              : 'Start it as extra practice: finishing it starts its review cycle like any new problem.'}
      </p>
      <div className="row">
        <Button
          variant="primary"
          onClick={() => {
            setError(null);
            actions
              .startExtraPractice(slug)
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
          }}
        >
          Start as extra practice
        </Button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </Card>
  );
}

const OPTIONAL_BONUS_TAG = 'Optional bonus';

function ChecklistRow({
  item,
  tag,
  openProblem,
}: {
  item: PlanItem;
  tag?: string;
  openProblem: (slug: string) => void;
}) {
  const { activity } = item;
  const problem = getProblem(activity.slug);
  const title = problem?.title ?? activity.slug;
  const done = activity.status === 'done';
  return (
    <li className={done ? 'check-done' : undefined}>
      <span className="check-mark" aria-hidden="true">
        {done ? '✓' : activity.status === 'in_progress' ? '▶' : '○'}
      </span>
      <span className="visually-hidden">
        {done ? 'Done: ' : activity.status === 'in_progress' ? 'In progress: ' : tag === OPTIONAL_BONUS_TAG ? 'Optional: ' : 'To do: '}
      </span>
      <Badge tone={activity.type}>{ACTIVITY_LABELS[activity.type]}</Badge>
      {tag ? <Badge tone="warn">{tag}</Badge> : null}
      <span className="check-title">{title}</span>
      {problem ? <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge> : null}
      <span className="muted">~{formatMinutes(item.minutes)}</span>
      <span className="spacer" />
      <Button aria-label={`Open ${title} on LeetCode`} onClick={() => openProblem(activity.slug)}>
        Open
      </Button>
    </li>
  );
}

/** Today's checklist with an Open button per item, shown whenever the active tab is not a known problem page. */
function TodayChecklist({
  state,
  now,
  openDashboard,
  openProblem,
}: Pick<ProblemPanelProps, 'state' | 'now' | 'openDashboard' | 'openProblem'>) {
  const today = localDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);
  if (plan.dayIndex < 1) {
    return <p className="muted">Your program starts on {formatDate(state.settings.startDate)}.</p>;
  }
  const open = plan.items.filter((i) => i.activity.status === 'planned' || i.activity.status === 'in_progress');
  return (
    <div className="stack-tight">
      <p>
        <strong>Day {plan.dayIndex}</strong> · {plan.items.length - open.length}/{plan.items.length} done ·{' '}
        {open.length} left (~{formatMinutes(open.reduce((sum, i) => sum + i.minutes, 0))})
      </p>
      {plan.items.length === 0 ? <p className="muted">Nothing is scheduled today.</p> : null}
      <ul className="checklist" aria-label="Today's checklist">
        {plan.items.map((item) => (
          <ChecklistRow key={item.activity.id} item={item} openProblem={openProblem} />
        ))}
        {plan.bonuses.map((item) => (
          <ChecklistRow key={item.activity.id} item={item} tag={OPTIONAL_BONUS_TAG} openProblem={openProblem} />
        ))}
        {plan.carriedOver.map((item) => (
          <ChecklistRow key={item.activity.id} item={item} tag="Carried over" openProblem={openProblem} />
        ))}
      </ul>
      <DashboardLink hash="#/today" openDashboard={openDashboard}>
        Open the dashboard
      </DashboardLink>
    </div>
  );
}

export function ProblemPanel({
  state,
  actions,
  slug,
  now,
  openDashboard,
  openProblem,
  submissionEvents = [],
}: ProblemPanelProps) {
  const today = localDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);
  const needsMaterializing =
    plan.items.some((item) => !item.persisted) || plan.bonuses.some((item) => !item.persisted);
  useEffect(() => {
    // Keep offers sticky even when the side panel is the only surface open. The shared store locks
    // this update against the dashboard, and materializing an existing plan is a no-op.
    if (needsMaterializing) actions.materializeToday().catch(console.error);
  }, [needsMaterializing, actions, state, today]);

  if (slug === null) {
    return (
      <div className="stack">
        <Card title="Open a LeetCode problem">
          <p className="muted">
            This panel follows your active tab. Open a problem on leetcode.com, or pick one from today&apos;s
            checklist, to see its activity, timer, hints and notes here.
          </p>
        </Card>
        <Card title="Today's checklist">
          <TodayChecklist state={state} now={now} openDashboard={openDashboard} openProblem={openProblem} />
        </Card>
      </div>
    );
  }

  const problem = getProblem(slug);
  if (!problem) {
    return (
      <div className="stack">
        <Card title="Not in the NeetCode 150">
          <p className="muted">
            “{slug}” is not one of the 150 problems this program tracks, so there is nothing to plan for it.
          </p>
        </Card>
        <Card title="Today's checklist">
          <TodayChecklist state={state} now={now} openDashboard={openDashboard} openProblem={openProblem} />
        </Card>
      </div>
    );
  }

  const matches: Match[] = [];
  const seen = new Set<string>();
  const collect = (activity: Activity, variant: CardVariant): void => {
    if (activity.slug !== slug || seen.has(activity.id)) return;
    seen.add(activity.id);
    matches.push({ activity, variant });
  };
  for (const item of plan.items) collect(item.activity, 'planned');
  for (const item of plan.bonuses) collect(item.activity, 'bonus');
  for (const item of plan.carriedOver) collect(item.activity, 'carried');
  const hasOpen = matches.some((m) => m.activity.status === 'planned' || m.activity.status === 'in_progress');

  const status = getProblemStatus(state, slug);
  const review = nextReview(state, slug, today);
  const history = attemptHistory(state, slug);
  const attempts = history.length;
  const position = queuePosition(state, slug);
  const openActivity =
    matches.map((m) => m.activity).find((a) => a.status === 'in_progress') ??
    matches.map((m) => m.activity).find((a) => a.status === 'planned');
  const locked = isNotesLocked(state, slug, today);
  // The activity model stores no first-start time, so "after the activity started" is approximated by
  // "since local midnight today" (a started activity is always one of today's); the latest Accepted
  // since then is used.
  const accepted = acceptedPrompt(submissionEvents, {
    slug,
    since: new Date(now).setHours(0, 0, 0, 0),
  });

  return (
    <div className="stack" key={slug}>
      <Card>
        <h1 className="panel-title">{problem.title}</h1>
        <div className="row">
          <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge>
          <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
          <span className="muted">{problem.category}</span>
        </div>
        <p className="muted">
          {position !== null
            ? `Program problem ${position} of ${programQueue(state).length}`
            : isBonusProblem(slug)
              ? 'Bonus problem (not in the 30-day program)'
              : 'Not in the 30-day program'}
        </p>
        <p className="muted">
          {review
            ? `Next review: ${ACTIVITY_LABELS[review.type]} on ${formatDate(review.dueDate)}${review.dueDate < today ? ' (overdue)' : ''}`
            : 'No review scheduled'}
          {attempts > 0 ? ` · ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}` : ''}
        </p>
        <div className="row">
          <DashboardLink hash={problemHref(slug)} openDashboard={openDashboard}>
            Open the problem sheet
          </DashboardLink>
          <LeetCodeLink href={problemUrl(slug)} />
        </div>
      </Card>

      {matches.length > 0 ? (
        <Card title="Today">
          <div className="stack-tight">
            {matches.map((m) => (
              <ActivityCard
                key={m.activity.id}
                activity={m.activity}
                now={now}
                actions={actions}
                variant={m.variant}
                compact
                budgets={state.settings.budgets}
                accepted={accepted ?? undefined}
                openProblemSheet={(target) => openDashboard(problemHref(target))}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {hasOpen ? null : <ExtraPractice state={state} actions={actions} slug={slug} today={today} />}

      <HintsSection slug={slug} activity={openActivity} actions={actions} />

      <NotesSection state={state} actions={actions} slug={slug} locked={locked} />

      <Card title="Attempt history">
        <AttemptHistory history={history} compact />
      </Card>
    </div>
  );
}
