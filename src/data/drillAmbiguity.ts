import { DRILL_CONTENT } from './drills';
import type { DataStructureTag, TechniqueTag } from './problemMetadata';

type Tag = DataStructureTag | TechniqueTag;
type DrillSlug = keyof typeof DRILL_CONTENT;

/** Too generic to be a convincing wrong answer: nearly any solution can be said to use them. */
export const NEVER_OFFERED_AS_WRONG: readonly Tag[] = ['Simulation', 'Array', 'String'];

/** Closely related tags. If a problem is registered with any member, no other member is offered as a wrong answer. */
export const RELATED_TAG_GROUPS: readonly (readonly Tag[])[] = [
  ['Hashing', 'Counting'],
  ['Hash Table', 'Hash Set'],
  ['Sorting', 'Sweep Line', 'Quickselect'],
  ['Greedy', 'Dynamic Programming', 'Simulation'],
  ['Depth-First Search', 'Breadth-First Search', 'Recursion', 'Backtracking'],
  ['Dynamic Programming', 'Recursion', 'Backtracking', 'Depth-First Search'],
  ['Two Pointers', 'Fast and Slow Pointers'],
  ['Bit Manipulation', 'Math'],
  ['Prefix Sum', 'Prefix Product', 'Prefix Maximum'],
  ['Queue', 'Deque'],
  ['Binary Tree', 'Binary Search Tree'],
];

/**
 * Curated, per problem: other tags that are also sound ways to solve it (alternative solutions, not just the
 * registered ones). They are never offered as wrong answers. Every drill problem has an entry; an empty list
 * means the audit found no further plausible alternative.
 */
export const DRILL_ALSO_VALID: Record<DrillSlug, readonly Tag[]> = {
  'two-sum': ['Sorting', 'Two Pointers', 'Binary Search'],
  'valid-anagram': ['Sorting', 'Hashing'],
  'group-anagrams': [],
  'top-k-frequent-elements': ['Queue', 'Binary Search Tree', 'Binary Tree'],
  'valid-palindrome': ['Recursion', 'Deque', 'Stack'],
  'two-sum-ii-input-array-is-sorted': ['Binary Search', 'Hashing', 'Hash Table', 'Hash Set', 'Greedy'],
  '3sum': ['Hashing', 'Hash Set', 'Hash Table', 'Binary Search'],
  'best-time-to-buy-and-sell-stock': ['Dynamic Programming', 'Two Pointers', 'Sliding Window', 'Prefix Sum', 'Prefix Maximum', 'Monotonic Stack'],
  'longest-substring-without-repeating-characters': ['Two Pointers', 'Hashing', 'Hash Table', 'Queue', 'Deque', 'Dynamic Programming', 'Counting', 'Greedy'],
  'valid-parentheses': ['Deque', 'Recursion', 'Linked List'],
  'min-stack': ['Linked List', 'Deque', 'Doubly Linked List', 'Heap'],
  'daily-temperatures': ['Dynamic Programming', 'Deque', 'Queue', 'Two Pointers'],
  'binary-search': ['Divide and Conquer', 'Recursion', 'Two Pointers'],
  'search-a-2d-matrix': ['Two Pointers', 'Divide and Conquer', 'Recursion'],
  'find-minimum-in-rotated-sorted-array': ['Divide and Conquer', 'Recursion', 'Two Pointers'],
  'reverse-linked-list': ['Stack', 'Deque', 'Doubly Linked List', 'Hash Table'],
  'merge-two-sorted-lists': ['Heap', 'Queue', 'Sorting', 'Divide and Conquer', 'Greedy'],
  'linked-list-cycle': ['Hashing', 'Hash Set', 'Hash Table'],
  'remove-nth-node-from-end-of-list': ['Recursion', 'Stack', 'Deque', 'Doubly Linked List'],
  'reorder-list': ['Stack', 'Deque', 'Recursion', 'Doubly Linked List'],
  'invert-binary-tree': ['Stack', 'Queue', 'Deque', 'Divide and Conquer', 'Graph'],
  'maximum-depth-of-binary-tree': ['Stack', 'Deque', 'Divide and Conquer', 'Graph'],
  'diameter-of-binary-tree': ['Stack', 'Queue', 'Deque', 'Divide and Conquer', 'Graph'],
  'same-tree': ['Stack', 'Queue', 'Deque', 'Serialization', 'Divide and Conquer', 'Graph'],
  'subtree-of-another-tree': ['Stack', 'Queue', 'Deque', 'Serialization', 'Hashing', 'Hash Table', 'Divide and Conquer', 'Graph'],
  'binary-tree-level-order-traversal': ['Deque', 'Stack', 'Hash Table', 'Graph'],
  'lowest-common-ancestor-of-a-binary-search-tree': ['Binary Search', 'Stack', 'Queue', 'Graph'],
  'kth-largest-element-in-a-stream': ['Sorting', 'Quickselect', 'Binary Search', 'Binary Search Tree', 'Queue', 'Deque', 'Binary Tree'],
  'last-stone-weight': ['Sorting', 'Binary Search Tree', 'Queue', 'Deque', 'Binary Tree'],
  'k-closest-points-to-origin': ['Math', 'Divide and Conquer', 'Binary Search', 'Queue', 'Binary Search Tree', 'Binary Tree'],
  'subsets': ['Hash Set', 'Queue', 'Math', 'Stack'],
  'combination-sum': ['Sorting', 'Hash Set'],
  'permutations': ['Hash Set', 'Hash Table', 'Sorting', 'Queue', 'Stack', 'Hashing'],
  'number-of-islands': ['Union Find', 'Disjoint Set', 'Stack', 'Queue', 'Deque', 'Hash Set', 'Hash Table', 'Hashing'],
  'max-area-of-island': ['Union Find', 'Disjoint Set', 'Stack', 'Queue', 'Deque', 'Hash Set', 'Hash Table', 'Hashing'],
  'course-schedule': ['Stack', 'Deque', 'Hash Set', 'Hash Table', 'Heap', 'Hashing'],
  'merge-intervals': ['Greedy', 'Two Pointers', 'Stack', 'Deque', 'Union Find'],
  'maximum-subarray': ['Divide and Conquer', 'Prefix Sum', 'Sliding Window', 'Two Pointers'],
  'jump-game': ['Backtracking', 'Breadth-First Search', 'Recursion', 'Hash Table'],
  'climbing-stairs': ['Recursion', 'Divide and Conquer', 'Backtracking', 'Hash Table'],
  'min-cost-climbing-stairs': ['Recursion', 'Shortest Path', 'Graph', 'Hash Table'],
  'house-robber': ['Recursion', 'Backtracking', 'Hash Table'],
  'coin-change': ['Breadth-First Search', 'Shortest Path', 'Recursion', 'Backtracking', 'Queue', 'Graph', 'Hash Table'],
  'longest-consecutive-sequence': ['Sorting', 'Union Find', 'Disjoint Set', 'Two Pointers', 'Binary Search'],
  'plus-one': ['Stack', 'Deque', 'Linked List', 'Recursion'],
  'single-number': ['Hashing', 'Counting', 'Sorting', 'Math', 'Hash Set', 'Hash Table'],
  'number-of-1-bits': ['Counting', 'Recursion', 'Dynamic Programming', 'Divide and Conquer'],
  'counting-bits': ['Counting', 'Recursion', 'Math'],
  'reverse-bits': ['Divide and Conquer', 'Recursion', 'Dynamic Programming', 'Hash Table'],
  'missing-number': ['Sorting', 'Hashing', 'Counting', 'Binary Search', 'Hash Set', 'Hash Table', 'Prefix Sum'],
};
