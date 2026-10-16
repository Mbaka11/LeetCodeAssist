import { formatElapsed } from '../core/timer';
import type { Activity } from '../core/types';
import { formatDate, formatMs } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';

export function hintsLabel(hintsUsed: number | undefined): string {
  return hintsUsed === undefined || hintsUsed === 0
    ? 'none'
    : `${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'}`;
}

/** Completed attempts, most recent first (table in the dashboard, list in the side panel). */
export function AttemptHistory({ history, compact = false }: { history: readonly Activity[]; compact?: boolean }) {
  if (history.length === 0) return <p className="muted">No completed attempts yet.</p>;
  if (compact) {
    return (
      <ul className="attempt-list">
        {history.map((a) => (
          <li key={a.id}>
            <strong>{formatDate(a.completedAt!)}</strong> · {ACTIVITY_LABELS[a.type]} ·{' '}
            {a.outcome ? OUTCOME_LABELS[a.outcome] : '–'} · {formatMs(a.totalMs ?? 0)}
            {a.approachMs !== undefined ? ` · approach ${formatElapsed(a.approachMs)}` : ''}
            {a.hintsUsed ? ` · ${hintsLabel(a.hintsUsed)}` : ''}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Duration</th>
          <th>Approach found</th>
          <th>Hints used</th>
          <th>Outcome</th>
        </tr>
      </thead>
      <tbody>
        {history.map((a) => (
          <tr key={a.id}>
            <td>{formatDate(a.completedAt!)}</td>
            <td>{ACTIVITY_LABELS[a.type]}</td>
            <td>{formatMs(a.totalMs ?? 0)}</td>
            <td>{a.approachMs !== undefined ? formatElapsed(a.approachMs) : '–'}</td>
            <td>{hintsLabel(a.hintsUsed)}</td>
            <td>{a.outcome ? OUTCOME_LABELS[a.outcome] : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
