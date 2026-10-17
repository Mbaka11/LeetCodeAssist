import { describe, expect, it } from 'vitest';
import { BONUS_POOL, isBonusProblem } from './bonus';
import { CATEGORY_NAMES, PROBLEMS_BY_SLUG } from './neetcode150';
import { isPremiumProblem } from './premium';
import { BENCHMARKS, PROGRAM_QUEUE } from './program';

describe('BONUS_POOL', () => {
  it('has 46 unique problems that all exist in the NeetCode 150', () => {
    expect(BONUS_POOL).toHaveLength(46);
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

describe('BONUS_POOL expansion', () => {
  /** The 0.5 pool, in its original order. */
  const LEGACY_POOL = [
    'generate-parentheses', 'evaluate-reverse-polish-notation', 'car-fleet', 'koko-eating-bananas',
    'search-in-rotated-sorted-array', 'validate-binary-search-tree', 'kth-smallest-element-in-a-bst',
    'kth-largest-element-in-an-array', 'task-scheduler', 'word-search', 'subsets-ii',
    'implement-trie-prefix-tree', 'design-add-and-search-words-data-structure', 'word-search-ii',
    'clone-graph', 'rotting-oranges', 'course-schedule-ii', 'house-robber-ii',
    'longest-palindromic-substring', 'decode-ways', 'word-break', 'unique-paths',
    'longest-common-subsequence', 'jump-game-ii', 'gas-station', 'partition-labels',
    'insert-interval', 'rotate-image',
  ];
  const ADDED = [
    'valid-sudoku', 'container-with-most-water', 'longest-repeating-character-replacement',
    'permutation-in-string', 'time-based-key-value-store', 'copy-list-with-random-pointer',
    'add-two-numbers', 'count-good-nodes-in-binary-tree',
    'construct-binary-tree-from-preorder-and-inorder-traversal',
    'letter-combinations-of-a-phone-number', 'pacific-atlantic-water-flow', 'palindromic-substrings',
    'maximum-product-subarray', 'longest-increasing-subsequence', 'partition-equal-subset-sum',
    'spiral-matrix', 'set-matrix-zeroes', 'sum-of-two-integers',
  ];

  it('keeps every old member in its original relative order', () => {
    expect(BONUS_POOL.filter((slug) => LEGACY_POOL.includes(slug))).toEqual(LEGACY_POOL);
  });

  it('adds exactly the 18 new free Medium problems', () => {
    expect(BONUS_POOL.filter((slug) => !LEGACY_POOL.includes(slug)).sort()).toEqual([...ADDED].sort());
    for (const slug of ADDED) expect(PROBLEMS_BY_SLUG.get(slug)!.difficulty, slug).toBe('Medium');
  });

  it('never contains a Premium problem', () => {
    for (const slug of BONUS_POOL) expect(isPremiumProblem(slug), slug).toBe(false);
  });
});

describe('isBonusProblem', () => {
  it('is true for pool slugs and false otherwise', () => {
    expect(isBonusProblem(BONUS_POOL[0]!)).toBe(true);
    expect(isBonusProblem(PROGRAM_QUEUE[0]!)).toBe(false);
    expect(isBonusProblem('not-a-problem')).toBe(false);
  });
});
