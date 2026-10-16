import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_NAMES } from '../data/neetcode150';
import { roadmapTiers } from './roadmap';

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
