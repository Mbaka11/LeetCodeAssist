import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ActivityHeatmap } from './ActivityHeatmap';
import { PaceChart } from './PaceChart';
import { ResultCorrectionDialog } from '../components/ResultCorrectionDialog';
import type { AppActions } from '../lib/actions';
import { DIFFICULTIES } from '../core/activities';
import { localDateFromTimestamp, trainingDateFromTimestamp } from '../core/dates';
import {
  buildLogRows,
  filterLogRows,
  logMonths,
  logRowsToCsv,
  summarizeLogRows,
  type LogFilters,
  type LogRow,
  type LogStatus,
} from '../core/logs';
import type { ActivityType, AppState, Difficulty, Outcome } from '../core/types';
import { CATEGORY_NAMES } from '../data/neetcode150';
import { formatMinutes } from '../lib/format';
import {
  ACTIVITY_LABELS,
  OUTCOME_LABELS,
  difficultyTone,
} from '../lib/instructions';
import { problemHref } from '../lib/route';
import { useNow } from '../lib/useNow';

const TYPES = Object.keys(ACTIVITY_LABELS) as ActivityType[];
const OUTCOMES = Object.keys(OUTCOME_LABELS) as Outcome[];
const STATUS_LABELS: Record<LogStatus, string> = {
  done: 'Done',
  skipped: 'Skipped',
  postponed: 'Postponed',
  replaced: 'Replaced',
};

const STATUS_TONES: Record<LogStatus, 'good' | 'warn' | 'neutral'> = {
  done: 'good',
  skipped: 'warn',
  postponed: 'warn',
  replaced: 'neutral',
};

/** "12m", "1h20": the minutes without the long unit, for dense cells. */
const compact = (minutes: number): string => formatMinutes(minutes).replace(' min', 'm');

/** "Nov 7" for a `YYYY-MM-DD` date. */
function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

/** "November 2026" for a `YYYY-MM` month. */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

/** "+5 min", "\u22123 min" or "0 min". */
export function formatDelta(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return '0 min';
  return `${rounded > 0 ? '+' : '\u2212'}${formatMinutes(Math.abs(rounded))}`;
}

function deltaTone(minutes: number): 'good' | 'bad' | undefined {
  if (Math.round(minutes) < 0) return 'good';
  if (Math.round(minutes) > 0) return 'bad';
  return undefined;
}

function downloadCsv(rows: readonly LogRow[]): void {
  const url = URL.createObjectURL(new Blob([logRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `leetcode-assist-logs-${localDateFromTimestamp(Date.now())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function FilterBar({
  filters,
  months,
  replacedCount,
  onChange,
}: {
  filters: LogFilters;
  months: readonly string[];
  replacedCount: number;
  onChange: (filters: LogFilters) => void;
}) {
  /** Sets one filter; an empty value clears it. */
  const set = <K extends keyof LogFilters>(key: K, value: LogFilters[K] | ''): void => {
    const next = { ...filters };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value as LogFilters[K];
    onChange(next);
  };
  // `months` is newest first: "previous" is the next index.
  const monthIndex = filters.month ? months.indexOf(filters.month) : -1;
  const stepMonth = (delta: 1 | -1): void => {
    const target = months[monthIndex + delta];
    if (target) set('month', target);
  };
  return (
    <div className="log-filters">
      <label className="field log-search">
        <span>Search</span>
        <input type="search" value={filters.search ?? ''} placeholder="Title, e.g. anagram" onChange={(e) => set('search', e.target.value)} />
      </label>
      <div className="field log-month">
        <span>Month</span>
        <div className="month-stepper">
          <Button variant="ghost" aria-label="Previous month" disabled={monthIndex === -1 || monthIndex >= months.length - 1} onClick={() => stepMonth(1)}>‹</Button>
          <select aria-label="Month" value={filters.month ?? ''} onChange={(e) => set('month', e.target.value)}>
            <option value="">All time</option>
            {months.map((month) => (
              <option key={month} value={month}>{monthLabel(month)}</option>
            ))}
          </select>
          <Button variant="ghost" aria-label="Next month" disabled={monthIndex <= 0} onClick={() => stepMonth(-1)}>›</Button>
        </div>
      </div>
      <label className="field">
        <span>Type</span>
        <select value={filters.type ?? ''} onChange={(e) => set('type', e.target.value as ActivityType | '')}>
          <option value="">All</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Difficulty</span>
        <select value={filters.difficulty ?? ''} onChange={(e) => set('difficulty', e.target.value as Difficulty | '')}>
          <option value="">All</option>
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>{difficulty}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Outcome</span>
        <select value={filters.outcome ?? ''} onChange={(e) => set('outcome', e.target.value as Outcome | '')}>
          <option value="">All</option>
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>{OUTCOME_LABELS[outcome]}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Category</span>
        <select value={filters.category ?? ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All</option>
          {CATEGORY_NAMES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>From</span>
        <input type="date" value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} />
      </label>
      <label className="field">
        <span>To</span>
        <input type="date" value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} />
      </label>
      <div className="log-filter-actions">
        {replacedCount > 0 ? (
          <label className="choice" title="Reviews the app replaced when it recalculated a schedule. You did not skip them.">
            <input type="checkbox" checked={filters.showReplaced === true} onChange={(e) => set('showReplaced', e.target.checked ? true : '')} />
            Show replaced ({replacedCount})
          </label>
        ) : null}
        <Button variant="ghost" onClick={() => onChange({})} disabled={Object.keys(filters).length === 0}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function SummaryChips({ rows }: { rows: readonly LogRow[] }) {
  const summary = summarizeLogRows(rows);
  const { averageMinutes, averageBudgetMinutes, averageDeltaMinutes, soloRate } = summary;
  const tone = averageDeltaMinutes === null ? undefined : deltaTone(averageDeltaMinutes);
  return (
    <dl className="log-chips" aria-label="Summary of the rows below">
      <div className="log-chip">
        <dt>Activities</dt>
        <dd>{summary.count}{summary.count === summary.doneCount ? '' : <small className="muted"> · {summary.doneCount} done</small>}</dd>
      </div>
      <div className="log-chip">
        <dt>Total time</dt>
        <dd>{formatMinutes(summary.totalMinutes)}</dd>
      </div>
      <div className="log-chip">
        <dt>Avg vs budget</dt>
        <dd className={tone ? `tone-${tone}` : undefined}>
          {averageMinutes === null || averageBudgetMinutes === null || averageDeltaMinutes === null
            ? '–'
            : <>{compact(averageMinutes)} / {compact(averageBudgetMinutes)} <small>({formatDelta(averageDeltaMinutes)})</small></>}
        </dd>
      </div>
      <div className="log-chip">
        <dt>Solo rate</dt>
        <dd>{soloRate === null ? '–' : `${Math.round(soloRate * 100)}%`}</dd>
      </div>
    </dl>
  );
}

function LogTable({ rows, onEdit }: { rows: readonly LogRow[]; onEdit?: ((id: string) => void) | undefined }) {
  return (
    <div className="table-scroll">
      <table className="table log-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Problem</th>
            <th>Time / budget</th>
            <th>Approach</th>
            <th>Outcome</th>
            <th>Status</th>
            {onEdit ? <th><span className="visually-hidden">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.status === 'done' ? undefined : 'log-row-muted'}>
              <td title={row.completedAtMs !== undefined ? `Saved ${new Date(row.completedAtMs).toLocaleString()}` : undefined}>
                {shortDate(row.date)}
                {row.programDay >= 1 ? <small className="muted"> · D{row.programDay}</small> : null}
              </td>
              <td>
                <Badge tone={row.type}>{ACTIVITY_LABELS[row.type]}</Badge>
              </td>
              <td className="log-problem">
                <a href={problemHref(row.slug)}>{row.title}</a>{' '}
                {row.difficulty ? <Badge tone={difficultyTone(row.difficulty)}>{row.difficulty}</Badge> : null}
                {row.category ? <small className="muted log-category">{row.category}</small> : null}
              </td>
              <td>
                {row.loggedMinutes === undefined ? '–' : (
                  <>
                    {compact(row.loggedMinutes)} <span className="muted">/ {compact(row.budgetMinutes)}</span>
                    {row.deltaMinutes !== undefined && Math.round(row.deltaMinutes) !== 0 ? (
                      <small className={`tone-${deltaTone(row.deltaMinutes) ?? 'neutral'}`}> {formatDelta(row.deltaMinutes)}</small>
                    ) : null}
                  </>
                )}
              </td>
              <td>{row.approachMinutes === undefined ? '–' : compact(row.approachMinutes)}</td>
              <td>
                {row.outcome ? OUTCOME_LABELS[row.outcome] : '–'}
                {row.hintsUsed > 0 ? <small className="muted"> · {row.hintsUsed} {row.hintsUsed === 1 ? 'hint' : 'hints'}</small> : null}
              </td>
              <td>
                {row.status === 'done' ? <span className="muted">Done</span> : <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>}
              </td>
              {onEdit ? <td>{row.status === 'done' ? <Button variant="ghost" aria-label={`Correct ${row.title} result on ${row.date}`}
                onClick={() => onEdit(row.id)}>Correct…</Button> : null}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogsView({ state, actions }: { state: AppState; actions?: AppActions }) {
  const today = trainingDateFromTimestamp(useNow(30_000));
  const [filters, setFilters] = useState<LogFilters>({});
  const [editing, setEditing] = useState<string | null>(null);
  const selected = state.activities.find((a) => a.id === editing && a.status === 'done');
  const allRows = useMemo(() => buildLogRows(state), [state]);
  const rows = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);
  const months = useMemo(() => logMonths(allRows), [allRows]);
  const replacedCount = useMemo(() => allRows.filter((row) => row.status === 'replaced').length, [allRows]);

  return (
    <div className="stack logs-page">
      <Card
        title="Logs"
        className="logs-toolbar"
        actions={
          <Button onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
            Export CSV ({rows.length})
          </Button>
        }
      >
        <SummaryChips rows={rows} />
        <FilterBar filters={filters} months={months} replacedCount={replacedCount} onChange={setFilters} />
      </Card>
      <Card className="logs-table-card">
        {allRows.length === 0 ? (
          <p className="muted">Nothing logged yet. Completed and skipped activities show up here.</p>
        ) : rows.length === 0 ? (
          <p className="muted">No activity matches these filters.</p>
        ) : (
          <LogTable rows={rows} onEdit={actions ? setEditing : undefined} />
        )}
        <p className="muted log-note">
          Newest first. Budgets are the current ones from Settings, so older rows are compared with today&apos;s budgets.
          Replaced reviews are old scheduled reviews the app retired when it recalculated a schedule; they are hidden by default.
        </p>
      </Card>
      <details className="logs-extra">
        <summary>Activity minutes</summary>
        <ActivityHeatmap state={state} today={today} />
      </details>
      <details className="logs-extra">
        <summary>Pace by month</summary>
        <PaceChart state={state} />
      </details>
      {selected && actions ? <ResultCorrectionDialog key={selected.id} state={state} activity={selected}
        actions={actions} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
