import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LeetCodeDetectionStatus } from '../components/LeetCodeDetectionStatus';
import { validateUsername } from '../lib/leetcodeProfile';
import { chromeLeetCodeStorage, type LeetCodePrefs } from '../lib/leetcodeStorage';
import {
  detectionDiagnostics,
  formatClockTime,
  type SubmissionEvent,
} from '../lib/leetcodeSubmissions';
import { useLeetCodePrefs, useSubmissionEvents } from '../lib/useLeetCodeData';
import { useNow } from '../lib/useNow';

interface Message {
  tone: 'good' | 'error';
  text: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function MessageText({ message }: { message: Message | null }) {
  return message ? <span className={message.tone === 'good' ? 'tone-good' : 'error'}>{message.text}</span> : null;
}

/** The optional public username that powers the streak card on the Calendar page. */
export function LeetCodeProfileForm({ prefs }: { prefs: LeetCodePrefs }) {
  const [value, setValue] = useState(prefs.username ?? '');
  const [message, setMessage] = useState<Message | null>(null);

  const save = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === '') {
      chromeLeetCodeStorage()
        .updatePrefs({ username: null })
        .then(
          () => setMessage({ tone: 'good', text: 'Username removed.' }),
          (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
        );
      return;
    }
    const checked = validateUsername(trimmed);
    if (!checked.ok) {
      setMessage({ tone: 'error', text: checked.message });
      return;
    }
    chromeLeetCodeStorage()
      .updatePrefs({ username: checked.username })
      .then(
        () => setMessage({ tone: 'good', text: 'Username saved.' }),
        (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
      );
  };

  return (
    <form className="stack-tight" onSubmit={save}>
      <label className="field">
        <span>LeetCode username (optional)</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          placeholder="your-username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="row">
        <Button type="submit" variant="primary">
          Save username
        </Button>
        <MessageText message={message} />
      </div>
    </form>
  );
}

export function LeetCodeProfileCard() {
  const prefs = useLeetCodePrefs();
  return (
    <Card title="LeetCode profile">
      <p className="muted">
        Optional. With your username the Calendar page shows your LeetCode submission streak. The extension
        reads only your <strong>public</strong> submission calendar from leetcode.com, anonymously (no login,
        no cookies), at most once an hour or when you press Refresh.
      </p>
      <LeetCodeProfileForm key={prefs.username ?? ''} prefs={prefs} />
    </Card>
  );
}

function lastSeenText(at: number | null, now: number): string {
  if (at === null) return 'never';
  const date = new Date(at);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  return sameDay ? `today ${formatClockTime(at)}` : `${date.toLocaleDateString('en-US')} ${formatClockTime(at)}`;
}

/** Counts and the last verdict texts seen: no code, no response bodies. */
export function DetectionDiagnostics({ events, now }: { events: readonly SubmissionEvent[]; now: number }) {
  const diagnostics = detectionDiagnostics(events);
  return (
    <dl className="diagnostics" aria-label="Detection diagnostics">
      <dt>Submissions seen</dt>
      <dd>{diagnostics.submits}</dd>
      <dt>Results seen</dt>
      <dd>
        {diagnostics.verdicts} ({diagnostics.accepted} Accepted)
      </dd>
      <dt>Last results</dt>
      <dd>{diagnostics.recentStatuses.length > 0 ? diagnostics.recentStatuses.join(', ') : 'none yet'}</dd>
      <dt>Last event</dt>
      <dd>{lastSeenText(diagnostics.lastEventAt, now)}</dd>
    </dl>
  );
}

export function LeetCodeDetectionPanel({
  enabled,
  events,
  now,
  onToggle,
  onClear,
  message,
}: {
  enabled: boolean;
  events: readonly SubmissionEvent[];
  now: number;
  onToggle: (enabled: boolean) => void;
  onClear: () => void;
  message: Message | null;
}) {
  return (
    <div className="stack-tight">
      <p className="muted">
        While the side panel is open on a started activity, a newly detected &quot;Accepted&quot; for that
        problem pauses its timer and opens the Finish form. Review the outcome and time, then choose Save
        result. Nothing is completed automatically. Older detected results still offer a manual Finish button.
      </p>
      <label className="check-field">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span>Detect accepted submissions</span>
      </label>
      <p className="muted privacy-note">
        <strong>Privacy.</strong> The extension watches, in your own browser and without changing anything, the
        two responses LeetCode shows you after a submission. It keeps only the problem name, the result text
        (for example &quot;Accepted&quot;), the language and the time, in this browser. It never reads or stores
        your code, cookies, passwords or account data, never submits anything for you, and sends nothing
        anywhere. Turn it off to stop recording; clear the list at any time.
      </p>
      <LeetCodeDetectionStatus enabled={enabled} events={events} now={now} />
      <DetectionDiagnostics events={events} now={now} />
      {events.length === 0 && enabled ? (
        <p className="muted">
          Nothing detected yet. If you have submitted on LeetCode and this stays empty, completing activities
          by hand works exactly as before (reload the LeetCode tab once after installing or updating).
        </p>
      ) : null}
      {enabled && events.some((e) => e.type === 'submit') && !events.some((e) => e.type === 'check') ? (
        <p className="muted">
          Submissions are being seen, but no final results have been recorded. Reload the LeetCode tab after
          updating the extension. If this continues, share these counts and the result request&apos;s route
          template only — never headers, cookies or full responses.
        </p>
      ) : null}
      <div className="row">
        <Button onClick={onClear} disabled={events.length === 0}>
          Clear detected events
        </Button>
        <MessageText message={message} />
      </div>
    </div>
  );
}

export function LeetCodeDetectionCard() {
  const prefs = useLeetCodePrefs();
  const events = useSubmissionEvents();
  const [message, setMessage] = useState<Message | null>(null);
  const now = useNow(30_000);
  return (
    <Card title="LeetCode detection">
      <LeetCodeDetectionPanel
        enabled={prefs.detectionEnabled}
        events={events}
        now={now}
        message={message}
        onToggle={(enabled) =>
          chromeLeetCodeStorage()
            .updatePrefs({ detectionEnabled: enabled })
            .then(
              () => setMessage({ tone: 'good', text: enabled ? 'Detection is on.' : 'Detection is off.' }),
              (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
            )
        }
        onClear={() =>
          chromeLeetCodeStorage()
            .clearEvents()
            .then(
              () => setMessage({ tone: 'good', text: 'Detected events cleared.' }),
              (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
            )
        }
      />
    </Card>
  );
}
