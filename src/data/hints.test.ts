import { describe, expect, it } from 'vitest';
import { HINTS, getHints } from './hints';
import { BENCHMARKS, PROGRAM_QUEUE } from './program';

const EXPECTED_SLUGS = [...PROGRAM_QUEUE, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium])];

describe('HINTS', () => {
  it('covers every program and benchmark slug and nothing else', () => {
    expect(Object.keys(HINTS).sort()).toEqual([...new Set(EXPECTED_SLUGS)].sort());
  });

  it('has three non-empty, distinct, reasonably short levels for each problem', () => {
    for (const slug of EXPECTED_SLUGS) {
      const hint = getHints(slug);
      if (!hint) throw new Error(`missing hint: ${slug}`);
      const levels = [hint.nudge, hint.insight, hint.sketch];
      for (const text of levels) {
        expect(text.trim().length, slug).toBeGreaterThan(0);
        expect(text.length, slug).toBeLessThanOrEqual(400);
      }
      expect(new Set(levels).size, slug).toBe(3);
    }
  });
});

describe('getHints', () => {
  it('returns the hint for a known slug and undefined otherwise', () => {
    expect(getHints('two-sum')).toBe(HINTS['two-sum']);
    expect(getHints('not-a-problem')).toBeUndefined();
    expect(getHints('toString')).toBeUndefined();
  });
});
