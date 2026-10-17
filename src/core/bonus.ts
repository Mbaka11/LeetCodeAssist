/**
 * Choosing the optional bonus problems (SPEC §2). Pure and deterministic: no randomness and no dependence on
 * the date, so the same state always suggests the same problems.
 *
 * Readiness rule. A pool problem is a candidate when its category is *ready*:
 *   - introduced: some completed activity (any type, so a finished bonus or benchmark counts) or a core item
 *     of today's plan (new problem, review or benchmark) belongs to that category; or
 *   - prerequisite-ready: every prerequisite of the category in the roadmap graph (`CATEGORIES`) is introduced.
 * So on day 2 of an Arrays & Hashing start only Arrays & Hashing, Two Pointers and Stack are ready; Graphs or
 * Dynamic Programming stay locked until Backtracking is worked. The rule is identical after day 30: the
 * remaining categories unlock one prerequisite step at a time.
 *
 * Order rule. Candidates keep the order of the pool (roadmap category order), except that a problem the user
 * skipped moves behind every candidate that was never skipped, so a skip postpones a suggestion without
 * deleting it. Problems with a completed activity are never suggested again.
 */
import { CATEGORIES, getProblem, type CategoryName } from '../data/neetcode150';
import type { Activity, AppState } from './types';

/** Number of optional bonus offers kept open at the same time. */
export const BONUS_SLOTS = 2;

export interface BonusHold {
  /** `locked`: problems remain but their category is not ready; `exhausted`: every pool problem is worked. */
  reason: 'locked' | 'exhausted';
  /** `locked`: the category of the first waiting problem. */
  category?: CategoryName;
  /** `locked`: the category to start next so that `category` becomes ready. */
  nextPrerequisite?: CategoryName;
  /** Plain-language explanation for the UI. */
  message: string;
}

export interface BonusSelection {
  /** Suggested slugs in offer order (at most the requested count). */
  slugs: string[];
  /** Why fewer than the requested number of problems could be suggested; null when enough were found. */
  hold: BonusHold | null;
}

export interface BonusSelectionInput {
  /** Bonus pool in order (normally `BONUS_POOL`). */
  pool: readonly string[];
  /** How many problems to suggest. */
  count: number;
  /** Slugs of today's core activities (reviews, benchmarks, new problems): their categories count as introduced. */
  coreSlugs: readonly string[];
  /** Slugs that must not be suggested, such as the offers that are already open. */
  exclude: ReadonlySet<string>;
}

const PREREQUISITES: ReadonlyMap<CategoryName, readonly CategoryName[]> = new Map(
  CATEGORIES.map((category) => [category.name, category.prerequisites]),
);

/** Categories with a completed activity or a core problem planned today. */
export function introducedCategories(state: AppState, coreSlugs: readonly string[]): Set<CategoryName> {
  const introduced = new Set<CategoryName>();
  const add = (slug: string): void => {
    const problem = getProblem(slug);
    if (problem) introduced.add(problem.category as CategoryName);
  };
  for (const activity of state.activities) {
    if (activity.status === 'done') add(activity.slug);
  }
  for (const slug of coreSlugs) add(slug);
  return introduced;
}

/** Introduced categories plus those whose prerequisites are all introduced. */
export function isCategoryReady(category: CategoryName, introduced: ReadonlySet<CategoryName>): boolean {
  if (introduced.has(category)) return true;
  return (PREREQUISITES.get(category) ?? []).every((prerequisite) => introduced.has(prerequisite));
}

/**
 * The first category to start so that `category` becomes ready: the earliest missing prerequisite whose own
 * prerequisites are introduced. Null when `category` is already ready.
 */
export function nextPrerequisite(
  category: CategoryName,
  introduced: ReadonlySet<CategoryName>,
): CategoryName | null {
  if (isCategoryReady(category, introduced)) return null;
  for (const prerequisite of PREREQUISITES.get(category) ?? []) {
    if (introduced.has(prerequisite)) continue;
    return nextPrerequisite(prerequisite, introduced) ?? prerequisite;
  }
  return null;
}

/**
 * The open offers already stored in the state: `new` activities of pool problems that are planned or started.
 * Every started one is kept (a running or paused timer is never abandoned); a planned one is kept once per
 * problem and only while it has no completed activity or started twin, up to `slots` offers in total. This also
 * reads 0.5 data, where one planned pool activity could be stored per date: the duplicates stay in the history
 * but only one offer per problem is shown. Returned in stored order, so the offers do not reshuffle.
 */
export function openBonusOffers(
  state: AppState,
  poolSlugs: ReadonlySet<string>,
  slots: number,
): Activity[] {
  const worked = new Set<string>();
  const started = new Set<string>();
  for (const activity of state.activities) {
    if (activity.status === 'done') worked.add(activity.slug);
    if (activity.status === 'in_progress' && activity.type === 'new') started.add(activity.slug);
  }
  const candidates = state.activities.filter(
    (a) => a.type === 'new' && poolSlugs.has(a.slug) && !a.postponed,
  );
  const kept = new Set<Activity>(candidates.filter((a) => a.status === 'in_progress'));
  const planned = new Set<string>();
  for (const activity of candidates) {
    if (kept.size >= Math.max(slots, 0) && activity.status === 'planned') continue;
    if (activity.status !== 'planned' || worked.has(activity.slug) || started.has(activity.slug)) continue;
    if (planned.has(activity.slug)) continue;
    planned.add(activity.slug);
    kept.add(activity);
  }
  return candidates.filter((a) => kept.has(a));
}

/** Slugs the user skipped as new problems (not queue postponements): they wait behind never-skipped ones. */
function skippedSlugs(state: AppState): Set<string> {
  const skipped = new Set<string>();
  for (const activity of state.activities) {
    if (activity.type === 'new' && activity.status === 'skipped' && !activity.postponed) {
      skipped.add(activity.slug);
    }
  }
  return skipped;
}

/** Picks up to `count` bonus problems (see the rules at the top of this file) and explains any shortfall. */
export function selectBonusSlugs(state: AppState, input: BonusSelectionInput): BonusSelection {
  const { pool, count, coreSlugs, exclude } = input;
  if (count <= 0) return { slugs: [], hold: null };

  const worked = new Set<string>();
  for (const activity of state.activities) {
    if (activity.status === 'done') worked.add(activity.slug);
  }
  const introduced = introducedCategories(state, coreSlugs);
  const skipped = skippedSlugs(state);

  const open = pool.filter((slug) => !worked.has(slug) && !exclude.has(slug));
  const ready: string[] = [];
  const waiting: string[] = [];
  for (const slug of open) {
    // A slug outside the NeetCode 150 has no category to gate on.
    const category = getProblem(slug)?.category as CategoryName | undefined;
    (category === undefined || isCategoryReady(category, introduced) ? ready : waiting).push(slug);
  }
  const ordered = [...ready.filter((s) => !skipped.has(s)), ...ready.filter((s) => skipped.has(s))];
  const slugs = ordered.slice(0, count);
  if (slugs.length >= count) return { slugs, hold: null };

  const firstWaiting = waiting[0];
  if (firstWaiting === undefined) {
    return {
      slugs,
      hold: {
        reason: 'exhausted',
        message:
          slugs.length === 0
            ? 'You have worked every problem in the bonus pool.'
            : 'This is the last bonus problem left in the pool.',
      },
    };
  }
  const category = getProblem(firstWaiting)!.category as CategoryName;
  const prerequisite = nextPrerequisite(category, introduced);
  return {
    slugs,
    hold: {
      reason: 'locked',
      category,
      ...(prerequisite ? { nextPrerequisite: prerequisite } : {}),
      message: prerequisite
        ? `More bonus problems unlock after you work a ${prerequisite} problem (a prerequisite of ${category}).`
        : `More bonus problems in ${category} are waiting.`,
    },
  };
}
