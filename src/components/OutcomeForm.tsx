import { useState } from 'react';
import { suggestedOutcome } from '../core/activities';
import type { Outcome } from '../core/types';
import { OUTCOME_DESCRIPTIONS, OUTCOME_LABELS } from '../lib/instructions';
import { Button } from './Button';

const OUTCOMES: readonly Outcome[] = ['solo', 'hint', 'solution', 'stuck'];

export function OutcomeForm({
  initialMinutes,
  hintsUsed,
  onSubmit,
  onCancel,
}: {
  initialMinutes: number;
  /** Hints revealed during the attempt; any hint pre-selects "Hint" (the user can still change it). */
  hintsUsed?: number | undefined;
  /** `totalMs` is only set when the user edited the logged time. */
  onSubmit: (outcome: Outcome, totalMs: number | undefined) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(suggestedOutcome(hintsUsed));
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [edited, setEdited] = useState(false);
  const parsed = Number(minutes);
  const minutesValid = minutes.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

  return (
    <form
      className="outcome-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (outcome && minutesValid) onSubmit(outcome, edited ? Math.round(parsed * 60_000) : undefined);
      }}
    >
      <fieldset>
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
      </fieldset>
      <label className="field inline">
        <span>Time logged (min)</span>
        <input
          type="number"
          min={0}
          step={1}
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value);
            setEdited(true);
          }}
        />
      </label>
      <div className="row">
        <Button type="submit" variant="primary" disabled={!outcome || !minutesValid}>
          Save result
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
