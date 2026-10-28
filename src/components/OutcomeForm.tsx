import { useState } from 'react';
import { suggestedOutcome } from '../core/activities';
import { addDays } from '../core/dates';
import type { Outcome } from '../core/types';
import { OUTCOME_DESCRIPTIONS, OUTCOME_LABELS } from '../lib/instructions';
import { usePanelShortcuts, type PanelShortcut } from '../lib/panelShortcuts';
import { Button } from './Button';

const OUTCOMES: readonly Outcome[] = ['solo', 'hint', 'solution', 'stuck'];
const OUTCOME_SHORTCUTS: Partial<Record<PanelShortcut, Outcome>> = {
  'outcome-solo': 'solo',
  'outcome-hint': 'hint',
  'outcome-solution': 'solution',
  'outcome-stuck': 'stuck',
};

export function OutcomeForm({
  initialMinutes,
  today,
  hintsUsed,
  initialOutcome,
  detectedNote,
  submitting = false,
  shortcuts = false,
  onSubmit,
  onCancel,
}: {
  initialMinutes: number;
  /** Current local date, kept up to date by the parent clock. The selected date stays fixed across midnight. */
  today: string;
  /** Hints revealed during the attempt; any hint pre-selects "Hint" (the user can still change it). */
  hintsUsed?: number | undefined;
  /** Pre-selected outcome when no hint was used (e.g. from a detected Accepted verdict); the user can change it. */
  initialOutcome?: Outcome | undefined;
  /** Explains why `initialOutcome` is pre-selected. */
  detectedNote?: string | undefined;
  submitting?: boolean;
  /** Side panel, selected activity: Alt+1..4 choose the outcome and Alt+Enter saves a valid form. */
  shortcuts?: boolean;
  /** `totalMs` is only set when the user edited the logged time; `completedDate` is the explicit displayed date. */
  onSubmit: (outcome: Outcome, totalMs: number | undefined, completedDate: string) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(suggestedOutcome(hintsUsed) ?? initialOutcome ?? null);
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [edited, setEdited] = useState(false);
  const [completedDate, setCompletedDate] = useState(today);
  const yesterday = addDays(today, -1);
  const dateValid = completedDate === today || completedDate === yesterday;
  const parsed = Number(minutes);
  const minutesValid = minutes.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  const save = (): boolean => {
    if (!outcome || !minutesValid || !dateValid || submitting) return false;
    onSubmit(outcome, edited ? Math.round(parsed * 60_000) : undefined, completedDate);
    return true;
  };

  usePanelShortcuts((shortcut) => {
    if (submitting) return false;
    const chosen = OUTCOME_SHORTCUTS[shortcut];
    if (chosen) {
      setOutcome(chosen);
      return true;
    }
    return shortcut === 'save' && save();
  }, shortcuts);

  return (
    <form
      className="outcome-form"
      aria-busy={submitting}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <fieldset disabled={submitting}>
        <legend>How did it go?</legend>
        <div className="outcome-options">
          {OUTCOMES.map((value) => (
            <label key={value} className={`outcome-option${outcome === value ? ' selected' : ''}`}>
              <input
                type="radio"
                name="outcome"
                value={value}
                checked={outcome === value}
                onChange={() => setOutcome(value)}
              />
              <strong>{OUTCOME_LABELS[value]}</strong>
              <span>{OUTCOME_DESCRIPTIONS[value]}</span>
            </label>
          ))}
        </div>
        {suggestedOutcome(hintsUsed) !== null ? (
          <p className="muted outcome-note" role="note">
            You revealed {hintsUsed} {hintsUsed === 1 ? 'hint' : 'hints'} during this attempt, so “Hint” is
            pre-selected. Change it if that is not how it went.
          </p>
        ) : null}
        {detectedNote && suggestedOutcome(hintsUsed) === null ? (
          <p className="muted outcome-note" role="note">
            {detectedNote}
          </p>
        ) : null}
      </fieldset>
      <label className="field">
        <span>Completed on</span>
        <select value={completedDate} onChange={(event) => setCompletedDate(event.target.value)} disabled={submitting}>
          {!dateValid ? <option value={completedDate} disabled>{completedDate} — choose again</option> : null}
          <option value={today}>Today ({today})</option>
          <option value={yesterday}>Yesterday ({yesterday})</option>
        </select>
      </label>
      <p className={dateValid ? 'muted' : 'error'} role={dateValid ? 'note' : 'alert'}>
        {dateValid
          ? 'This date is used for your app log, calendar and reviews. Choosing Yesterday can make a review due today.'
          : 'The selected date is no longer today or yesterday. Choose a date again before saving.'}
      </p>
      <label className="field inline">
        <span>Time logged (min)</span>
        <input
          type="number"
          min={0}
          step={1}
          value={minutes}
          disabled={submitting}
          onChange={(event) => {
            setMinutes(event.target.value);
            setEdited(true);
          }}
        />
      </label>
      <div className="row">
        <Button type="submit" variant="primary" disabled={!outcome || !minutesValid || !dateValid || submitting}>
          {submitting ? 'Saving…' : 'Save result'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
