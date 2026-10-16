import { useState } from 'react';
import { isValidDateString } from '../core/dates';
import { Button } from './Button';

/** Inline "Move to <date>" form for a review: the new day must lie between `minDate` (today) and `maxDate`. */
export function MoveForm({
  minDate,
  maxDate,
  initialDate,
  onMove,
  onCancel,
}: {
  minDate: string;
  maxDate: string;
  initialDate: string;
  onMove: (date: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [error, setError] = useState<string | null>(null);
  const valid = isValidDateString(date) && date >= minDate && date <= maxDate;
  return (
    <form
      className="row move-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        setError(null);
        onMove(date).then(onCancel, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
      }}
    >
      <label className="field inline">
        <span>Move to</span>
        <input type="date" required min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <Button type="submit" variant="primary" disabled={!valid}>
        Move
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      {error ? <span className="error">{error}</span> : null}
    </form>
  );
}
