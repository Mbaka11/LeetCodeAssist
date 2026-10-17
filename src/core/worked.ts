import { isBonusProblem } from '../data/bonus';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppState } from './types';

/**
 * Distinct problems worked, split into disjoint buckets. A problem is worked once it has at least one
 * completed (`done`) activity of any type: reviews, blind and resolve attempts or extra practice of a slug
 * never count it a second time, and planned, skipped, in-progress or manually ticked problems do not count.
 */
export interface WorkedTotals {
  /** Program-queue problems worked. */
  program: number;
  /** Size of the program queue (the "/50"). */
  programTotal: number;
  /** Benchmark problems worked. */
  benchmark: number;
  /** Number of benchmark problems (the "/6"). */
  benchmarkTotal: number;
  /** Bonus-pool problems worked. */
  bonus: number;
  /** Worked problems outside the program, the benchmarks and the bonus pool (extra practice on other problems). */
  other: number;
  /** `program + benchmark + bonus + other`: every distinct worked problem. */
  total: number;
}

const BENCHMARK_SLUGS: ReadonlySet<string> = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));
const PROGRAM_SLUGS: ReadonlySet<string> = new Set(PROGRAM_QUEUE);

/**
 * Counts each worked slug once, in the first bucket that claims it: program, then benchmark, then bonus,
 * then other. Derived from the activity history only, so it needs no stored counter and no migration.
 * Mastery and solo rates are separate (`problemStats`).
 */
export function workedTotals(state: AppState): WorkedTotals {
  const worked = new Set<string>();
  for (const activity of state.activities) {
    if (activity.status === 'done') worked.add(activity.slug);
  }
  let program = 0;
  let benchmark = 0;
  let bonus = 0;
  let other = 0;
  for (const slug of worked) {
    if (PROGRAM_SLUGS.has(slug)) program += 1;
    else if (BENCHMARK_SLUGS.has(slug)) benchmark += 1;
    else if (isBonusProblem(slug)) bonus += 1;
    else other += 1;
  }
  return {
    program,
    programTotal: PROGRAM_QUEUE.length,
    benchmark,
    benchmarkTotal: BENCHMARK_SLUGS.size,
    bonus,
    other,
    total: worked.size,
  };
}
