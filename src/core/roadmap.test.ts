import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_NAMES } from '../data/neetcode150';
import { NEETCODE_150 } from '../data/neetcode150';
import {
  TREE_NODE_HEIGHT,
  TREE_NODE_WIDTH,
  categoryDifficultyCounts,
  layoutRoadmapTree,
  roadmapTiers,
} from './roadmap';
import { newState } from './testing';

describe('roadmapTiers', () => {
  const tiers = roadmapTiers();

  it('places every category exactly once', () => {
    expect(tiers.flat().sort()).toEqual([...CATEGORY_NAMES].sort());
  });

  it('puts every category below all of its prerequisites', () => {
    const tierOf = new Map(tiers.flatMap((names, tier) => names.map((name) => [name, tier] as const)));
    for (const category of CATEGORIES) {
      for (const prerequisite of category.prerequisites) {
        expect(tierOf.get(prerequisite)!).toBeLessThan(tierOf.get(category.name)!);
      }
    }
  });

  it('starts with Arrays & Hashing and keeps roadmap order inside a tier', () => {
    expect(tiers[0]).toEqual(['Arrays & Hashing']);
    expect(tiers[1]).toEqual(['Two Pointers', 'Stack']);
  });
});

describe('layoutRoadmapTree', () => {
  const layout = layoutRoadmapTree();
  const byName = new Map(layout.nodes.map((n) => [n.name, n]));

  it('has one node per category and one edge per prerequisite', () => {
    expect(layout.nodes.map((n) => n.name).sort()).toEqual([...CATEGORY_NAMES].sort());
    expect(layout.edges).toHaveLength(CATEGORIES.reduce((n, c) => n + c.prerequisites.length, 0));
  });

  it('lays prerequisites out to the left of the categories that follow them', () => {
    for (const edge of layout.edges) {
      expect(byName.get(edge.from)!.x + TREE_NODE_WIDTH).toBeLessThan(byName.get(edge.to)!.x);
    }
  });

  it('never overlaps nodes and keeps them inside the canvas', () => {
    for (const a of layout.nodes) {
      expect(a.x + TREE_NODE_WIDTH).toBeLessThanOrEqual(layout.width);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y + TREE_NODE_HEIGHT).toBeLessThanOrEqual(layout.height);
      for (const b of layout.nodes) {
        if (a === b || a.tier !== b.tier) continue;
        expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(TREE_NODE_HEIGHT);
      }
    }
  });

  it('starts every edge at the right edge of a node and ends it at the left edge of the next', () => {
    const edge = layout.edges.find((e) => e.from === 'Arrays & Hashing' && e.to === 'Stack')!;
    const from = byName.get('Arrays & Hashing')!;
    const to = byName.get('Stack')!;
    expect(edge.path.startsWith(`M ${from.x + TREE_NODE_WIDTH} ${from.y + TREE_NODE_HEIGHT / 2} C`)).toBe(true);
    expect(edge.path.endsWith(`${to.x} ${to.y + TREE_NODE_HEIGHT / 2}`)).toBe(true);
  });
});

describe('categoryDifficultyCounts', () => {
  it('counts problems per difficulty and which of them were worked', () => {
    const empty = categoryDifficultyCounts(newState());
    const total = [...empty.values()].flatMap((c) => [c.Easy, c.Medium, c.Hard]).reduce((n, c) => n + c.total, 0);
    expect(total).toBe(NEETCODE_150.length);
    expect(empty.get('Two Pointers')).toEqual({
      Easy: { worked: 0, total: 1 },
      Medium: { worked: 0, total: 3 },
      Hard: { worked: 0, total: 1 },
    });

    const state = {
      ...newState(),
      checked: { 'valid-palindrome': true },
      problemStatus: { '3sum': 'learning' as const, 'trapping-rain-water': 'mastered' as const },
    };
    expect(categoryDifficultyCounts(state).get('Two Pointers')).toEqual({
      Easy: { worked: 1, total: 1 },
      Medium: { worked: 1, total: 3 },
      Hard: { worked: 1, total: 1 },
    });
  });
});

describe('categoryDifficultyCounts and the bonus pool', () => {
  it('counts a started bonus-pool problem as worked in its category', () => {
    const state = { ...newState(), problemStatus: { 'koko-eating-bananas': 'learning' as const } };
    expect(categoryDifficultyCounts(state).get('Binary Search')!.Medium.worked).toBe(1);
  });
});
