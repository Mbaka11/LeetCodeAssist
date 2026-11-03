/**
 * The bonus pool: extra NeetCode 150 problems that are not part of the program queue (SPEC §2).
 * The planner keeps two optional offers open at any time, chosen in pool order among the problems whose
 * category is ready (see `src/core/bonus.ts`), also after day 60. Completing one starts a normal review cycle
 * but does not count toward pace or the program counter. All slugs refer to src/data/neetcode150.ts and
 * never overlap with the program queue or the benchmarks.
 */

/**
 * Ordered bonus problems: roadmap category order, then Easy before Medium before Hard. Since the program
 * became 60 days (0.12), the most useful of the Mediums that used to be bonuses are phase 2 of the queue; what
 * remains is the rest of those Mediums and every free Hard.
 */
export const BONUS_POOL: readonly string[] = [
  // Two Pointers
  'trapping-rain-water',
  // Sliding Window
  'permutation-in-string',
  'minimum-window-substring',
  'sliding-window-maximum',
  // Stack
  'evaluate-reverse-polish-notation',
  'car-fleet',
  'largest-rectangle-in-histogram',
  // Binary Search
  'time-based-key-value-store',
  'median-of-two-sorted-arrays',
  // Linked List
  'copy-list-with-random-pointer',
  'add-two-numbers',
  'find-the-duplicate-number',
  'reverse-nodes-in-k-group',
  // Trees
  'construct-binary-tree-from-preorder-and-inorder-traversal',
  'binary-tree-maximum-path-sum',
  'serialize-and-deserialize-binary-tree',
  // Heap / Priority Queue
  'design-twitter',
  'find-median-from-data-stream',
  // Backtracking
  'letter-combinations-of-a-phone-number',
  'n-queens',
  // Tries
  'design-add-and-search-words-data-structure',
  // Graphs
  'pacific-atlantic-water-flow',
  'redundant-connection',
  // Advanced Graphs
  'min-cost-to-connect-all-points',
  'cheapest-flights-within-k-stops',
  'reconstruct-itinerary',
  'swim-in-rising-water',
  // 1-D Dynamic Programming
  'palindromic-substrings',
  'maximum-product-subarray',
  'partition-equal-subset-sum',
  // 2-D Dynamic Programming
  'best-time-to-buy-and-sell-stock-with-cooldown',
  'target-sum',
  'interleaving-string',
  'longest-increasing-path-in-a-matrix',
  'distinct-subsequences',
  'burst-balloons',
  'regular-expression-matching',
  // Greedy
  'hand-of-straights',
  'merge-triplets-to-form-target-triplet',
  'valid-parenthesis-string',
  // Intervals
  'minimum-interval-to-include-each-query',
  // Math & Geometry
  'powx-n',
  'multiply-strings',
  'detect-squares',
  'spiral-matrix',
  'set-matrix-zeroes',
  // Bit Manipulation
  'reverse-integer',
];

const BONUS_SLUGS: ReadonlySet<string> = new Set(BONUS_POOL);

export function isBonusProblem(slug: string): boolean {
  return BONUS_SLUGS.has(slug);
}
