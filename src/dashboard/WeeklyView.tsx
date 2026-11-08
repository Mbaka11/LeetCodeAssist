import { Explain } from '../components/Explain';
import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { addDays, isValidDateString, trainingDateFromTimestamp } from '../core/dates';
import type { AppState } from '../core/types';
import { weeklySummary } from '../core/weekly';
import { getProblem } from '../data/neetcode150';
import { formatMs } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { useNow } from '../lib/useNow';
import { CategoryBars, DailyMinutesChart, OutcomeMix } from './WeeklyCharts';

export function WeeklyView({ state }: { state: AppState }) {
  const today = trainingDateFromTimestamp(useNow(30_000));
  const [chosenEnd, setChosenEnd] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const end = chosenEnd ?? today;
  const summary = useMemo(() => weeklySummary(state, end), [state, end]);
  const { current, previous } = summary;
  const select = (date: string | null): void => { setChosenEnd(date); setShowAll(false); };
  const fragile = showAll ? summary.fragile : summary.fragile.slice(0, 10);
  const kpis = [
    { label: 'Distinct problems', now: current.distinct, before: previous.distinct, text: String(current.distinct) },
    { label: 'First worked', now: current.firstWorked, before: previous.firstWorked, text: String(current.firstWorked) },
    { label: 'Activities', now: current.attempts, before: previous.attempts, text: String(current.attempts) },
    { label: 'Time logged', now: current.totalMs, before: previous.totalMs, text: formatMs(current.totalMs) },
  ];
  return <div className="stack weekly-page">
    <Card title="Weekly review">
      <div className="weekly-head">
        <p><strong>{current.from} – {current.to}</strong> <span className="muted">· compared with {previous.from} – {previous.to}</span></p>
        <div className="row">
          <div className="segmented" role="group" aria-label="Choose the week">
            <Button onClick={() => select(addDays(end, -7))}>Previous 7 days</Button>
            <Button disabled={end >= today} onClick={() => select(addDays(end, 7) > today ? null : addDays(end, 7))}>Next 7 days</Button>
            <Button disabled={chosenEnd === null} onClick={() => select(null)}>Latest 7 days</Button>
          </div>
          <label className="field inline"><span>Period ending</span><input type="date" value={end} max={today}
            onChange={(e) => { if (isValidDateString(e.target.value) && e.target.value <= today) select(e.target.value); }} /></label>
        </div>
      </div>
      <div className="wk-kpis">
        {kpis.map((k) => {
          const diff = k.now - k.before;
          const text = k.label === 'Time logged' ? formatMs(Math.abs(diff)) : String(Math.abs(diff));
          return <div key={k.label} className="wk-kpi">
            <span className="wk-kpi-label">{k.label}</span>
            <span className="wk-kpi-value">{k.text}</span>
            <span className={`wk-kpi-delta ${diff > 0 ? 'tone-good' : 'muted'}`}>
              {diff === 0 ? '= same as previous' : `${diff > 0 ? '▲ +' : '▼ −'}${text} vs previous`}
            </span>
          </div>;
        })}
      </div>
      <p className="muted">Read-only insights from your app history. No program, review date or budget is changed.
        Small samples and different problem difficulties limit comparisons.</p>
    </Card>
    <div className="wk-grid-2">
      <Card title="Minutes per day"><DailyMinutesChart days={summary.days} /></Card>
      <Card title="How activities ended">
        <OutcomeMix current={summary.outcomes.current} previous={summary.outcomes.previous} />
      </Card>
    </div>
    <Card title="Category evidence">
      <Explain><p>Progress is shown as first-worked problems and distinct problems with an independent scheduled
        review (Solo with no recorded hints). Immediate extra repeats do not inflate that review count. Help means
        a Hint/Solution outcome or a recorded hint; rates use rated attempts, not guesses about external help.
        The amber part of a bar is the share of activities that needed help.</p></Explain>
      {summary.categories.length === 0 ? <p>No completed activities in either period.</p> : <CategoryBars categories={summary.categories} />}
    </Card>
    <Card title={`Still fragile · ${summary.fragile.length}`}>
      <Explain><p>As of {end}: the latest rated scheduled review needed help or was Stuck; if none exists, initial
        completion evidence is used. An optional immediate re-solve does not erase that signal. Absence from this
        list is not proof of mastery; missing outcomes cannot establish success.</p></Explain>
      {fragile.length === 0 ? <p>No help-dependent or failed eligible attempts recorded.</p> : <ul className="weekly-fragile">
        {fragile.map(({ slug, evidence, reason }) => <li key={slug}>
          <a href={problemHref(slug)}>{getProblem(slug)?.title ?? slug}</a>
          {' '}<Badge tone={evidence.type}>{ACTIVITY_LABELS[evidence.type]}</Badge>
          <span className="muted"> {reason} · {evidence.completedAt} · {evidence.outcome ? OUTCOME_LABELS[evidence.outcome] : 'No outcome recorded'}</span>
        </li>)}
      </ul>}
      {!showAll && summary.fragile.length > 10 ? <Button onClick={() => setShowAll(true)}>Show all {summary.fragile.length} fragile problems</Button> : null}
    </Card>
  </div>;
}
