import { FavoriteButton } from '../components/FavoriteButton';
import { useState } from 'react';
import { AttemptHistory } from '../components/AttemptHistory';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HintsSection } from '../components/HintsSection';
import { LeetCodeLink } from '../components/LeetCodeLink';
import { NotesForm } from '../components/NotesForm';
import { ProblemMetadataSection } from '../components/ProblemMetadata';
import { localDateFromTimestamp } from '../core/dates';
import { attemptHistory, isNotesLocked, nextReview, openActivityToday } from '../core/problemSheet';
import { programQueue, queuePosition } from '../core/queue';
import { getProblemStatus } from '../core/state';
import type { AppState } from '../core/types';
import { getProblem, problemUrl } from '../data/neetcode150';
import { isBonusProblem } from '../data/bonus';
import { BENCHMARKS } from '../data/program';
import type { AppActions } from '../lib/actions';
import { formatDate } from '../lib/format';
import { ACTIVITY_LABELS, STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
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
  const position = queuePosition(state, slug);
  const openActivity = openActivityToday(state, slug, today);

  return (
    <div className="stack">
      <div className="day-header">
        <h1>{problem.title}</h1>
        <FavoriteButton slug={slug} title={problem.title} state={state} actions={actions} />
        <Badge tone={difficultyTone(problem.difficulty)}>
          {problem.difficulty}
        </Badge>
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
        {position !== null ? <Badge>30-day program</Badge> : null}
        {inBenchmark ? <Badge tone="benchmark">Benchmark</Badge> : null}
        {isBonusProblem(slug) ? <Badge tone="warn">Bonus</Badge> : null}
      </div>

      <Card>
        <dl className="meta">
          <dt>Category</dt>
          <dd>{problem.category}</dd>
          <dt>NeetCode order</dt>
          <dd>#{problem.neetcodeOrder}</dd>
          <dt>Program position</dt>
          <dd>
            {position !== null
              ? `${position} of ${programQueue(state).length}`
              : isBonusProblem(slug)
                ? 'Bonus problem (not in the 30-day program)'
                : 'Not in the 30-day program'}
          </dd>
          <dt>Next review</dt>
          <dd>
            {review
              ? `${ACTIVITY_LABELS[review.type]} on ${formatDate(review.dueDate)}${review.dueDate < today ? ' (overdue)' : ''}`
              : 'None scheduled'}
          </dd>
          <dt>Link</dt>
          <dd>
            <LeetCodeLink href={problem.url || problemUrl(slug)} className="" openPanel>
              Open on LeetCode ↗
            </LeetCodeLink>
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

      <ProblemMetadataSection key={`${slug}-${locked}`} slug={slug} state={state} protectedReview={locked} />

      <HintsSection slug={slug} activity={openActivity} actions={actions} />

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
        <AttemptHistory history={history} />
      </Card>
    </div>
  );
}
