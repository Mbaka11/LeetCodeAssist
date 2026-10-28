import { COMPANY_EVIDENCE_DISCLAIMER, getCompanyEvidence } from '../data/companies';
import { NEETCODE_150 } from '../data/neetcode150';
import { companyName } from '../core/practice';
import { groupSimulationHistory, summarizeSession } from '../core/interviewSession';
import { INTERVIEW_STEPS, type InterviewStep, type SimulationRecord } from '../core/practiceTypes';

/** m:ss for a duration in milliseconds. */
export function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function problemTitle(slug: string): string { return NEETCODE_150.find((p) => p.slug === slug)?.title ?? slug; }
const outcomeLabel = (outcome: SimulationRecord['outcome']): string => (outcome === 'not' ? 'not solved' : outcome);
const checklistCount = (r: SimulationRecord): number => Object.values(r.checklist).filter(Boolean).length;

function RecordBody({ record: r }: { record: SimulationRecord }) {
  return <>
    <p>{new Date(r.endedAt).toLocaleString()} · {outcomeLabel(r.outcome)} · {clock(r.durationMs)} elapsed / {r.targetMinutes} min target · Checklist {checklistCount(r)}/8</p>
    <ul>{(Object.entries(INTERVIEW_STEPS) as [InterviewStep, string][]).map(([key, label]) => <li key={key}>{r.checklist[key] ? '✓' : '—'} {label}</li>)}</ul>
    {r.reflection ? <p style={{ whiteSpace: 'pre-wrap' }}>{r.reflection}</p> : null}
    {r.companyId ? <><p className="muted">{COMPANY_EVIDENCE_DISCLAIMER}</p>{getCompanyEvidence(r.slug, r.companyId).evidence.map((row) => <div key={row.source.url}>
      <strong>{row.label}</strong><p>{row.qualification}</p><p className="muted">{row.source.caveat}</p>
      <a href={row.source.url} target="_blank" rel="noreferrer">{row.source.title}</a>
      <p className="muted">Snapshot {row.source.snapshotDate}; publication {row.source.reportedDate ?? 'unknown'}{row.source.reportedDateBasis ? ` (${row.source.reportedDateBasis})` : ''}; interview {row.source.interviewPeriod ?? (row.source.interviewDate ? `${row.source.interviewDate.month}/${row.source.interviewDate.day}, year ${row.source.interviewDate.year ?? 'unknown'}` : 'unknown')}.</p>
    </div>)}</> : null}
  </>;
}

/** Saved simulations, newest first; the two records of a two-problem session appear as one linked entry. */
export function SimulationHistory({ records }: { records: readonly SimulationRecord[] }) {
  return <section className="stack" aria-label="Interview history"><h3>Interview history</h3>
    {!records.length ? <p className="muted">No interviews saved.</p> : groupSimulationHistory(records).map((entry) => {
      if (entry.kind === 'single') {
        const r = entry.record;
        return <article className="card stack-tight" key={r.id}>
          <h4>{problemTitle(r.slug)}{r.companyId ? ` — ${companyName(r.companyId)}` : ''}</h4>
          <RecordBody record={r} />
        </article>;
      }
      const summary = summarizeSession(entry.records);
      const companyId = entry.records[0]?.companyId;
      return <article className="card stack-tight" key={entry.sessionId} aria-label="Two-problem session">
        <h4>Two-problem session{companyId ? ` — ${companyName(companyId)}` : ''}</h4>
        <p>Total time {clock(summary.totalMs)} · Checklist {summary.checklistDone}/{summary.checklistTotal} · Outcomes: {summary.outcomes.map(outcomeLabel).join(', ')}</p>
        {!entry.complete ? <p className="muted">Only one of the two linked records is present on this device (the other has not synced or was removed).</p> : null}
        {entry.records.map((r) => <section className="stack-tight" key={r.id} aria-label={`Session problem ${r.part}`}>
          <h5>Problem {r.part}: {problemTitle(r.slug)}</h5>
          <RecordBody record={r} />
        </section>)}
        {entry.records.find((r) => r.sessionReflection)?.sessionReflection ? <><h5>Session reflection</h5>
          <p style={{ whiteSpace: 'pre-wrap' }}>{entry.records.find((r) => r.sessionReflection)!.sessionReflection}</p></> : null}
      </article>;
    })}
  </section>;
}
