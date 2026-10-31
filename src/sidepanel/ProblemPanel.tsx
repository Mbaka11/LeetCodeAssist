import { useEffect, useMemo, useState } from 'react';
import { ProblemActivities } from '../components/ProblemActivities';
import { AttemptHistory } from '../components/AttemptHistory';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HintsSection } from '../components/HintsSection';
import { LeetCodeLink } from '../components/LeetCodeLink';
import { NotesForm } from '../components/NotesForm';
import { ProblemMetadataSection } from '../components/ProblemMetadata';
import { trainingDateFromTimestamp, trainingDayStart } from '../core/dates';
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
import { groupActivities } from '../lib/groupActivities';
import { ACTIVITY_LABELS, STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { acceptedPrompt, type SubmissionEvent } from '../lib/leetcodeSubmissions';
import { PANEL_SHORTCUT_LIST, usePanelShortcuts } from '../lib/panelShortcuts';
import { problemHref } from '../lib/route';
import { panelMatches, selectedPanelActivity } from './focusActivity';

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

/** Collapsed by default; Alt+? toggles it. */
function ShortcutsHelp({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <details className="shortcuts-help" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>Shortcuts</summary>
      <dl>
        {PANEL_SHORTCUT_LIST.map((shortcut) => (
          <div key={shortcut.keys}>
            <dt><kbd>{shortcut.keys}</kbd></dt>
            <dd>{shortcut.description}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        They work while this panel has focus and you are not typing in a field. The browser shortcut Alt+Shift+L
        opens the panel.
      </p>
    </details>
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
      <div className="problem-practice">
        <h3>Reserved for a benchmark</h3>
        <p className="muted">
          This problem is kept unseen for a benchmark day (1, 15 or 30), so it is not offered as practice.
        </p>
      </div>
    );
  }
  return (
    <div className="problem-practice">
      <h3>{doneToday ? 'Done today' : "Not in today's plan"}</h3>
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
    </div>
  );
}

const OPTIONAL_BONUS_TAG = 'Optional bonus';

function ChecklistRow({
  items,
  openProblem,
}: {
  items: readonly (PlanItem & { tag?: string })[];
  openProblem: (slug: string) => void;
}) {
  const activity = items[0]!.activity;
  const problem = getProblem(activity.slug);
  const title = problem?.title ?? activity.slug;
  const doneCount = items.filter((item) => item.activity.status === 'done').length;
  const done = doneCount === items.length;
  const started = items.some((item) => item.activity.status === 'in_progress');
  const types = new Map<Activity['type'], number>();
  for (const item of items) types.set(item.activity.type, (types.get(item.activity.type) ?? 0) + 1);
  const tags = [...new Set(items.flatMap((item) => item.tag ? [item.tag] : []))];
  return (
    <li className={done ? 'check-done' : undefined}>
      <span className="check-mark" aria-hidden="true">
        {done ? '✓' : started ? '▶' : '○'}
      </span>
      <span className="visually-hidden">
        {done ? 'Done: ' : started ? 'In progress: ' : tags.includes(OPTIONAL_BONUS_TAG) ? 'Optional: ' : 'To do: '}
      </span>
      {[...types].map(([type, count]) => <Badge key={type} tone={type}>
        {ACTIVITY_LABELS[type]}{count > 1 ? ` ×${count}` : ''}
      </Badge>)}
      {tags.map((tag) => <Badge key={tag} tone="warn">{tag}</Badge>)}
      <span className="check-title">{title}</span>
      {problem ? <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge> : null}
      {items.length > 1 ? <span className="muted">{doneCount}/{items.length} done</span> : null}
      <span className="muted">~{formatMinutes(items.reduce((sum, item) => sum + item.minutes, 0))}</span>
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
  const today = trainingDateFromTimestamp(now);
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
        {groupActivities([
          ...plan.items,
          ...plan.bonuses.map((item) => ({ ...item, tag: OPTIONAL_BONUS_TAG })),
          ...plan.carriedOver.map((item) => ({ ...item, tag: 'Carried over' })),
          ...plan.missedBenchmarks.map((item) => ({ ...item, tag: 'Missed benchmark' })),
        ], state.activities).map((group) => (
          <ChecklistRow key={group.slug} items={group.items} openProblem={openProblem} />
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
  const today = trainingDateFromTimestamp(now);
  const plan = useMemo(() => planDay(state, today), [state, today]);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  usePanelShortcuts((shortcut) => {
    if (shortcut !== 'help') return false;
    setHelpOpen((open) => !open);
    return true;
  });
  const problem = slug === null ? undefined : getProblem(slug);
  const matches = slug && problem ? panelMatches(plan, slug) : [];
  const openActivity = selectedPanelActivity(matches);
  const focused = state.settings.sidePanelFocus === true && openActivity !== undefined;
  const focusToggle = <div className="stack-tight">
    <Button aria-pressed={state.settings.sidePanelFocus === true} onClick={() => {
      setFocusError(null);
      actions.updateSettings({ sidePanelFocus: !state.settings.sidePanelFocus })
        .catch((e: unknown) => setFocusError(e instanceof Error ? e.message : String(e)));
    }}>Focus mode</Button>
    {state.settings.sidePanelFocus && !openActivity ? <p role="status" className="muted">Nothing to focus on: open a problem with a current activity. Showing the normal panel.</p> : null}
    {focusError ? <p className="error" role="alert">{focusError}</p> : null}
    <ShortcutsHelp open={helpOpen} onToggle={setHelpOpen} />
  </div>;
  const needsMaterializing =
    plan.items.some((item) => !item.persisted) || plan.bonuses.some((item) => !item.persisted) ||
    plan.missedBenchmarks.some((item) => !item.persisted);
  useEffect(() => {
    // Keep offers sticky even when the side panel is the only surface open. The shared store locks
    // this update against the dashboard, and materializing an existing plan is a no-op.
    if (needsMaterializing) actions.materializeToday().catch(console.error);
  }, [needsMaterializing, actions, state, today]);

  if (slug === null) {
    return (
      <div className="stack">
        {focusToggle}
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

  if (!problem) {
    return (
      <div className="stack">
        {focusToggle}
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

  const hasOpen = matches.some((m) => m.activity.status === 'planned' || m.activity.status === 'in_progress');

  const status = getProblemStatus(state, slug);
  const review = nextReview(state, slug, today);
  const history = attemptHistory(state, slug);
  const attempts = history.length;
  const position = queuePosition(state, slug);
  const locked = isNotesLocked(state, slug, today);
  // The activity model stores no first-start time, so "after the activity started" is approximated by
  // "since this training day's 04:00 boundary"; the latest Accepted since then is advisory only. ActivityCard auto-opens only for a fresh event observed
  // while that started activity is on screen; loading older events never auto-opens the form.
  const accepted = acceptedPrompt(submissionEvents, {
    slug,
    since: trainingDayStart(now),
  });

  return (
    <div className="stack" key={slug}>
      {focusToggle}
      <Card>
        <h1 className="panel-title">{problem.title}</h1>
        <div hidden={focused}>
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
        </div>
        <div className="row">
          <span hidden={focused}><DashboardLink hash={problemHref(slug)} openDashboard={openDashboard}>
            Open the problem sheet
          </DashboardLink></span>
          <LeetCodeLink href={problemUrl(slug)} />
        </div>
      </Card>

      <Card title="Today">
        {matches.length > 0 ? (
          <ProblemActivities items={matches} history={state.activities} now={now} actions={actions}
            compact budgets={state.settings.budgets} accepted={accepted ?? undefined}
            selectedActivityId={openActivity?.id} focused={focused} shortcuts
            openProblemSheet={(target) => openDashboard(problemHref(target))}
            footer={hasOpen ? null : <ExtraPractice state={state} actions={actions} slug={slug} today={today} />} />
        ) : <ExtraPractice state={state} actions={actions} slug={slug} today={today} />}
      </Card>

      <div hidden={focused}><ProblemMetadataSection key={`${slug}-${locked}`} slug={slug} state={state} collapsed protectedReview={locked}
        openProblemSheet={(target) => openDashboard(problemHref(target))} /></div>

      <HintsSection slug={slug} activity={openActivity} actions={actions} />

      <div hidden={focused}>
        <NotesSection state={state} actions={actions} slug={slug} locked={locked} />
      </div>
      <div hidden={focused}>
        <Card title="Attempt history">
          <AttemptHistory history={history} compact />
        </Card>
      </div>
    </div>
  );
}
