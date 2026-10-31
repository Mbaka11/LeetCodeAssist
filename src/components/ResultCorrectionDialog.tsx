import { useEffect, useRef, useState } from 'react';
import { trainingDateFromTimestamp } from '../core/dates';
import { correctionDateBounds, prepareResultCorrection, type CorrectionPreview, type ResultEdit } from '../core/resultCorrection';
import type { Activity, AppState, Outcome } from '../core/types';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { ACTIVITY_LABELS, OUTCOME_LABELS, STATUS_LABELS } from '../lib/instructions';
import { Button } from './Button';

function Reviews({ title, items, today }: { title: string; items: readonly Activity[]; today: string }) {
  return <div><h3>{title} ({items.length})</h3>{items.length === 0 ? <p className="muted">None</p> :
    <ul>{items.map((a) => <li key={a.id}>{ACTIVITY_LABELS[a.type]} · {a.dueDate}{a.dueDate < today ? ' · overdue' : a.dueDate === today ? ' · due today' : ''}</li>)}</ul>}</div>;
}

export function ResultCorrectionDialog({ state, activity, actions, onClose }: {
  state: AppState; activity: Activity; actions: AppActions; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(activity.completedAt!);
  const [minutes, setMinutes] = useState(String((activity.totalMs ?? 0) / 60_000));
  const [timeEdited, setTimeEdited] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | ''>(activity.outcome ?? '');
  const [preview, setPreview] = useState<{ data: CorrectionPreview; edit: ResultEdit } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = trainingDateFromTimestamp(Date.now());
  const bounds = correctionDateBounds(state, activity.id, today);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) {
      if (typeof node.showModal === 'function') node.showModal();
      else node.setAttribute('open', ''); // DOM test environments without native dialog support.
    }
    return () => { if (node?.open && typeof node.close === 'function') node.close(); };
  }, []);
  const invalidate = (): void => { setPreview(null); setError(null); };
  const title = getProblem(activity.slug)?.title ?? activity.slug;
  return <dialog ref={dialog} className="result-dialog" aria-labelledby="correction-title"
    aria-modal="true" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="stack">
      <h2 id="correction-title">Correct saved result · {title}</h2>
      <p className="muted">{ACTIVITY_LABELS[activity.type]} · Nothing changes until you preview and confirm.
        {' '}Completed and in-progress attempts are protected. Previous values are kept in your JSON backup.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        try {
          if (!outcome) throw new Error('Choose an outcome.');
          if (minutes.trim() === '' || !Number.isFinite(Number(minutes))) throw new Error('Enter valid minutes.');
          const edit: ResultEdit = { completedDate: date, outcome,
            totalMs: timeEdited ? Math.round(Number(minutes) * 60_000) : activity.totalMs ?? 0 };
          const prepared = prepareResultCorrection(state, activity.id, edit, Date.now());
          setPreview({ data: prepared.preview, edit });
        } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : String(e)); }
      }}>
        <fieldset className="correction-fields" disabled={saving}>
          <legend>Corrected values</legend>
          <label className="field"><span>Completion date</span>
            <input type="date" min={bounds.min} max={bounds.max} required value={date}
              onChange={(e) => { invalidate(); setDate(e.target.value); }} /></label>
          <label className="field"><span>Logged minutes</span>
            <input type="number" min={0} step="any" required value={minutes}
              onChange={(e) => { invalidate(); setTimeEdited(true); setMinutes(e.target.value); }} /></label>
          <label className="field"><span>Recorded outcome</span>
            <select required value={outcome} onChange={(e) => { invalidate(); setOutcome(e.target.value as Outcome); }}>
              <option value="" disabled>Choose an outcome</option>
              {Object.entries(OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          <Button type="submit">Preview changes</Button>
        </fieldset>
      </form>
      <p className="muted">Allowed dates: {bounds.min} to {bounds.max}. A date correction cannot reorder completed
        attempts of the same problem. Hints and approach time stay unchanged; a Solo result with recorded hints
        is not counted as an independent success in the weekly summary.</p>
      {preview ? <section className="correction-preview" aria-label="Correction preview">
        <h3>Before → After</h3>
        <ul>
          <li>Date: {preview.data.before.completedAt} → {preview.data.after.completedAt}</li>
          <li>Minutes: {Math.round((preview.data.before.totalMs ?? 0) / 600) / 100} → {Math.round((preview.data.after.totalMs ?? 0) / 600) / 100}</li>
          <li>Outcome: {preview.data.before.outcome ? OUTCOME_LABELS[preview.data.before.outcome] : 'Not recorded'} → {OUTCOME_LABELS[preview.edit.outcome]}</li>
          <li>Learning status: {STATUS_LABELS[preview.data.statusBefore]} → {STATUS_LABELS[preview.data.statusAfter]}</li>
        </ul>
        {preview.data.scheduleRecalculated ? <>
          <p className="muted">Unstarted scheduled reviews are recalculated from completed attempts. Previous
            manual moves may change. Removed plans are retained as skipped records, not deleted. Extra practice
            and started/completed attempts are not changed. Newly overdue reviews remain due. The planner may
            rebalance other upcoming work under your unchanged daily cap.</p>
          <Reviews title="Remove from plan" items={preview.data.retired} today={today} />
          <Reviews title="Add to plan" items={preview.data.added} today={today} />
        </> : <p className="muted">Review schedule and learning status stay unchanged.</p>}
        {!preview.data.changed ? <p>No values changed.</p> : null}
        <Button variant="primary" disabled={saving || !preview.data.changed} onClick={() => {
          if (saving) return;
          setSaving(true); setError(null);
          actions.correctResult(activity.id, preview.edit, preview.data.fingerprint)
            .then(onClose, (e: unknown) => { setPreview(null); setError(e instanceof Error ? e.message : String(e)); })
            .finally(() => setSaving(false));
        }}>{saving ? 'Saving…' : 'Confirm correction'}</Button>
      </section> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {(activity.corrections?.length ?? 0) > 0 ? <p className="muted">Previous corrections: {activity.corrections!.length}. Original values remain in the JSON audit history.</p> : null}
      <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
    </div>
  </dialog>;
}
