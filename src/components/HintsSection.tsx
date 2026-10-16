import { useState } from 'react';
import type { Activity } from '../core/types';
import { getHints } from '../data/hints';
import type { AppActions } from '../lib/actions';
import { Button } from './Button';
import { Card } from './Card';

const LEVELS = [
  { level: 1, key: 'nudge', label: 'Nudge' },
  { level: 2, key: 'insight', label: 'Insight' },
  { level: 3, key: 'sketch', label: 'Sketch' },
] as const;

/**
 * Progressive hints for a problem: three reveal buttons (nudge, insight, sketch). With an open `activity`
 * each reveal is stored on it as `hintsUsed` and shows up in the attempt history; without one (browsing a
 * problem that is not in today's plan) hints are shown for this visit only.
 */
export function HintsSection({
  slug,
  activity,
  actions,
}: {
  slug: string;
  /** The open (planned or in-progress) activity for this problem, if any. */
  activity?: Activity | undefined;
  actions: AppActions;
}) {
  const [visited, setVisited] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hints = getHints(slug);
  if (!hints) return null;

  const revealed = activity ? (activity.hintsUsed ?? 0) : visited;
  const reveal = (level: number): void => {
    setError(null);
    if (!activity) {
      setVisited(level);
      return;
    }
    actions.revealHint(activity.id, level).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  return (
    <Card title="Hints" className="hints">
      <p className="muted">
        {activity
          ? 'Reveal them one at a time, only when stuck. Using a hint pre-selects “Hint” when you finish this attempt.'
          : 'No attempt is open for this problem, so revealed hints are not recorded.'}
      </p>
      <div className="stack-tight" aria-live="polite">
        {LEVELS.filter((l) => l.level <= revealed).map((l) => (
          <div key={l.level} className="hint">
            <strong>
              Hint {l.level} · {l.label}
            </strong>
            <p>{hints[l.key]}</p>
          </div>
        ))}
      </div>
      {revealed < LEVELS.length ? (
        <div className="row">
          {LEVELS.filter((l) => l.level > revealed).map((l) => (
            <Button key={l.level} disabled={l.level !== revealed + 1} onClick={() => reveal(l.level)}>
              Reveal hint {l.level}
            </Button>
          ))}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </Card>
  );
}
