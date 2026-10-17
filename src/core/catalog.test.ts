import { describe, expect, it } from 'vitest';
import { BLIND_75 } from '../data/blind75';
import { CATEGORY_NAMES, PROBLEMS_BY_SLUG } from '../data/neetcode150';
import { isPremiumProblem } from '../data/premium';
import { CATALOG_IDS, catalogProblems } from './catalog';
import { categoryDifficultyCounts } from './roadmap';
import { problemStats } from './state';
import { newState } from './testing';
import type { AppState } from './types';

describe('catalogProblems', () => {
  it('has the whole NeetCode 150 and the 75 Blind 75 problems in roadmap order', () => {
    expect(CATALOG_IDS).toEqual(['neetcode150', 'blind75']);
    expect(catalogProblems('neetcode150')).toHaveLength(150);
    const blind = catalogProblems('blind75');
    expect(blind).toHaveLength(75);
    expect(new Set(blind.map((p) => p.slug))).toEqual(new Set(BLIND_75));
    const orders = blind.map((p) => p.neetcodeOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(blind.every((p) => PROBLEMS_BY_SLUG.get(p.slug) === p)).toBe(true);
  });

  it('keeps the six Premium Blind 75 problems, labelled by the Premium list', () => {
    const premium = catalogProblems('blind75').filter((p) => isPremiumProblem(p.slug));
    expect(premium).toHaveLength(6);
    expect(catalogProblems('neetcode150').filter((p) => isPremiumProblem(p.slug))).toHaveLength(7);
  });
});

describe('problemStats and categoryDifficultyCounts for a catalog', () => {
  const state: AppState = {
    ...newState(),
    problemStatus: {
      'two-sum': 'mastered',
      'min-stack': 'reviewed', // NeetCode 150 only
      '3sum': 'consolidating',
      'combination-sum': 'learning',
    },
    checked: { 'contains-duplicate': true, 'walls-and-gates': true }, // walls-and-gates is not in the Blind 75
  };

  it('defaults to the NeetCode 150', () => {
    expect(problemStats(state)).toEqual(problemStats(state, 'neetcode150'));
    expect(problemStats(state).overall.total).toBe(150);
  });

  it('filters overall, category and difficulty counts to the Blind 75 over the same state', () => {
    const all = problemStats(state, 'neetcode150');
    const blind = problemStats(state, 'blind75');
    expect(blind.overall).toEqual({ total: 75, worked: 4, soloInReview: 1, consolidating: 1 });
    expect(all.overall).toMatchObject({ total: 150, worked: 6, soloInReview: 2, consolidating: 1 });
    expect(blind.byCategory.map((c) => c.category)).toEqual([...CATEGORY_NAMES]);
    expect(blind.byCategory.reduce((n, c) => n + c.total, 0)).toBe(75);
    expect(blind.byCategory.reduce((n, c) => n + c.worked, 0)).toBe(blind.overall.worked);
    const { Easy, Medium, Hard } = blind.byDifficulty;
    expect(Easy.total + Medium.total + Hard.total).toBe(75);
    for (const category of blind.byCategory) {
      expect(category.total, category.category).toBeGreaterThan(0);
      expect(category.worked).toBeLessThanOrEqual(all.byCategory.find((c) => c.category === category.category)!.worked);
    }
  });

  it('counts the same slug state in both catalogs and gives tree nodes for every category', () => {
    const blind = problemStats(state, 'blind75');
    const arrays = blind.byCategory.find((c) => c.category === 'Arrays & Hashing')!;
    expect(arrays.worked).toBe(2); // two-sum (status) and contains-duplicate (checked)
    const tree = categoryDifficultyCounts(state, 'blind75');
    expect([...tree.keys()].sort()).toEqual([...CATEGORY_NAMES].sort());
    let total = 0;
    let worked = 0;
    for (const counts of tree.values()) {
      for (const level of Object.values(counts)) {
        total += level.total;
        worked += level.worked;
      }
    }
    expect(total).toBe(75);
    expect(worked).toBe(blind.overall.worked);
    expect(categoryDifficultyCounts(state)).toEqual(categoryDifficultyCounts(state, 'neetcode150'));
  });
});
