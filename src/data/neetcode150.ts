import type { Difficulty, Problem } from '../core/types';

/**
 * The NeetCode 150 problem list: facts only (slug, title, difficulty, category, URL).
 * Explanations and solutions are intentionally not included.
 */

export const CATEGORY_NAMES = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees',
  'Heap / Priority Queue',
  'Backtracking',
  'Tries',
  'Graphs',
  'Advanced Graphs',
  '1-D Dynamic Programming',
  '2-D Dynamic Programming',
  'Greedy',
  'Intervals',
  'Math & Geometry',
  'Bit Manipulation',
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

type Row = readonly [slug: string, title: string, difficulty: Difficulty];

const E = 'Easy';
const M = 'Medium';
const H = 'Hard';

/** Problems grouped by category, in NeetCode roadmap order. */
const ROWS: Record<CategoryName, readonly Row[]> = {
  'Arrays & Hashing': [
    ['contains-duplicate', 'Contains Duplicate', E],
    ['valid-anagram', 'Valid Anagram', E],
    ['two-sum', 'Two Sum', E],
    ['group-anagrams', 'Group Anagrams', M],
    ['top-k-frequent-elements', 'Top K Frequent Elements', M],
    ['encode-and-decode-strings', 'Encode and Decode Strings', M],
    ['product-of-array-except-self', 'Product of Array Except Self', M],
    ['valid-sudoku', 'Valid Sudoku', M],
    ['longest-consecutive-sequence', 'Longest Consecutive Sequence', M],
  ],
  'Two Pointers': [
    ['valid-palindrome', 'Valid Palindrome', E],
    ['two-sum-ii-input-array-is-sorted', 'Two Sum II - Input Array Is Sorted', M],
    ['3sum', '3Sum', M],
    ['container-with-most-water', 'Container With Most Water', M],
    ['trapping-rain-water', 'Trapping Rain Water', H],
  ],
  'Sliding Window': [
    ['best-time-to-buy-and-sell-stock', 'Best Time to Buy and Sell Stock', E],
    [
      'longest-substring-without-repeating-characters',
      'Longest Substring Without Repeating Characters',
      M,
    ],
    [
      'longest-repeating-character-replacement',
      'Longest Repeating Character Replacement',
      M,
    ],
    ['permutation-in-string', 'Permutation in String', M],
    ['minimum-window-substring', 'Minimum Window Substring', H],
    ['sliding-window-maximum', 'Sliding Window Maximum', H],
  ],
  Stack: [
    ['valid-parentheses', 'Valid Parentheses', E],
    ['min-stack', 'Min Stack', M],
    ['evaluate-reverse-polish-notation', 'Evaluate Reverse Polish Notation', M],
    ['generate-parentheses', 'Generate Parentheses', M],
    ['daily-temperatures', 'Daily Temperatures', M],
    ['car-fleet', 'Car Fleet', M],
    ['largest-rectangle-in-histogram', 'Largest Rectangle in Histogram', H],
  ],
  'Binary Search': [
    ['binary-search', 'Binary Search', E],
    ['search-a-2d-matrix', 'Search a 2D Matrix', M],
    ['koko-eating-bananas', 'Koko Eating Bananas', M],
    ['find-minimum-in-rotated-sorted-array', 'Find Minimum in Rotated Sorted Array', M],
    ['search-in-rotated-sorted-array', 'Search in Rotated Sorted Array', M],
    ['time-based-key-value-store', 'Time Based Key-Value Store', M],
    ['median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', H],
  ],
  'Linked List': [
    ['reverse-linked-list', 'Reverse Linked List', E],
    ['merge-two-sorted-lists', 'Merge Two Sorted Lists', E],
    ['reorder-list', 'Reorder List', M],
    ['remove-nth-node-from-end-of-list', 'Remove Nth Node From End of List', M],
    ['copy-list-with-random-pointer', 'Copy List with Random Pointer', M],
    ['add-two-numbers', 'Add Two Numbers', M],
    ['linked-list-cycle', 'Linked List Cycle', E],
    ['find-the-duplicate-number', 'Find the Duplicate Number', M],
    ['lru-cache', 'LRU Cache', M],
    ['merge-k-sorted-lists', 'Merge k Sorted Lists', H],
    ['reverse-nodes-in-k-group', 'Reverse Nodes in k-Group', H],
  ],
  Trees: [
    ['invert-binary-tree', 'Invert Binary Tree', E],
    ['maximum-depth-of-binary-tree', 'Maximum Depth of Binary Tree', E],
    ['diameter-of-binary-tree', 'Diameter of Binary Tree', E],
    ['balanced-binary-tree', 'Balanced Binary Tree', E],
    ['same-tree', 'Same Tree', E],
    ['subtree-of-another-tree', 'Subtree of Another Tree', E],
    [
      'lowest-common-ancestor-of-a-binary-search-tree',
      'Lowest Common Ancestor of a Binary Search Tree',
      M,
    ],
    ['binary-tree-level-order-traversal', 'Binary Tree Level Order Traversal', M],
    ['binary-tree-right-side-view', 'Binary Tree Right Side View', M],
    ['count-good-nodes-in-binary-tree', 'Count Good Nodes in Binary Tree', M],
    ['validate-binary-search-tree', 'Validate Binary Search Tree', M],
    ['kth-smallest-element-in-a-bst', 'Kth Smallest Element in a BST', M],
    [
      'construct-binary-tree-from-preorder-and-inorder-traversal',
      'Construct Binary Tree from Preorder and Inorder Traversal',
      M,
    ],
    ['binary-tree-maximum-path-sum', 'Binary Tree Maximum Path Sum', H],
    ['serialize-and-deserialize-binary-tree', 'Serialize and Deserialize Binary Tree', H],
  ],
  'Heap / Priority Queue': [
    ['kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', E],
    ['last-stone-weight', 'Last Stone Weight', E],
    ['k-closest-points-to-origin', 'K Closest Points to Origin', M],
    ['kth-largest-element-in-an-array', 'Kth Largest Element in an Array', M],
    ['task-scheduler', 'Task Scheduler', M],
    ['design-twitter', 'Design Twitter', M],
    ['find-median-from-data-stream', 'Find Median from Data Stream', H],
  ],
  Backtracking: [
    ['subsets', 'Subsets', M],
    ['combination-sum', 'Combination Sum', M],
    ['permutations', 'Permutations', M],
    ['subsets-ii', 'Subsets II', M],
    ['combination-sum-ii', 'Combination Sum II', M],
    ['word-search', 'Word Search', M],
    ['palindrome-partitioning', 'Palindrome Partitioning', M],
    ['letter-combinations-of-a-phone-number', 'Letter Combinations of a Phone Number', M],
    ['n-queens', 'N-Queens', H],
  ],
  Tries: [
    ['implement-trie-prefix-tree', 'Implement Trie (Prefix Tree)', M],
    [
      'design-add-and-search-words-data-structure',
      'Design Add and Search Words Data Structure',
      M,
    ],
    ['word-search-ii', 'Word Search II', H],
  ],
  Graphs: [
    ['number-of-islands', 'Number of Islands', M],
    ['max-area-of-island', 'Max Area of Island', M],
    ['clone-graph', 'Clone Graph', M],
    ['walls-and-gates', 'Walls and Gates', M],
    ['rotting-oranges', 'Rotting Oranges', M],
    ['pacific-atlantic-water-flow', 'Pacific Atlantic Water Flow', M],
    ['surrounded-regions', 'Surrounded Regions', M],
    ['course-schedule', 'Course Schedule', M],
    ['course-schedule-ii', 'Course Schedule II', M],
    ['redundant-connection', 'Redundant Connection', M],
    [
      'number-of-connected-components-in-an-undirected-graph',
      'Number of Connected Components in an Undirected Graph',
      M,
    ],
    ['graph-valid-tree', 'Graph Valid Tree', M],
    ['word-ladder', 'Word Ladder', H],
  ],
  'Advanced Graphs': [
    ['reconstruct-itinerary', 'Reconstruct Itinerary', H],
    ['min-cost-to-connect-all-points', 'Min Cost to Connect All Points', M],
    ['network-delay-time', 'Network Delay Time', M],
    ['swim-in-rising-water', 'Swim in Rising Water', H],
    ['alien-dictionary', 'Alien Dictionary', H],
    ['cheapest-flights-within-k-stops', 'Cheapest Flights Within K Stops', M],
  ],
  '1-D Dynamic Programming': [
    ['climbing-stairs', 'Climbing Stairs', E],
    ['min-cost-climbing-stairs', 'Min Cost Climbing Stairs', E],
    ['house-robber', 'House Robber', M],
    ['house-robber-ii', 'House Robber II', M],
    ['longest-palindromic-substring', 'Longest Palindromic Substring', M],
    ['palindromic-substrings', 'Palindromic Substrings', M],
    ['decode-ways', 'Decode Ways', M],
    ['coin-change', 'Coin Change', M],
    ['maximum-product-subarray', 'Maximum Product Subarray', M],
    ['word-break', 'Word Break', M],
    ['longest-increasing-subsequence', 'Longest Increasing Subsequence', M],
    ['partition-equal-subset-sum', 'Partition Equal Subset Sum', M],
  ],
  '2-D Dynamic Programming': [
    ['unique-paths', 'Unique Paths', M],
    ['longest-common-subsequence', 'Longest Common Subsequence', M],
    [
      'best-time-to-buy-and-sell-stock-with-cooldown',
      'Best Time to Buy and Sell Stock with Cooldown',
      M,
    ],
    ['coin-change-ii', 'Coin Change II', M],
    ['target-sum', 'Target Sum', M],
    ['interleaving-string', 'Interleaving String', M],
    ['longest-increasing-path-in-a-matrix', 'Longest Increasing Path in a Matrix', H],
    ['distinct-subsequences', 'Distinct Subsequences', H],
    ['edit-distance', 'Edit Distance', M],
    ['burst-balloons', 'Burst Balloons', H],
    ['regular-expression-matching', 'Regular Expression Matching', H],
  ],
  Greedy: [
    ['maximum-subarray', 'Maximum Subarray', M],
    ['jump-game', 'Jump Game', M],
    ['jump-game-ii', 'Jump Game II', M],
    ['gas-station', 'Gas Station', M],
    ['hand-of-straights', 'Hand of Straights', M],
    [
      'merge-triplets-to-form-target-triplet',
      'Merge Triplets to Form Target Triplet',
      M,
    ],
    ['partition-labels', 'Partition Labels', M],
    ['valid-parenthesis-string', 'Valid Parenthesis String', M],
  ],
  Intervals: [
    ['insert-interval', 'Insert Interval', M],
    ['merge-intervals', 'Merge Intervals', M],
    ['non-overlapping-intervals', 'Non-overlapping Intervals', M],
    ['meeting-rooms', 'Meeting Rooms', E],
    ['meeting-rooms-ii', 'Meeting Rooms II', M],
    [
      'minimum-interval-to-include-each-query',
      'Minimum Interval to Include Each Query',
      H,
    ],
  ],
  'Math & Geometry': [
    ['rotate-image', 'Rotate Image', M],
    ['spiral-matrix', 'Spiral Matrix', M],
    ['set-matrix-zeroes', 'Set Matrix Zeroes', M],
    ['happy-number', 'Happy Number', E],
    ['plus-one', 'Plus One', E],
    ['powx-n', 'Pow(x, n)', M],
    ['multiply-strings', 'Multiply Strings', M],
    ['detect-squares', 'Detect Squares', M],
  ],
  'Bit Manipulation': [
    ['single-number', 'Single Number', E],
    ['number-of-1-bits', 'Number of 1 Bits', E],
    ['counting-bits', 'Counting Bits', E],
    ['reverse-bits', 'Reverse Bits', E],
    ['missing-number', 'Missing Number', E],
    ['sum-of-two-integers', 'Sum of Two Integers', M],
    ['reverse-integer', 'Reverse Integer', M],
  ],
};

export function problemUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

function buildProblems(): Problem[] {
  const problems: Problem[] = [];
  let order = 1;
  for (const category of CATEGORY_NAMES) {
    for (const [slug, title, difficulty] of ROWS[category]) {
      problems.push({
        slug,
        title,
        difficulty,
        category,
        url: problemUrl(slug),
        neetcodeOrder: order,
      });
      order += 1;
    }
  }
  return problems;
}

/** All 150 problems in NeetCode order (`neetcodeOrder` is 1-based). */
export const NEETCODE_150: readonly Problem[] = buildProblems();

export const PROBLEMS_BY_SLUG: ReadonlyMap<string, Problem> = new Map(
  NEETCODE_150.map((problem) => [problem.slug, problem]),
);

export function getProblem(slug: string): Problem | undefined {
  return PROBLEMS_BY_SLUG.get(slug);
}

export interface Category {
  name: CategoryName;
  /** Categories to study first (roadmap edges point from prerequisite to this category). */
  prerequisites: readonly CategoryName[];
}

/** NeetCode roadmap tree: categories in roadmap order with their prerequisite edges. */
export const CATEGORIES: readonly Category[] = [
  { name: 'Arrays & Hashing', prerequisites: [] },
  { name: 'Two Pointers', prerequisites: ['Arrays & Hashing'] },
  { name: 'Sliding Window', prerequisites: ['Two Pointers'] },
  { name: 'Stack', prerequisites: ['Arrays & Hashing'] },
  { name: 'Binary Search', prerequisites: ['Two Pointers'] },
  { name: 'Linked List', prerequisites: ['Two Pointers'] },
  { name: 'Trees', prerequisites: ['Binary Search', 'Linked List'] },
  { name: 'Heap / Priority Queue', prerequisites: ['Trees'] },
  { name: 'Backtracking', prerequisites: ['Trees'] },
  { name: 'Tries', prerequisites: ['Trees'] },
  { name: 'Graphs', prerequisites: ['Backtracking'] },
  { name: 'Advanced Graphs', prerequisites: ['Graphs', 'Heap / Priority Queue'] },
  { name: '1-D Dynamic Programming', prerequisites: ['Backtracking'] },
  { name: '2-D Dynamic Programming', prerequisites: ['1-D Dynamic Programming'] },
  { name: 'Greedy', prerequisites: ['Heap / Priority Queue'] },
  { name: 'Intervals', prerequisites: ['Heap / Priority Queue'] },
  { name: 'Math & Geometry', prerequisites: ['2-D Dynamic Programming', 'Bit Manipulation'] },
  { name: 'Bit Manipulation', prerequisites: ['1-D Dynamic Programming'] },
];

export function problemsInCategory(category: string): Problem[] {
  return NEETCODE_150.filter((problem) => problem.category === category);
}
