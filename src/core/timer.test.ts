import { describe, expect, it } from 'vitest';
import { createTimer, elapsedMs, formatElapsed, pauseTimer, resumeTimer, startTimer } from './timer';

describe('timer', () => {
  it('starts idle', () => {
    const timer = createTimer();
    expect(timer).toEqual({ startedAt: null, accumulatedMs: 0, running: false });
    expect(elapsedMs(timer, 5000)).toBe(0);
  });

  it('derives elapsed time from timestamps', () => {
    const running = startTimer(createTimer(), 1000);
    expect(running.running).toBe(true);
    expect(elapsedMs(running, 1000)).toBe(0);
    expect(elapsedMs(running, 61_000)).toBe(60_000);
    expect(elapsedMs(running, 3_601_000)).toBe(3_600_000);
  });

  it('accumulates across pause and resume', () => {
    let timer = startTimer(createTimer(), 0);
    timer = pauseTimer(timer, 10_000);
    expect(timer).toEqual({ startedAt: null, accumulatedMs: 10_000, running: false });
    expect(elapsedMs(timer, 999_999)).toBe(10_000);
    timer = resumeTimer(timer, 100_000);
    expect(elapsedMs(timer, 105_000)).toBe(15_000);
    timer = pauseTimer(timer, 130_000);
    expect(elapsedMs(timer, 500_000)).toBe(40_000);
  });

  it('is idempotent for repeated start and pause', () => {
    const started = startTimer(createTimer(), 0);
    expect(startTimer(started, 5000)).toBe(started);
    const paused = pauseTimer(started, 1000);
    expect(pauseTimer(paused, 9000)).toBe(paused);
  });

  it('never goes negative when the clock moves backwards', () => {
    const running = startTimer(createTimer(), 10_000);
    expect(elapsedMs(running, 5000)).toBe(0);
    expect(pauseTimer(running, 5000).accumulatedMs).toBe(0);
  });

  it('does not mutate its input', () => {
    const timer = createTimer();
    startTimer(timer, 1);
    expect(timer).toEqual({ startedAt: null, accumulatedMs: 0, running: false });
  });

  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatElapsed(-5)).toBe('00:00');
  });
});
