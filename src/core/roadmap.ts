import { CATEGORIES, type CategoryName } from '../data/neetcode150';

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
