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
import { ProgressBar } from '../components/ProgressBar';
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

const isOpenItem = (item: PlanItem): boolean =>
  item.activity.status === 'planned' || item.activity.status === 'in_progress';

function ChecklistRow({
  items,
  openProblem,
  hideTag,
}: {
  items: readonly (PlanItem & { tag?: string })[];
  openProblem: (slug: string) => void;
  /** A tag the surrounding section already states (the Optional bonus heading). */
  hideTag?: string;
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
    <li className={`${done ? 'check-done' : ''}${started ? ' check-started' : ''}`.trim() || undefined}>
      <span className="check-mark" aria-hidden="true">
        {done ? '✓' : started ? '▶' : '○'}
      </span>
      <span className="visually-hidden">
        {done ? 'Done: ' : started ? 'In progress: ' : tags.includes(OPTIONAL_BONUS_TAG) ? 'Optional: ' : 'To do: '}
      </span>
      <span className="check-main">
        <span className="check-title">{title}</span>
        <span className="check-meta">
          {[...types].map(([type, count]) => <Badge key={type} tone={type}>
            {ACTIVITY_LABELS[type]}{count > 1 ? ` ×${count}` : ''}
          </Badge>)}
          {tags.filter((tag) => tag !== hideTag).map((tag) => <Badge key={tag} tone="warn">{tag}</Badge>)}
          {problem ? <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge> : null}
          {items.length > 1 ? <span className="muted">{doneCount}/{items.length} done</span> : null}
          <span className="muted">~{formatMinutes(items.reduce((sum, item) => sum + item.minutes, 0))}</span>
        </span>
      </span>
      <Button className="btn-small" aria-label={`Open ${title} on LeetCode`} onClick={() => openProblem(activity.slug)}>
        Open
      </Button>
    </li>
  );
}

/**
 * Today's checklist, shown whenever the active tab is not a known problem page: what is left first, then the
 * optional bonus offers, then the finished items folded away. Each row has an Open button.
 */
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
  const open = plan.items.filter(isOpenItem);
  const doneCount = plan.items.length - open.length;
  const groups = groupActivities([
    ...plan.items,
    ...plan.bonuses.map((item) => ({ ...item, tag: OPTIONAL_BONUS_TAG })),
    ...plan.carriedOver.map((item) => ({ ...item, tag: 'Carried over' })),
    ...plan.missedBenchmarks.map((item) => ({ ...item, tag: 'Missed benchmark' })),
  ], state.activities);
  const finished = groups.filter((g) => !g.items.some(isOpenItem));
  const pending = groups.filter((g) => g.items.some(isOpenItem));
  const optional = pending.filter((g) => g.items.every((i) => i.tag === OPTIONAL_BONUS_TAG));
  const todo = pending.filter((g) => !optional.includes(g));
  return (
    <div className="stack-tight">
      <div className="checklist-summary">
        <p>
          <strong>Day {plan.dayIndex}</strong> · {doneCount}/{plan.items.length} done
          {open.length > 0 ? <span className="muted"> · {open.length} left (~{formatMinutes(open.reduce((sum, i) => sum + i.minutes, 0))})</span> : null}
        </p>
        {plan.items.length > 0 ? <ProgressBar value={doneCount} max={plan.items.length} done={open.length === 0} /> : null}
      </div>
      {plan.items.length === 0 ? <p className="muted">Nothing is scheduled today.</p> : null}
      {todo.length > 0 ? (
        <ul className="checklist" aria-label="Today's checklist">
          {todo.map((group) => <ChecklistRow key={group.slug} items={group.items} openProblem={openProblem} />)}
        </ul>
      ) : plan.items.length > 0 ? <p className="tone-good">Core plan done for today.</p> : null}
      {optional.length > 0 ? (
        <section className="checklist-section">
          <h3 className="checklist-heading">Optional bonus <span className="muted">· never debt</span></h3>
          <ul className="checklist" aria-label="Optional bonus problems">
            {optional.map((group) => (
              <ChecklistRow key={group.slug} items={group.items} openProblem={openProblem} hideTag={OPTIONAL_BONUS_TAG} />
            ))}
          </ul>
        </section>
      ) : null}
      {finished.length > 0 ? (
        <details className="checklist-section checklist-finished">
          <summary>Done today ({finished.length})</summary>
          <ul className="checklist" aria-label="Done today">
            {finished.map((group) => <ChecklistRow key={group.slug} items={group.items} openProblem={openProblem} />)}
          </ul>
        </details>
      ) : null}
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
  const coreOpen = plan.items.filter(isOpenItem).length;
  const focusToggle = <div className="stack-tight panel-top">
    <div className="panel-toolbar">
      {/* On a problem page only: the checklist already states the day and progress. */}
      {problem && plan.dayIndex >= 1 ? (
        <span className="panel-day" title={`${coreOpen} core ${coreOpen === 1 ? 'item' : 'items'} left today`}>
          <strong>Day {plan.dayIndex}</strong> · {plan.items.length - coreOpen}/{plan.items.length}
        </span>
      ) : null}
      <span className="spacer" />
      <Button className="btn-small" aria-pressed={state.settings.sidePanelFocus === true}
        title="Hide everything except the current activity, its hints and the LeetCode link" onClick={() => {
          setFocusError(null);
          actions.updateSettings({ sidePanelFocus: !state.settings.sidePanelFocus })
            .catch((e: unknown) => setFocusError(e instanceof Error ? e.message : String(e)));
        }}>Focus mode</Button>
      <Button variant="ghost" className="btn-small" title="Open the dashboard" onClick={() => openDashboard('#/today')}>
        Dashboard ↗
      </Button>
      <ShortcutsHelp open={helpOpen} onToggle={setHelpOpen} />
    </div>
    {state.settings.sidePanelFocus && !openActivity ? <p role="status" className="muted small">Nothing to focus on: open a problem with a current activity. Showing the normal panel.</p> : null}
    {focusError ? <p className="error" role="alert">{focusError}</p> : null}
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
        <p className="panel-hint muted">
          <strong>Open a LeetCode problem</strong> to see its timer, hints and notes here. The panel follows your
          active tab.
        </p>
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

  const hasOpen = matches.some(isOpenItem);
  // A Blind review is solved with the category hidden: do not print it in the header.
  const blindOpen = matches.some((m) => m.activity.type === 'blind' && isOpenItem(m));

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
      <Card className="panel-head">
        <div className="panel-head-top">
          <h1 className="panel-title">{problem.title}</h1>
          <LeetCodeLink href={problemUrl(slug)} />
        </div>
        <div hidden={focused} className="stack-tight">
          <div className="row panel-badges">
            <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge>
            <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
            {blindOpen
              ? <span className="muted" title="A Blind review is open: the category is hidden so it does not give the pattern away.">Category hidden</span>
              : <span className="muted">{problem.category}</span>}
          </div>
          <p className="muted small panel-meta">
            {[
              position !== null
                ? `Program problem ${position} of ${programQueue(state).length}`
                : isBonusProblem(slug) ? 'Bonus problem (not in the 60-day program)' : 'Not in the 60-day program',
              review
                ? `Next review: ${ACTIVITY_LABELS[review.type]} ${review.dueDate === today ? 'today' : `on ${formatDate(review.dueDate)}`}${review.dueDate < today ? ' (overdue)' : ''}`
                : 'No review scheduled',
              ...(attempts > 0 ? [`${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`] : []),
            ].join(' · ')}
          </p>
          <DashboardLink hash={problemHref(slug)} openDashboard={openDashboard}>
            Open the problem sheet
          </DashboardLink>
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
        <details className="card panel-fold">
          <summary><h2>Attempt history</h2><span className="muted">{attempts}</span></summary>
          <AttemptHistory history={history} compact />
        </details>
      </div>
    </div>
  );
}
