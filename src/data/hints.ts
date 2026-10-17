/**
 * Three-level help ladder for every program, benchmark and bonus-pool problem, keyed by LeetCode slug.
 * Level 1 names the technique family, level 2 gives the key observation, level 3 outlines
 * the algorithm with target complexity. No code, so the user can still write it themselves.
 */

export interface Hint {
  /** Level 1: the family of technique or data structure to think about. */
  nudge: string;
  /** Level 2: the key observation that makes the approach work. */
  insight: string;
  /** Level 3: the algorithm in a few short steps with target time/space. */
  sketch: string;
}

export const HINTS: Record<string, Hint> = {
  // ---- Arrays & Hashing ----
  'two-sum': {
    nudge: 'Think about a lookup structure that answers "have I already seen the partner value?" in constant time.',
    insight:
      'For each number x, the only value that can complete the pair is target - x, so you never need to compare all pairs, only to remember what you have passed.',
    sketch:
      '1) Keep a map from value to index. 2) For each element, compute the complement. 3) If the complement is in the map, return both indices. 4) Otherwise store the current value and index. Time O(n), space O(n).',
  },
  'valid-anagram': {
    nudge: 'Compare the two strings by what letters they contain, not by their order: a counting approach.',
    insight:
      'Two strings are anagrams exactly when every character occurs the same number of times in both, and strings of different length can be rejected immediately.',
    sketch:
      '1) If lengths differ, return false. 2) Count characters of the first string. 3) Walk the second string and decrement counts, failing if a count would go below zero. 4) Otherwise they match. Time O(n), space O(1) for a fixed alphabet.',
  },
  'group-anagrams': {
    nudge: 'Grouping needs a hash map: what could the words in one group have in common that you can use as a lookup key?',
    insight:
      'Anagrams become identical once their letters are normalised, for example sorted or turned into a vector of letter counts, so that normal form can serve as the group key.',
    sketch:
      '1) For each word build a key: its sorted letters or a 26-slot count signature. 2) Append the word to the list stored under that key. 3) Return all lists in the map. Time O(n·k) with count keys (O(n·k log k) with sorting), space O(n·k).',
  },
  'top-k-frequent-elements': {
    nudge: 'First count frequencies, then think about selecting the k largest counts without fully sorting, such as buckets or a heap.',
    insight:
      'A frequency can never exceed n, so counts can be used as indices into an array of buckets, which avoids any comparison sort.',
    sketch:
      '1) Count occurrences in a map. 2) Create n+1 buckets and place each value in the bucket of its count. 3) Scan buckets from the highest count down, collecting values until you have k. Time O(n), space O(n).',
  },
  'longest-consecutive-sequence': {
    nudge: 'A hash set can answer "is this number present?" instantly; can you avoid re-counting the same run of numbers?',
    insight:
      'A number starts a run only if its predecessor is absent, so if you expand only from run starts, every element is visited a bounded number of times.',
    sketch:
      '1) Put all numbers in a set. 2) For each number whose value-1 is not in the set, it is a run start. 3) Walk upward while the next value exists, counting length. 4) Track the maximum. Time O(n), space O(n).',
  },

  // ---- Two Pointers ----
  'valid-palindrome': {
    nudge: 'Two pointers moving inward from both ends of the string.',
    insight:
      'A palindrome reads the same from both ends, so you only need to compare the outermost remaining characters, skipping anything that is not a letter or digit and ignoring case.',
    sketch:
      '1) Put one pointer at each end. 2) Advance each pointer past non-alphanumeric characters. 3) Compare the two characters case-insensitively; return false on a mismatch. 4) Move both inward until they cross. Time O(n), space O(1).',
  },
  'two-sum-ii-input-array-is-sorted': {
    nudge: 'The array is sorted, which lets two pointers replace a hash map and keep memory constant.',
    insight:
      'With one pointer at each end, the sum is either too large or too small; moving the left pointer raises it and moving the right pointer lowers it, so no valid pair is ever skipped.',
    sketch:
      '1) Set left = 0 and right = n-1. 2) Compute the sum. 3) If it equals the target, return the 1-based indices. 4) If it is too small move left up, otherwise move right down. Time O(n), space O(1).',
  },
  '3sum': {
    nudge: 'Order the data first; what does a sorted array let you do when you look for a pair?',
    insight:
      'After sorting, fixing one value leaves a sorted two-sum problem, and skipping equal neighbours at every level removes duplicate triplets without any extra set.',
    sketch:
      '1) Sort the array. 2) For each index i (skipping repeated values), set left = i+1 and right = n-1. 3) Move pointers by the sign of the sum; on a hit record the triplet and skip duplicate values on the left. 4) Stop early when nums[i] > 0. Time O(n²), space O(1) beyond output.',
  },

  // ---- Sliding Window ----
  'best-time-to-buy-and-sell-stock': {
    nudge: 'A single pass that remembers the best thing seen so far, similar to a sliding window with a moving left edge.',
    insight:
      'For any selling day, the best purchase is the cheapest earlier price, so you only need to maintain a running minimum and compare the profit against it.',
    sketch:
      '1) Track minPrice, starting at the first day, and bestProfit = 0. 2) For each later price, update bestProfit with price - minPrice. 3) Then update minPrice. 4) Return bestProfit. Time O(n), space O(1).',
  },
  'longest-substring-without-repeating-characters': {
    nudge: 'A variable-size sliding window combined with a structure that tells you whether a character is already inside it.',
    insight:
      'When the right edge adds a character that is already in the window, the left edge must jump just past that earlier occurrence; the window stays valid and never moves backward.',
    sketch:
      '1) Keep a map from character to its last index and a left edge. 2) For each right index, if the character was seen at or after left, move left to that index + 1. 3) Record the character position. 4) Update the best length as right - left + 1. Time O(n), space O(alphabet).',
  },

  // ---- Stack ----
  'valid-parentheses': {
    nudge: 'Brackets close in the reverse order they open, which is the behaviour of a stack.',
    insight:
      'Every closing bracket must match the most recent unmatched opening bracket, and the string is valid only if nothing is left unmatched at the end.',
    sketch:
      '1) Create an empty stack and a map from closer to opener. 2) Push each opener. 3) For a closer, fail if the stack is empty or its top is not the matching opener; otherwise pop. 4) Return whether the stack is empty. Time O(n), space O(n).',
  },
  'min-stack': {
    nudge: 'The stack must report its minimum in constant time; what extra information could you keep as the stack changes?',
    insight:
      'The minimum of the stack only changes when you push or pop, so storing the minimum at the time of each push lets pop restore the previous minimum automatically.',
    sketch:
      '1) Store pairs (value, minimum so far) in one stack, or keep a second stack of minimums. 2) On push, the new minimum is min(value, previous minimum). 3) Pop removes the top pair. 4) top and getMin read the top pair. Every operation is O(1), space O(n).',
  },
  'daily-temperatures': {
    nudge: 'For each day you are waiting for something later to arrive; what structure helps you remember the days still waiting?',
    insight:
      'A day waits only until the first later day that is strictly warmer, so when a warm day arrives it resolves every colder waiting day on top of the stack at once.',
    sketch:
      '1) Keep a stack of indices with decreasing temperatures. 2) For each day, while the stack top is colder than today, pop it and set its answer to the index difference. 3) Push today. 4) Remaining days stay 0. Time O(n), space O(n).',
  },

  // ---- Binary Search ----
  'binary-search': {
    nudge: 'The array is sorted, so each comparison can discard half of the remaining range.',
    insight:
      'Comparing the middle element with the target tells you which half cannot contain it; the invariant is that if the target exists, it lies within the current bounds.',
    sketch:
      '1) Set low = 0, high = n-1. 2) While low <= high, take mid. 3) If nums[mid] equals the target return mid; if smaller move low to mid+1; otherwise move high to mid-1. 4) Return -1 if the range empties. Time O(log n), space O(1).',
  },
  'search-a-2d-matrix': {
    nudge: 'Treat the matrix as one sorted sequence and binary search over it.',
    insight:
      'Because each row starts above the end of the previous one, the cells in row-major order form a single sorted array, and a flat index maps back to a row and column using division and remainder.',
    sketch:
      '1) Let low = 0 and high = rows*cols - 1. 2) Take mid and convert it to (mid / cols, mid % cols). 3) Compare that value with the target and shrink the range like a normal binary search. 4) Return whether it was found. Time O(log(m·n)), space O(1).',
  },
  'find-minimum-in-rotated-sorted-array': {
    nudge: 'A modified binary search that decides which half contains the rotation point.',
    insight:
      'Compare the middle element with the rightmost one: if the middle is larger, the minimum lies strictly to its right; otherwise the middle could be the minimum and the answer lies at or left of it.',
    sketch:
      '1) Set low = 0, high = n-1. 2) While low < high, compute mid. 3) If nums[mid] > nums[high], set low = mid+1; else set high = mid. 4) When the bounds meet, nums[low] is the minimum. Time O(log n), space O(1).',
  },

  // ---- Linked List ----
  'reverse-linked-list': {
    nudge: 'Walk the list once while rewiring pointers, using a couple of trailing pointer variables.',
    insight:
      'Reversing means pointing each node at its predecessor; you must save the next node before overwriting the link, or the rest of the list is lost.',
    sketch:
      '1) Keep prev = null and current = head. 2) Save current.next. 3) Point current.next at prev. 4) Advance prev to current and current to the saved next. 5) When current is null, prev is the new head. Time O(n), space O(1).',
  },
  'merge-two-sorted-lists': {
    nudge: 'Merge like the merge step of merge sort, with a dummy head node to simplify the edge cases.',
    insight:
      'Since both lists are already sorted, the next node of the result is always the smaller of the two current heads, and when one list ends the other can be attached whole.',
    sketch:
      '1) Create a dummy node and a tail pointer. 2) While both lists have nodes, link the smaller head to the tail and advance that list. 3) Attach the remaining non-empty list. 4) Return dummy.next. Time O(n+m), space O(1).',
  },
  'remove-nth-node-from-end-of-list': {
    nudge: 'You do not know the length yet; can two pointers moving through the list in a single pass locate the node?',
    insight:
      'If the lead pointer is n steps ahead, then when it reaches the end the trailing pointer sits right before the node to delete; a dummy head covers removal of the first node.',
    sketch:
      '1) Add a dummy node before head. 2) Move a fast pointer n steps ahead of a slow pointer that starts at the dummy. 3) Advance both until fast is on the last node. 4) Set slow.next = slow.next.next. 5) Return dummy.next. Time O(n), space O(1).',
  },
  'reorder-list': {
    nudge: 'Split the job into smaller linked-list operations you already know.',
    insight:
      'The target order alternates nodes from the front and from the back, so reversing the second half lets you merge two forward-moving lists in place.',
    sketch:
      '1) Find the middle with slow and fast pointers. 2) Cut the list there and reverse the second half. 3) Merge by alternating one node from the first half and one from the reversed second half. Time O(n), space O(1).',
  },

  // ---- Trees ----
  'invert-binary-tree': {
    nudge: 'Recursion over the tree, handling one node at a time.',
    insight:
      'Mirroring a tree is the same as swapping the two children of every node, and the order in which you visit nodes does not matter.',
    sketch:
      '1) If the node is null, return null. 2) Recursively invert the left and right subtrees. 3) Swap the two children. 4) Return the node. An iterative traversal with a stack or queue also works. Time O(n), space O(h).',
  },
  'maximum-depth-of-binary-tree': {
    nudge: 'A recursive definition of depth in terms of the depth of the subtrees.',
    insight:
      'The depth of a node is one more than the larger depth of its children, and an empty tree has depth zero, which makes the base case trivial.',
    sketch:
      '1) If the node is null, return 0. 2) Compute the depth of the left and right subtrees. 3) Return 1 + the larger of the two. Level-by-level traversal counting levels is an alternative. Time O(n), space O(h).',
  },
  'same-tree': {
    nudge: 'Traverse both trees together and compare them node by node.',
    insight:
      'Two trees are identical exactly when their roots match in presence and value and both pairs of corresponding subtrees are identical; a null on only one side is an immediate mismatch.',
    sketch:
      '1) If both nodes are null, return true. 2) If only one is null or the values differ, return false. 3) Return the result of comparing left with left and right with right. Time O(n), space O(h).',
  },
  'binary-tree-level-order-traversal': {
    nudge: 'Breadth-first search with a queue, processing the tree one layer at a time.',
    insight:
      'If you record the queue size at the start of each round, exactly that many nodes belong to the current level, so levels can be separated without storing depths.',
    sketch:
      '1) Return an empty list for an empty tree; otherwise enqueue the root. 2) While the queue is non-empty, take its current size k. 3) Pop k nodes, record their values as one level and enqueue their non-null children. 4) Append the level to the result. Time O(n), space O(n).',
  },
  'lowest-common-ancestor-of-a-binary-search-tree': {
    nudge: 'Use the ordering property of a binary search tree to walk down from the root without exploring both sides.',
    insight:
      'The first node whose value lies between the two targets, inclusive, is where their paths split, so it is the lowest common ancestor; if both are smaller go left, if both are larger go right.',
    sketch:
      '1) Start at the root. 2) If both p and q are smaller than the current value, move left. 3) If both are larger, move right. 4) Otherwise return the current node. Time O(h), space O(1) iteratively.',
  },

  // ---- Heap / Priority Queue ----
  'kth-largest-element-in-a-stream': {
    nudge: 'A heap that holds only the few largest values seen so far.',
    insight:
      'You only care about the k largest elements, and the smallest of those is the answer, so a min-heap capped at size k keeps exactly what is needed.',
    sketch:
      '1) Build a min-heap from the initial numbers, popping while its size exceeds k. 2) On add, push the new value. 3) If the size is above k, pop the smallest. 4) The heap top is the k-th largest. Time O(log k) per add, space O(k).',
  },
  'last-stone-weight': {
    nudge: 'You repeatedly need the largest elements, which is what a priority queue is for.',
    insight:
      'Each round removes the two heaviest stones and returns at most one remainder, so the process is a direct simulation as long as you can extract the maximum quickly.',
    sketch:
      '1) Put all weights in a max-heap (or a min-heap of negated values). 2) While more than one stone remains, pop the two largest. 3) If they differ, push their difference back. 4) Return the remaining stone or 0. Time O(n log n), space O(n).',
  },
  'k-closest-points-to-origin': {
    nudge: 'Selection of the k smallest items by distance: consider a bounded heap or a quickselect-style partition.',
    insight:
      'Comparing squared distances gives the same ordering as true distances, so no square roots are needed, and you never need to sort all points.',
    sketch:
      '1) Compute the squared distance x² + y² for each point. 2) Keep a max-heap of size k keyed by distance. 3) Push each point and pop the farthest whenever the size exceeds k. 4) Return the points left in the heap. Time O(n log k), space O(k).',
  },

  // ---- Backtracking ----
  subsets: {
    nudge: 'Backtracking where, at each element, you branch on including it or leaving it out.',
    insight:
      'Each of the n elements is independently in or out, so the answer has 2^n subsets, and they can be generated by exploring a decision tree where every node is itself a valid subset.',
    sketch:
      '1) Keep a current path and a start index. 2) At each call, record a copy of the path. 3) For every index from start onward, append it, recurse with index+1, then remove it. Time O(n·2^n), space O(n) beyond output.',
  },
  'combination-sum': {
    nudge: 'Backtracking over candidates where the same number may be reused, pruned by the remaining target.',
    insight:
      'To avoid duplicate combinations, only allow choosing candidates at or after the current index; reuse is allowed by recursing with the same index, and a branch stops once the remainder goes negative.',
    sketch:
      '1) Recurse with a start index, the current path and the remaining sum. 2) If remaining is 0, record the path. 3) For each candidate from start onward with value <= remaining, add it and recurse at the same index, then undo. Sorting lets you break early. Time exponential, space O(target/min).',
  },
  permutations: {
    nudge: 'Backtracking that builds an ordering one position at a time, tracking which elements are still unused.',
    insight:
      'At each position any element not yet placed may go there, giving n! leaves in total, and undoing each choice after recursion restores the state for the next branch.',
    sketch:
      '1) Keep a path and a used marker per element. 2) When the path length is n, store a copy. 3) Otherwise try each unused element: mark, append, recurse, then unmark and remove. Time O(n·n!), space O(n) beyond output.',
  },
  'generate-parentheses': {
    nudge: 'Backtracking that builds the string character by character while only allowing choices that can still lead to a valid result.',
    insight:
      'A prefix can still become valid exactly when it has at most n opening brackets and never more closers than openers, so you add "(" while openers < n and ")" only while closers < openers.',
    sketch:
      '1) Track the counts of opens and closes used. 2) If the string has length 2n, record it. 3) If opens < n, append "(" and recurse. 4) If closes < opens, append ")" and recurse. Time O(4^n/√n) (Catalan growth), space O(n) for the recursion.',
  },
  'word-search': {
    nudge: 'Depth-first search with backtracking on a grid, starting from every cell that matches the first letter.',
    insight:
      'A cell can be used only once per path, so mark it as visited when you enter and restore it when you leave; fail fast as soon as a letter does not match.',
    sketch:
      '1) For each cell, start a DFS at word index 0. 2) Fail if out of bounds, already visited, or the letter differs; succeed when the whole word is matched. 3) Mark the cell, try its four neighbours with the next index, then unmark. Time O(m·n·4^L), space O(L).',
  },

  // ---- Graphs ----
  'number-of-islands': {
    nudge: 'Traverse the grid with a flood fill (DFS or BFS) and count connected components.',
    insight:
      'Each island is one connected group of land cells, so every time you find unvisited land you have found a new island, and flooding it marks all of its cells as seen.',
    sketch:
      '1) Scan every cell. 2) On unvisited land, increase the count and start a DFS or BFS. 3) The traversal marks all four-directionally connected land as visited (or sinks it). 4) Return the count. Time O(m·n), space O(m·n) worst case.',
  },
  'max-area-of-island': {
    nudge: 'The same grid flood fill as counting islands, but measure each component as you traverse it.',
    insight:
      'The size of an island equals the number of cells your traversal visits from its starting cell, so you can return that count from the traversal and keep the maximum.',
    sketch:
      '1) Scan every cell for unvisited land. 2) Run a DFS that marks the cell and returns 1 plus the sizes from its four neighbours. 3) Update the best area with each result. 4) Return it (0 if no land). Time O(m·n), space O(m·n).',
  },
  'clone-graph': {
    nudge: 'A graph traversal where you must remember something about each node you have already visited.',
    insight:
      'The map serves two roles: it prevents infinite loops on cycles and guarantees each original node has exactly one clone, which neighbours can link to.',
    sketch:
      '1) Return null for an empty graph. 2) Keep a map original → clone. 3) In a DFS or BFS, create the clone the first time you see a node. 4) For each neighbour, ensure it is cloned and append its clone to the current clone\'s neighbours. Time O(V+E), space O(V).',
  },
  'course-schedule': {
    nudge: 'Model courses as a directed graph and ask whether it contains a cycle, using topological ordering.',
    insight:
      'All courses can be finished exactly when the prerequisite graph is acyclic; a course with no remaining prerequisites can always be taken next.',
    sketch:
      '1) Build adjacency lists and in-degree counts. 2) Queue every course with in-degree 0. 3) Pop a course, count it, and decrement the in-degree of its dependents, queueing those that reach 0. 4) Possible if the count equals the number of courses. Time O(V+E), space O(V+E).',
  },

  // ---- Intervals ----
  'merge-intervals': {
    nudge: 'Sort the intervals by start, then sweep through them once.',
    insight:
      'After sorting by start, an interval can only overlap the most recent merged interval, so it either extends that one\'s end or begins a new one.',
    sketch:
      '1) Sort by start. 2) Start the result with the first interval. 3) For each next interval, if its start is <= the last result end, set that end to the larger of the two ends. 4) Otherwise append it. Time O(n log n), space O(n).',
  },
  'insert-interval': {
    nudge: 'The list is already sorted and non-overlapping, so a single linear scan in three phases is enough.',
    insight:
      'Intervals fall into three groups: those ending before the new one starts, those overlapping it, and those starting after it ends; the overlapping group collapses into one interval.',
    sketch:
      '1) Copy intervals whose end is < new start. 2) While the next interval\'s start is <= new end, widen the new interval to the min start and max end. 3) Add the merged interval. 4) Copy the remaining intervals. Time O(n), space O(n).',
  },

  // ---- Greedy ----
  'maximum-subarray': {
    nudge: 'A running-sum approach that decides at each element whether to extend the current subarray or restart.',
    insight:
      'A running sum that has gone negative can only hurt any later subarray, so you drop it and start fresh at the current element.',
    sketch:
      '1) Set current and best to the first element. 2) For each next value, set current = max(value, current + value). 3) Update best with current. 4) Return best. Time O(n), space O(1).',
  },
  'jump-game': {
    nudge: 'Track how far you can possibly get rather than searching for exact jump sequences.',
    insight:
      'Reachability is contiguous: if you can reach index i, you can reach every index before it, so one number, the furthest reachable index, summarises everything.',
    sketch:
      '1) Let furthest = 0. 2) For each index i, if i > furthest return false. 3) Update furthest = max(furthest, i + nums[i]). 4) If furthest reaches the last index, return true. Time O(n), space O(1).',
  },
  'jump-game-ii': {
    nudge: 'A greedy sweep that thinks in terms of "windows" reachable with a given number of jumps, like a breadth-first search over ranges.',
    insight:
      'All indices reachable with k jumps form a contiguous range, so you only need the furthest point reachable from that range to define the range for k+1 jumps.',
    sketch:
      '1) Keep jumps = 0, the end of the current range and the furthest reach. 2) Scan indices before the last one, updating furthest with i + nums[i]. 3) On reaching the range end, add a jump and set the new range end to furthest. 4) Return jumps. Time O(n), space O(1).',
  },
  'gas-station': {
    nudge: 'Consider the running balance of gas minus cost and what a failure tells you about which starting points are impossible.',
    insight:
      'If the total gas is less than the total cost no start works; otherwise if you run out going from start s to station j, no station between s and j can be a valid start either, so the next candidate is j+1.',
    sketch:
      '1) Track the total balance and the tank for the current candidate. 2) At each station add gas[i] - cost[i] to both. 3) If the tank goes negative, set the start to i+1 and reset the tank. 4) Return -1 if the total is negative, else the start. Time O(n), space O(1).',
  },

  // ---- 1-D Dynamic Programming ----
  'climbing-stairs': {
    nudge: 'Think about how many ways there are to arrive at a step from the steps just below it: a small dynamic programming recurrence.',
    insight:
      'You reach step n from step n-1 or n-2, so ways(n) = ways(n-1) + ways(n-2), the Fibonacci pattern, and only the last two values are ever needed.',
    sketch:
      '1) Set the ways for steps 1 and 2 as 1 and 2. 2) For each following step, the count is the sum of the previous two. 3) Keep just two variables and roll them forward. 4) Return the value for step n. Time O(n), space O(1).',
  },
  'min-cost-climbing-stairs': {
    nudge: 'Dynamic programming over the steps, where each state is the cheapest way to stand on a given step.',
    insight:
      'You can arrive at a step from one or two steps below, so the cheapest cost to stand there is the minimum of those two arrivals, and the top is reached from either of the last two steps.',
    sketch:
      '1) Define best[i] as the min cost to stand on step i, with steps 0 and 1 free to start on. 2) best[i] = min(best[i-1] + cost[i-1], best[i-2] + cost[i-2]). 3) The answer is best at index n (the top). Two rolling variables suffice. Time O(n), space O(1).',
  },
  'house-robber': {
    nudge: 'Dynamic programming where each house offers a choice between robbing and skipping.',
    insight:
      'The best total up to house i is either the best up to i-1 (skip this house) or the best up to i-2 plus this house\'s value, so only the last two results matter.',
    sketch:
      '1) Keep two variables: best excluding the previous house and best including up to it. 2) For each house, new = max(prev, prevPrev + value). 3) Shift the variables forward. 4) Return the final value. Time O(n), space O(1).',
  },
  'house-robber-ii': {
    nudge: 'How does the circle change the linear house-robber choice? Start from the version you already know.',
    insight:
      'In a circle the first and last houses are adjacent, so the optimal plan never uses both; it is the better of "ignore the first house" and "ignore the last house".',
    sketch:
      '1) If there is a single house, return its value. 2) Solve the linear problem on houses 0..n-2. 3) Solve it on houses 1..n-1. 4) Return the larger result. Time O(n), space O(1).',
  },
  'longest-palindromic-substring': {
    nudge: 'Testing every substring is too slow; what do all palindromes have in common structurally?',
    insight:
      'Every palindrome mirrors around a centre that is either a character (odd length) or a gap between two characters (even length), giving only 2n-1 centres to expand.',
    sketch:
      '1) For each index, expand from (i, i) and from (i, i+1) while the two end characters are equal. 2) Record the longest span seen and its start. 3) Return that substring. Time O(n²), space O(1).',
  },
  'decode-ways': {
    nudge: 'Dynamic programming over string prefixes, counting the ways to decode each one.',
    insight:
      'The ways for a prefix come from decoding the last digit alone (if it is not 0) plus decoding the last two digits together (if they form 10 to 26), so a 0 is only valid as the tail of 10 or 20.',
    sketch:
      '1) Let ways[0] = 1 for the empty prefix. 2) For position i, add ways[i-1] if s[i-1] is not "0". 3) Add ways[i-2] if the two-digit number is between 10 and 26. 4) Return ways[n]; two rolling variables work. Time O(n), space O(1).',
  },
  'coin-change': {
    nudge: 'Unbounded-knapsack style dynamic programming over amounts, not a greedy choice of the largest coin.',
    insight:
      'The fewest coins for amount a is one coin plus the fewest coins for a - c, minimised over all coins c, and greedy fails because a large coin can lead to a worse remainder.',
    sketch:
      '1) Make dp[0..amount], with dp[0] = 0 and the others set to infinity. 2) For each amount a, try every coin c <= a: dp[a] = min(dp[a], dp[a-c] + 1). 3) Return dp[amount], or -1 if it is still infinity. Time O(amount·coins), space O(amount).',
  },
  'word-break': {
    nudge: 'Dynamic programming over prefixes of the string, with a dictionary lookup for each candidate last word.',
    insight:
      'A prefix can be segmented if some shorter segmentable prefix is followed by a dictionary word, so you only need a boolean for each prefix length.',
    sketch:
      '1) Put the words in a set and let ok[0] = true. 2) For each end i from 1 to n, look for a split j < i where ok[j] is true and s[j..i) is in the set. 3) Set ok[i] accordingly. 4) Return ok[n]. Only splits within the longest word length L need checking: O(n·L) splits, each costing O(L) to hash, so O(n·L²) time, space O(n).',
  },

  // ---- Hard ----
  'trapping-rain-water': {
    nudge: 'What decides how much water sits on a single bar? Start with one bar, then think about doing it in one pass.',
    insight:
      'The water over a bar equals min(tallest to the left, tallest to the right) minus its height, and the pointer on the side with the smaller maximum can be resolved without knowing the other side exactly.',
    sketch:
      '1) Place pointers at both ends and keep the left and right running maximums. 2) Handle the side whose current height is lower. 3) If it is below its side\'s maximum, add the difference as water; otherwise update the maximum. 4) Move that pointer inward until they meet. Time O(n), space O(1).',
  },
  'merge-k-sorted-lists': {
    nudge: 'You repeatedly need the smallest among k candidates, which suggests a heap, or merging the lists pairwise.',
    insight:
      'At any moment the next output node is the smallest among the current heads of the k lists, so a heap of size k always has it on top and the heap size never grows with n.',
    sketch:
      '1) Push the head of each non-empty list into a min-heap keyed by value. 2) Pop the smallest node and append it to the result. 3) Push that node\'s next, if any. 4) Repeat until the heap is empty. Time O(N log k), space O(k). Divide-and-conquer pairwise merging gives the same time.',
  },

  // ---- Benchmark problems ----
  'contains-duplicate': {
    nudge: 'A hash-based structure that remembers what you have already seen.',
    insight:
      'A duplicate exists the moment you meet a value that is already in your seen collection, so you can stop early without comparing all pairs.',
    sketch:
      '1) Create an empty set. 2) For each number, return true if it is in the set. 3) Otherwise add it. 4) Return false after the scan. Sorting and checking neighbours is an alternative. Time O(n), space O(n).',
  },
  'product-of-array-except-self': {
    nudge: 'Each answer depends on all the other elements, and division is not allowed; how can you split an answer into smaller pieces?',
    insight:
      'The product except self at index i is (product of everything before i) times (product of everything after i), and both parts can be built with one running product each.',
    sketch:
      '1) Fill the result so that result[i] is the product of all elements left of i. 2) Sweep from the right with a running product of elements right of i. 3) Multiply it into result[i] at each step. 4) Return result. Time O(n), extra space O(1) besides the output.',
  },
  'balanced-binary-tree': {
    nudge: 'A recursive traversal over the tree; consider how much work each node should do and how often it is visited.',
    insight:
      'If you let the height function also signal failure when a node\'s subtrees differ in height by more than one, each node is visited once instead of recomputing heights repeatedly.',
    sketch:
      '1) Define a post-order helper that returns the height, or a sentinel such as -1 for unbalanced. 2) Get both child heights and propagate the sentinel if either is unbalanced. 3) If they differ by more than 1, return the sentinel. 4) Otherwise return 1 + max. The tree is balanced if the root result is not the sentinel. Time O(n), space O(h).',
  },
  'binary-tree-right-side-view': {
    nudge: 'Level-by-level traversal, or a depth-first search that prioritises one side.',
    insight:
      'The view from the right shows the last node of each level; in a DFS that visits the right child first, the first node reached at a new depth is the visible one.',
    sketch:
      '1) Run a BFS by levels and record the last node\'s value of every level. 2) Alternatively, run a DFS visiting right before left and add a value whenever the depth equals the result length. 3) Return the collected values. Time O(n), space O(n) for BFS or O(h) for DFS.',
  },
  'happy-number': {
    nudge: 'The digit-square-sum process either reaches 1 or falls into a cycle, so think about cycle detection.',
    insight:
      'The sequence cannot grow without bound, because the next value stays small for large inputs, so it must eventually reach 1 or repeat a value that you can detect.',
    sketch:
      '1) Define next(n) as the sum of the squares of its digits. 2) Track visited values in a set, or use slow and fast pointers on the sequence. 3) Stop with true when the value becomes 1. 4) Return false if a value repeats. Time O(log n) per step with a small number of steps, space O(1) with two pointers.',
  },
  'non-overlapping-intervals': {
    nudge: 'A greedy interval-scheduling problem: decide which interval to keep when two overlap.',
    insight:
      'After sorting by end time, always keeping the interval that finishes earliest leaves the most room for later ones, so the minimum removals equal the total count minus the maximum number of non-overlapping intervals.',
    sketch:
      '1) Sort the intervals by end. 2) Keep the end of the last chosen interval. 3) For each interval, if its start is >= that end, keep it and update the end. 4) Otherwise count it as removed. Time O(n log n), space O(1) beyond sorting.',
  },

  // ---- Bonus pool ----
  'evaluate-reverse-polish-notation': {
    nudge: 'Each operator works on the values produced just before it: which structure hands back the most recent items first?',
    insight:
      'In postfix notation an operator always applies to the two most recent results, and its own result then becomes an operand for something later, so only the latest values ever matter.',
    sketch:
      '1) Scan the tokens left to right. 2) Push every number. 3) For an operator, pop the right operand first, then the left one, apply the operator and push the result. 4) Division truncates toward zero. 5) The single value left on the stack is the answer. Time O(n), space O(n).',
  },
  'car-fleet': {
    nudge: 'Think about how a fast car behaves once it reaches a slower one ahead of it.',
    insight:
      'A car can never pass the one ahead; it can only catch up and then move at that car\'s pace. So going from the car nearest the target, a car starts a new fleet only if it would arrive later than the fleet ahead.',
    sketch:
      '1) Pair each position with its speed and sort by position, nearest to the target first. 2) Compute each car\'s arrival time as (target - position) / speed. 3) Remember the arrival time of the last fleet. 4) A car with a larger time starts a new fleet; otherwise it merges into the one ahead. 5) Return the fleet count. Time O(n log n), space O(n).',
  },
  'koko-eating-bananas': {
    nudge: 'Instead of searching the piles, search over the answer itself: does the eating speed have a clean yes/no threshold?',
    insight:
      'If Koko can finish at speed k she can also finish at every faster speed, so feasibility flips exactly once; the hours needed at a given speed are the sum of ceil(pile / k) over the piles.',
    sketch:
      '1) The speed lies between 1 and the largest pile. 2) Binary search that range. 3) For a candidate k, add up ceil(pile / k) for all piles. 4) If the total is within h hours, k works so try a smaller one; otherwise try a larger one. 5) Return the smallest working k. Time O(n log m) for largest pile m, space O(1).',
  },
  'search-in-rotated-sorted-array': {
    nudge: 'A rotated sorted array is still partly ordered everywhere: a binary search that first works out which half is in order.',
    insight:
      'Whatever the pivot position, at least one side of the middle is a normally sorted run. You can test whether the target lies inside that run, and if it does not, it can only be in the other half.',
    sketch:
      '1) Keep lo and hi. 2) Take mid and return it if it holds the target. 3) If nums[lo] <= nums[mid] the left half is sorted: keep it when the target is in [nums[lo], nums[mid]), otherwise go right. 4) Else the right half is sorted: apply the mirrored check. 5) Return -1 once the range is empty. Time O(log n), space O(1).',
  },
  'diameter-of-binary-tree': {
    nudge: 'A post-order recursion where each call hands one value to its parent while a separate variable collects the real answer.',
    insight:
      'The longest path that bends at a node is its left height plus its right height, and the best path overall bends at some node, so looking at every node once is enough.',
    sketch:
      '1) Write a recursive height function; an empty node has height 0. 2) For a node, get the heights of both children. 3) Update the best diameter with left + right, which counts edges. 4) Return 1 + max(left, right) to the parent. 5) Return the best value at the end. Time O(n), space O(h) for tree height h.',
  },
  'validate-binary-search-tree': {
    nudge: 'Comparing a node only with its children is not enough; think about passing limits down the recursion, or about an ordered traversal.',
    insight:
      'Every node must lie strictly between the bounds set by all of its ancestors. Equivalently, an inorder walk of a valid search tree produces strictly increasing values.',
    sketch:
      '1) Recurse with an open interval (low, high), starting with no limits. 2) A node outside the interval makes the tree invalid. 3) Go left with high set to the node value and right with low set to it. 4) An empty subtree is valid. 5) Alternatively walk inorder and compare each value with the previous one. Time O(n), space O(h).',
  },
  'kth-smallest-element-in-a-bst': {
    nudge: 'A search tree already stores its values in order: which traversal reads them from smallest to largest?',
    insight:
      'An inorder traversal visits the values of a search tree in sorted order, so the k-th node visited is the answer and you can stop right there.',
    sketch:
      '1) Walk inorder with an explicit stack: go left as far as possible, pushing nodes. 2) Pop a node and count it. 3) When the count reaches k, return its value. 4) Otherwise continue with the right child. Time O(h + k), space O(h).',
  },
  'kth-largest-element-in-an-array': {
    nudge: 'A full sort does more work than needed: think of a heap that only keeps a few elements, or a partition-based selection.',
    insight:
      'Only the k largest values seen so far matter, and the smallest of those k is the k-th largest overall, so a min-heap capped at size k has the answer on top at all times.',
    sketch:
      '1) Start with an empty min-heap. 2) Push each number and pop the smallest whenever the size exceeds k. 3) After the scan the top of the heap is the k-th largest. 4) Quickselect is the alternative, with average linear time. Time O(n log k), space O(k).',
  },
  'task-scheduler': {
    nudge: 'The most frequent task decides how much waiting is forced: count frequencies, then think greedy with a heap or a counting formula.',
    insight:
      'The most frequent task creates frames of length n + 1 between its repeats, and the other tasks fill the gaps. Idle slots appear only when the gaps stay unfilled, and the answer is never smaller than the number of tasks.',
    sketch:
      '1) Count the tasks and find the highest frequency f and how many tasks share it, c. 2) The frames give (f - 1) * (n + 1) + c slots. 3) Return the larger of that value and the total number of tasks. 4) Alternatively simulate with a max-heap and a cooldown queue. Time O(n), space O(1) for 26 letters.',
  },
  'subsets-ii': {
    nudge: 'The same take-or-skip backtracking as for plain subsets, plus a way to avoid building an identical subset twice.',
    insight:
      'After sorting, equal values sit side by side. At one level of the recursion, trying a value equal to the one just tried there would repeat a subset, so each distinct value is chosen once per level.',
    sketch:
      '1) Sort the numbers. 2) Recurse with a start index and the current path, recording a copy of the path at every call. 3) Loop i from start and skip i when i > start and nums[i] equals nums[i - 1]. 4) Push nums[i], recurse with i + 1, then pop. Time O(n * 2^n), space O(n) besides the output.',
  },
  'implement-trie-prefix-tree': {
    nudge: 'A tree in which each edge is a letter and a path from the root spells a prefix: nodes with children keyed by character.',
    insight:
      'Words that share a prefix share a path, so every operation walks one node per character. Only a flag on the last node tells a complete word apart from a mere prefix.',
    sketch:
      '1) A node holds a map of children and an end-of-word flag. 2) insert walks the word, creating missing children, and sets the flag on the last node. 3) search walks the word and requires the flag. 4) startsWith walks the prefix and only requires that the path exists. Time O(L) per call for length L, space O(total characters).',
  },
  'design-add-and-search-words-data-structure': {
    nudge: 'A prefix tree again, but one search symbol matches any letter: how should the search branch when it meets it?',
    insight:
      'Insertion is identical to an ordinary trie. At a wildcard any child could continue the match, so the search tries all of them recursively, while a normal letter follows exactly one edge.',
    sketch:
      '1) Build a trie with an end-of-word flag. 2) addWord inserts as usual. 3) search uses a recursive helper over a node and a position. 4) A letter moves to that child or fails if it is missing. 5) A dot tries every child. 6) At the end of the pattern require the flag. Time O(L) to add; search is O(L) without dots and can branch heavily with many of them. Space O(total characters).',
  },
  'word-search-ii': {
    nudge: 'Searching for each word separately repeats work; store the words in a prefix structure and explore the grid once with backtracking.',
    insight:
      'A path in the grid can be abandoned as soon as it is not a prefix of any word, and a trie of all the words answers that question at each step. Clearing found words keeps results unique and later searches quick.',
    sketch:
      '1) Insert every word into a trie and store the whole word at its final node. 2) Start a DFS from each cell, following the trie child for each letter. 3) Mark the cell as visited while exploring and restore it afterwards. 4) When a node holds a word, add it to the results and clear it. 5) Optionally prune exhausted branches. Time about O(m * n * 4^L) worst case, space O(total word characters).',
  },
  'rotting-oranges': {
    nudge: 'Something spreads outward one step per minute from several starting points at once: a multi-source breadth-first search.',
    insight:
      'All rotten oranges spread during the same minute, so put every initial rotten cell in the queue together and process it level by level; each level is one minute. Fresh oranges that are never reached stay fresh.',
    sketch:
      '1) Scan the grid: enqueue all rotten cells and count the fresh ones. 2) Process the queue level by level; each level rots the fresh neighbours in four directions, lowers the fresh count and enqueues them. 3) Add a minute after each level that rotted something. 4) If fresh oranges remain return -1, otherwise return the minutes. Time O(m * n), space O(m * n).',
  },
  'course-schedule-ii': {
    nudge: 'Prerequisites form a directed graph, and an order where every edge points forward is a topological sort.',
    insight:
      'A course with no unmet prerequisites can be taken now, and taking it frees the courses that depend on it. If nothing is available while courses remain, there is a cycle and no valid order exists.',
    sketch:
      '1) Build an adjacency list and the in-degree of each course. 2) Queue all courses with in-degree 0. 3) Pop a course, append it to the order and decrement the in-degree of its dependents, queueing those that reach 0. 4) If the order holds every course return it, otherwise return an empty list. Time O(V + E), space O(V + E).',
  },
  'unique-paths': {
    nudge: 'Counting routes on a grid where you may only go right or down: build each cell from cells you have already computed.',
    insight:
      'A cell can only be entered from above or from the left, so its number of routes is the sum of those two neighbours. The first row and the first column each have exactly one route.',
    sketch:
      '1) Start with a row of n ones (the first row). 2) For every further row update each column j >= 1 with dp[j] += dp[j - 1]. 3) After the last row, dp[n - 1] is the answer. 4) The formula C(m + n - 2, m - 1) gives the same count. Time O(m * n), space O(n).',
  },
  'longest-common-subsequence': {
    nudge: 'Two strings and a question about their best alignment: a table indexed by a prefix of each string.',
    insight:
      'Compare the last characters of two prefixes. If they match, they extend the best result of the shorter prefixes by one; if not, at least one of them is unused, so take the better of dropping either.',
    sketch:
      '1) Let dp[i][j] be the answer for the first i characters of a and the first j of b, with row and column 0 equal to 0. 2) If a[i - 1] equals b[j - 1], dp[i][j] = dp[i - 1][j - 1] + 1. 3) Otherwise dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]). 4) Return dp[m][n]. Time O(m * n), space O(m * n), or O(min(m, n)) with two rows.',
  },
  'partition-labels': {
    nudge: 'A greedy scan driven by where each letter appears last: how far must the current piece stretch?',
    insight:
      'If a letter appears in the current piece, the piece must reach that letter\'s last occurrence. While scanning, the required end can only move right, and once the scan position catches up with it the piece can be closed safely.',
    sketch:
      '1) Record the last index of every letter. 2) Scan with index i, tracking the start of the piece and its end. 3) For each character set end = max(end, last[char]). 4) When i equals end, record a piece of size end - start + 1 and start the next one at i + 1. Time O(n), space O(1) for a fixed alphabet.',
  },
  'rotate-image': {
    nudge: 'Rotating in place can be split into simpler in-place moves of the whole matrix.',
    insight:
      'A clockwise quarter turn equals a transpose followed by reversing every row. Both steps only swap elements inside the same matrix, so no second matrix is needed.',
    sketch:
      '1) Transpose: for i < j swap matrix[i][j] and matrix[j][i]. 2) Reverse each row. 3) The matrix is now rotated 90 degrees clockwise. 4) Alternatively rotate four cells at a time, layer by layer. Time O(n^2), space O(1).',
  },
  'single-number': {
    nudge: 'Every value but one comes in pairs: look for an operation that makes equal values cancel each other.',
    insight:
      'XOR of a number with itself is 0 and XOR with 0 changes nothing. XOR is also order-independent, so every pair vanishes and only the single value is left.',
    sketch:
      '1) Start with result 0. 2) XOR it with every element. 3) Return the result. Time O(n), space O(1).',
  },
};

export function getHints(slug: string): Hint | undefined {
  return Object.prototype.hasOwnProperty.call(HINTS, slug) ? HINTS[slug] : undefined;
}
