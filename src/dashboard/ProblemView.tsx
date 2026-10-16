import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NotesForm } from '../components/NotesForm';
import { localDateFromTimestamp } from '../core/dates';
import { attemptHistory, isNotesLocked, nextReview } from '../core/problemSheet';
import { getProblemStatus } from '../core/state';
import { formatElapsed } from '../core/timer';
import type { AppState } from '../core/types';
import { getProblem, problemUrl } from '../data/neetcode150';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { formatDate, formatMs } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS, STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { useNow } from '../lib/useNow';

export function ProblemView({
  slug,
  state,
  actions,
}: {
  slug: string;
  state: AppState;
  actions: AppActions;
}) {
  const now = useNow(30_000);
  const today = localDateFromTimestamp(now);
  const [revealed, setRevealed] = useState(false);
  const problem = getProblem(slug);

  if (!problem) {
    return (
      <Card title="Problem not found">
        <p className="muted">“{slug}” is not in the NeetCode 150 list.</p>
        <a href="#/roadmap">Back to the roadmap</a>
      </Card>
    );
  }

  const status = getProblemStatus(state, slug);
  const review = nextReview(state, slug, today);
  const history = attemptHistory(state, slug);
  const locked = isNotesLocked(state, slug, today);
  const inBenchmark = BENCHMARKS.some((b) => b.easy === slug || b.medium === slug);
  const note = state.notes[slug];

  return (
    <div className="stack">
      <div className="day-header">
        <h1>{problem.title}</h1>
        <Badge tone={difficultyTone(problem.difficulty)}>
          {problem.difficulty}
        </Badge>
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
        {PROGRAM_QUEUE.includes(slug) ? <Badge>30-day program</Badge> : null}
        {inBenchmark ? <Badge tone="benchmark">Benchmark</Badge> : null}
      </div>

      <Card>
        <dl className="meta">
          <dt>Category</dt>
          <dd>{problem.category}</dd>
          <dt>NeetCode order</dt>
          <dd>#{problem.neetcodeOrder}</dd>
          <dt>Next review</dt>
          <dd>
            {review
              ? `${ACTIVITY_LABELS[review.type]} on ${formatDate(review.dueDate)}${review.dueDate < today ? ' (overdue)' : ''}`
              : 'None scheduled'}
          </dd>
          <dt>Link</dt>
          <dd>
            <a href={problem.url || problemUrl(slug)} target="_blank" rel="noreferrer">
              Open on LeetCode ↗
            </a>
          </dd>
        </dl>
        <label className="choice">
          <input
            type="checkbox"
            checked={state.checked[slug] === true}
            onChange={() => void actions.toggleChecked(slug)}
          />
          I have already solved this problem
        </label>
      </Card>

      <Card title="Notes">
        {locked && !revealed ? (
          <div className="locked">
            <p>
              A review of this problem is in progress or due today, so your notes are hidden. Try to
              recall them first.
            </p>
            <Button variant="primary" onClick={() => setRevealed(true)}>
              Reveal notes
            </Button>
          </div>
        ) : (
          <NotesForm note={note} onSave={(fields) => actions.saveNote(slug, fields)} />
        )}
      </Card>

      <Card title="Attempt history">
        {history.length === 0 ? (
          <p className="muted">No completed attempts yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Approach found</th>
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
                  <td>{a.outcome ? OUTCOME_LABELS[a.outcome] : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
