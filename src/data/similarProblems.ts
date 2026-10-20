import type { MetadataProblemSlug } from './problemMetadata';

export const SIMILAR_RELATIONS = ['same-pattern', 'prerequisite', 'next-challenge', 'useful-contrast'] as const;
export type SimilarRelation = (typeof SIMILAR_RELATIONS)[number];

export interface SimilarProblem {
  readonly slug: MetadataProblemSlug;
  /** Describes the target relative to the current problem; not a scheduling dependency. */
  readonly relation: SimilarRelation;
  readonly rationale: string;
}

function link(slug: MetadataProblemSlug, relation: SimilarRelation, rationale: string): SimilarProblem {
  return { slug, relation, rationale };
}

/** Original, directional editorial recommendations, not official LeetCode similar questions. */
export const SIMILAR_PROBLEMS = {
  'contains-duplicate': [
    link('two-sum', 'next-challenge', 'Extend membership checks to value-pair lookup.'),
    link('valid-sudoku', 'next-challenge', 'Check uniqueness across several overlapping groups.'),
    link('longest-consecutive-sequence', 'next-challenge', 'Use set membership to recognize consecutive runs.'),
  ],
  'valid-anagram': [
    link('group-anagrams', 'next-challenge', 'Group many strings by the same character-count equivalence.'),
    link('permutation-in-string', 'next-challenge', 'Move character-count matching into a substring window.'),
    link('valid-palindrome', 'useful-contrast', 'Contrast order-insensitive counts with mirrored character order.'),
  ],
  'two-sum': [
    link('two-sum-ii-input-array-is-sorted', 'useful-contrast', 'Sorted input changes the pair-search tradeoffs.'),
    link('3sum', 'next-challenge', 'Extend pair matching to unique triples.'),
    link('contains-duplicate', 'prerequisite', 'Practice basic membership lookup before storing pair information.'),
  ],
  'group-anagrams': [
    link('valid-anagram', 'prerequisite', 'Establish when two strings have equivalent character counts.'),
    link('top-k-frequent-elements', 'same-pattern', 'Aggregate equivalent values before answering a group-level query.'),
    link('permutation-in-string', 'useful-contrast', 'Compare whole-string grouping with local permutation matching.'),
  ],
  'top-k-frequent-elements': [
    link('kth-largest-element-in-an-array', 'same-pattern', 'Compare frequency ranking with numeric rank selection.'),
    link('k-closest-points-to-origin', 'same-pattern', 'Select a small subset using a different ranking key.'),
    link('kth-largest-element-in-a-stream', 'useful-contrast', 'Contrast batch selection with continuously updated rank.'),
  ],
  'encode-and-decode-strings': [
    link('serialize-and-deserialize-binary-tree', 'next-challenge', 'Extend reversible encoding from sequences to tree structure.'),
  ],
  'product-of-array-except-self': [
    link('trapping-rain-water', 'same-pattern', 'Compare summaries from both sides of an array position.'),
    link('maximum-product-subarray', 'useful-contrast', 'Contrast exclusion products with contiguous product optimization.'),
    link('maximum-subarray', 'useful-contrast', 'Compare per-position aggregation with contiguous-sum optimization.'),
  ],
  'valid-sudoku': [
    link('contains-duplicate', 'prerequisite', 'Practice uniqueness checks on a single group first.'),
    link('n-queens', 'useful-contrast', 'Contrast validating a board with generating valid placements.'),
    link('set-matrix-zeroes', 'same-pattern', 'Track constraints shared by matrix rows and columns.'),
  ],
  'longest-consecutive-sequence': [
    link('contains-duplicate', 'prerequisite', 'Build familiarity with set membership on unsorted input.'),
    link('hand-of-straights', 'useful-contrast', 'Add multiplicities and fixed group sizes to consecutive values.'),
    link('longest-increasing-subsequence', 'useful-contrast', 'Distinguish consecutive values from order-preserving subsequences.'),
  ],
  'valid-palindrome': [
    link('longest-palindromic-substring', 'next-challenge', 'Move from checking one string to finding a palindromic span.'),
    link('palindromic-substrings', 'next-challenge', 'Count palindromic spans instead of checking the entire string.'),
    link('valid-anagram', 'useful-contrast', 'Character counts ignore order; palindrome checks do not.'),
  ],
  'two-sum-ii-input-array-is-sorted': [
    link('two-sum', 'useful-contrast', 'Remove sortedness and compare the lookup requirements.'),
    link('3sum', 'next-challenge', 'Extend sorted pair search to deduplicated triples.'),
    link('container-with-most-water', 'same-pattern', 'Practice a different objective with inward-moving pointers.'),
  ],
  '3sum': [
    link('two-sum-ii-input-array-is-sorted', 'prerequisite', 'Practice sorted pair search before handling triples.'),
    link('two-sum', 'useful-contrast', 'Compare one index pair with all unique value triples.'),
    link('combination-sum-ii', 'useful-contrast', 'Compare fixed-size triples with variable-size unique combinations.'),
  ],
  'container-with-most-water': [
    link('two-sum-ii-input-array-is-sorted', 'same-pattern', 'Use opposing pointers under a different movement rule.'),
    link('trapping-rain-water', 'useful-contrast', 'Distinguish a single container from total trapped volume.'),
    link('largest-rectangle-in-histogram', 'useful-contrast', 'Compare boundary-limited area with contiguous-bar area.'),
  ],
  'trapping-rain-water': [
    link('container-with-most-water', 'useful-contrast', 'Separate total trapped volume from one chosen container.'),
    link('largest-rectangle-in-histogram', 'same-pattern', 'Explore monotonic height boundaries with a different objective.'),
    link('product-of-array-except-self', 'same-pattern', 'Practice combining information from both array directions.'),
  ],
  'best-time-to-buy-and-sell-stock': [
    link('maximum-subarray', 'same-pattern', 'Compare profitable spans with contiguous-sum optimization.'),
    link('best-time-to-buy-and-sell-stock-with-cooldown', 'next-challenge', 'Add repeated transactions and a cooldown constraint.'),
    link('maximum-product-subarray', 'useful-contrast', 'Compare additive gains with sign-sensitive multiplicative spans.'),
  ],
  'longest-substring-without-repeating-characters': [
    link('longest-repeating-character-replacement', 'next-challenge', 'Change window validity from uniqueness to a replacement budget.'),
    link('minimum-window-substring', 'next-challenge', 'Switch from maximizing a valid window to minimizing coverage.'),
    link('permutation-in-string', 'same-pattern', 'Compare variable-length uniqueness with fixed-length count matching.'),
  ],
  'longest-repeating-character-replacement': [
    link('longest-substring-without-repeating-characters', 'prerequisite', 'Practice variable-length windows with a simpler validity condition.'),
    link('permutation-in-string', 'same-pattern', 'Maintain character frequencies as a window moves.'),
    link('minimum-window-substring', 'next-challenge', 'Track a different frequency-based window constraint.'),
  ],
  'permutation-in-string': [
    link('valid-anagram', 'prerequisite', 'Practice character-count equivalence without a moving window.'),
    link('minimum-window-substring', 'next-challenge', 'Generalize exact fixed-length matching to minimum coverage.'),
    link('longest-repeating-character-replacement', 'same-pattern', 'Reuse window counts under a replacement constraint.'),
  ],
  'minimum-window-substring': [
    link('permutation-in-string', 'prerequisite', 'Start with fixed-length character-count matching.'),
    link('longest-substring-without-repeating-characters', 'useful-contrast', 'Contrast minimum coverage with maximum uniqueness.'),
    link('longest-repeating-character-replacement', 'same-pattern', 'Compare frequency-based validity rules for variable windows.'),
  ],
  'sliding-window-maximum': [
    link('daily-temperatures', 'same-pattern', 'Compare monotonic candidate tracking across array scans.'),
    link('largest-rectangle-in-histogram', 'same-pattern', 'Explore another use of ordered candidate elimination.'),
    link('kth-largest-element-in-a-stream', 'useful-contrast', 'Contrast expiring window values with persistent stream history.'),
  ],
  'valid-parentheses': [
    link('generate-parentheses', 'next-challenge', 'Generate valid strings instead of validating one.'),
    link('valid-parenthesis-string', 'next-challenge', 'Allow wildcard characters in a balance constraint.'),
    link('evaluate-reverse-polish-notation', 'same-pattern', 'Compare stack-based parsing of brackets and expressions.'),
  ],
  'min-stack': [
    link('valid-parentheses', 'prerequisite', 'Practice stack operations before maintaining extra stack information.'),
    link('daily-temperatures', 'useful-contrast', 'Contrast persistent stack queries with monotonic candidate tracking.'),
    link('lru-cache', 'next-challenge', 'Explore another mutable structure with constant-time operation requirements.'),
  ],
  'evaluate-reverse-polish-notation': [
    link('valid-parentheses', 'same-pattern', 'Compare two stack-driven token interpreters.'),
    link('min-stack', 'useful-contrast', 'Contrast expression evaluation with an augmented stack API.'),
  ],
  'generate-parentheses': [
    link('valid-parentheses', 'prerequisite', 'Understand bracket validity before generating valid strings.'),
    link('letter-combinations-of-a-phone-number', 'same-pattern', 'Build strings through a constrained choice tree.'),
    link('n-queens', 'next-challenge', 'Extend partial-validity constraints to board placements.'),
  ],
  'daily-temperatures': [
    link('largest-rectangle-in-histogram', 'next-challenge', 'Extend monotonic boundaries to an area objective.'),
    link('sliding-window-maximum', 'same-pattern', 'Compare monotonic stacks with expiring-window deques.'),
    link('car-fleet', 'same-pattern', 'Compare ordered candidate handling for temperatures and arrivals.'),
  ],
  'car-fleet': [
    link('daily-temperatures', 'same-pattern', 'Practice monotonic comparisons on an ordered sequence.'),
    link('merge-intervals', 'useful-contrast', 'Contrast merging arrival groups with merging spatial intervals.'),
    link('non-overlapping-intervals', 'same-pattern', 'Compare sorted greedy decisions under different constraints.'),
  ],
  'largest-rectangle-in-histogram': [
    link('daily-temperatures', 'prerequisite', 'Practice monotonic boundary searches before optimizing area.'),
    link('trapping-rain-water', 'same-pattern', 'Use height boundaries for a different geometric aggregate.'),
    link('sliding-window-maximum', 'same-pattern', 'Compare ordered candidate removal with explicit window expiry.'),
  ],
  'binary-search': [
    link('search-a-2d-matrix', 'next-challenge', 'Transfer ordered search to a matrix layout.'),
    link('search-in-rotated-sorted-array', 'next-challenge', 'Handle ordered regions separated by a rotation.'),
    link('koko-eating-bananas', 'next-challenge', 'Search a feasible numeric parameter rather than an element.'),
  ],
  'search-a-2d-matrix': [
    link('binary-search', 'prerequisite', 'Practice search boundaries in a one-dimensional ordered array.'),
    link('search-in-rotated-sorted-array', 'same-pattern', 'Exploit structured ordering rather than scan every value.'),
    link('kth-smallest-element-in-a-bst', 'useful-contrast', 'Compare ordered lookup in matrices and search trees.'),
  ],
  'koko-eating-bananas': [
    link('binary-search', 'prerequisite', 'Practice search interval invariants before searching feasible answers.'),
    link('swim-in-rising-water', 'next-challenge', 'Compare numeric feasibility with grid reachability thresholds.'),
    link('median-of-two-sorted-arrays', 'useful-contrast', 'Contrast answer feasibility with sorted partition constraints.'),
  ],
  'find-minimum-in-rotated-sorted-array': [
    link('binary-search', 'prerequisite', 'Establish ordered-search boundary reasoning first.'),
    link('search-in-rotated-sorted-array', 'next-challenge', 'Locate a target rather than only the rotation minimum.'),
    link('median-of-two-sorted-arrays', 'next-challenge', 'Practice more demanding ordered partition reasoning.'),
  ],
  'search-in-rotated-sorted-array': [
    link('binary-search', 'prerequisite', 'Practice target search without a rotation first.'),
    link('find-minimum-in-rotated-sorted-array', 'same-pattern', 'Study the same rotation structure with a different target.'),
    link('search-a-2d-matrix', 'same-pattern', 'Compare two structured variants of ordered search.'),
  ],
  'time-based-key-value-store': [
    link('binary-search', 'prerequisite', 'Practice ordered lookup before adding timestamp boundaries.'),
    link('lru-cache', 'useful-contrast', 'Contrast historical lookup with recency-based eviction.'),
    link('design-twitter', 'next-challenge', 'Extend timestamped storage to merging multiple user histories.'),
  ],
  'median-of-two-sorted-arrays': [
    link('binary-search', 'prerequisite', 'Practice interval invariants before reasoning about paired partitions.'),
    link('find-median-from-data-stream', 'useful-contrast', 'Contrast static sorted input with an evolving median.'),
    link('kth-largest-element-in-an-array', 'same-pattern', 'Compare median selection with general rank selection.'),
  ],
  'reverse-linked-list': [
    link('reverse-nodes-in-k-group', 'next-challenge', 'Add group boundaries to list reversal.'),
    link('reorder-list', 'next-challenge', 'Use reversal as part of a list rearrangement.'),
    link('merge-two-sorted-lists', 'same-pattern', 'Practice pointer rewiring under a different output order.'),
  ],
  'merge-two-sorted-lists': [
    link('merge-k-sorted-lists', 'next-challenge', 'Scale sorted merging from two lists to many.'),
    link('reverse-linked-list', 'same-pattern', 'Practice list rewiring without a sorted-order constraint.'),
    link('add-two-numbers', 'same-pattern', 'Traverse two lists while building a result list.'),
  ],
  'reorder-list': [
    link('reverse-linked-list', 'prerequisite', 'Practice reversal before composing a larger rearrangement.'),
    link('linked-list-cycle', 'same-pattern', 'Compare fast-and-slow traversal for different purposes.'),
    link('reverse-nodes-in-k-group', 'next-challenge', 'Add repeated segment boundaries to list rewiring.'),
  ],
  'remove-nth-node-from-end-of-list': [
    link('reverse-linked-list', 'same-pattern', 'Practice pointer safety while changing list structure.'),
    link('linked-list-cycle', 'useful-contrast', 'Contrast fixed pointer spacing with different pointer speeds.'),
    link('reverse-nodes-in-k-group', 'next-challenge', 'Handle more involved segment boundaries and reconnections.'),
  ],
  'copy-list-with-random-pointer': [
    link('clone-graph', 'same-pattern', 'Preserve identity and cross-references while copying nodes.'),
    link('reverse-linked-list', 'useful-contrast', 'Distinguish copying nodes from mutating existing links.'),
    link('lru-cache', 'same-pattern', 'Combine keyed node lookup with linked structure management.'),
  ],
  'add-two-numbers': [
    link('plus-one', 'prerequisite', 'Practice digit carries before handling two linked operands.'),
    link('multiply-strings', 'next-challenge', 'Extend digit arithmetic to a more complex operation.'),
    link('merge-two-sorted-lists', 'same-pattern', 'Coordinate two list traversals while constructing output.'),
  ],
  'linked-list-cycle': [
    link('find-the-duplicate-number', 'next-challenge', 'Recognize cycle structure in array-index transitions.'),
    link('happy-number', 'same-pattern', 'Detect repetition in an implicit numeric sequence.'),
    link('remove-nth-node-from-end-of-list', 'useful-contrast', 'Compare speed-based and fixed-gap pointer movement.'),
  ],
  'find-the-duplicate-number': [
    link('linked-list-cycle', 'prerequisite', 'Practice cycle detection on explicit links first.'),
    link('contains-duplicate', 'useful-contrast', 'Compare duplicate detection under different space constraints.'),
    link('missing-number', 'useful-contrast', 'Contrast a repeated value with an absent value.'),
  ],
  'lru-cache': [
    link('min-stack', 'same-pattern', 'Maintain extra invariants behind a constant-time mutable API.'),
    link('time-based-key-value-store', 'useful-contrast', 'Distinguish recency eviction from historical value lookup.'),
    link('design-twitter', 'next-challenge', 'Coordinate several structures behind a richer service API.'),
  ],
  'merge-k-sorted-lists': [
    link('merge-two-sorted-lists', 'prerequisite', 'Practice the two-list merge before scaling the input count.'),
    link('design-twitter', 'same-pattern', 'Compare merging sorted lists with merging timestamped feeds.'),
    link('kth-largest-element-in-a-stream', 'same-pattern', 'Practice heap-based selection with incremental input.'),
  ],
  'reverse-nodes-in-k-group': [
    link('reverse-linked-list', 'prerequisite', 'Practice whole-list reversal before managing group boundaries.'),
    link('reorder-list', 'same-pattern', 'Compose list transformations while preserving reconnection points.'),
    link('remove-nth-node-from-end-of-list', 'same-pattern', 'Reason carefully about boundaries and head changes.'),
  ],
  'invert-binary-tree': [
    link('same-tree', 'same-pattern', 'Compare recursive tree transformation with structural comparison.'),
    link('maximum-depth-of-binary-tree', 'same-pattern', 'Reuse recursive traversal for an aggregate result.'),
    link('rotate-image', 'useful-contrast', 'Contrast tree reflection with matrix rotation.'),
  ],
  'maximum-depth-of-binary-tree': [
    link('balanced-binary-tree', 'next-challenge', 'Add a balance condition to subtree-height reasoning.'),
    link('diameter-of-binary-tree', 'next-challenge', 'Distinguish tree height from the longest connecting path.'),
    link('binary-tree-level-order-traversal', 'same-pattern', 'View depth through explicit traversal levels.'),
  ],
  'diameter-of-binary-tree': [
    link('maximum-depth-of-binary-tree', 'prerequisite', 'Understand subtree heights before combining path lengths.'),
    link('balanced-binary-tree', 'same-pattern', 'Derive a global property from subtree height summaries.'),
    link('binary-tree-maximum-path-sum', 'next-challenge', 'Extend unweighted path length to weighted path optimization.'),
  ],
  'balanced-binary-tree': [
    link('maximum-depth-of-binary-tree', 'prerequisite', 'Practice height calculation before checking local balance.'),
    link('diameter-of-binary-tree', 'same-pattern', 'Combine subtree summaries into a different global property.'),
    link('binary-tree-maximum-path-sum', 'next-challenge', 'Handle richer information about paths through subtrees.'),
  ],
  'same-tree': [
    link('subtree-of-another-tree', 'next-challenge', 'Search for a matching structure inside a larger tree.'),
    link('invert-binary-tree', 'same-pattern', 'Compare structural recursion for checking and transforming trees.'),
    link('serialize-and-deserialize-binary-tree', 'next-challenge', 'Preserve the structure and values used by equality checks.'),
  ],
  'subtree-of-another-tree': [
    link('same-tree', 'prerequisite', 'Practice exact tree comparison before subtree matching.'),
    link('serialize-and-deserialize-binary-tree', 'same-pattern', 'Consider how an encoding preserves subtree structure.'),
    link('word-search', 'useful-contrast', 'Contrast structural tree matching with path-based grid matching.'),
  ],
  'lowest-common-ancestor-of-a-binary-search-tree': [
    link('validate-binary-search-tree', 'same-pattern', 'Use global ordering constraints in a search tree.'),
    link('kth-smallest-element-in-a-bst', 'same-pattern', 'Exploit search-tree ordering for a different query.'),
    link('binary-search', 'useful-contrast', 'Compare ordered navigation in trees and arrays.'),
  ],
  'binary-tree-level-order-traversal': [
    link('binary-tree-right-side-view', 'next-challenge', 'Select a view from each traversal level.'),
    link('maximum-depth-of-binary-tree', 'same-pattern', 'Relate level counts to tree depth.'),
    link('rotting-oranges', 'next-challenge', 'Transfer layered traversal to multiple grid sources.'),
  ],
  'binary-tree-right-side-view': [
    link('binary-tree-level-order-traversal', 'prerequisite', 'Practice grouping nodes by depth before selecting a view.'),
    link('count-good-nodes-in-binary-tree', 'useful-contrast', 'Contrast depth-based visibility with root-path constraints.'),
    link('maximum-depth-of-binary-tree', 'same-pattern', 'Reason about tree depth under different traversal styles.'),
  ],
  'count-good-nodes-in-binary-tree': [
    link('maximum-depth-of-binary-tree', 'prerequisite', 'Practice recursive tree traversal before tracking path context.'),
    link('validate-binary-search-tree', 'same-pattern', 'Carry ancestor-derived constraints through a traversal.'),
    link('binary-tree-maximum-path-sum', 'useful-contrast', 'Contrast root-path context with paths joining subtrees.'),
  ],
  'validate-binary-search-tree': [
    link('count-good-nodes-in-binary-tree', 'same-pattern', 'Compare ancestor-derived bounds with root-path extrema.'),
    link('kth-smallest-element-in-a-bst', 'same-pattern', 'Use the ordered traversal property of valid search trees.'),
    link('lowest-common-ancestor-of-a-binary-search-tree', 'same-pattern', 'Apply search-tree ordering to an ancestry query.'),
  ],
  'kth-smallest-element-in-a-bst': [
    link('validate-binary-search-tree', 'same-pattern', 'Connect search-tree validity with ordered traversal.'),
    link('kth-largest-element-in-an-array', 'useful-contrast', 'Compare rank selection with and without tree ordering.'),
    link('lowest-common-ancestor-of-a-binary-search-tree', 'same-pattern', 'Explore another query supported by search-tree ordering.'),
  ],
  'construct-binary-tree-from-preorder-and-inorder-traversal': [
    link('same-tree', 'useful-contrast', 'Compare checking an existing structure with rebuilding one.'),
    link('serialize-and-deserialize-binary-tree', 'same-pattern', 'Reconstruct trees from different sequence representations.'),
    link('kth-smallest-element-in-a-bst', 'same-pattern', 'Explore how inorder traversal exposes tree structure and ordering.'),
  ],
  'binary-tree-maximum-path-sum': [
    link('diameter-of-binary-tree', 'prerequisite', 'Practice combining subtree paths without node weights.'),
    link('maximum-subarray', 'same-pattern', 'Compare best contiguous paths in linear and branching structures.'),
    link('balanced-binary-tree', 'same-pattern', 'Distinguish returned subtree information from a global tree property.'),
  ],
  'serialize-and-deserialize-binary-tree': [
    link('encode-and-decode-strings', 'prerequisite', 'Practice reversible encoding with unambiguous sequence boundaries.'),
    link('construct-binary-tree-from-preorder-and-inorder-traversal', 'same-pattern', 'Rebuild trees from a different representation.'),
    link('same-tree', 'same-pattern', 'Tree equality describes the structure a round trip must preserve.'),
  ],
  'kth-largest-element-in-a-stream': [
    link('kth-largest-element-in-an-array', 'useful-contrast', 'Contrast ongoing rank maintenance with batch selection.'),
    link('find-median-from-data-stream', 'next-challenge', 'Maintain a central rank rather than a fixed upper rank.'),
    link('top-k-frequent-elements', 'same-pattern', 'Compare retaining numeric rank with frequency-based ranking.'),
  ],
  'last-stone-weight': [
    link('kth-largest-element-in-a-stream', 'same-pattern', 'Practice repeated priority access under changing input.'),
    link('task-scheduler', 'next-challenge', 'Add temporal constraints to priority-driven simulation.'),
    link('hand-of-straights', 'useful-contrast', 'Contrast largest-first simulation with consecutive-value grouping.'),
  ],
  'k-closest-points-to-origin': [
    link('kth-largest-element-in-an-array', 'same-pattern', 'Reuse rank selection with a geometric ranking key.'),
    link('top-k-frequent-elements', 'same-pattern', 'Select a subset after computing a different priority.'),
    link('min-cost-to-connect-all-points', 'useful-contrast', 'Distinguish nearest-to-origin ranking from connecting all points.'),
  ],
  'kth-largest-element-in-an-array': [
    link('kth-largest-element-in-a-stream', 'useful-contrast', 'Compare one-time selection with an incremental API.'),
    link('k-closest-points-to-origin', 'same-pattern', 'Transfer rank selection to geometric priorities.'),
    link('top-k-frequent-elements', 'same-pattern', 'Rank frequency aggregates instead of raw values.'),
  ],
  'task-scheduler': [
    link('last-stone-weight', 'prerequisite', 'Practice priority-driven simulation without cooldowns.'),
    link('hand-of-straights', 'same-pattern', 'Compare frequency-constrained greedy arrangements.'),
    link('best-time-to-buy-and-sell-stock-with-cooldown', 'useful-contrast', 'Contrast cooldown scheduling with cooldown profit optimization.'),
  ],
  'design-twitter': [
    link('merge-k-sorted-lists', 'same-pattern', 'Compare merged feeds with merging multiple sorted lists.'),
    link('time-based-key-value-store', 'same-pattern', 'Manage timestamped histories behind a mutable API.'),
    link('lru-cache', 'same-pattern', 'Coordinate indexed records and ordering constraints in a service.'),
  ],
  'find-median-from-data-stream': [
    link('kth-largest-element-in-a-stream', 'prerequisite', 'Practice incremental rank maintenance before a changing middle rank.'),
    link('median-of-two-sorted-arrays', 'useful-contrast', 'Contrast stream updates with static sorted partitions.'),
    link('sliding-window-maximum', 'useful-contrast', 'Compare persistent stream history with expiring-window extrema.'),
  ],
  'subsets': [
    link('subsets-ii', 'next-challenge', 'Add duplicate input values while keeping unique subsets.'),
    link('permutations', 'same-pattern', 'Compare choosing membership with choosing an ordering.'),
    link('combination-sum', 'next-challenge', 'Add a numeric target and reusable choices.'),
  ],
  'combination-sum': [
    link('combination-sum-ii', 'useful-contrast', 'Change reuse rules and add duplicate candidates.'),
    link('subsets', 'prerequisite', 'Practice choice enumeration before adding a target constraint.'),
    link('coin-change-ii', 'useful-contrast', 'Count target combinations rather than enumerate them.'),
  ],
  'permutations': [
    link('subsets', 'useful-contrast', 'Contrast order-sensitive arrangements with membership-only choices.'),
    link('letter-combinations-of-a-phone-number', 'same-pattern', 'Compare positional choices from different candidate sets.'),
    link('n-queens', 'next-challenge', 'Add placement conflicts to an arrangement search.'),
  ],
  'subsets-ii': [
    link('subsets', 'prerequisite', 'Practice subset enumeration without duplicate values.'),
    link('combination-sum-ii', 'same-pattern', 'Handle duplicate choices under an additional target constraint.'),
    link('permutations', 'useful-contrast', 'Compare unordered selections with ordered arrangements.'),
  ],
  'combination-sum-ii': [
    link('combination-sum', 'useful-contrast', 'Compare reusable candidates with single-use duplicate candidates.'),
    link('subsets-ii', 'prerequisite', 'Practice duplicate-aware selection without a target sum.'),
    link('partition-equal-subset-sum', 'useful-contrast', 'Contrast enumerating target groups with deciding existence.'),
  ],
  'word-search': [
    link('word-search-ii', 'next-challenge', 'Search many words while sharing prefix information.'),
    link('number-of-islands', 'useful-contrast', 'Contrast path-specific cell reuse rules with component visitation.'),
    link('palindrome-partitioning', 'same-pattern', 'Backtrack over string constraints in a different search space.'),
  ],
  'palindrome-partitioning': [
    link('valid-palindrome', 'prerequisite', 'Understand palindrome validity before partition enumeration.'),
    link('palindromic-substrings', 'same-pattern', 'Recognize palindromic spans without enumerating complete partitions.'),
    link('word-break', 'useful-contrast', 'Compare enumerating valid partitions with deciding dictionary segmentation.'),
  ],
  'letter-combinations-of-a-phone-number': [
    link('subsets', 'same-pattern', 'Compare optional selections with one choice per input position.'),
    link('permutations', 'same-pattern', 'Compare independent positional choices with distinct-item arrangements.'),
    link('generate-parentheses', 'next-challenge', 'Add prefix-validity constraints to generated strings.'),
  ],
  'n-queens': [
    link('permutations', 'prerequisite', 'Practice arrangement search before adding board conflicts.'),
    link('valid-sudoku', 'useful-contrast', 'Contrast generating placements with validating a filled board.'),
    link('generate-parentheses', 'same-pattern', 'Prune partial constructions using validity constraints.'),
  ],
  'implement-trie-prefix-tree': [
    link('design-add-and-search-words-data-structure', 'next-challenge', 'Add wildcard matching to prefix-tree lookup.'),
    link('word-search-ii', 'next-challenge', 'Combine prefix indexing with grid path search.'),
    link('word-break', 'useful-contrast', 'Contrast prefix storage with dictionary-based segmentation.'),
  ],
  'design-add-and-search-words-data-structure': [
    link('implement-trie-prefix-tree', 'prerequisite', 'Practice exact prefix-tree lookup before wildcard branching.'),
    link('word-search-ii', 'next-challenge', 'Combine trie branching with board traversal constraints.'),
    link('regular-expression-matching', 'useful-contrast', 'Compare dictionary wildcards with whole-string pattern operators.'),
  ],
  'word-search-ii': [
    link('word-search', 'prerequisite', 'Practice single-word board search first.'),
    link('implement-trie-prefix-tree', 'prerequisite', 'Understand shared-prefix indexing before combining many searches.'),
    link('design-add-and-search-words-data-structure', 'same-pattern', 'Explore branching searches through a prefix tree.'),
  ],
  'number-of-islands': [
    link('max-area-of-island', 'next-challenge', 'Measure component size instead of counting components.'),
    link('number-of-connected-components-in-an-undirected-graph', 'same-pattern', 'Transfer component counting from grids to explicit graphs.'),
    link('surrounded-regions', 'next-challenge', 'Distinguish components by their connection to the boundary.'),
  ],
  'max-area-of-island': [
    link('number-of-islands', 'prerequisite', 'Practice discovering grid components before measuring their sizes.'),
    link('surrounded-regions', 'same-pattern', 'Classify grid regions using a different component property.'),
    link('pacific-atlantic-water-flow', 'next-challenge', 'Add directional height constraints to grid reachability.'),
  ],
  'clone-graph': [
    link('copy-list-with-random-pointer', 'same-pattern', 'Preserve node identity and arbitrary cross-references when copying.'),
    link('number-of-connected-components-in-an-undirected-graph', 'same-pattern', 'Traverse explicit adjacency while tracking visited nodes.'),
    link('same-tree', 'useful-contrast', 'Contrast cyclic graph identity with acyclic tree structure.'),
  ],
  'walls-and-gates': [
    link('rotting-oranges', 'same-pattern', 'Compare distance propagation with elapsed infection time.'),
    link('binary-tree-level-order-traversal', 'prerequisite', 'Practice layered traversal before handling multiple grid sources.'),
    link('word-ladder', 'next-challenge', 'Transfer shortest unweighted distances to an implicit word graph.'),
  ],
  'rotting-oranges': [
    link('walls-and-gates', 'same-pattern', 'Compare multi-source propagation with nearest-source distances.'),
    link('number-of-islands', 'useful-contrast', 'Distinguish traversal layers from component membership.'),
    link('network-delay-time', 'next-challenge', 'Replace uniform propagation steps with weighted travel times.'),
  ],
  'pacific-atlantic-water-flow': [
    link('surrounded-regions', 'same-pattern', 'Reason about grid connectivity relative to boundaries.'),
    link('max-area-of-island', 'useful-contrast', 'Add directed height constraints to ordinary grid traversal.'),
    link('swim-in-rising-water', 'next-challenge', 'Compare boundary reachability with threshold-limited travel.'),
  ],
  'surrounded-regions': [
    link('number-of-islands', 'prerequisite', 'Practice grid-component traversal before boundary classification.'),
    link('pacific-atlantic-water-flow', 'next-challenge', 'Add height-directed reachability from multiple boundaries.'),
    link('walls-and-gates', 'same-pattern', 'Compare boundary-based region traversal with nearest-source grid distances.'),
  ],
  'course-schedule': [
    link('course-schedule-ii', 'next-challenge', 'Produce a valid order instead of only testing feasibility.'),
    link('alien-dictionary', 'next-challenge', 'Infer ordering constraints before checking their consistency.'),
    link('graph-valid-tree', 'useful-contrast', 'Distinguish directed dependency cycles from undirected tree structure.'),
  ],
  'course-schedule-ii': [
    link('course-schedule', 'prerequisite', 'Understand dependency feasibility before returning an ordering.'),
    link('alien-dictionary', 'same-pattern', 'Order symbols under inferred precedence constraints.'),
    link('longest-increasing-path-in-a-matrix', 'same-pattern', 'Explore dependency ordering in a height-directed grid graph.'),
  ],
  'redundant-connection': [
    link('graph-valid-tree', 'same-pattern', 'Compare identifying an extra edge with validating tree structure.'),
    link('number-of-connected-components-in-an-undirected-graph', 'prerequisite', 'Practice tracking connectivity before detecting cycle-forming edges.'),
    link('min-cost-to-connect-all-points', 'next-challenge', 'Add edge costs to connectivity decisions.'),
  ],
  'number-of-connected-components-in-an-undirected-graph': [
    link('number-of-islands', 'same-pattern', 'Compare explicit graph components with grid components.'),
    link('graph-valid-tree', 'next-challenge', 'Add a no-cycle requirement to connectivity.'),
    link('redundant-connection', 'next-challenge', 'Identify the edge that makes connectivity cyclic.'),
  ],
  'graph-valid-tree': [
    link('number-of-connected-components-in-an-undirected-graph', 'prerequisite', 'Practice connectivity checking before adding the tree constraint.'),
    link('redundant-connection', 'same-pattern', 'Study how an added edge breaks tree structure.'),
    link('course-schedule', 'useful-contrast', 'Distinguish undirected cycles from directed dependency cycles.'),
  ],
  'word-ladder': [
    link('walls-and-gates', 'prerequisite', 'Practice shortest unweighted distances on an explicit grid.'),
    link('word-search', 'useful-contrast', 'Distinguish word transformations from spelling paths on a board.'),
    link('network-delay-time', 'next-challenge', 'Compare unit-cost transitions with weighted shortest paths.'),
  ],
  'reconstruct-itinerary': [
    link('course-schedule-ii', 'useful-contrast', 'Distinguish using every edge from respecting dependency order.'),
    link('network-delay-time', 'useful-contrast', 'Contrast complete edge usage with shortest travel times.'),
  ],
  'min-cost-to-connect-all-points': [
    link('redundant-connection', 'prerequisite', 'Practice connectivity and cycle reasoning before minimizing edge costs.'),
    link('network-delay-time', 'useful-contrast', 'Distinguish cheapest total connection from shortest source paths.'),
    link('k-closest-points-to-origin', 'useful-contrast', 'Contrast connecting all points with ranking individual distances.'),
  ],
  'network-delay-time': [
    link('rotting-oranges', 'prerequisite', 'Practice propagation time with uniform edge costs first.'),
    link('cheapest-flights-within-k-stops', 'next-challenge', 'Add a limit on the number of travel steps.'),
    link('min-cost-to-connect-all-points', 'useful-contrast', 'Distinguish shortest source paths from minimum total connection cost.'),
  ],
  'swim-in-rising-water': [
    link('network-delay-time', 'useful-contrast', 'Compare maximum-height path cost with additive travel time.'),
    link('pacific-atlantic-water-flow', 'same-pattern', 'Explore height-dependent reachability on a grid.'),
    link('koko-eating-bananas', 'same-pattern', 'Compare monotone feasibility over numeric thresholds.'),
  ],
  'alien-dictionary': [
    link('course-schedule-ii', 'prerequisite', 'Practice ordering an already specified dependency graph.'),
    link('course-schedule', 'same-pattern', 'Detect contradictions in directed ordering constraints.'),
    link('reconstruct-itinerary', 'useful-contrast', 'Distinguish symbol precedence from a route using every edge.'),
  ],
  'cheapest-flights-within-k-stops': [
    link('network-delay-time', 'useful-contrast', 'Compare weighted paths with and without a stop budget.'),
    link('word-ladder', 'same-pattern', 'Reason about path length in a different transition graph.'),
  ],
  'climbing-stairs': [
    link('min-cost-climbing-stairs', 'next-challenge', 'Change path counting into minimum-cost optimization.'),
    link('decode-ways', 'next-challenge', 'Add input-dependent validity to short-step choices.'),
    link('unique-paths', 'same-pattern', 'Count paths with a different state-space shape.'),
  ],
  'min-cost-climbing-stairs': [
    link('climbing-stairs', 'prerequisite', 'Practice step-based recurrence reasoning without costs.'),
    link('house-robber', 'same-pattern', 'Compare local movement costs with constrained reward selection.'),
    link('coin-change', 'next-challenge', 'Optimize over a larger set of possible step sizes.'),
  ],
  'house-robber': [
    link('house-robber-ii', 'next-challenge', 'Add circular adjacency to the selection constraint.'),
    link('min-cost-climbing-stairs', 'same-pattern', 'Practice small-state optimization along a sequence.'),
    link('best-time-to-buy-and-sell-stock-with-cooldown', 'next-challenge', 'Compare skipped neighbors with transaction cooldown states.'),
  ],
  'house-robber-ii': [
    link('house-robber', 'prerequisite', 'Understand linear adjacency before adding a circular boundary.'),
    link('best-time-to-buy-and-sell-stock-with-cooldown', 'same-pattern', 'Compare sequence optimization under different exclusion constraints.'),
    link('gas-station', 'useful-contrast', 'Contrast circular selection constraints with circular route feasibility.'),
  ],
  'longest-palindromic-substring': [
    link('valid-palindrome', 'prerequisite', 'Understand mirrored comparisons before searching substring boundaries.'),
    link('palindromic-substrings', 'same-pattern', 'Count valid spans instead of selecting the longest.'),
    link('palindrome-partitioning', 'next-challenge', 'Use palindromic spans in complete string partitions.'),
  ],
  'palindromic-substrings': [
    link('longest-palindromic-substring', 'same-pattern', 'Recognize the same spans under a different aggregate.'),
    link('valid-palindrome', 'prerequisite', 'Practice checking one palindrome before counting many.'),
    link('palindrome-partitioning', 'next-challenge', 'Combine valid spans into complete partitions.'),
  ],
  'decode-ways': [
    link('climbing-stairs', 'prerequisite', 'Practice short-step counting without character validity constraints.'),
    link('word-break', 'same-pattern', 'Compare valid prefix segments in two string interpretations.'),
    link('distinct-subsequences', 'next-challenge', 'Count string interpretations with two sequence positions.'),
  ],
  'coin-change': [
    link('coin-change-ii', 'useful-contrast', 'Contrast minimizing coin count with counting combinations.'),
    link('combination-sum', 'useful-contrast', 'Compare optimal counts with explicitly enumerated combinations.'),
    link('min-cost-climbing-stairs', 'prerequisite', 'Practice minimum-cost sequence states with fewer transitions.'),
  ],
  'maximum-product-subarray': [
    link('maximum-subarray', 'useful-contrast', 'Contrast additive spans with sign-sensitive multiplicative spans.'),
    link('product-of-array-except-self', 'useful-contrast', 'Distinguish contiguous optimization from exclusion products.'),
    link('best-time-to-buy-and-sell-stock', 'same-pattern', 'Compare compact state summaries for sequence optimization.'),
  ],
  'word-break': [
    link('decode-ways', 'same-pattern', 'Compare valid string segmentation under different token rules.'),
    link('palindrome-partitioning', 'useful-contrast', 'Contrast deciding segmentation with enumerating partitions.'),
    link('implement-trie-prefix-tree', 'same-pattern', 'Explore a data structure for recognizing dictionary prefixes.'),
  ],
  'longest-increasing-subsequence': [
    link('longest-common-subsequence', 'same-pattern', 'Compare subsequence optimization under ordering and matching constraints.'),
    link('longest-consecutive-sequence', 'useful-contrast', 'Distinguish input-order subsequences from consecutive-value sets.'),
    link('longest-increasing-path-in-a-matrix', 'next-challenge', 'Move increasing-chain optimization from sequences to grid paths.'),
  ],
  'partition-equal-subset-sum': [
    link('target-sum', 'same-pattern', 'Compare subset feasibility with counting signed assignments.'),
    link('combination-sum-ii', 'useful-contrast', 'Contrast target existence with enumerating single-use combinations.'),
    link('coin-change-ii', 'useful-contrast', 'Compare single-use partition choices with reusable denominations.'),
  ],
  'unique-paths': [
    link('climbing-stairs', 'prerequisite', 'Practice path counting in a one-dimensional state space.'),
    link('longest-increasing-path-in-a-matrix', 'useful-contrast', 'Contrast fixed-direction path counts with height-directed path lengths.'),
    link('interleaving-string', 'same-pattern', 'Compare two-coordinate states under input-dependent transitions.'),
  ],
  'longest-common-subsequence': [
    link('edit-distance', 'same-pattern', 'Compare alignment length with transformation cost.'),
    link('distinct-subsequences', 'next-challenge', 'Count matching subsequences instead of maximizing their length.'),
    link('longest-increasing-subsequence', 'useful-contrast', 'Contrast two-string matching with single-sequence ordering.'),
  ],
  'best-time-to-buy-and-sell-stock-with-cooldown': [
    link('best-time-to-buy-and-sell-stock', 'prerequisite', 'Practice profit reasoning with only one transaction.'),
    link('house-robber', 'same-pattern', 'Compare sequential decisions with enforced gaps.'),
    link('task-scheduler', 'useful-contrast', 'Contrast profit-state cooldowns with task-spacing constraints.'),
  ],
  'coin-change-ii': [
    link('coin-change', 'useful-contrast', 'Distinguish combination counts from minimum coin counts.'),
    link('combination-sum', 'useful-contrast', 'Contrast counting combinations with enumerating them.'),
    link('target-sum', 'same-pattern', 'Compare two ways to count target-forming choices.'),
  ],
  'target-sum': [
    link('partition-equal-subset-sum', 'same-pattern', 'Connect signed assignments with subset-sum constraints.'),
    link('coin-change-ii', 'useful-contrast', 'Compare single-use signed choices with reusable coin combinations.'),
    link('subsets', 'prerequisite', 'Practice binary choice enumeration before counting target assignments.'),
  ],
  'interleaving-string': [
    link('longest-common-subsequence', 'same-pattern', 'Track progress through two strings under different matching rules.'),
    link('edit-distance', 'same-pattern', 'Compare two-sequence states for recognition and transformation.'),
    link('distinct-subsequences', 'same-pattern', 'Compare ways to consume source characters in order.'),
  ],
  'longest-increasing-path-in-a-matrix': [
    link('longest-increasing-subsequence', 'useful-contrast', 'Contrast increasing grid paths with index-ordered subsequences.'),
    link('course-schedule-ii', 'same-pattern', 'Explore acyclic dependencies induced by increasing heights.'),
    link('pacific-atlantic-water-flow', 'useful-contrast', 'Compare optimizing height-directed paths with boundary reachability.'),
  ],
  'distinct-subsequences': [
    link('longest-common-subsequence', 'prerequisite', 'Practice two-sequence matching before counting matching selections.'),
    link('interleaving-string', 'same-pattern', 'Compare order-preserving consumption rules across string states.'),
    link('decode-ways', 'same-pattern', 'Count valid string interpretations with a different state dimension.'),
  ],
  'edit-distance': [
    link('longest-common-subsequence', 'same-pattern', 'Compare alignment length with operation-based transformation cost.'),
    link('interleaving-string', 'same-pattern', 'Use two string positions under different transition rules.'),
    link('regular-expression-matching', 'next-challenge', 'Add pattern operators to two-sequence matching states.'),
  ],
  'burst-balloons': [
    link('construct-binary-tree-from-preorder-and-inorder-traversal', 'useful-contrast', 'Compare recursive sequence decomposition with interval optimization.'),
    link('permutations', 'useful-contrast', 'Contrast enumerating orders with optimizing an order-dependent reward.'),
  ],
  'regular-expression-matching': [
    link('edit-distance', 'prerequisite', 'Practice two-sequence states before adding repetition operators.'),
    link('interleaving-string', 'same-pattern', 'Compare recognition problems over paired sequence positions.'),
    link('design-add-and-search-words-data-structure', 'useful-contrast', 'Distinguish pattern repetition from dictionary wildcard lookup.'),
  ],
  'maximum-subarray': [
    link('maximum-product-subarray', 'next-challenge', 'Replace additive spans with sign-sensitive products.'),
    link('best-time-to-buy-and-sell-stock', 'same-pattern', 'Compare contiguous gains with a single buy-sell interval.'),
    link('binary-tree-maximum-path-sum', 'next-challenge', 'Extend contiguous path optimization to a branching structure.'),
  ],
  'jump-game': [
    link('jump-game-ii', 'next-challenge', 'Minimize jumps instead of only deciding reachability.'),
    link('gas-station', 'same-pattern', 'Compare greedy reachability with resource-limited travel.'),
    link('climbing-stairs', 'useful-contrast', 'Contrast feasible variable jumps with counting fixed-step paths.'),
  ],
  'jump-game-ii': [
    link('jump-game', 'prerequisite', 'Understand reachable positions before optimizing the jump count.'),
    link('walls-and-gates', 'same-pattern', 'Compare shortest-step layers in different state spaces.'),
    link('coin-change', 'useful-contrast', 'Contrast position-dependent jump lengths with reusable fixed denominations.'),
  ],
  'gas-station': [
    link('jump-game', 'same-pattern', 'Compare greedy feasibility arguments for forward travel.'),
    link('maximum-subarray', 'same-pattern', 'Explore cumulative gains and losses along a sequence.'),
    link('house-robber-ii', 'useful-contrast', 'Distinguish circular route feasibility from circular selection constraints.'),
  ],
  'hand-of-straights': [
    link('longest-consecutive-sequence', 'useful-contrast', 'Add multiplicities and fixed-size groups to consecutive values.'),
    link('task-scheduler', 'same-pattern', 'Arrange counted items under a different spacing rule.'),
    link('group-anagrams', 'useful-contrast', 'Contrast consecutive grouping with equivalence-based grouping.'),
  ],
  'merge-triplets-to-form-target-triplet': [
    link('partition-equal-subset-sum', 'useful-contrast', 'Contrast componentwise target formation with additive target formation.'),
  ],
  'partition-labels': [
    link('merge-intervals', 'same-pattern', 'Relate character spans to overlapping interval groups.'),
    link('longest-substring-without-repeating-characters', 'useful-contrast', 'Contrast globally confined characters with local uniqueness.'),
    link('non-overlapping-intervals', 'same-pattern', 'Compare greedy boundary choices over spans.'),
  ],
  'valid-parenthesis-string': [
    link('valid-parentheses', 'prerequisite', 'Understand fixed bracket balance before introducing wildcards.'),
    link('generate-parentheses', 'useful-contrast', 'Contrast flexible validation with constrained generation.'),
    link('regular-expression-matching', 'useful-contrast', 'Distinguish wildcard balance choices from pattern repetition.'),
  ],
  'insert-interval': [
    link('merge-intervals', 'same-pattern', 'Compare adding one interval with normalizing an entire collection.'),
    link('non-overlapping-intervals', 'useful-contrast', 'Contrast merging overlaps with removing conflicting intervals.'),
    link('meeting-rooms', 'same-pattern', 'Practice overlap boundaries with a feasibility-only objective.'),
  ],
  'merge-intervals': [
    link('insert-interval', 'same-pattern', 'Use existing ordering when adding a new interval.'),
    link('non-overlapping-intervals', 'useful-contrast', 'Choose removals instead of merging conflicting spans.'),
    link('partition-labels', 'next-challenge', 'Recognize interval-like spans inside a string partition problem.'),
  ],
  'non-overlapping-intervals': [
    link('meeting-rooms', 'prerequisite', 'Practice overlap detection before optimizing removals.'),
    link('merge-intervals', 'useful-contrast', 'Compare selecting compatible spans with merging overlaps.'),
    link('meeting-rooms-ii', 'useful-contrast', 'Contrast removing conflicts with allocating concurrent resources.'),
  ],
  'meeting-rooms': [
    link('meeting-rooms-ii', 'next-challenge', 'Count required rooms instead of testing one-room feasibility.'),
    link('merge-intervals', 'same-pattern', 'Compare overlap detection with overlap consolidation.'),
    link('non-overlapping-intervals', 'next-challenge', 'Remove as few conflicting meetings as possible.'),
  ],
  'meeting-rooms-ii': [
    link('meeting-rooms', 'prerequisite', 'Practice meeting overlap rules before counting simultaneous resources.'),
    link('minimum-interval-to-include-each-query', 'next-challenge', 'Maintain active intervals under a different query objective.'),
    link('non-overlapping-intervals', 'useful-contrast', 'Compare resource allocation with discarding conflicts.'),
  ],
  'minimum-interval-to-include-each-query': [
    link('meeting-rooms-ii', 'same-pattern', 'Compare active interval priorities during an ordered scan.'),
    link('merge-intervals', 'useful-contrast', 'Preserve individual interval sizes instead of merging their coverage.'),
    link('k-closest-points-to-origin', 'same-pattern', 'Compare heap selection under different ranking keys.'),
  ],
  'rotate-image': [
    link('spiral-matrix', 'same-pattern', 'Practice matrix boundaries under a different traversal order.'),
    link('set-matrix-zeroes', 'same-pattern', 'Compare in-place matrix transformations and overwrite hazards.'),
    link('invert-binary-tree', 'useful-contrast', 'Distinguish geometric rotation from structural reflection.'),
  ],
  'spiral-matrix': [
    link('rotate-image', 'same-pattern', 'Compare matrix boundary traversal with positional transformation.'),
    link('set-matrix-zeroes', 'useful-contrast', 'Contrast ordered visitation with row-column mutation.'),
  ],
  'set-matrix-zeroes': [
    link('rotate-image', 'same-pattern', 'Manage in-place matrix updates without losing needed information.'),
    link('valid-sudoku', 'same-pattern', 'Track facts shared across matrix rows and columns.'),
    link('surrounded-regions', 'useful-contrast', 'Compare global row-column effects with connectivity-based changes.'),
  ],
  'happy-number': [
    link('linked-list-cycle', 'same-pattern', 'Compare cycle detection in explicit and implicit sequences.'),
    link('find-the-duplicate-number', 'same-pattern', 'Recognize repetition through deterministic numeric transitions.'),
    link('plus-one', 'useful-contrast', 'Contrast repeated digit transformation with positional carry arithmetic.'),
  ],
  'plus-one': [
    link('add-two-numbers', 'next-challenge', 'Extend carry arithmetic to two linked operands.'),
    link('multiply-strings', 'next-challenge', 'Handle carries in a larger digit-based arithmetic operation.'),
    link('reverse-integer', 'same-pattern', 'Practice positional digit arithmetic under different boundary rules.'),
  ],
  'powx-n': [
    link('construct-binary-tree-from-preorder-and-inorder-traversal', 'useful-contrast', 'Compare numeric divide-and-conquer with sequence-based tree reconstruction.'),
  ],
  'multiply-strings': [
    link('add-two-numbers', 'prerequisite', 'Practice carry arithmetic before multiplying digit sequences.'),
    link('plus-one', 'prerequisite', 'Understand positional carries in a smaller arithmetic task.'),
    link('sum-of-two-integers', 'useful-contrast', 'Compare decimal-digit arithmetic with bit-level arithmetic.'),
  ],
  'detect-squares': [
    link('k-closest-points-to-origin', 'useful-contrast', 'Contrast coordinate relationships with distance-based point ranking.'),
  ],
  'single-number': [
    link('missing-number', 'same-pattern', 'Compare bitwise cancellation under different occurrence assumptions.'),
    link('contains-duplicate', 'useful-contrast', 'Distinguish exceptional multiplicity from any repeated value.'),
    link('sum-of-two-integers', 'next-challenge', 'Explore a different use of bitwise operations.'),
  ],
  'number-of-1-bits': [
    link('counting-bits', 'next-challenge', 'Extend one population count to an entire numeric range.'),
    link('reverse-bits', 'same-pattern', 'Inspect bit positions for a different output transformation.'),
    link('single-number', 'useful-contrast', 'Compare per-integer bit counting with cross-value cancellation.'),
  ],
  'counting-bits': [
    link('number-of-1-bits', 'prerequisite', 'Understand population count for a single value first.'),
    link('climbing-stairs', 'same-pattern', 'Compare sequence recurrence reasoning with bit-derived states.'),
    link('reverse-bits', 'useful-contrast', 'Contrast counting set positions with rearranging positions.'),
  ],
  'reverse-bits': [
    link('number-of-1-bits', 'same-pattern', 'Practice inspecting individual bit positions.'),
    link('reverse-integer', 'useful-contrast', 'Compare fixed-width binary reversal with decimal digit reversal.'),
    link('sum-of-two-integers', 'same-pattern', 'Explore shifts and fixed-width bit behavior in arithmetic.'),
  ],
  'missing-number': [
    link('single-number', 'same-pattern', 'Compare cancellation under different uniqueness assumptions.'),
    link('find-the-duplicate-number', 'useful-contrast', 'Distinguish an absent value from a repeated value.'),
    link('contains-duplicate', 'useful-contrast', 'Compare range-based absence with unrestricted repetition.'),
  ],
  'sum-of-two-integers': [
    link('single-number', 'prerequisite', 'Practice XOR behavior before bitwise arithmetic.'),
    link('add-two-numbers', 'same-pattern', 'Compare carry propagation across bits and decimal digits.'),
    link('reverse-bits', 'same-pattern', 'Practice shifts and fixed-width representation constraints.'),
  ],
  'reverse-integer': [
    link('reverse-bits', 'useful-contrast', 'Contrast decimal digit reversal with fixed-width bit reversal.'),
    link('plus-one', 'same-pattern', 'Practice digit arithmetic with boundary and carry concerns.'),
    link('multiply-strings', 'next-challenge', 'Move from one numeric value to explicit digit-sequence arithmetic.'),
  ],
} as const satisfies Record<MetadataProblemSlug, readonly SimilarProblem[]>;
