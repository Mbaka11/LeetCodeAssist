import { describe, expect, it } from 'vitest';
import { BONUS_POOL, isBonusProblem } from './bonus';
import { CATEGORY_NAMES, PROBLEMS_BY_SLUG } from './neetcode150';
import { BENCHMARKS, PROGRAM_QUEUE } from './program';

describe('BONUS_POOL', () => {
  it('has 18-35 unique problems that all exist in the NeetCode 150', () => {
    expect(BONUS_POOL.length).toBeGreaterThanOrEqual(18);
    expect(BONUS_POOL.length).toBeLessThanOrEqual(35);
    expect(new Set(BONUS_POOL).size).toBe(BONUS_POOL.length);
    for (const slug of BONUS_POOL) {
      expect(PROBLEMS_BY_SLUG.has(slug), slug).toBe(true);
    }
  });

  it('does not overlap with the program queue or the benchmarks', () => {
    const reserved = new Set([...PROGRAM_QUEUE, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium])]);
    for (const slug of BONUS_POOL) {
      expect(reserved.has(slug), slug).toBe(false);
    }
  });

  it('is mostly Medium with at most 1 Hard and no Easy (every free Easy is in the program)', () => {
    const count = (difficulty: string): number =>
      BONUS_POOL.filter((slug) => PROBLEMS_BY_SLUG.get(slug)!.difficulty === difficulty).length;
    expect(count('Hard')).toBeLessThanOrEqual(1);
    expect(count('Easy')).toBe(0);
    expect(count('Medium')).toBeGreaterThan(BONUS_POOL.length / 2);
  });

  it('is ordered by roadmap category, then by difficulty', () => {
    const rank = { Easy: 0, Medium: 1, Hard: 2 } as const;
    const keys = BONUS_POOL.map((slug) => {
      const problem = PROBLEMS_BY_SLUG.get(slug)!;
      return [CATEGORY_NAMES.indexOf(problem.category as (typeof CATEGORY_NAMES)[number]), rank[problem.difficulty]];
    });
    for (let i = 1; i < keys.length; i += 1) {
      const [prevCategory, prevDifficulty] = keys[i - 1]!;
      const [category, difficulty] = keys[i]!;
      expect(category! > prevCategory! || (category === prevCategory && difficulty! >= prevDifficulty!), BONUS_POOL[i]).toBe(true);
    }
  });
});

describe('isBonusProblem', () => {
  it('is true for pool slugs and false otherwise', () => {
    expect(isBonusProblem(BONUS_POOL[0]!)).toBe(true);
    expect(isBonusProblem(PROGRAM_QUEUE[0]!)).toBe(false);
    expect(isBonusProblem('not-a-problem')).toBe(false);
  });
});
