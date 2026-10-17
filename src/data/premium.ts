/**
 * NeetCode 150 problems that need LeetCode Premium, from the same public NeetCode metadata as
 * src/data/blind75.ts (revision d5ebb3ea8bd4b52d605bc7aa179e22af684d31bb). Six of them are in the Blind 75,
 * `walls-and-gates` is only in the NeetCode 150, and `meeting-rooms` is the Easy problem the program leaves out.
 * They stay in the catalogs and are only labelled; the planner never schedules a Premium problem.
 */
export const PREMIUM_PROBLEMS: readonly string[] = [
  'encode-and-decode-strings',
  'walls-and-gates',
  'number-of-connected-components-in-an-undirected-graph',
  'graph-valid-tree',
  'alien-dictionary',
  'meeting-rooms',
  'meeting-rooms-ii',
];

const PREMIUM_SLUGS: ReadonlySet<string> = new Set(PREMIUM_PROBLEMS);

export function isPremiumProblem(slug: string): boolean {
  return PREMIUM_SLUGS.has(slug);
}
