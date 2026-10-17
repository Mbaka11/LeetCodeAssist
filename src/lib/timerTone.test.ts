import { describe, expect, it } from 'vitest';
import { timerTone } from './timerTone';

const min = (m: number): number => m * 60_000;

describe('timerTone', () => {
  it('is green under 75% of the budget', () => {
    expect(timerTone(0, 40)).toBe('good');
    expect(timerTone(min(29), 40)).toBe('good');
    expect(timerTone(min(30) - 1, 40)).toBe('good');
  });

  it('is amber from 75% up to and including 100%', () => {
    expect(timerTone(min(30), 40)).toBe('warn');
    expect(timerTone(min(39), 40)).toBe('warn');
    expect(timerTone(min(40), 40)).toBe('warn');
  });

  it('is red above 100%', () => {
    expect(timerTone(min(40) + 1, 40)).toBe('bad');
    expect(timerTone(min(120), 40)).toBe('bad');
  });

  it('is neutral when paused or not started, whatever the elapsed time', () => {
    expect(timerTone(min(10), 40, false)).toBe('neutral');
    expect(timerTone(min(120), 40, false)).toBe('neutral');
  });

  it('is neutral without a usable budget and never negative', () => {
    expect(timerTone(min(10), 0)).toBe('neutral');
    expect(timerTone(min(10), Number.NaN)).toBe('neutral');
    expect(timerTone(-5, 40)).toBe('good');
  });
});
