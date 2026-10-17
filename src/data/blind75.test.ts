import { describe, expect, it } from 'vitest';
import { BLIND_75, isBlind75 } from './blind75';
import { BONUS_POOL } from './bonus';
import { PROBLEMS_BY_SLUG } from './neetcode150';
import { PREMIUM_PROBLEMS, isPremiumProblem } from './premium';
import { BENCHMARKS, PROGRAM_QUEUE } from './program';

describe('BLIND_75', () => {
  it('has 75 unique slugs that all exist in the NeetCode 150', () => {
    expect(BLIND_75).toHaveLength(75);
    expect(new Set(BLIND_75).size).toBe(75);
    for (const slug of BLIND_75) expect(PROBLEMS_BY_SLUG.has(slug), slug).toBe(true);
  });

  it('is the NeetCode version: Combination Sum, not Combination Sum IV, and no Min Stack', () => {
    expect(isBlind75('contains-duplicate')).toBe(true);
    expect(isBlind75('combination-sum')).toBe(true);
    expect(isBlind75('combination-sum-iv')).toBe(false);
    expect(isBlind75('min-stack')).toBe(false);
    expect(isBlind75('not-a-problem')).toBe(false);
  });

  it('keeps the six Premium problems in the list', () => {
    const premium = BLIND_75.filter(isPremiumProblem).sort();
    expect(premium).toEqual(
      [
        'alien-dictionary',
        'encode-and-decode-strings',
        'graph-valid-tree',
        'meeting-rooms',
        'meeting-rooms-ii',
        'number-of-connected-components-in-an-undirected-graph',
      ].sort(),
    );
  });
});

describe('PREMIUM_PROBLEMS', () => {
  it('lists the seven Premium NeetCode 150 problems, all known, and never schedules one', () => {
    expect(PREMIUM_PROBLEMS).toHaveLength(7);
    expect(isPremiumProblem('walls-and-gates')).toBe(true);
    expect(isPremiumProblem('two-sum')).toBe(false);
    const scheduled = new Set([...PROGRAM_QUEUE, ...BONUS_POOL, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium])]);
    for (const slug of PREMIUM_PROBLEMS) {
      expect(PROBLEMS_BY_SLUG.has(slug), slug).toBe(true);
      expect(scheduled.has(slug), slug).toBe(false);
    }
  });
});
