import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import { visibleRetrospectives, type BenchmarkResult, type Retrospective } from '../core/retrospective';
import type { AppState, Outcome } from '../core/types';
import { getProblem } from '../data/neetcode150';
import { formatDate, formatMinutes } from '../lib/format';
import { ACTIVITY_LABELS, OUTCOME_LABELS } from '../lib/instructions';

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–';
}

function title(slug: string): string {
  return getProblem(slug)?.title ?? slug;
}

const OUTCOME_TONE: Record<Outcome, 'good' | 'warn' | 'bad'> = { solo: 'good', hint: 'warn', solution: 'bad', stuck: 'bad' };

function Result({ result }: { result: BenchmarkResult }) {
  if (!result.done) return <span className="muted">not taken</span>;
  return (
    <span>
      {result.outcome ? <Badge tone={OUTCOME_TONE[result.outcome]}>{OUTCOME_LABELS[result.outcome]}</Badge> : null}
      {result.minutes !== undefined ? ` ${formatMinutes(result.minutes)}` : ''}
    </span>
  );
}

function LockedRetrospective({ r }: { r: Retrospective }) {
  return (
    <Card title={`${r.phase.label} retrospective`} className="retrospective">
      <p className="muted">
        Opens on {formatDate(r.endDate)} (day {r.phase.toDay}). It will summarise what you learned, how the reviews went, your
        weakest categories and the benchmark pairs. Nothing is scheduled or changed by it.
      </p>
    </Card>
  );
}

function ReachedRetrospective({ r }: { r: Retrospective }) {
  const planTone = r.days.planDays > 0 && r.days.planDone / r.days.planDays >= 0.8 ? ('good' as const) : undefined;
  return (
    <Card title={`${r.phase.label} retrospective`} className="retrospective">
      <p className="muted">
        Days {r.phase.fromDay}–{r.phase.toDay} ({formatDate(r.startDate)} – {formatDate(r.endDate)}). Read-only: built from your
        logs, never scheduled or changed.
      </p>
      <div className="stats">
        <Stat
          label="Problems learned"
          value={`${r.learned.count} of ${r.learned.total}`}
          hint={`${r.learned.solo} solved solo the first time`}
          {...(r.learned.count >= r.learned.total ? { tone: 'good' as const } : {})}
        />
        <Stat label="Days practised" value={`${r.days.active} of ${r.days.elapsed}`} hint={`${r.days.streak} streak days`} />
        <Stat
          label="Plan done"
          value={`${r.days.planDone} of ${r.days.planDays} days`}
          {...(planTone ? { tone: planTone } : {})}
        />
        <Stat label="Time logged" value={formatMinutes(r.loggedMinutes)} hint="all finished activities" />
      </div>
      <ProgressBar value={r.learned.count} max={r.learned.total} done={r.learned.count >= r.learned.total} />

      {r.reviews.length > 0 ? (
        <div className="table-scroll">
          <table className="table">
            <caption className="muted">Reviews by type (solo = finished without a hint or the solution)</caption>
            <thead>
              <tr>
                <th>Type</th>
                <th>Done</th>
                <th>Solo</th>
                <th>Median time</th>
              </tr>
            </thead>
            <tbody>
              {r.reviews.map((row) => (
                <tr key={row.type}>
                  <td>{ACTIVITY_LABELS[row.type]}</td>
                  <td>{row.attempts}</td>
                  <td>
                    {row.solo} ({percent(row.solo, row.attempts)})
                  </td>
                  <td>{row.medianMinutes !== undefined ? formatMinutes(row.medianMinutes) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div>
        <h3>Weakest categories</h3>
        {r.weakCategories.length === 0 ? (
          <p className="muted">No category has three or more attempts with a hint, solution or stuck result.</p>
        ) : (
          <ul className="retro-weak">
            {r.weakCategories.map((c) => (
              <li key={c.category}>
                <strong>{c.category}</strong>: {c.notSolo} of {c.attempts} attempts needed help ({percent(c.notSolo, c.attempts)})
              </li>
            ))}
          </ul>
        )}
      </div>

      {r.benchmarks.length > 0 ? (
        <div className="table-scroll">
          <table className="table">
            <caption className="muted">Benchmark pairs: unseen problems taken on the same days of each phase</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Lighter problem</th>
                <th>Harder problem</th>
              </tr>
            </thead>
            <tbody>
              {r.benchmarks.map((b) => (
                <tr key={b.day}>
                  <td>
                    {b.day} <span className="muted">{formatDate(b.date)}</span>
                  </td>
                  <td>
                    {title(b.lighter.slug)} <Result result={b.lighter} />
                  </td>
                  <td>
                    {title(b.harder.slug)} <Result result={b.harder} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}

/** Day 30 and Day 60 retrospectives: shown on the Calendar once the end of a phase is near or reached. */
export function RetrospectiveCards({ state, today }: { state: AppState; today: string }) {
  const items = visibleRetrospectives(state, today);
  if (items.length === 0) return null;
  return (
    <>
      {items.map((r) => (r.reached ? <ReachedRetrospective key={r.phase.id} r={r} /> : <LockedRetrospective key={r.phase.id} r={r} />))}
    </>
  );
}
