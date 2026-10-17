import { describe, expect, it } from 'vitest';
import { isBlind75 } from './blind75';
import { BONUS_POOL } from './bonus';
import { getProblem } from './neetcode150';
import { PREMIUM_PROBLEMS, isPremiumProblem } from './premium';
import { BENCHMARKS, PROGRAM_QUEUE } from './program';

describe('Premium problems', () => {
  it('are known NeetCode 150 problems', () => {
    expect(PREMIUM_PROBLEMS).toHaveLength(7);
    for (const slug of PREMIUM_PROBLEMS) expect(getProblem(slug), slug).toBeDefined();
  });

  it('never appear in the program queue, the benchmarks or the bonus pool, so they are never scheduled', () => {
    const scheduled = [...PROGRAM_QUEUE, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium]), ...BONUS_POOL];
    expect(scheduled.filter(isPremiumProblem)).toEqual([]);
  });

  it('are six in the Blind 75', () => {
    expect(PREMIUM_PROBLEMS.filter(isBlind75)).toHaveLength(6);
  });
});
