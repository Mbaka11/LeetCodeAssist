import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Stat } from '../components/Stat';
import { addDays, isValidDateString, localDateFromTimestamp } from '../core/dates';
import type { AppState } from '../core/types';
import { weeklySummary } from '../core/weekly';
import { getProblem } from '../data/neetcode150';
import { formatMs } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { useNow } from '../lib/useNow';

export function WeeklyView({ state }: { state: AppState }) {
  const today = localDateFromTimestamp(useNow(30_000));
  const [chosenEnd, setChosenEnd] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const end = chosenEnd ?? today;
  const summary = useMemo(() => weeklySummary(state, end), [state, end]);
  const { current, previous } = summary;
  const select = (date: string | null): void => { setChosenEnd(date); setShowAll(false); };
  const fragile = showAll ? summary.fragile : summary.fragile.slice(0, 10);
  return <div className="stack">
    <Card title="Weekly review">
      <p><strong>{current.from} – {current.to}</strong> · compared with {previous.from} – {previous.to}</p>
      <div className="row">
        <Button onClick={() => select(addDays(end, -7))}>Previous 7 days</Button>
        <Button disabled={end >= today} onClick={() => select(addDays(end, 7) > today ? null : addDays(end, 7))}>Next 7 days</Button>
        <Button variant="ghost" disabled={chosenEnd === null} onClick={() => select(null)}>Latest 7 days</Button>
        <label className="field inline"><span>Period ending</span><input type="date" value={end} max={today}
          onChange={(e) => { if (isValidDateString(e.target.value) && e.target.value <= today) select(e.target.value); }} /></label>
      </div>
      <p className="muted">Read-only insights from your app history. No program, review date or budget is changed.
        Small samples and different problem difficulties limit comparisons.</p>
    </Card>
    <Card><div className="stats">
      <Stat label="Distinct problems worked" value={current.distinct} hint={`previous ${previous.distinct}`} />
      <Stat label="First worked in this period" value={current.firstWorked} hint={`previous ${previous.firstWorked}`} />
      <Stat label="Completed activities" value={current.attempts} hint={`previous ${previous.attempts}; includes extra practice`} />
      <Stat label="Time logged" value={formatMs(current.totalMs)} hint={`previous ${formatMs(previous.totalMs)}`} />
    </div></Card>
    <Card title="Category evidence">
      <p className="muted">Progress is shown as first-worked problems and distinct problems with an independent scheduled
        review (Solo with no recorded hints). Immediate extra repeats do not inflate that review count. Help means
        a Hint/Solution outcome or a recorded hint; rates use rated attempts, not guesses about external help.</p>
      {summary.categories.length === 0 ? <p>No completed activities in either period.</p> : <div className="table-scroll"><table className="table">
        <thead><tr><th>Category</th><th>Activities</th><th>First worked</th><th>Independent review problems</th><th>Help / rated attempts</th></tr></thead>
        <tbody>{summary.categories.map((c) => <tr key={c.category}>
          <td>{c.category}</td><td>{c.attempts}</td><td>{c.firstWorked}</td>
          <td>{c.independentReviewProblems} · previous {c.previousIndependentReviewProblems}
            {c.independentReviewProblems > c.previousIndependentReviewProblems ? ' · increased' : ''}</td>
          <td>{c.rated === 0 ? 'No rated attempts' : `${c.helped}/${c.rated} (${Math.round(c.helped / c.rated * 100)}%)`}</td>
        </tr>)}</tbody>
      </table></div>}
    </Card>
    <Card title={`Still fragile · ${summary.fragile.length}`}>
      <p className="muted">As of {end}: the latest rated scheduled review needed help or was Stuck; if none exists, initial
        completion evidence is used. An optional immediate re-solve does not erase that signal. Absence from this
        list is not proof of mastery; missing outcomes cannot establish success.</p>
      {fragile.length === 0 ? <p>No help-dependent or failed eligible attempts recorded.</p> : <ul className="weekly-fragile">
        {fragile.map(({ slug, evidence, reason }) => <li key={slug}>
          <a href={problemHref(slug)}>{getProblem(slug)?.title ?? slug}</a>
          {' '}<Badge tone={evidence.type}>{ACTIVITY_LABELS[evidence.type]}</Badge>
          <p className="muted">{reason} · {evidence.completedAt} · {evidence.outcome ? OUTCOME_LABELS[evidence.outcome] : 'No outcome recorded'}</p>
        </li>)}
      </ul>}
      {!showAll && summary.fragile.length > 10 ? <Button onClick={() => setShowAll(true)}>Show all {summary.fragile.length} fragile problems</Button> : null}
    </Card>
  </div>;
}
