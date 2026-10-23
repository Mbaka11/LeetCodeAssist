import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { setUnsavedWorkGuard } from '../lib/navigationGuard';
import { COMPANY_EVIDENCE_DISCLAIMER, COMPANIES, companyInterviewEnabled, companyInterviewSlugs, getCompanyEvidence, type CompanyId } from '../data/companies';
import { CATEGORY_NAMES, NEETCODE_150 } from '../data/neetcode150';
import { companyName, drawSimulation, drillQuestions, emptyChecklist, simulationPool, type DrillQuestion } from '../core/practice';
import { INTERVIEW_STEPS, type DrillAnswer, type DrillKind, type DrillSessionRecord, type InterviewStep, type SimulationOutcome, type SimulationRecord } from '../core/practiceTypes';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';

type Props = { state: AppState; actions: AppActions };
function time(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function title(slug: string): string { return NEETCODE_150.find((p) => p.slug === slug)?.title ?? slug; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function PracticeView({ state, actions }: Props) {
  const [tab, setTab] = useState<'simulation' | 'drills'>('simulation');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    setUnsavedWorkGuard('Leave Practice? The unsaved interview or drill session will be discarded.');
    return () => { window.removeEventListener('beforeunload', warn); setUnsavedWorkGuard(null); };
  }, [busy]);
  return <section className="stack" aria-label="Optional practice">
    <h1>Practice</h1>
    <p className="muted">Voluntary, separate practice. No scheduled reviews, problem-status changes, program progress, worked totals, streak or weekly-review credit. Results appear only here and in JSON backups.</p>
    {busy ? <p className="muted">Session in progress. Leaving this view discards unsaved practice; finish here to keep a result.</p> : null}
    <div className="row" role="group" aria-label="Practice mode">
      <Button disabled={busy} aria-pressed={tab === 'simulation'} onClick={() => setTab('simulation')}>Interview simulation</Button>
      <Button disabled={busy} aria-pressed={tab === 'drills'} onClick={() => setTab('drills')}>Pattern drills</Button>
    </div>
    {tab === 'simulation' ? <SimulationView state={state} actions={actions} onBusy={setBusy} /> : <DrillsView state={state} actions={actions} onBusy={setBusy} />}
  </section>;
}

function SimulationView({ state, actions, onBusy }: Props & { onBusy: (busy: boolean) => void }) {
  const [company, setCompany] = useState<'' | CompanyId>('');
  const [includeUnworked, setIncludeUnworked] = useState(false);
  const [difficulty, setDifficulty] = useState('');
  const [category, setCategory] = useState('');
  const [minutes, setMinutes] = useState<25 | 35 | 45>(35);
  const [session, setSession] = useState<Omit<SimulationRecord, 'endedAt' | 'outcome' | 'reflection' | 'durationMs'> | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now);
  const [outcome, setOutcome] = useState<SimulationOutcome>('partial');
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!session || endedAt !== null) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session, endedAt]);
  const pool = simulationPool(state, { includeUnworked, difficulty, category, ...(company ? { companyId: company } : {}) });
  const clear = () => { setSession(null); setEndedAt(null); setReflection(''); setError(null); onBusy(false); };
  const records = Object.values(state.simulations ?? {}).sort((a, b) => b.endedAt - a.endedAt);
  return <div className="stack">
    <h2>Interview simulation</h2>
    {!session ? <div className="card stack">
      <label>Interview pool<select value={company} onChange={(e) => setCompany(e.target.value as '' | CompanyId)}>
        <option value="">Global — worked problems by default</option>
        {COMPANIES.map((c) => <option key={c.id} value={c.id} disabled={!companyInterviewEnabled(c.id)}>{c.name} — {companyInterviewEnabled(c.id) ? `${companyInterviewSlugs(c.id).length} documented topics` : 'Not enough documented data'}</option>)}
      </select></label>
      {company ? <div className="stack-tight">
        <p>{COMPANY_EVIDENCE_DISCLAIMER}</p>
        <p className="muted">Company pools include unworked documented topics and qualified variants. Exact-topic associations receive more sampling weight (3:1), an editorial practice choice, not interview frequency or a hiring prediction. No pattern-similar fallback is used.</p>
        <p className="muted">Reports may be mirrored or AI-reworded; identity and employer confirmation are unverified. Systems/firmware reports may not generalize to other roles. Per-topic sources and qualifications appear after saving, not during the interview.</p>
      </div> : <label className="choice"><input type="checkbox" checked={includeUnworked} onChange={(e) => setIncludeUnworked(e.target.checked)} />Include unworked catalog problems (may reveal a new problem; no progress credit)</label>}
      <div className="row">
        <label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Any</option>{['Easy', 'Medium', 'Hard'].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Any</option>{CATEGORY_NAMES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Interview length<select value={minutes} onChange={(e) => setMinutes(Number(e.target.value) as 25 | 35 | 45)}>{[25, 35, 45].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      </div>
      <p>{pool.length} eligible problems. Worked means started/completed program or bonus work, a learned status, or a solved check. Tags and similar questions stay hidden throughout the session.</p>
      {!pool.length ? <p role="status">No matching problems. Work or check a problem first, or explicitly include unworked problems.</p> : null}
      <Button disabled={!pool.length} onClick={() => {
        const problem = drawSimulation(pool, company || undefined);
        if (!problem) return;
        const now = Date.now();
        setSession({ id: crypto.randomUUID(), createdAt: now, slug: problem.slug, mode: company ? 'company' : 'global', ...(company ? { companyId: company } : {}), checklist: emptyChecklist(), targetMinutes: minutes });
        setClock(now); setEndedAt(null); setOutcome('partial'); setError(null); onBusy(true);
      }}>Start interview</Button>
    </div> : <div className="card stack" aria-label="Active interview">
      <h3>{title(session.slug)}</h3>
      <a href={NEETCODE_150.find((p) => p.slug === session.slug)!.url} target="_blank" rel="noreferrer">Open on LeetCode</a>
      <p className="muted">Use the linked prompt. No technique tags, similar questions or hints are shown here. LeetCode itself may expose hints; avoid them for a blind simulation. Accepted detection does not finish or score this simulation.</p>
      <p role="timer" aria-label="Interview time remaining">{time(session.targetMinutes * 60_000 - Math.max(0, (endedAt ?? clock) - session.createdAt))}</p>
      {(endedAt ?? clock) - session.createdAt >= session.targetMinutes * 60_000 ? <p role="status">Time is up. End when ready; nothing is saved automatically.</p> : null}
      <fieldset disabled={endedAt !== null || saving} className="stack-tight"><legend>Interview checklist</legend>
        {(Object.entries(INTERVIEW_STEPS) as [InterviewStep, string][]).map(([step, label]) => <label className="choice" key={step}><input type="checkbox" checked={session.checklist[step]} onChange={(e) => setSession({ ...session, checklist: { ...session.checklist, [step]: e.target.checked } })} />{label}</label>)}
      </fieldset>
      {endedAt === null ? <Button onClick={() => setEndedAt(Math.max(session.createdAt, Date.now()))}>End interview</Button> : <div className="stack">
        <p>Elapsed: {time(endedAt - session.createdAt)} · Checklist: {Object.values(session.checklist).filter(Boolean).length}/8</p>
        <label>Self-rating<select value={outcome} onChange={(e) => setOutcome(e.target.value as SimulationOutcome)}><option value="solved">Solved</option><option value="partial">Partial</option><option value="not">Not solved</option></select></label>
        <label>Short reflection<textarea maxLength={1000} value={reflection} onChange={(e) => setReflection(e.target.value)} /></label>
        <Button disabled={saving} onClick={() => {
          setSaving(true); setError(null);
          void actions.saveSimulation({ ...session, endedAt, outcome, reflection, durationMs: endedAt - session.createdAt })
            .then(clear).catch((e: unknown) => setError(message(e))).finally(() => setSaving(false));
        }}>Save interview result</Button>
      </div>}
      <fieldset disabled={saving}><ConfirmButton prompt="Discard this unsaved interview?" confirmLabel="Discard interview" onConfirm={clear}>Discard session</ConfirmButton></fieldset>
    </div>}
    {error ? <p role="alert">{error}</p> : null}
    {!session ? <section className="stack" aria-label="Interview history"><h3>Interview history</h3>
      {!records.length ? <p className="muted">No interviews saved.</p> : records.map((r) => <article className="card stack-tight" key={r.id}>
        <h4>{title(r.slug)}{r.companyId ? ` — ${companyName(r.companyId)}` : ''}</h4>
        <p>{new Date(r.endedAt).toLocaleString()} · {r.outcome === 'not' ? 'not solved' : r.outcome} · {time(r.durationMs)} elapsed / {r.targetMinutes} min target · Checklist {Object.values(r.checklist).filter(Boolean).length}/8</p>
        <ul>{(Object.entries(INTERVIEW_STEPS) as [InterviewStep, string][]).map(([key, label]) => <li key={key}>{r.checklist[key] ? '✓' : '—'} {label}</li>)}</ul>
        {r.reflection ? <p style={{ whiteSpace: 'pre-wrap' }}>{r.reflection}</p> : null}
        {r.companyId ? <><p className="muted">{COMPANY_EVIDENCE_DISCLAIMER}</p>{getCompanyEvidence(r.slug, r.companyId).evidence.map((row) => <div key={row.source.url}>
          <strong>{row.label}</strong><p>{row.qualification}</p><p className="muted">{row.source.caveat}</p>
          <a href={row.source.url} target="_blank" rel="noreferrer">{row.source.title}</a>
          <p className="muted">Snapshot {row.source.snapshotDate}; publication {row.source.reportedDate ?? 'unknown'}{row.source.reportedDateBasis ? ` (${row.source.reportedDateBasis})` : ''}; interview {row.source.interviewPeriod ?? (row.source.interviewDate ? `${row.source.interviewDate.month}/${row.source.interviewDate.day}, year ${row.source.interviewDate.year ?? 'unknown'}` : 'unknown')}.</p>
        </div>)}</> : null}
      </article>)}
    </section> : null}
  </div>;
}

const QUESTION_LABELS: Record<DrillKind, string> = { technique: 'Which is a useful technique?', structure: 'Which is a useful data structure?', outline: 'Which pseudo-code outline is correct?' };
function DrillsView({ state, actions, onBusy }: Props & { onBusy: (busy: boolean) => void }) {
  const [enabled, setEnabled] = useState(state.settings.roadmapHideTechniques !== true);
  const [includeUnworked, setIncludeUnworked] = useState(false);
  const [kind, setKind] = useState<DrillKind | 'mixed'>('mixed');
  const [count, setCount] = useState(5);
  const [session, setSession] = useState<{ id: string; createdAt: number; includeUnworked: boolean; questions: DrillQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<DrillAnswer[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = drillQuestions(state, { includeUnworked, kind, count });
  const question = session?.questions[answers.length];
  const nextButton = useRef<HTMLButtonElement>(null);
  // Answer buttons disable on the first click, so keyboard focus would drop to the page: move it to Next/Finish.
  useEffect(() => { if (choice !== null) nextButton.current?.focus(); }, [choice]);
  const clear = () => { setSession(null); setAnswers([]); setChoice(null); setEndedAt(null); setError(null); onBusy(false); };
  return <div className="stack"><h2>Pattern drills</h2>
    <p className="muted">Drills intentionally reveal hints. Your Hide techniques preference disables them by default, not permanently. Original prompts and outlines cover the fixed 50-program-problem bank. These are useful editorial approaches, not the only possible solutions.</p>
    {!session ? <div className="card stack">
      <label className="choice"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Show hint-based drills</label>
      <label className="choice"><input type="checkbox" checked={includeUnworked} onChange={(e) => setIncludeUnworked(e.target.checked)} />Include unworked problems — warning: reveals techniques and data structures</label>
      <p className="muted">Pseudo-code questions are always restricted to worked problems, even with this toggle. Practice results never unlock more spoilers.</p>
      <label>Question kind<select value={kind} onChange={(e) => setKind(e.target.value as DrillKind | 'mixed')}><option value="mixed">Mixed</option>{Object.entries(QUESTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Questions per session<select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 20].map((n) => <option key={n}>{n}</option>)}</select></label>
      <p>Up to {count} questions; {available.length} available for this session (no repeated question). A small pool produces a shorter session.</p>
      <Button disabled={!enabled || !available.length} onClick={() => {
        setSession({ id: crypto.randomUUID(), createdAt: Date.now(), includeUnworked, questions: drillQuestions(state, { includeUnworked, kind, count }) });
        setAnswers([]); setChoice(null); setEndedAt(null); setError(null); onBusy(true);
      }}>Start drills</Button>
    </div> : <div className="card stack" aria-label="Active drills">
      {question ? <>
        <p>Question {answers.length + 1}/{session.questions.length}</p><h3>{question.title}</h3><p>{question.summary}</p><h4>{QUESTION_LABELS[question.kind]}</h4>
        <div className="stack-tight" role="group" aria-label="Answer choices">{question.choices.map((option, index) => <Button key={index} disabled={choice !== null} onClick={() => setChoice(index)}>{option.text}</Button>)}</div>
        {choice !== null ? <div role="status" className="stack-tight"><strong>{question.choices[choice]!.correct ? 'Correct' : 'Not quite'}</strong>
          <p>{question.choices[choice]!.explanation}</p>
          {!question.choices[choice]!.correct ? <p>Intended answer: {question.choices.find((c) => c.correct)!.text}</p> : null}
          <Button ref={nextButton} onClick={() => {
            const next = [...answers, { slug: question.slug, kind: question.kind, correct: question.choices[choice]!.correct }];
            setAnswers(next); setChoice(null);
            if (next.length === session.questions.length) setEndedAt(Math.max(session.createdAt, Date.now()));
          }}>{answers.length + 1 === session.questions.length ? 'Finish drills' : 'Next question'}</Button>
        </div> : null}
      </> : <><h3>Session score: {answers.filter((a) => a.correct).length}/{answers.length}</h3>
        <Button disabled={saving || endedAt === null} onClick={() => {
          if (endedAt === null) return;
          setSaving(true); setError(null);
          const record: DrillSessionRecord = { id: session.id, createdAt: session.createdAt, endedAt, includeUnworked: session.includeUnworked, answers, score: answers.filter((a) => a.correct).length, total: answers.length };
          void actions.saveDrillSession(record).then(clear).catch((e: unknown) => setError(message(e))).finally(() => setSaving(false));
        }}>Save drill score</Button>
      </>}
      <fieldset disabled={saving}><ConfirmButton prompt="Discard this unsaved drill session?" confirmLabel="Discard drills" onConfirm={clear}>Discard session</ConfirmButton></fieldset>
    </div>}
    {error ? <p role="alert">{error}</p> : null}
    {!session ? <section aria-label="Drill history"><h3>Drill history</h3>
      {!Object.keys(state.drillSessions ?? {}).length ? <p className="muted">No drill sessions saved.</p> : <ul>{Object.values(state.drillSessions ?? {}).sort((a, b) => b.endedAt - a.endedAt).map((r) => <li key={r.id}>{new Date(r.endedAt).toLocaleString()} — {r.score}/{r.total}{r.includeUnworked ? ' · unworked topics allowed (no unworked outlines)' : ' · worked topics only'}</li>)}</ul>}
    </section> : null}
  </div>;
}
