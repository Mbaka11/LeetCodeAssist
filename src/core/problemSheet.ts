import { REVIEW_STRENGTH, isReviewType } from './activities';
import { compareDates } from './dates';
import type { Activity, AppState, ReviewType } from './types';

/** A planned review that is not stale optional practice (see `Activity.extra`). */
function isPendingReview(activity: Activity, today: string): boolean {
  return (
    isReviewType(activity.type) &&
    activity.status === 'planned' &&
    !(activity.extra && activity.dueDate < today)
  );
}

/**
 * Notes stay hidden while the user is being tested on the problem (SPEC §6): a review activity is
 * in progress, or one is due today (or overdue).
 */
export function isNotesLocked(state: AppState, slug: string, today: string): boolean {
  return state.activities.some(
    (a) =>
      a.slug === slug &&
      isReviewType(a.type) &&
      (a.status === 'in_progress' ||
        (isPendingReview(a, today) && compareDates(a.dueDate, today) <= 0)),
  );
}

/** The earliest planned review of `slug` (the stronger one on a tie), or undefined. */
export function nextReview(state: AppState, slug: string, today: string): Activity | undefined {
  return state.activities
    .filter((a) => a.slug === slug && isPendingReview(a, today))
    .sort(
      (a, b) =>
        compareDates(a.dueDate, b.dueDate) ||
        REVIEW_STRENGTH[b.type as ReviewType] - REVIEW_STRENGTH[a.type as ReviewType],
    )[0];
}

/** Completed attempts of `slug`, most recent first. */
export function attemptHistory(state: AppState, slug: string): Activity[] {
  return state.activities
    .filter((a) => a.slug === slug && a.status === 'done' && a.completedAt !== undefined)
    .sort(
      (a, b) =>
        compareDates(b.completedAt!, a.completedAt!) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
}
