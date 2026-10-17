/**
 * The bonus pool: extra NeetCode 150 problems that are not part of the program queue (SPEC §2).
 * The planner keeps two optional offers open at any time, chosen in pool order among the problems whose
 * category is ready (see `src/core/bonus.ts`), also after day 30. Completing one starts a normal review cycle
 * but does not count toward pace or the program counter. All slugs refer to src/data/neetcode150.ts and
 * never overlap with the program queue or the benchmarks.
 */

/**
 * Ordered bonus problems: roadmap category order, then Easy before Medium before Hard. The Mediums that
 * did not fit the program queue are the first bonuses offered within their category.
 */
export const BONUS_POOL: readonly string[] = [
  // Arrays & Hashing
  'valid-sudoku',
  // Two Pointers
  'container-with-most-water',
  // Sliding Window
  'longest-repeating-character-replacement',
  'permutation-in-string',
  // Stack
  'generate-parentheses',
  'evaluate-reverse-polish-notation',
  'car-fleet',
  // Binary Search
  'koko-eating-bananas',
  'search-in-rotated-sorted-array',
  'time-based-key-value-store',
  // Linked List
  'copy-list-with-random-pointer',
  'add-two-numbers',
  // Trees
  'count-good-nodes-in-binary-tree',
  'validate-binary-search-tree',
  'kth-smallest-element-in-a-bst',
  'construct-binary-tree-from-preorder-and-inorder-traversal',
  // Heap / Priority Queue
  'kth-largest-element-in-an-array',
  'task-scheduler',
  // Backtracking
  'word-search',
  'subsets-ii',
  'letter-combinations-of-a-phone-number',
  // Tries
  'implement-trie-prefix-tree',
  'design-add-and-search-words-data-structure',
  'word-search-ii',
  // Graphs
  'clone-graph',
  'pacific-atlantic-water-flow',
  'rotting-oranges',
  'course-schedule-ii',
  // 1-D Dynamic Programming
  'house-robber-ii',
  'longest-palindromic-substring',
  'palindromic-substrings',
  'decode-ways',
  'maximum-product-subarray',
  'word-break',
  'longest-increasing-subsequence',
  'partition-equal-subset-sum',
  // 2-D Dynamic Programming
  'unique-paths',
  'longest-common-subsequence',
  // Greedy
  'jump-game-ii',
  'gas-station',
  'partition-labels',
  // Intervals
  'insert-interval',
  // Math & Geometry
  'rotate-image',
  'spiral-matrix',
  'set-matrix-zeroes',
  // Bit Manipulation
  'sum-of-two-integers',
];

const BONUS_SLUGS: ReadonlySet<string> = new Set(BONUS_POOL);

export function isBonusProblem(slug: string): boolean {
  return BONUS_SLUGS.has(slug);
}
