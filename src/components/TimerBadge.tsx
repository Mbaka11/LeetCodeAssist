import { formatElapsed } from '../core/timer';
import {
  HELP_LADDER_CUES,
  TIMER_TONE_ICON,
  TIMER_TONE_TEXT,
  timerTone,
} from '../lib/timerTone';

/**
 * The elapsed time of an open activity, coloured against its budget: green under 75 %, amber up to the
 * budget ("near limit"), red beyond ("over budget"), neutral while paused. The state is always spelled
 * out in text next to an icon, never colour alone. For new problems two subtle help-ladder cues are shown.
 */
export function TimerBadge({
  elapsedMs,
  budgetMin,
  running,
  showHelpLadder = false,
}: {
  elapsedMs: number;
  /** The estimated minutes shown on the card. */
  budgetMin: number;
  running: boolean;
  /** Help-ladder cues at 15 and 35 minutes (new problems only). */
  showHelpLadder?: boolean;
}) {
  const tone = timerTone(elapsedMs, budgetMin, running);
  const text = TIMER_TONE_TEXT[tone];
  const classes = ['timer', `timer-${tone}`];
  if (running) classes.push('timer-running');
  return (
    <span className="timer-badge">
      <span className={classes.join(' ')} role="timer" aria-label="Elapsed time">
        {formatElapsed(elapsedMs)}
      </span>
      {text ? (
        <span className={`timer-tone timer-tone-${tone}`}>
          <span aria-hidden="true">{TIMER_TONE_ICON[tone]}</span> {text}
        </span>
      ) : null}
      {showHelpLadder ? (
        <span className="timer-cues">
          {HELP_LADDER_CUES.map((cue) => (
            <span
              key={cue.minutes}
              className={elapsedMs >= cue.minutes * 60_000 ? 'timer-cue timer-cue-reached' : 'timer-cue'}
            >
              {cue.minutes} min: {cue.text}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
