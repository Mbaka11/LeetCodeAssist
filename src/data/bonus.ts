/**
 * The bonus pool: extra NeetCode 150 problems that are not part of the 53-problem program (SPEC §2).
 * The planner offers the first one that is not worked yet as the optional third problem of a day,
 * also after day 30. Completing one starts a normal review cycle but does not count toward pace or the
 * program counter. All slugs refer to src/data/neetcode150.ts and never overlap with the program queue
 * or the benchmarks.
 */

/** Ordered bonus problems: roadmap category order, then Easy before Medium before Hard. */
export const BONUS_POOL: readonly string[] = [
  // Stack
  'evaluate-reverse-polish-notation',
  'car-fleet',
  // Binary Search
  'koko-eating-bananas',
  'search-in-rotated-sorted-array',
  // Trees
  'diameter-of-binary-tree',
  'validate-binary-search-tree',
  'kth-smallest-element-in-a-bst',
  // Heap / Priority Queue
  'kth-largest-element-in-an-array',
  'task-scheduler',
  // Backtracking
  'subsets-ii',
  // Tries
  'implement-trie-prefix-tree',
  'design-add-and-search-words-data-structure',
  'word-search-ii',
  // Graphs
  'rotting-oranges',
  'course-schedule-ii',
  // 2-D Dynamic Programming
  'unique-paths',
  'longest-common-subsequence',
  // Greedy
  'partition-labels',
  // Intervals
  'meeting-rooms',
  // Math & Geometry
  'rotate-image',
  // Bit Manipulation
  'single-number',
];

const BONUS_SLUGS: ReadonlySet<string> = new Set(BONUS_POOL);

export function isBonusProblem(slug: string): boolean {
  return BONUS_SLUGS.has(slug);
}
