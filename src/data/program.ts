/**
 * The 60-day program: an ordered queue of new problems (SPEC §4), the day skeleton and
 * the reserved benchmark problems. All slugs refer to src/data/neetcode150.ts.
 *
 * Phase 1 (days 1-30) learns the 50 core problems; phase 2 (days 31-60) is a second, deeper pass over the same
 * categories with 36 more problems. The remaining Mediums and the Hards stay in the optional bonus pool.
 */

/**
 * Phase 1 queue (50 problems), NeetCode roadmap order, no Hard. It holds every free Easy problem of
 * the NeetCode 150 except the benchmark ones (the premium-only Easy `meeting-rooms` is left out) and the
 * core Mediums of each pattern.
 */
export const PHASE_ONE_QUEUE: readonly string[] = [
  // Arrays & Hashing
  'two-sum',
  'valid-anagram',
  'group-anagrams',
  'top-k-frequent-elements',
  // Two Pointers
  'valid-palindrome',
  'two-sum-ii-input-array-is-sorted',
  '3sum',
  // Sliding Window
  'best-time-to-buy-and-sell-stock',
  'longest-substring-without-repeating-characters',
  // Stack
  'valid-parentheses',
  'min-stack',
  'daily-temperatures',
  // Binary Search
  'binary-search',
  'search-a-2d-matrix',
  'find-minimum-in-rotated-sorted-array',
  // Linked List
  'reverse-linked-list',
  'merge-two-sorted-lists',
  'linked-list-cycle',
  'remove-nth-node-from-end-of-list',
  'reorder-list',
  // Trees
  'invert-binary-tree',
  'maximum-depth-of-binary-tree',
  'diameter-of-binary-tree',
  'same-tree',
  'subtree-of-another-tree',
  'binary-tree-level-order-traversal',
  'lowest-common-ancestor-of-a-binary-search-tree',
  // Heap / Priority Queue
  'kth-largest-element-in-a-stream',
  'last-stone-weight',
  'k-closest-points-to-origin',
  // Backtracking
  'subsets',
  'combination-sum',
  'permutations',
  // Graphs
  'number-of-islands',
  'max-area-of-island',
  'course-schedule',
  // Intervals
  'merge-intervals',
  // Greedy
  'maximum-subarray',
  'jump-game',
  // 1-D Dynamic Programming
  'climbing-stairs',
  'min-cost-climbing-stairs',
  'house-robber',
  'coin-change',
  // Mixed finish
  'longest-consecutive-sequence',
  // Math & Geometry, Bit Manipulation (Easy)
  'plus-one',
  'single-number',
  'number-of-1-bits',
  'counting-bits',
  'reverse-bits',
  'missing-number',
];

/**
 * Phase 2 queue (36 problems, days 31-60): a second, deeper pass in roadmap category order with the Mediums
 * that matter most (plus `word-search-ii`, the one Hard, as the Tries anchor). No Easy is left: phase 1 holds
 * them all. It is smaller than phase 1 on purpose: from day 31 reviews fill about half of the daily budget, so
 * a perfect user fits roughly 1.2 new problems a day (see `PHASE_TWO_NEW_PER_LEARNING_DAY`). The other Mediums
 * and the Hards are in `BONUS_POOL`.
 */
export const PHASE_TWO_QUEUE: readonly string[] = [
  // Arrays & Hashing
  'valid-sudoku',
  // Two Pointers
  'container-with-most-water',
  // Sliding Window
  'longest-repeating-character-replacement',
  // Stack
  'generate-parentheses',
  // Binary Search
  'koko-eating-bananas',
  'search-in-rotated-sorted-array',
  // Linked List
  'lru-cache',
  // Trees
  'count-good-nodes-in-binary-tree',
  'validate-binary-search-tree',
  'kth-smallest-element-in-a-bst',
  // Heap / Priority Queue
  'kth-largest-element-in-an-array',
  'task-scheduler',
  // Backtracking
  'word-search',
  'subsets-ii',
  'combination-sum-ii',
  // Tries
  'implement-trie-prefix-tree',
  'word-search-ii',
  // Graphs
  'clone-graph',
  'rotting-oranges',
  'course-schedule-ii',
  'surrounded-regions',
  // Advanced Graphs
  'network-delay-time',
  // 1-D Dynamic Programming
  'house-robber-ii',
  'longest-palindromic-substring',
  'decode-ways',
  'word-break',
  'longest-increasing-subsequence',
  // 2-D Dynamic Programming
  'unique-paths',
  'longest-common-subsequence',
  'edit-distance',
  // Greedy
  'jump-game-ii',
  'gas-station',
  'partition-labels',
  // Intervals
  'insert-interval',
  // Math & Geometry
  'rotate-image',
  // Bit Manipulation
  'sum-of-two-integers',
];

/** The whole program queue: phase 1 then phase 2 (86 problems). */
export const PROGRAM_QUEUE: readonly string[] = [...PHASE_ONE_QUEUE, ...PHASE_TWO_QUEUE];

export interface Benchmark {
  /** Program day on which the pair is taken. */
  day: number;
  /** The lighter unseen problem of the pair: an Easy on days 1-30, a Medium on days 45 and 60. */
  easy: string;
  /** The harder unseen problem of the pair: a Medium on days 1-30, a Hard on days 45 and 60. */
  medium: string;
}

/** Reserved benchmark pairs: never in PROGRAM_QUEUE. */
export const BENCHMARKS: readonly Benchmark[] = [
  { day: 1, easy: 'contains-duplicate', medium: 'product-of-array-except-self' },
  { day: 15, easy: 'balanced-binary-tree', medium: 'binary-tree-right-side-view' },
  { day: 30, easy: 'happy-number', medium: 'non-overlapping-intervals' },
  { day: 45, easy: 'palindrome-partitioning', medium: 'merge-k-sorted-lists' },
  { day: 60, easy: 'coin-change-ii', medium: 'word-ladder' },
];

export const BENCHMARK_DAYS: readonly number[] = BENCHMARKS.map((b) => b.day);

/** Consolidation days: no new problems. */
export const CONSOLIDATION_DAYS: readonly number[] = [7, 14, 21, 28, 35, 42, 49, 56];

/** Last day of phase 1; the Day 30 retrospective closes it. */
export const PHASE_ONE_DAYS = 30;

export const PROGRAM_LENGTH_DAYS = 60;

/** New problems on a normal day of phase 1. */
export const NEW_PROBLEMS_PER_DAY = 2;

/**
 * Expected new problems per learning day in phase 2 (days 31-60), as a fraction (5 per 4 days). Reviews take about
 * half of the budget by then, so the expected pace is lower than in phase 1.
 */
export const PHASE_TWO_NEW_PER_LEARNING_DAY = { numerator: 5, denominator: 4 } as const;

/** A third new problem is allowed on a normal day when it is Easy and fits the soft overflow (SPEC §4). */
export const MAX_NEW_PROBLEMS_PER_DAY = 3;

export interface DaySkeleton {
  day: number;
  /** Categories this day focuses on (empty on consolidation days). */
  focus: readonly string[];
  consolidation: boolean;
  benchmark: boolean;
}

const FOCUS_BY_DAY: Record<number, readonly string[]> = {
  1: ['Arrays & Hashing'],
  2: ['Arrays & Hashing'],
  3: ['Two Pointers'],
  4: ['Two Pointers', 'Sliding Window'],
  5: ['Sliding Window', 'Stack'],
  6: ['Stack'],
  8: ['Binary Search'],
  9: ['Binary Search', 'Linked List'],
  10: ['Linked List'],
  11: ['Linked List', 'Trees'],
  12: ['Trees'],
  13: ['Trees'],
  15: ['Heap / Priority Queue'],
  16: ['Heap / Priority Queue', 'Backtracking'],
  17: ['Backtracking'],
  18: ['Graphs'],
  19: ['Graphs'],
  20: ['Intervals'],
  22: ['Greedy'],
  23: ['Greedy'],
  24: ['1-D Dynamic Programming'],
  25: ['1-D Dynamic Programming'],
  26: ['1-D Dynamic Programming'],
  27: ['1-D Dynamic Programming', 'Arrays & Hashing'],
  29: ['Stack', 'Backtracking'],
  30: ['Two Pointers', 'Linked List'],
  // Phase 2: a second, deeper pass in roadmap order (about 1-2 new problems a day).
  31: ['Arrays & Hashing', 'Two Pointers'],
  32: ['Sliding Window'],
  33: ['Stack', 'Binary Search'],
  34: ['Binary Search'],
  36: ['Linked List', 'Trees'],
  37: ['Trees'],
  38: ['Trees', 'Heap / Priority Queue'],
  39: ['Heap / Priority Queue'],
  40: ['Backtracking'],
  41: ['Backtracking'],
  43: ['Tries'],
  44: ['Graphs'],
  45: ['Graphs'],
  46: ['Graphs'],
  47: ['Advanced Graphs', '1-D Dynamic Programming'],
  48: ['1-D Dynamic Programming'],
  50: ['1-D Dynamic Programming'],
  51: ['1-D Dynamic Programming'],
  52: ['2-D Dynamic Programming'],
  53: ['2-D Dynamic Programming'],
  54: ['Greedy'],
  55: ['Greedy'],
  57: ['Intervals', 'Math & Geometry'],
  58: ['Bit Manipulation'],
  59: ['Graphs', '1-D Dynamic Programming'],
  60: ['Trees', 'Backtracking'],
};

/** The 60-day skeleton (days 1-60). The queue, not the skeleton, decides which problems come next. */
export const DAY_SKELETON: readonly DaySkeleton[] = Array.from(
  { length: PROGRAM_LENGTH_DAYS },
  (_, i): DaySkeleton => {
    const day = i + 1;
    return {
      day,
      focus: FOCUS_BY_DAY[day] ?? [],
      consolidation: CONSOLIDATION_DAYS.includes(day),
      benchmark: BENCHMARK_DAYS.includes(day),
    };
  },
);

export function isConsolidationDay(day: number): boolean {
  return CONSOLIDATION_DAYS.includes(day);
}

export function benchmarkForDay(day: number): Benchmark | undefined {
  return BENCHMARKS.find((b) => b.day === day);
}

/**
 * Number of new problems a user on schedule has completed by the end of program day `day`: 2 per normal day
 * of phase 1 and 5 per 4 normal days of phase 2, capped by the queue length. The planner is a little faster on
 * Easy days in phase 1; the queue must stay within what this reaches by day 60 (checked in program.test.ts).
 */
export function expectedNewDone(day: number, queueLength: number = PROGRAM_QUEUE.length): number {
  const lastDay = Math.min(Math.max(day, 0), PROGRAM_LENGTH_DAYS);
  let phaseOneDays = 0;
  let phaseTwoDays = 0;
  for (let d = 1; d <= lastDay; d += 1) {
    if (isConsolidationDay(d)) continue;
    if (d <= PHASE_ONE_DAYS) phaseOneDays += 1;
    else phaseTwoDays += 1;
  }
  const { numerator, denominator } = PHASE_TWO_NEW_PER_LEARNING_DAY;
  const expected = phaseOneDays * NEW_PROBLEMS_PER_DAY + Math.floor((phaseTwoDays * numerator) / denominator);
  return Math.min(queueLength, expected);
}
