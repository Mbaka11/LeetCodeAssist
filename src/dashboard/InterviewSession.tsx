import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { SESSION_BREAK_MINUTES, SESSION_REMINDER_MINUTES, summarizeSession } from '../core/interviewSession';
import { emptyChecklist } from '../core/practice';
import { INTERVIEW_STEPS, type InterviewChecklist, type InterviewStep, type SimulationOutcome, type SimulationRecord } from '../core/practiceTypes';
import type { Problem } from '../core/types';
import type { CompanyId } from '../data/companies';
import type { AppActions } from '../lib/actions';
import { clock } from './SimulationHistory';

interface PartState { startedAt: number; endedAt: number | null; checklist: InterviewChecklist; outcome: SimulationOutcome; reflection: string }
type Stage = 'working' | 'rating' | 'break' | 'summary';
const newPart = (startedAt: number): PartState => ({ startedAt, endedAt: null, checklist: emptyChecklist(), outcome: 'partial', reflection: '' });
const checklistCount = (checklist: InterviewChecklist): number => Object.values(checklist).filter(Boolean).length;
const outcomeLabel = (outcome: SimulationOutcome): string => (outcome === 'not' ? 'Not solved' : outcome === 'solved' ? 'Solved' : 'Partial');
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

/**
 * Two problems back to back. Everything lives in React state until "Save session" writes both linked records
 * in one step; nothing here touches activities, reviews or the program. The second problem stays hidden
 * until it starts, and no tags, similar problems or hints are shown at any point.
 */
export function TwoProblemSession({ problems, companyId, withBreak, actions, onClose }: {
  problems: readonly [Problem, Problem];
  companyId?: CompanyId;
  withBreak: boolean;
  actions: AppActions;
  onClose: () => void;
}) {
  const [sessionId] = useState(() => crypto.randomUUID());
  // Fixed for the lifetime of the session, so a retried save can never create a second pair of records.
  const [recordIds] = useState<[string, string]>(() => [crypto.randomUUID(), crypto.randomUUID()]);
  const [parts, setParts] = useState<PartState[]>(() => [newPart(Date.now())]);
  const [stage, setStage] = useState<Stage>('working');
  const [breakStartedAt, setBreakStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [sessionReflection, setSessionReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = parts.length - 1;
  const part = parts[index]!;
  const running = stage === 'working' || stage === 'break';
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const update = (change: Partial<PartState>): void => setParts((all) => all.map((p, i) => (i === index ? { ...p, ...change } : p)));
  const startSecond = (): void => { const t = Date.now(); setParts((all) => [...all, newPart(t)]); setNow(t); setStage('working'); };
  const elapsed = (p: PartState): number => Math.max(0, (p.endedAt ?? now) - p.startedAt);
  const problem = problems[index]!;
  const number = index + 1;

  const save = (): void => {
    setSaving(true); setError(null);
    const record = (p: PartState, i: 0 | 1): SimulationRecord => ({
      id: recordIds[i], createdAt: p.startedAt, endedAt: p.endedAt!, durationMs: p.endedAt! - p.startedAt,
      slug: problems[i].slug, mode: companyId ? 'company' : 'global', ...(companyId ? { companyId } : {}),
      outcome: p.outcome, checklist: p.checklist, targetMinutes: SESSION_REMINDER_MINUTES, reflection: p.reflection,
      sessionId, part: i === 0 ? 1 : 2,
      ...(i === 1 && sessionReflection.trim() ? { sessionReflection } : {}),
    });
    void actions.saveSimulationSession([record(parts[0]!, 0), record(parts[1]!, 1)])
      .then(onClose).catch((e: unknown) => setError(message(e))).finally(() => setSaving(false));
  };

  const link = <a href={problem.url} target="_blank" rel="noreferrer">Open on LeetCode</a>;
  return <div className="card stack" aria-label="Active two-problem session">
    {stage === 'working' || stage === 'rating' ? <>
      <h3>Problem {number} of 2: {problem.title}</h3>
      {link}
      <p className="muted">Use the linked prompt. No technique tags, similar questions or hints are shown here. Accepted detection does not finish or score this session; nothing is saved until you save the summary.</p>
      <p role="timer" aria-label="Problem time elapsed">{clock(elapsed(part))}</p>
      {elapsed(part) >= SESSION_REMINDER_MINUTES * 60_000 ? <p role="status" className="banner">
        {SESSION_REMINDER_MINUTES} minutes reached for this problem. Wrap up when ready; the timer keeps running and nothing is saved automatically.</p> : null}
      <fieldset disabled={stage === 'rating'} className="stack-tight"><legend>Interview checklist</legend>
        {(Object.entries(INTERVIEW_STEPS) as [InterviewStep, string][]).map(([step, label]) => <label className="choice" key={step}>
          <input type="checkbox" checked={part.checklist[step]} onChange={(e) => update({ checklist: { ...part.checklist, [step]: e.target.checked } })} />{label}</label>)}
      </fieldset>
      {stage === 'working' ? <Button onClick={() => { update({ endedAt: Math.max(part.startedAt, Date.now()) }); setStage('rating'); }}>End problem {number}</Button> : <div className="stack">
        <p>Elapsed: {clock(elapsed(part))} · Checklist: {checklistCount(part.checklist)}/8</p>
        <label>Self-rating<select value={part.outcome} onChange={(e) => update({ outcome: e.target.value as SimulationOutcome })}>
          <option value="solved">Solved</option><option value="partial">Partial</option><option value="not">Not solved</option></select></label>
        <label>Short reflection<textarea maxLength={1000} value={part.reflection} onChange={(e) => update({ reflection: e.target.value })} /></label>
        {index === 0
          ? <Button onClick={() => { if (withBreak) { const t = Date.now(); setBreakStartedAt(t); setNow(t); setStage('break'); } else startSecond(); }}>
            {withBreak ? 'Continue to break' : 'Start problem 2'}</Button>
          : <Button onClick={() => setStage('summary')}>View session summary</Button>}
      </div>}
    </> : null}
    {stage === 'break' ? <div className="stack" aria-label="Break">
      <h3>Break</h3>
      <p>Step away for up to {SESSION_BREAK_MINUTES} minutes. Problem 2 stays hidden until you start it. The break is optional and not counted in either problem's time.</p>
      <p role="timer" aria-label="Break time remaining">{clock(SESSION_BREAK_MINUTES * 60_000 - (now - breakStartedAt))}</p>
      {now - breakStartedAt >= SESSION_BREAK_MINUTES * 60_000
        ? <><p role="status">Break over.</p><Button onClick={startSecond}>Start problem 2</Button></>
        : <Button onClick={startSecond}>Skip break</Button>}
    </div> : null}
    {stage === 'summary' ? <div className="stack" aria-label="Session summary">
      <h3>Session summary</h3>
      {(() => {
        const summary = summarizeSession(parts.map((p) => ({ durationMs: p.endedAt! - p.startedAt, checklist: p.checklist, outcome: p.outcome })));
        return <>
          {parts.map((p, i) => <div className="stack-tight" key={i}>
            <h4>Problem {i + 1}: {problems[i]!.title}</h4>
            <p>{outcomeLabel(p.outcome)} · {clock(p.endedAt! - p.startedAt)} · Checklist {checklistCount(p.checklist)}/8</p>
            {p.reflection ? <p style={{ whiteSpace: 'pre-wrap' }}>{p.reflection}</p> : null}
          </div>)}
          <p><strong>Total time: {clock(summary.totalMs)}</strong> · Checklist completion {summary.checklistDone}/{summary.checklistTotal}</p>
        </>;
      })()}
      <label>Session reflection<textarea maxLength={1000} value={sessionReflection} onChange={(e) => setSessionReflection(e.target.value)} /></label>
      <Button disabled={saving} onClick={save}>Save session</Button>
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
    <fieldset disabled={saving}><ConfirmButton prompt="Discard this unsaved session?" confirmLabel="Discard session" onConfirm={onClose}>Discard two-problem session</ConfirmButton></fieldset>
  </div>;
}
