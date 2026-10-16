/**
 * The 30-day program: an ordered queue of new problems (SPEC §4), the day skeleton and
 * the reserved benchmark problems. All slugs refer to src/data/neetcode150.ts.
 */

/** Ordered queue of new problems (53), NeetCode roadmap order, 2 Hard at the very end. */
export const PROGRAM_QUEUE: readonly string[] = [
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
  'remove-nth-node-from-end-of-list',
  'reorder-list',
  // Trees
  'invert-binary-tree',
  'maximum-depth-of-binary-tree',
  'same-tree',
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
  'clone-graph',
  'course-schedule',
  // Intervals
  'merge-intervals',
  'insert-interval',
  // Greedy
  'maximum-subarray',
  'jump-game',
  'jump-game-ii',
  'gas-station',
  // 1-D Dynamic Programming
  'climbing-stairs',
  'min-cost-climbing-stairs',
  'house-robber',
  'house-robber-ii',
  'longest-palindromic-substring',
  'decode-ways',
  'coin-change',
  // Mixed finish
  'longest-consecutive-sequence',
  'word-break',
  'generate-parentheses',
  'word-search',
  // Hard (at most two, at the very end)
  'trapping-rain-water',
  'merge-k-sorted-lists',
];

export interface Benchmark {
  /** Program day on which the pair is taken. */
  day: number;
  /** Unseen Easy problem. */
  easy: string;
  /** Unseen Medium problem. */
  medium: string;
}

/** Reserved benchmark pairs: never in PROGRAM_QUEUE. */
export const BENCHMARKS: readonly Benchmark[] = [
  { day: 1, easy: 'contains-duplicate', medium: 'product-of-array-except-self' },
  { day: 15, easy: 'balanced-binary-tree', medium: 'binary-tree-right-side-view' },
  { day: 30, easy: 'happy-number', medium: 'non-overlapping-intervals' },
];

export const BENCHMARK_DAYS: readonly number[] = BENCHMARKS.map((b) => b.day);

/** Consolidation days: no new problems. */
export const CONSOLIDATION_DAYS: readonly number[] = [7, 14, 21, 28];

export const PROGRAM_LENGTH_DAYS = 30;

export const NEW_PROBLEMS_PER_DAY = 2;

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
};

/** The 30-day skeleton (days 1-30). The queue, not the skeleton, decides which problems come next. */
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
 * Number of new problems a user on schedule has completed by the end of program day `day`
 * (2 per non-consolidation day, capped by the queue length).
 */
export function expectedNewDone(day: number, queueLength: number = PROGRAM_QUEUE.length): number {
  const lastDay = Math.min(Math.max(day, 0), PROGRAM_LENGTH_DAYS);
  let learningDays = 0;
  for (let d = 1; d <= lastDay; d += 1) {
    if (!isConsolidationDay(d)) learningDays += 1;
  }
  return Math.min(queueLength, learningDays * NEW_PROBLEMS_PER_DAY);
}
