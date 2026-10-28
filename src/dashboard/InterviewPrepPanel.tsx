import { useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { isValidDateString, localDateFromTimestamp } from '../core/dates';
import { interviewPrepView, prepDateRange, type PrepProblem } from '../core/interviewPrep';
import type { AppState } from '../core/types';
import { COMPANIES, COMPANY_EVIDENCE_DISCLAIMER, companyInterviewEnabled, companyInterviewSlugs, type CompanyId } from '../data/companies';
import type { AppActions } from '../lib/actions';
import { ACTIVITY_LABELS } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { useNow } from '../lib/useNow';

const minutes = (value: number): string => `${Math.round(value * 10) / 10} min`;
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function daysText(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'The interview is today';
  return `This interview date has passed (${-daysLeft === 1 ? '1 day' : `${-daysLeft} days`} ago)`;
}
function timeText(p: PrepProblem): string {
  return p.medianMinutes === undefined ? 'no logged time' : `${minutes(p.medianMinutes)} median · ${p.samples} ${p.samples === 1 ? 'attempt' : 'attempts'}`;
}

/** Optional, informational preparation for one company interview date. It never schedules or changes anything else. */
export function InterviewPrepPanel({ state, actions, onStartSimulation }: {
  state: AppState;
  actions: AppActions;
  onStartSimulation: (companyId: CompanyId) => void;
}) {
  const today = localDateFromTimestamp(useNow(30_000));
  const range = prepDateRange(today);
  const prep = state.interviewPrep;
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState<'' | CompanyId>('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showForm = !prep || editing;
  const dateOk = isValidDateString(date) && date >= range.min && date <= range.max;

  return <div className="stack">
    <h2>Interview prep</h2>
    <p className="muted">Optional and informational only. It never schedules work, changes your plan, reviews or the 50-problem program, and it
      gives no progress, worked-total, streak or weekly-review credit. Pick one company and your interview date to see how your own history lines up
      with that company's documented problems.</p>
    {showForm ? <div className="card stack">
      <label>Company<select value={company} onChange={(e) => setCompany(e.target.value as '' | CompanyId)}>
        <option value="">Choose a company</option>
        {COMPANIES.map((c) => <option key={c.id} value={c.id} disabled={!companyInterviewEnabled(c.id)}>{c.name} — {companyInterviewEnabled(c.id)
          ? `${companyInterviewSlugs(c.id).length} documented topics` : 'Not enough documented data'}</option>)}
      </select></label>
      <label>Interview date<input type="date" value={date} min={range.min} max={range.max} onChange={(e) => setDate(e.target.value)} /></label>
      <p className="muted">From today ({range.min}) up to 365 days ahead ({range.max}).</p>
      <div className="row">
        <Button disabled={saving || !company || !dateOk} onClick={() => {
          if (!company) return;
          setSaving(true); setError(null);
          void actions.saveInterviewPrep({ companyId: company, date })
            .then(() => setEditing(false)).catch((e: unknown) => setError(message(e))).finally(() => setSaving(false));
        }}>Save interview prep</Button>
        {prep ? <Button variant="ghost" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div> : <PrepSummary state={state} today={today} onEdit={() => { setCompany(prep.companyId); setDate(prep.date); setEditing(true); }}
      onClear={() => { void actions.clearInterviewPrep().catch((e: unknown) => setError(message(e))); }} onStartSimulation={onStartSimulation} error={error} />}
  </div>;
}

function PrepSummary({ state, today, onEdit, onClear, onStartSimulation, error }: {
  state: AppState; today: string; onEdit: () => void; onClear: () => void; onStartSimulation: (companyId: CompanyId) => void; error: string | null;
}) {
  const view = interviewPrepView(state, state.interviewPrep!, today);
  return <div className="card stack" aria-label="Interview prep summary">
    <h3>{view.companyName} · {view.date}</h3>
    <p role="status"><strong>{daysText(view.daysLeft)}</strong></p>
    <div className="row">
      <Button disabled={!view.companyEnabled} onClick={() => onStartSimulation(view.companyId)}>Start a {view.companyName} simulation</Button>
      <Button onClick={onEdit}>Edit prep</Button>
      <ConfirmButton prompt="Clear this interview prep?" confirmLabel="Clear prep" onConfirm={onClear}>Clear prep</ConfirmButton>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {!view.companyEnabled ? <p className="muted">This company no longer has enough documented coding problems for a simulation (at least five are required).</p> : null}
    <p className="muted">{COMPANY_EVIDENCE_DISCLAIMER} The list shows problems only, no technique tags or hints. The button opens the Interview simulation setup with this company's pool chosen.</p>
    {view.problems.length === 0 ? <p>No documented problems for this company.</p> : <>
      <section className="stack-tight" aria-label="Documented problems">
        <h4>Documented problems ({view.problems.length})</h4>
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Problem</th><th>Your status</th><th>Logged time</th></tr></thead>
          <tbody>{view.problems.map((p) => <tr key={p.slug}>
            <td><a href={problemHref(p.slug)}>{p.title}</a></td>
            <td>{p.status}{p.worked ? '' : ' · not worked'}</td>
            <td>{timeText(p)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <section className="stack-tight" aria-label="Untouched problems">
        <h4>Untouched ({view.untouched.length})</h4>
        {view.untouched.length === 0 ? <p>You have worked every documented problem for this company.</p>
          : <ul>{view.untouched.map((p) => <li key={p.slug}>{p.title}</li>)}</ul>}
      </section>
      <section className="stack-tight" aria-label="Slowest problems">
        <h4>Slowest by logged time</h4>
        {view.slowest.length === 0 ? <p>No logged time on these problems yet.</p> : <ol>{view.slowest.map((p) => <li key={p.slug}>{p.title} — {timeText(p)}</li>)}</ol>}
        <p className="muted">Medians of your logged activity minutes, not adjusted for difficulty. One or two attempts are a weak signal.</p>
      </section>
      <section className="stack-tight" aria-label="Fragile problems">
        <h4>Still fragile ({view.fragile.length})</h4>
        {view.fragile.length === 0 ? <p>None flagged by the weekly-review rule. That is not proof of mastery; missing outcomes cannot show success.</p>
          : <ul>{view.fragile.map((f) => <li key={f.slug}>{f.title} — {f.reason}</li>)}</ul>}
      </section>
      <section className="stack-tight" aria-label="Scheduled reviews before the interview">
        <h4>Reviews already scheduled before {view.date} ({view.scheduledBefore.length})</h4>
        {view.passed ? <p>The interview date has passed.</p> : view.scheduledBefore.length === 0 ? <p>No reviews for these problems are currently scheduled before that date.</p>
          : <ul>{view.scheduledBefore.map((r) => <li key={r.id}>{r.dueDate} — {r.title} ({ACTIVITY_LABELS[r.type]}){r.overdue ? ' · overdue' : ''}</li>)}</ul>}
        <p className="muted">These are reviews the normal schedule already contains. Nothing is added or moved for this prep.</p>
      </section>
    </>}
  </div>;
}
