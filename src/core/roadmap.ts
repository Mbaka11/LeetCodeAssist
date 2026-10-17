import { CATEGORIES, type CategoryName } from '../data/neetcode150';
import { catalogProblems, type CatalogId } from './catalog';
import { getProblemStatus } from './state';
import type { AppState, Difficulty } from './types';

/**
 * Categories grouped into tiers along the roadmap's prerequisite edges: a category sits one tier
 * below its deepest prerequisite, and tiers and members keep the roadmap order.
 */
export function roadmapTiers(categories: typeof CATEGORIES = CATEGORIES): CategoryName[][] {
  const tierOf = new Map<CategoryName, number>();
  const byName = new Map(categories.map((c) => [c.name, c]));
  const resolve = (name: CategoryName): number => {
    const known = tierOf.get(name);
    if (known !== undefined) return known;
    const category = byName.get(name);
    const tier = category && category.prerequisites.length > 0
      ? 1 + Math.max(...category.prerequisites.map(resolve))
      : 0;
    tierOf.set(name, tier);
    return tier;
  };

  const tiers: CategoryName[][] = [];
  for (const category of categories) {
    const tier = resolve(category.name);
    (tiers[tier] ??= []).push(category.name);
  }
  return tiers;
}

export const TREE_NODE_WIDTH = 220;
export const TREE_NODE_HEIGHT = 150;
const TREE_COLUMN_GAP = 64;
const TREE_ROW_GAP = 14;

export interface TreeNode {
  name: CategoryName;
  /** Column index (left to right): the prerequisite depth. */
  tier: number;
  x: number;
  y: number;
}

export interface TreeEdge {
  from: CategoryName;
  to: CategoryName;
  /** SVG path from the right edge of the prerequisite to the left edge of the category. */
  path: string;
}

export interface RoadmapTreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
}

/**
 * Left-to-right layout of the prerequisite graph: one column per tier, members in roadmap order and each
 * column centred vertically. Edges are cubic curves from a prerequisite to the categories that follow it.
 */
export function layoutRoadmapTree(categories: typeof CATEGORIES = CATEGORIES): RoadmapTreeLayout {
  const tiers = roadmapTiers(categories);
  const tallest = Math.max(1, ...tiers.map((names) => names.length));
  const height = tallest * TREE_NODE_HEIGHT + (tallest - 1) * TREE_ROW_GAP;
  const width = tiers.length * TREE_NODE_WIDTH + (tiers.length - 1) * TREE_COLUMN_GAP;

  const nodes: TreeNode[] = [];
  const byName = new Map<CategoryName, TreeNode>();
  tiers.forEach((names, tier) => {
    const columnHeight = names.length * TREE_NODE_HEIGHT + (names.length - 1) * TREE_ROW_GAP;
    const top = (height - columnHeight) / 2;
    names.forEach((name, row) => {
      const node: TreeNode = {
        name,
        tier,
        x: tier * (TREE_NODE_WIDTH + TREE_COLUMN_GAP),
        y: top + row * (TREE_NODE_HEIGHT + TREE_ROW_GAP),
      };
      nodes.push(node);
      byName.set(name, node);
    });
  });

  const edges: TreeEdge[] = [];
  for (const category of categories) {
    const to = byName.get(category.name)!;
    for (const prerequisite of category.prerequisites) {
      const from = byName.get(prerequisite)!;
      const x1 = from.x + TREE_NODE_WIDTH;
      const y1 = from.y + TREE_NODE_HEIGHT / 2;
      const x2 = to.x;
      const y2 = to.y + TREE_NODE_HEIGHT / 2;
      const bend = Math.max(TREE_COLUMN_GAP / 2, (x2 - x1) / 2);
      edges.push({
        from: prerequisite,
        to: category.name,
        path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      });
    }
  }
  return { nodes, edges, width, height };
}

export interface DifficultyCount {
  /** Started in the program or ticked as solved. */
  worked: number;
  total: number;
}

/** Per category: worked/total problems for each difficulty (the counters on the tree nodes). */
export function categoryDifficultyCounts(
  state: AppState,
  catalog: CatalogId = 'neetcode150',
): Map<string, Record<Difficulty, DifficultyCount>> {
  const result = new Map<string, Record<Difficulty, DifficultyCount>>();
  for (const problem of catalogProblems(catalog)) {
    let counts = result.get(problem.category);
    if (!counts) {
      counts = {
        Easy: { worked: 0, total: 0 },
        Medium: { worked: 0, total: 0 },
        Hard: { worked: 0, total: 0 },
      };
      result.set(problem.category, counts);
    }
    const bucket = counts[problem.difficulty];
    bucket.total += 1;
    if (getProblemStatus(state, problem.slug) !== 'untouched' || state.checked[problem.slug]) {
      bucket.worked += 1;
    }
  }
  return result;
}
