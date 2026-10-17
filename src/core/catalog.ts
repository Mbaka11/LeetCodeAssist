import { isBlind75 } from '../data/blind75';
import { NEETCODE_150 } from '../data/neetcode150';
import type { Problem } from './types';

/**
 * Problem catalogs the roadmap statistics can be filtered by. Both read the same state (status, checks and
 * attempts of a slug), so switching catalogs never duplicates progress.
 */
export type CatalogId = 'neetcode150' | 'blind75';

export const CATALOG_IDS: readonly CatalogId[] = ['neetcode150', 'blind75'];

const BLIND_75_PROBLEMS: readonly Problem[] = NEETCODE_150.filter((problem) => isBlind75(problem.slug));

/** The problems of a catalog in NeetCode roadmap order. */
export function catalogProblems(catalog: CatalogId): readonly Problem[] {
  return catalog === 'blind75' ? BLIND_75_PROBLEMS : NEETCODE_150;
}
