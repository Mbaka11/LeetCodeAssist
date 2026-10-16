/** The ordered queue of new problems, including the user's postponements (SPEC §4). */
import { PROGRAM_QUEUE } from '../data/program';
import type { AppState } from './types';

/** How many upcoming problems a postponed one waits behind. */
export const POSTPONE_BEHIND = 2;

/**
 * The effective queue: the saved order (`state.queue`) restricted to known program problems, then any
 * program problem the saved order does not mention, so a later change to the program is still picked up.
 */
export function programQueue(state: Pick<AppState, 'queue'>): readonly string[] {
  if (!state.queue) return PROGRAM_QUEUE;
  const known = new Set(PROGRAM_QUEUE);
  const saved = state.queue.filter((slug) => known.has(slug));
  const listed = new Set(saved);
  return [...saved, ...PROGRAM_QUEUE.filter((slug) => !listed.has(slug))];
}

/** 1-based position of `slug` in the effective queue, or null when it is not a program problem. */
export function queuePosition(state: Pick<AppState, 'queue'>, slug: string): number | null {
  const index = programQueue(state).indexOf(slug);
  return index === -1 ? null : index + 1;
}

/**
 * Moves `slug` back in `queue` so that it comes after the next `POSTPONE_BEHIND` problems that are
 * not finished yet (`finished` holds the slugs that are done or already skipped for good). With fewer
 * problems left it goes to the end. Never removes anything.
 */
export function postponeInQueue(
  queue: readonly string[],
  slug: string,
  finished: ReadonlySet<string>,
): string[] {
  const from = queue.indexOf(slug);
  if (from === -1) return [...queue];
  const rest = queue.filter((s) => s !== slug);
  let insertAt = from;
  let skipped = 0;
  while (insertAt < rest.length && skipped < POSTPONE_BEHIND) {
    if (!finished.has(rest[insertAt]!)) skipped += 1;
    insertAt += 1;
  }
  return [...rest.slice(0, insertAt), slug, ...rest.slice(insertAt)];
}
