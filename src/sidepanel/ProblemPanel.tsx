import { useMemo, useState } from 'react';
import { ActivityCard, type CardVariant } from '../components/ActivityCard';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NotesForm } from '../components/NotesForm';
import { localDateFromTimestamp } from '../core/dates';
import { planDay } from '../core/planner';
import { attemptHistory, isNotesLocked, nextReview } from '../core/problemSheet';
import { getProblemStatus } from '../core/state';
import type { Activity, AppState } from '../core/types';
import { getProblem, problemUrl } from '../data/neetcode150';
import { BENCHMARKS } from '../data/program';
import type { AppActions } from '../lib/actions';
import { formatDate, formatMinutes } from '../lib/format';
import { ACTIVITY_LABELS, STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';

export interface ProblemPanelProps {
  state: AppState;
  actions: AppActions;
  /** Slug of the problem open in the active tab, or null on any other page. */
  slug: string | null;
  now: number;
  /** Opens (or focuses) the dashboard at a hash such as `#/problem/two-sum`. */
  openDashboard: (hash: string) => void;
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

function TodayStrip({ state, now, openDashboard }: Pick<ProblemPanelProps, 'state' | 'now' | 'openDashboard'>) {
  const today = localDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);
  const open = plan.items.filter((i) => i.activity.status === 'planned' || i.activity.status === 'in_progress');
  const next = open.find((i) => i.activity.status === 'in_progress') ?? open[0];
  const nextProblem = next ? getProblem(next.activity.slug) : undefined;
  if (plan.dayIndex < 1) {
    return <p className="muted">Your program starts on {formatDate(state.settings.startDate)}.</p>;
  }
  return (
    <div className="stack-tight">
      <p>
        <strong>Day {plan.dayIndex}</strong> · {plan.items.length - open.length}/{plan.items.length} done ·{' '}
        {open.length} left (~{formatMinutes(open.reduce((sum, i) => sum + i.minutes, 0))})
      </p>
      {next && nextProblem ? (
        <p>
          Next: {ACTIVITY_LABELS[next.activity.type]} ·{' '}
          <a href={nextProblem.url} target="_blank" rel="noreferrer">
            {nextProblem.title} ↗
          </a>
        </p>
      ) : null}
      <DashboardLink hash="#/today" openDashboard={openDashboard}>
        Open the dashboard
      </DashboardLink>
    </div>
  );
}

export function ProblemPanel({ state, actions, slug, now, openDashboard }: ProblemPanelProps) {
  const today = localDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);

  if (slug === null) {
    return (
      <div className="stack">
        <Card title="LeetCode Assist">
          <p className="muted">Open a problem on leetcode.com to see its activity, timer and notes here.</p>
          <TodayStrip state={state} now={now} openDashboard={openDashboard} />
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
          <TodayStrip state={state} now={now} openDashboard={openDashboard} />
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
  if (plan.bonus) collect(plan.bonus.activity, 'bonus');
  for (const item of plan.carriedOver) collect(item.activity, 'carried');
  const hasOpen = matches.some((m) => m.activity.status === 'planned' || m.activity.status === 'in_progress');

  const status = getProblemStatus(state, slug);
  const review = nextReview(state, slug, today);
  const attempts = attemptHistory(state, slug).length;
  const locked = isNotesLocked(state, slug, today);

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
          {review
            ? `Next review: ${ACTIVITY_LABELS[review.type]} on ${formatDate(review.dueDate)}${review.dueDate < today ? ' (overdue)' : ''}`
            : 'No review scheduled'}
          {attempts > 0 ? ` · ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}` : ''}
        </p>
        <div className="row">
          <DashboardLink hash={problemHref(slug)} openDashboard={openDashboard}>
            Open the problem sheet
          </DashboardLink>
          <a className="link-out" href={problemUrl(slug)} target="_blank" rel="noreferrer">
            LeetCode ↗
          </a>
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
                openProblemSheet={(target) => openDashboard(problemHref(target))}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {hasOpen ? null : <ExtraPractice state={state} actions={actions} slug={slug} today={today} />}

      <NotesSection state={state} actions={actions} slug={slug} locked={locked} />
    </div>
  );
}
