import { useEffect, useId, useMemo, useRef, useState, type FocusEvent } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { MoveForm } from '../components/MoveForm';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import {
  calendarDays,
  programProgress,
  type CalendarDay,
  type CalendarEntry,
  type EntryState,
} from '../core/calendar';
import { addDays, trainingDateFromTimestamp } from '../core/dates';
import { projectDay, projectDays, type DayProjection } from '../core/projection';
import { computeStreak, loggedTotals } from '../core/state';
import type { ActivityType, AppState } from '../core/types';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { MAX_MOVE_DAYS } from '../lib/commands';
import { formatDate, formatMinutes, formatMs } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { useNow } from '../lib/useNow';
import { LeetCodeStreakCard } from './LeetCodeStreakCard';
import { RetrospectiveCards } from './RetrospectiveCard';

const ENTRY_LABELS: Record<EntryState, string> = {
  done: 'Done',
  open: 'To do',
  carried: 'Carried over',
  missed: 'Not done',
  skipped: 'Skipped',
  expected: 'Expected',
};

const ENTRY_TONES: Record<EntryState, 'good' | 'neutral' | 'warn' | 'bad'> = {
  done: 'good',
  open: 'neutral',
  carried: 'warn',
  missed: 'bad',
  skipped: 'neutral',
  expected: 'neutral',
};

interface StartDateMessage {
  ok: boolean;
  text: string;
}

/** The message lives outside the form: a saved change re-keys (remounts) the form. */
function StartDateForm({
  state,
  actions,
  message,
  setMessage,
}: {
  state: AppState;
  actions: AppActions;
  message: StartDateMessage | null;
  setMessage: (message: StartDateMessage | null) => void;
}) {
  const [value, setValue] = useState(state.settings.startDate);
  return (
    <form
      className="row"
      onSubmit={(event) => {
        event.preventDefault();
        actions.updateSettings({ startDate: value }).then(
          () => setMessage({ ok: true, text: 'Start date saved.' }),
          (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) }),
        );
      }}
    >
      <label className="field inline">
        <span>Program start (day 1)</span>
        <input type="date" required value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <Button type="submit" disabled={value === state.settings.startDate}>
        Save start date
      </Button>
      {message ? <span className={message.ok ? 'tone-good' : 'error'}>{message.text}</span> : null}
    </form>
  );
}

/** "3/4 done" for past days and today, "~6 · 2h10" for a projected future day; the details are a tooltip. */
function cellSummary(day: CalendarDay, projection: DayProjection | undefined): { counts: string; minutes: string; title: string } {
  if (day.kind === 'future') {
    const count = projection?.items.length ?? day.plannedCount;
    const minutes = projection?.totalMinutes ?? day.plannedMinutes;
    return {
      counts: count === 0 ? 'nothing planned' : `~${count} ${count === 1 ? 'activity' : 'activities'}`,
      minutes: `~${formatMinutes(minutes)}`,
      title: 'Forecast if you do every planned item on budget. Hover for the list.',
    };
  }
  const details = [`planned ${day.plannedCount}`, `done ${day.doneCount}`];
  if (day.carriedCount > 0) details.push(`carried ${day.carriedCount}`);
  if (day.extraCount > 0) details.push(`${day.extraCount} optional extra`);
  return {
    counts: day.coreCount > 0 ? `${day.coreDoneCount}/${day.coreCount} done` : day.doneCount > 0 ? `${day.doneCount} done` : 'nothing done',
    minutes: `${formatMinutes(day.loggedMinutes)} logged`,
    title: `${details.join(' · ')} · ~${formatMinutes(day.plannedMinutes)} planned`,
  };
}

function DayCell({
  day,
  selected,
  onSelect,
  describedBy,
  projection,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: () => void;
  describedBy: string;
  projection?: DayProjection | undefined;
}) {
  const summary = cellSummary(day, projection);
  const classes = ['cal-day', `cal-${day.kind}`];
  if (selected) classes.push('selected');
  if (day.planDone) classes.push('plan-done');
  const future = day.kind === 'future';
  const barMinutes = future ? (projection?.totalMinutes ?? day.plannedMinutes) : day.loggedMinutes;
  const barPercent =
    day.targetMinutes > 0 ? Math.min(100, Math.round((barMinutes / day.targetMinutes) * 100)) : 0;
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={selected}
      onClick={onSelect}
      aria-describedby={describedBy}
    >
      <span className="cal-head">
        <strong>Day {day.dayIndex}</strong>
        <span className="muted">{formatDate(day.date)}</span>
      </span>
      <span className="cal-badges">
        {day.kind === 'today' ? <Badge tone="new">Today</Badge> : null}
        {day.isConsolidation ? <Badge tone="resolve">Consolidation</Badge> : null}
        {day.isBenchmark ? <Badge tone="benchmark">Benchmark</Badge> : null}
        {day.overflow ? <Badge>After day 60</Badge> : null}
      </span>
      <span className="cal-counts" title={summary.title}>
        <strong>{summary.counts}</strong>
        <span className="muted">{summary.minutes}</span>
      </span>
      <span className={`cal-bar${future ? ' cal-bar-planned' : ''}`} aria-hidden="true">
        <span className="cal-bar-fill" style={{ width: `${barPercent}%` }} />
      </span>
      {day.planDone ? (
        <span className="cal-badges">
          <Badge tone="good">Plan done</Badge>
        </span>
      ) : null}
    </button>
  );
}

export interface PopoverRow {
  key: string;
  type: ActivityType;
  title: string;
  /** Budgeted minutes. */
  minutes: number;
  /** Status label of an existing entry (past and current days). */
  status?: string;
  /** Logged minutes of a completed entry. */
  loggedMinutes?: number;
  /** A bonus-pool problem. */
  bonus?: boolean;
}

function titleOfSlug(slug: string | undefined): string {
  return slug ? (getProblem(slug)?.title ?? slug) : 'Next problem from the queue';
}

/** An open bonus offer is optional, not a to-do. */
function entryLabel(entry: CalendarEntry): string {
  return entry.bonus && entry.state === 'open' ? 'Optional' : ENTRY_LABELS[entry.state];
}

/** The activities of a day for the popover: real entries for past and current days. */
export function entryRows(day: CalendarDay): PopoverRow[] {
  return day.entries.map((entry) => ({
    key: entry.id,
    type: entry.type,
    title: titleOfSlug(entry.slug),
    minutes: entry.minutes,
    status: entryLabel(entry),
    ...(entry.loggedMinutes !== undefined ? { loggedMinutes: entry.loggedMinutes } : {}),
    ...(entry.bonus ? { bonus: true } : {}),
  }));
}

/** Text content of the day popover. `projected` marks a forecast rather than the recorded plan. */
export function DayPopoverContent({
  day,
  rows,
  totalMinutes,
  projected,
  carriedOverCount = 0,
}: {
  day: CalendarDay;
  rows: readonly PopoverRow[];
  totalMinutes: number;
  projected: boolean;
  carriedOverCount?: number;
}) {
  return (
    <>
      <p className="cal-popover-title">
        <strong>
          Day {day.dayIndex} · {formatDate(day.date)}
        </strong>
        {projected ? <Badge tone="warn">projected</Badge> : null}
      </p>
      {projected ? (
        <p className="muted">Assumes you do each day&apos;s plan as scheduled and nothing else changes.</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="muted">Nothing planned.</p>
      ) : (
        <ul className="cal-popover-list">
          {rows.map((row) => (
            <li key={row.key}>
              <Badge tone={row.type}>{ACTIVITY_LABELS[row.type]}</Badge>
              {row.bonus ? <Badge tone="warn">Bonus</Badge> : null}
              <span className="cal-popover-problem">{row.title}</span>
              <span className="muted">
                {row.loggedMinutes !== undefined
                  ? `${formatMinutes(row.loggedMinutes)} logged`
                  : `~${formatMinutes(row.minutes)}`}
                {row.status ? ` · ${row.status}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        Total <strong>~{formatMinutes(totalMinutes)}</strong>
        {carriedOverCount > 0 ? ` · ${carriedOverCount} more carried over` : ''}
      </p>
    </>
  );
}

/** Widest the popover gets (matches `max-width` in the stylesheet). */
const POPOVER_MAX_WIDTH_PX = 340;

/** Whether a popover opening at `cellLeft` would run past the right edge of the viewport. */
export function popoverAlignsToEnd(cellLeft: number, viewportWidth: number): boolean {
  return cellLeft + POPOVER_MAX_WIDTH_PX > viewportWidth;
}

/** The popover element is always mounted (so `aria-describedby` resolves); its content only while open. */
function DayPopover({
  id,
  day,
  state,
  today,
  open,
  alignEnd,
  projection,
}: {
  id: string;
  day: CalendarDay;
  state: AppState;
  today: string;
  open: boolean;
  alignEnd: boolean;
  projection?: DayProjection | undefined;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label={`Plan for day ${day.dayIndex}`}
      className={`cal-popover${alignEnd ? ' cal-popover-end' : ''}`}
      hidden={!open}
    >
      {open ? <DayPopoverBody day={day} state={state} today={today} projected={projection} /> : null}
    </div>
  );
}

function DayPopoverBody({ day, state, today, projected: given }: { day: CalendarDay; state: AppState; today: string; projected?: DayProjection | undefined }) {
  const projection = useMemo(
    () => (day.kind === 'future' ? (given ?? projectDay(state, day.date, today)) : null),
    [day.kind, day.date, state, today, given],
  );
  return (
    <>
      {projection ? (
        <DayPopoverContent
          day={day}
          projected
          rows={projection.items.map((item, i) => ({
            key: `${item.type}:${item.slug}:${i}`,
            type: item.type,
            title: titleOfSlug(item.slug),
            minutes: item.minutes,
          }))}
          totalMinutes={projection.totalMinutes}
          carriedOverCount={projection.carriedOverCount}
        />
      ) : (
        <DayPopoverContent
          day={day}
          projected={false}
          rows={entryRows(day)}
          totalMinutes={day.plannedMinutes}
        />
      )}
    </>
  );
}

/**
 * A day cell with a popover that opens on hover and keyboard focus and closes with Escape (also when
 * only the mouse is over the cell) and on blur or when the pointer leaves.
 */
function DayCellWithPopover({
  day,
  selected,
  onSelect,
  state,
  today,
  projection,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: () => void;
  state: AppState;
  today: string;
  projection?: DayProjection | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const show = (event: { currentTarget: HTMLElement }): void => {
    setAlignEnd(popoverAlignsToEnd(event.currentTarget.getBoundingClientRect().left, window.innerWidth));
    setOpen(true);
  };
  return (
    <div
      className="cal-cell"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={(event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <DayCell day={day} selected={selected} onSelect={onSelect} describedBy={popoverId} projection={projection} />
      <DayPopover id={popoverId} day={day} state={state} today={today} open={open} alignEnd={alignEnd} projection={projection} />
    </div>
  );
}

function ProgramProgressCard({ state, today }: { state: AppState; today: string }) {
  const progress = programProgress(state, today);
  return (
    <div className="stats program-progress">
      <div className="stack-tight">
        <Stat
          label="Problems learned"
          value={`${progress.learned}/${progress.totalProblems}`}
          title="Program problems with a finished first attempt, out of the 100 the 60 days plan"
        />
        <ProgressBar
          value={progress.learned}
          max={progress.totalProblems}
          done={progress.learned >= progress.totalProblems}
        />
      </div>
      <div className="stack-tight">
        <Stat
          label="Days elapsed"
          value={`${progress.daysElapsed}/${progress.totalDays}`}
          title={progress.daysElapsed === 0 ? 'Not started yet' : 'Including today'}
        />
        <ProgressBar
          value={progress.daysElapsed}
          max={progress.totalDays}
          done={progress.daysElapsed >= progress.totalDays}
        />
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  canPostpone,
  moving,
  onToggleMove,
  onPostpone,
}: {
  entry: CalendarEntry;
  canPostpone: boolean;
  moving: boolean;
  onToggleMove: () => void;
  onPostpone: () => void;
}) {
  const problem = entry.slug ? getProblem(entry.slug) : undefined;
  return (
    <tr>
      <td>
        <Badge tone={entry.type}>{ACTIVITY_LABELS[entry.type]}</Badge>
      </td>
      <td>
        {entry.slug ? (
          <a href={problemHref(entry.slug)}>{problem?.title ?? entry.slug}</a>
        ) : (
          <span className="muted">Next problem from the queue</span>
        )}
        {entry.bonus ? <Badge tone="warn">Bonus</Badge> : null}
      </td>
      <td>
        <Badge tone={ENTRY_TONES[entry.state]}>{entryLabel(entry)}</Badge>
      </td>
      <td>
        {entry.loggedMinutes !== undefined
          ? `${formatMinutes(entry.loggedMinutes)} (budget ${formatMinutes(entry.minutes)})`
          : `~${formatMinutes(entry.minutes)}`}
      </td>
      <td>{entry.outcome ? OUTCOME_LABELS[entry.outcome] : '–'}</td>
      <td>
        {entry.movable ? (
          <Button variant="ghost" aria-expanded={moving} onClick={onToggleMove}>
            Move…
          </Button>
        ) : null}
        {entry.postponable && canPostpone ? (
          <Button
            variant="ghost"
            title="Moves this problem back in the queue, behind the next two. It stays in the program."
            onClick={onPostpone}
          >
            Postpone
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function DayDetail({
  day,
  today,
  actions,
}: {
  day: CalendarDay;
  today: string;
  actions: AppActions;
}) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moving = day.entries.find((e) => e.id === movingId && e.movable);
  return (
    <Card title={`Day ${day.dayIndex} · ${formatDate(day.date)}`}>
      <p className="muted">
        Target {formatMinutes(day.targetMinutes)}
        {day.kind === 'future'
          ? '. Future days list the reviews already scheduled plus the expected program work (estimated; an Easy day can get a third new problem). Hover or focus a day above for a projection.'
          : ` · logged ${formatMinutes(day.loggedMinutes)}`}
        {day.planDone ? (
          <>
            {' '}
            <Badge tone="good">Plan done</Badge>
          </>
        ) : null}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {day.entries.length === 0 ? (
        <p className="muted">
          {day.isConsolidation ? 'Consolidation day: no new problems, only reviews.' : 'Nothing on this day.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Problem</th>
                <th>Status</th>
                <th>Time</th>
                <th>Outcome</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {day.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  canPostpone={day.kind === 'today'}
                  moving={entry.id === movingId}
                  onToggleMove={() => setMovingId(entry.id === movingId ? null : entry.id)}
                  onPostpone={() => {
                    setError(null);
                    actions
                      .postpone(entry.id)
                      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moving ? (
        <MoveForm
          key={moving.id}
          minDate={today}
          maxDate={addDays(today, MAX_MOVE_DAYS)}
          initialDate={addDays(today, 1)}
          onMove={(date) => actions.moveReview(moving.id, date)}
          onCancel={() => setMovingId(null)}
        />
      ) : null}
    </Card>
  );
}

/** The 60-day grid is shown in two halves; days after the program (overflow) join the second one. */
const CALENDAR_SECTIONS = [
  { title: 'Days 1–30', from: -Infinity, to: 30 },
  { title: 'Days 31–60', from: 31, to: Infinity },
] as const;

export function CalendarView({ state, actions }: { state: AppState; actions: AppActions }) {
  const now = useNow(60_000);
  const today = trainingDateFromTimestamp(now);
  const days = useMemo(() => calendarDays(state, today), [state, today]);
  // One forward run gives every future cell the same forecast as its popover.
  const projections = useMemo(
    () => projectDays(state, days.filter((d) => d.kind === 'future').map((d) => d.date), today),
    [state, days, today],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startDateMessage, setStartDateMessage] = useState<StartDateMessage | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef(false);

  // After a click on a day, bring its detail into view (it sits under the 60-day grid).
  useEffect(() => {
    if (!pickedRef.current) return;
    pickedRef.current = false;
    // The day detail is the card right after the grid.
    gridRef.current?.nextElementSibling?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [selectedDate]);

  // Today is the default detail; picking another day is a single click on its cell.
  const selected =
    days.find((d) => d.date === selectedDate) ?? days.find((d) => d.kind === 'today') ?? days[0]!;
  const streak = computeStreak(state, today);
  const elapsed = days.filter((d) => d.kind !== 'future');
  const countedDays = elapsed.filter((d) => d.coreCount > 0);
  const planDoneDays = countedDays.filter((d) => d.planDone).length;
  const logged = loggedTotals(state, today);

  return (
    <div className="stack cal-page">
      <div className="cal-summary">
        <Card title="Calendar" className="cal-overview">
          <div className="stats">
            <Stat
              label="Streak"
              value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`}
              title={`Longest ${streak.longest} days. A day counts with 1+ activity done and 30+ min logged.`}
            />
            <Stat
              label="Plan done"
              value={`${planDoneDays} of ${countedDays.length} days`}
              {...(planDoneDays > 0 ? { tone: 'good' as const } : {})}
            />
            <Stat
              label="Time logged"
              value={formatMs(logged.last7DaysMs)}
              hint="last 7 days"
              title={`${formatMs(logged.allTimeMs)} logged in total`}
            />
          </div>
          <ProgramProgressCard state={state} today={today} />
          <div className="cal-fine">
            <details className="cal-details">
              <summary>How these are counted</summary>
              <ul className="cal-explain">
                <li>Streak: a day needs 1+ activity done and 30+ min logged.</li>
                <li>Plan done: finished 80%+ of the day&apos;s core plan (bonus problems do not count).</li>
                <li>Problems learned: program problems with a finished first attempt, out of the queue length.</li>
              </ul>
            </details>
            <details
              className="cal-details"
              open={startDateOpen}
              onToggle={(event) => setStartDateOpen(event.currentTarget.open)}
            >
              <summary>Change start date</summary>
              <StartDateForm
                key={state.settings.startDate}
                state={state}
                actions={actions}
                message={startDateMessage}
                setMessage={setStartDateMessage}
              />
            </details>
          </div>
        </Card>

        <LeetCodeStreakCard now={now} compact />
      </div>

      <div className="calendar-months" ref={gridRef}>
        {CALENDAR_SECTIONS.map(({ title, from, to }) => {
          const section = days.filter((d) => d.dayIndex >= from && d.dayIndex <= to);
          if (section.length === 0) return null;
          return (
            <section key={title} className="calendar-section" aria-label={title}>
              <header className="calendar-section-head">
                <h2>{title}</h2>
                <span className="muted">
                  {formatDate(section[0]!.date)} – {formatDate(section[section.length - 1]!.date)}
                </span>
              </header>
              <div className="calendar-grid">
                {section.map((day) => (
                  <DayCellWithPopover
                    key={day.date}
                    day={day}
                    selected={day.date === selected.date}
                    onSelect={() => { pickedRef.current = true; setSelectedDate(day.date); }}
                    state={state}
                    today={today}
                    projection={projections.get(day.date)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <DayDetail key={selected.date} day={selected} today={today} actions={actions} />

      <RetrospectiveCards state={state} today={today} />
    </div>
  );
}
