import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Stat } from '../components/Stat';
import { calendarDays, type CalendarDay, type CalendarEntry, type EntryState } from '../core/calendar';
import { localDateFromTimestamp } from '../core/dates';
import { computeStreak } from '../core/state';
import type { AppState } from '../core/types';
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

function StartDateForm({ state, actions }: { state: AppState; actions: AppActions }) {
  const [value, setValue] = useState(state.settings.startDate);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
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

function DayCell({ day, selected, onSelect }: { day: CalendarDay; selected: boolean; onSelect: () => void }) {
  const classes = ['cal-day', `cal-${day.kind}`];
  if (selected) classes.push('selected');
  if (day.goalMet) classes.push('goal-met');
  return (
    <button type="button" className={classes.join(' ')} aria-pressed={selected} onClick={onSelect}>
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
      {day.streakQualified || day.goalMet ? (
        <span className="cal-badges">
          {day.streakQualified ? <Badge tone="good">Streak day</Badge> : null}
          {day.goalMet ? <Badge tone="good">Goal met</Badge> : null}
        </span>
      ) : null}
    </button>
  );
}

function EntryRow({ entry }: { entry: CalendarEntry }) {
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
    </tr>
  );
}

function DayDetail({ day }: { day: CalendarDay }) {
  return (
    <Card title={`Day ${day.dayIndex} · ${formatDate(day.date)}`}>
      <p className="muted">
        Target {formatMinutes(day.targetMinutes)}
        {day.kind === 'future'
          ? '. Future days list the reviews already scheduled plus the expected program work (estimated).'
          : ` · logged ${formatMinutes(day.loggedMinutes)}`}
      </p>
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
            </tr>
          </thead>
          <tbody>
            {day.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function CalendarView({ state, actions }: { state: AppState; actions: AppActions }) {
  const now = useNow(60_000);
  const today = localDateFromTimestamp(now);
  const days = useMemo(() => calendarDays(state, today), [state, today]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
        <StartDateForm key={state.settings.startDate} state={state} actions={actions} />
      </Card>

      <div className="calendar-grid">
        {days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            selected={day.date === selected.date}
            onSelect={() => setSelectedDate(day.date)}
          />
        ))}
      </div>

      <DayDetail day={selected} />
    </div>
  );
}
