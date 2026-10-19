import { localDateFromTimestamp } from '../core/dates';
import { getProblem } from '../data/neetcode150';
import { detectionSnapshot } from '../lib/detectionStatus';
import { formatClockTime, isAccepted, languageLabel, type SubmissionEvent } from '../lib/leetcodeSubmissions';
import { Badge, type BadgeTone } from './Badge';
import { Button } from './Button';

function problemTitle(slug: string): string {
  return getProblem(slug)?.title ?? slug;
}

function Observation({ event, now }: { event: SubmissionEvent | null; now: number }) {
  if (!event) return <span className="muted">None recorded</span>;
  const date = localDateFromTimestamp(event.at);
  const day = date === localDateFromTimestamp(now) ? 'Today' : date;
  return <>
    <time dateTime={new Date(event.at).toISOString()}>{day} {formatClockTime(event.at)}</time>
    {' · '}{problemTitle(event.slug)}
    {event.lang ? ` · ${languageLabel(event.lang)}` : ''}
  </>;
}

/** Saved observations, not a live connection probe. Stays visible above the side-panel activities. */
export function LeetCodeDetectionStatus({ enabled, events, now, currentSlug, activityStarted, onOpenSettings }: {
  enabled: boolean;
  events: readonly SubmissionEvent[];
  now: number;
  currentSlug?: string | null | undefined;
  activityStarted?: boolean | undefined;
  onOpenSettings?: (() => void) | undefined;
}) {
  const global = detectionSnapshot(events);
  const current = currentSlug ? detectionSnapshot(events, currentSlug) : global;
  let tone: BadgeTone = 'neutral';
  let message: string;
  if (!enabled) {
    message = 'Detection is off. No new events are recorded; previous observations remain below.';
  } else if (current.waitingForResult) {
    tone = 'warn';
    message = 'Submit received — no later final result received for this problem yet. Judging may still be running.';
  } else if (current.lastResult && isAccepted(current.lastResult)) {
    tone = 'good';
    message = currentSlug && activityStarted === false
      ? 'Accepted received. No activity is currently in progress for this problem.'
      : 'Accepted received. Save result always requires your confirmation.';
  } else if (current.lastResult) {
    tone = 'warn';
    message = `Last result: ${current.lastResult.status_msg}. Only Accepted opens Finish.`;
  } else {
    message = currentSlug ? 'No events received for this problem yet.' : 'No events recorded yet.';
  }

  return (
    <section className="detection-status" aria-label="LeetCode detection status">
      <header className="row detection-status-header">
        <strong>LeetCode detection</strong>
        <Badge tone={enabled ? 'good' : 'neutral'}>
          <span className="detection-light" aria-hidden="true" />
          {enabled ? 'Detection on' : 'Detection off'}
        </Badge>
        {onOpenSettings ? <Button variant="ghost" onClick={onOpenSettings}>Settings</Button> : null}
      </header>
      <dl className="detection-observations" aria-label="Latest saved observations across all problems">
        <dt>Last Submit</dt>
        <dd><Observation event={global.lastSubmit} now={now} /></dd>
        <dt>Last Accepted</dt>
        <dd><Observation event={global.lastAccepted} now={now} /></dd>
      </dl>
      {currentSlug ? <p className="muted detection-context">Current problem: {problemTitle(currentSlug)}</p> : null}
      <p className={`detection-feedback tone-${tone}`} role="status" aria-live="polite">{message}</p>
      <details className="detection-help">
        <summary>Why did Finish not open?</summary>
        <ul>
          <li>Detection on means the setting is enabled, not that the page observer is connected.</li>
          <li>Reload the LeetCode tab after installing or updating the extension. Do not reload while you have unsaved work.</li>
          <li>Start the matching activity and keep its side panel visible before submitting.</li>
          <li>Wrong Answer and other unsuccessful results do not open Finish. Old Accepted events and Cancel do not reopen the same form.</li>
          <li>If no final result arrives, you can still use Finish manually. Share only these diagnostics, never headers, cookies or full responses.</li>
        </ul>
        <p className="muted">Times are local. These are the latest observations in the saved, capped event list, not your full LeetCode history. No connection test or extra request is made.</p>
      </details>
    </section>
  );
}
