import type { TimerState } from './types';

export function createTimer(): TimerState {
  return { startedAt: null, accumulatedMs: 0, running: false };
}

export function startTimer(timer: TimerState, now: number): TimerState {
  if (timer.running) return timer;
  return { startedAt: now, accumulatedMs: timer.accumulatedMs, running: true };
}

export function pauseTimer(timer: TimerState, now: number): TimerState {
  if (!timer.running) return timer;
  return { startedAt: null, accumulatedMs: elapsedMs(timer, now), running: false };
}

/** Resuming a paused timer is the same transition as starting it. */
export function resumeTimer(timer: TimerState, now: number): TimerState {
  return startTimer(timer, now);
}

/** Total elapsed milliseconds; never negative even if the clock moves backwards. */
export function elapsedMs(timer: TimerState, now: number): number {
  const running =
    timer.running && timer.startedAt !== null ? Math.max(0, now - timer.startedAt) : 0;
  return timer.accumulatedMs + running;
}

/** "mm:ss", or "h:mm:ss" past one hour. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
