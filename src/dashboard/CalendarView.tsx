import { useId, useMemo, useState, type KeyboardEvent } from 'react';
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
import { addDays, localDateFromTimestamp } from '../core/dates';
import { projectDay } from '../core/projection';
import { computeStreak } from '../core/state';
import type { ActivityType, AppState } from '../core/types';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { formatDate, formatMinutes } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { useNow } from '../lib/useNow';

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
        Change start date
      </Button>
      {message ? <span className={message.ok ? 'tone-good' : 'error'}>{message.text}</span> : null}
    </form>
  );
}

function DayCell({
  day,
  selected,
  onSelect,
  describedBy,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: () => void;
  describedBy: string | undefined;
}) {
  const classes = ['cal-day', `cal-${day.kind}`];
  if (selected) classes.push('selected');
  if (day.goalMet) classes.push('goal-met');
  const future = day.kind === 'future';
  const barMinutes = future ? day.plannedMinutes : day.loggedMinutes;
  const barPercent =
    day.targetMinutes > 0 ? Math.min(100, Math.round((barMinutes / day.targetMinutes) * 100)) : 0;
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={selected}
      onClick={onSelect}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
    >
      <span className="cal-head">
        <strong>Day {day.dayIndex}</strong>
        <span className="muted">{formatDate(day.date)}</span>
      </span>
      <span className="cal-badges">
        {day.kind === 'today' ? <Badge tone="new">Today</Badge> : null}
        {day.isConsolidation ? <Badge tone="resolve">Consolidation</Badge> : null}
        {day.isBenchmark ? <Badge tone="benchmark">Benchmark</Badge> : null}
        {day.overflow ? <Badge>After day 30</Badge> : null}
      </span>
      <span className="cal-counts">
        planned {day.plannedCount} · done {day.doneCount}
        {day.carriedCount > 0 ? ` · carried ${day.carriedCount}` : ''}
      </span>
      <span className="muted">
        {day.kind === 'future'
          ? `~${formatMinutes(day.plannedMinutes)} planned`
          : `${formatMinutes(day.loggedMinutes)} logged of ~${formatMinutes(day.plannedMinutes)}`}
      </span>
      <span className={`cal-bar${future ? ' cal-bar-planned' : ''}`} aria-hidden="true">
        <span className="cal-bar-fill" style={{ width: `${barPercent}%` }} />
      </span>
      {day.streakQualified || day.goalMet ? (
        <span className="cal-badges">
          {day.streakQualified ? <Badge tone="good">Streak day</Badge> : null}
          {day.goalMet ? <Badge tone="good">Goal met</Badge> : null}
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
}

function titleOfSlug(slug: string | undefined): string {
  return slug ? (getProblem(slug)?.title ?? slug) : 'Next problem from the queue';
}

/** The activities of a day for the popover: real entries for past and current days. */
export function entryRows(day: CalendarDay): PopoverRow[] {
  return day.entries.map((entry) => ({
    key: entry.id,
    type: entry.type,
    title: titleOfSlug(entry.slug),
    minutes: entry.minutes,
    status: ENTRY_LABELS[entry.state],
    ...(entry.loggedMinutes !== undefined ? { loggedMinutes: entry.loggedMinutes } : {}),
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

function DayPopover({ id, day, state, today }: { id: string; day: CalendarDay; state: AppState; today: string }) {
  const projection = useMemo(
    () => (day.kind === 'future' ? projectDay(state, day.date, today) : null),
    [day.kind, day.date, state, today],
  );
  return (
    <div id={id} role="tooltip" className="cal-popover">
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
    </div>
  );
}

/** A day cell with a popover that opens on hover and keyboard focus and closes with Escape. */
function DayCellWithPopover({
  day,
  selected,
  onSelect,
  state,
  today,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: () => void;
  state: AppState;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  return (
    <div
      className="cal-cell"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <DayCell
        day={day}
        selected={selected}
        onSelect={onSelect}
        describedBy={open ? popoverId : undefined}
      />
      {open ? <DayPopover id={popoverId} day={day} state={state} today={today} /> : null}
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
          hint="program problems with a finished first attempt"
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
          hint={progress.daysElapsed === 0 ? 'the program has not started yet' : 'including today'}
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
      </td>
      <td>
        <Badge tone={ENTRY_TONES[entry.state]}>{ENTRY_LABELS[entry.state]}</Badge>
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
          ? '. Future days list the reviews already scheduled plus the expected program work (estimated). Hover or focus a day above for a projection.'
          : ` · logged ${formatMinutes(day.loggedMinutes)}`}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {day.entries.length === 0 ? (
        <p className="muted">
          {day.isConsolidation ? 'Consolidation day: no new problems, only reviews.' : 'Nothing on this day.'}
        </p>
      ) : (
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
      )}
      {moving ? (
        <MoveForm
          key={moving.id}
          minDate={today}
          initialDate={addDays(today, 1)}
          onMove={(date) => actions.moveReview(moving.id, date)}
          onCancel={() => setMovingId(null)}
        />
      ) : null}
    </Card>
  );
}

export function CalendarView({ state, actions }: { state: AppState; actions: AppActions }) {
  const now = useNow(60_000);
  const today = localDateFromTimestamp(now);
  const days = useMemo(() => calendarDays(state, today), [state, today]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startDateMessage, setStartDateMessage] = useState<StartDateMessage | null>(null);

  const selected =
    days.find((d) => d.date === selectedDate) ?? days.find((d) => d.kind === 'today') ?? days[0]!;
  const streak = computeStreak(state, today);
  const elapsed = days.filter((d) => d.kind !== 'future');
  const goalDays = elapsed.filter((d) => d.goalMet).length;

  return (
    <div className="stack">
      <Card title="Calendar">
        <div className="stats">
          <Stat
            label="Streak"
            value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`}
            hint={`longest ${streak.longest} · a day needs 1+ activity and 30+ min logged`}
          />
          <Stat
            label="Daily goal met"
            value={`${goalDays} of ${elapsed.length} days`}
            hint="logged time reached the day's target (the daily target; 90 min on consolidation days)"
            {...(goalDays > 0 ? { tone: 'good' as const } : {})}
          />
        </div>
        <ProgramProgressCard state={state} today={today} />
        <StartDateForm
          key={state.settings.startDate}
          state={state}
          actions={actions}
          message={startDateMessage}
          setMessage={setStartDateMessage}
        />
      </Card>

      <div className="calendar-grid">
        {days.map((day) => (
          <DayCellWithPopover
            key={day.date}
            day={day}
            selected={day.date === selected.date}
            onSelect={() => setSelectedDate(day.date)}
            state={state}
            today={today}
          />
        ))}
      </div>

      <DayDetail key={selected.date} day={selected} today={today} actions={actions} />
    </div>
  );
}
