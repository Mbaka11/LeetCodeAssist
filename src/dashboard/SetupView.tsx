import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { addDays, isValidDateString, trainingDateFromTimestamp } from '../core/dates';
import type { AppActions } from '../lib/actions';
import { formatDate } from '../lib/format';

type StartChoice = 'today' | 'tomorrow' | 'custom';

export function SetupView({ actions }: { actions: AppActions }) {
  const today = trainingDateFromTimestamp(Date.now());
  const [choice, setChoice] = useState<StartChoice>('today');
  const [custom, setCustom] = useState(addDays(today, 2));
  const [error, setError] = useState<string | null>(null);

  const startDate = choice === 'today' ? today : choice === 'tomorrow' ? addDays(today, 1) : custom;
  const valid = isValidDateString(startDate);

  return (
    <main className="page narrow">
      <Card title="Welcome to LeetCode Assist">
        <p>
          A 30-day bootcamp on the NeetCode 150 roadmap. Every day you get a short list: new problems,
          spaced reviews and how long each should take.
        </p>
        <fieldset className="choice-group">
          <legend>When does day 1 start?</legend>
          {(
            [
              ['today', `Today (${formatDate(today)})`],
              ['tomorrow', `Tomorrow (${formatDate(addDays(today, 1))})`],
              ['custom', 'Pick a date'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name="start"
                checked={choice === value}
                onChange={() => setChoice(value)}
              />
              {label}
            </label>
          ))}
          {choice === 'custom' ? (
            <input
              type="date"
              aria-label="Start date"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          ) : null}
        </fieldset>
        <div className="row">
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              setError(null);
              actions.initialize(startDate).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
            }}
          >
            Start the program
          </Button>
          <span className="muted">Daily target 150 min, cap 180 min. You can change this in Settings.</span>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </Card>
    </main>
  );
}
