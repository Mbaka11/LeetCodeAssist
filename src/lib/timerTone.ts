/** Pure helpers for the timer colours and the help-ladder cues (no browser APIs). */

export type TimerTone = 'neutral' | 'good' | 'warn' | 'bad';

/** From this share of the budget the timer turns amber. */
export const NEAR_LIMIT_RATIO = 0.75;

/** Help-ladder cue minutes for a `new` problem (SPEC section 3). */
export const HELP_LADDER_CUES: readonly { minutes: number; text: string }[] = [
  { minutes: 15, text: 'consider a hint' },
  { minutes: 35, text: 'read the solution, then re-code it' },
];

/**
 * Tone of a timer against its budget: green under 75 %, amber from 75 % up to and including 100 %, red
 * beyond. A timer that is not running (paused or not started) and a missing budget are neutral.
 */
export function timerTone(elapsedMs: number, budgetMin: number, running = true): TimerTone {
  if (!running || !Number.isFinite(budgetMin) || budgetMin <= 0) return 'neutral';
  const ratio = Math.max(0, elapsedMs) / (budgetMin * 60_000);
  if (ratio < NEAR_LIMIT_RATIO) return 'good';
  return ratio <= 1 ? 'warn' : 'bad';
}

/** Short text that accompanies the colour, so the state never depends on colour alone. */
export const TIMER_TONE_TEXT: Record<TimerTone, string> = {
  neutral: '',
  good: 'on pace',
  warn: 'near limit',
  bad: 'over budget',
};

export const TIMER_TONE_ICON: Record<TimerTone, string> = {
  neutral: '',
  good: '✓',
  warn: '⚠',
  bad: '✕',
};
