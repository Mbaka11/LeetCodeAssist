import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Stat } from '../components/Stat';
import { DIFFICULTIES } from '../core/activities';
import { localDateFromTimestamp } from '../core/dates';
import {
  buildLogRows,
  filterLogRows,
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

const TYPES = Object.keys(ACTIVITY_LABELS) as ActivityType[];
const OUTCOMES = Object.keys(OUTCOME_LABELS) as Outcome[];
const STATUS_LABELS: Record<LogStatus, string> = {
  done: 'Done',
  skipped: 'Skipped',
  postponed: 'Postponed',
};

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
  onChange,
}: {
  filters: LogFilters;
  onChange: (filters: LogFilters) => void;
}) {
  /** Sets one filter; an empty value clears it. */
  const set = <K extends keyof LogFilters>(key: K, value: LogFilters[K] | ''): void => {
    const next = { ...filters };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value as LogFilters[K];
    onChange(next);
  };
  return (
    <div className="row log-filters">
      <label className="field">
        <span>Search title</span>
        <input
          type="search"
          value={filters.search ?? ''}
          placeholder="e.g. anagram"
          onChange={(e) => set('search', e.target.value)}
        />
      </label>
      <label className="field">
        <span>Type</span>
        <select value={filters.type ?? ''} onChange={(e) => set('type', e.target.value as ActivityType | '')}>
          <option value="">All</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {ACTIVITY_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Difficulty</span>
        <select
          value={filters.difficulty ?? ''}
          onChange={(e) => set('difficulty', e.target.value as Difficulty | '')}
        >
          <option value="">All</option>
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Outcome</span>
        <select value={filters.outcome ?? ''} onChange={(e) => set('outcome', e.target.value as Outcome | '')}>
          <option value="">All</option>
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {OUTCOME_LABELS[outcome]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Category</span>
        <select value={filters.category ?? ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All</option>
          {CATEGORY_NAMES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
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
      <Button variant="ghost" onClick={() => onChange({})} disabled={Object.keys(filters).length === 0}>
        Clear filters
      </Button>
    </div>
  );
}

function SummaryRow({ rows }: { rows: readonly LogRow[] }) {
  const summary = summarizeLogRows(rows);
  const { averageMinutes, averageBudgetMinutes, averageDeltaMinutes, soloRate } = summary;
  return (
    <div className="stats">
      <Stat
        label="Activities"
        value={summary.count}
        hint={summary.count === summary.doneCount ? undefined : `${summary.doneCount} done`}
      />
      <Stat label="Total time" value={formatMinutes(summary.totalMinutes)} />
      <Stat
        label="Average vs budget"
        value={
          averageMinutes === null || averageBudgetMinutes === null || averageDeltaMinutes === null
            ? '–'
            : `${formatMinutes(averageMinutes)} / ${formatMinutes(averageBudgetMinutes)}`
        }
        hint={averageDeltaMinutes === null ? undefined : `${formatDelta(averageDeltaMinutes)} per activity`}
        {...(averageDeltaMinutes !== null && deltaTone(averageDeltaMinutes)
          ? { tone: deltaTone(averageDeltaMinutes)! }
          : {})}
      />
      <Stat label="Solo rate" value={soloRate === null ? '–' : `${Math.round(soloRate * 100)}%`} />
    </div>
  );
}

function LogTable({ rows }: { rows: readonly LogRow[] }) {
  return (
    <div className="table-scroll">
      <table className="table log-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Type</th>
            <th>Problem</th>
            <th>Category</th>
            <th>Time</th>
            <th>Approach</th>
            <th>Budget</th>
            <th>vs budget</th>
            <th>Outcome</th>
            <th>Hints</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.programDay >= 1 ? row.programDay : '–'}</td>
              <td>
                <Badge tone={row.type}>{ACTIVITY_LABELS[row.type]}</Badge>
              </td>
              <td>
                <a href={problemHref(row.slug)}>{row.title}</a>{' '}
                {row.difficulty ? <Badge tone={difficultyTone(row.difficulty)}>{row.difficulty}</Badge> : null}
              </td>
              <td>{row.category ?? '–'}</td>
              <td>{row.loggedMinutes === undefined ? '–' : formatMinutes(row.loggedMinutes)}</td>
              <td>{row.approachMinutes === undefined ? '–' : formatMinutes(row.approachMinutes)}</td>
              <td>{formatMinutes(row.budgetMinutes)}</td>
              <td className={row.deltaMinutes === undefined ? undefined : `tone-${deltaTone(row.deltaMinutes) ?? 'neutral'}`}>
                {row.deltaMinutes === undefined ? '–' : formatDelta(row.deltaMinutes)}
              </td>
              <td>{row.outcome ? OUTCOME_LABELS[row.outcome] : '–'}</td>
              <td>{row.hintsUsed > 0 ? row.hintsUsed : '–'}</td>
              <td>
                <Badge tone={row.status === 'done' ? 'good' : 'warn'}>{STATUS_LABELS[row.status]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogsView({ state }: { state: AppState }) {
  const [filters, setFilters] = useState<LogFilters>({});
  const allRows = useMemo(() => buildLogRows(state), [state]);
  const rows = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);

  return (
    <div className="stack">
      <Card
        title="Logs"
        actions={
          <Button onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
            Export CSV ({rows.length})
          </Button>
        }
      >
        <p className="muted">
          Every completed or skipped activity, newest first. Budgets are the current ones from Settings, so
          the comparison uses today&apos;s budgets for older rows too.
        </p>
        <FilterBar filters={filters} onChange={setFilters} />
      </Card>
      <Card>
        <SummaryRow rows={rows} />
      </Card>
      <Card>
        {allRows.length === 0 ? (
          <p className="muted">Nothing logged yet. Completed and skipped activities show up here.</p>
        ) : rows.length === 0 ? (
          <p className="muted">No activity matches these filters.</p>
        ) : (
          <LogTable rows={rows} />
        )}
      </Card>
    </div>
  );
}
