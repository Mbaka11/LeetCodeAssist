import { describe, expect, it } from 'vitest';
import { findActivity } from '../core/activities';
import { planDay } from '../core/planner';
import { POSTPONE_BEHIND, programQueue } from '../core/queue';
import { StateValidationError } from '../core/state';
import { START, day, newState } from '../core/testing';
import { PROGRAM_QUEUE } from '../data/program';
import type { AppState } from '../core/types';
import * as commands from './commands';

function at(date: string, hour = 10): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, 0, 0).getTime();
}

/** Day 1 state with today's plan persisted; returns the ids of the new problems. */
function dayOne(): { state: AppState; newIds: string[]; now: number } {
  const now = at(START);
  const state = commands.materializeToday(newState(), now);
  const newIds = state.activities.filter((a) => a.type === 'new').map((a) => a.id);
  return { state, newIds, now };
}

describe('materializeToday', () => {
  it('persists the benchmark pair and the new problems, and is idempotent', () => {
    const { state, now } = dayOne();
    const types = state.activities.map((a) => a.type);
    expect(types.filter((t) => t === 'benchmark')).toHaveLength(2);
    expect(types.filter((t) => t === 'new').length).toBeGreaterThanOrEqual(2);
    expect(planDay(state, START).items.every((i) => i.persisted)).toBe(true);
    expect(commands.materializeToday(state, now)).toBe(state);
  });

  it('does nothing before the start date', () => {
    const state = newState();
    expect(commands.materializeToday(state, at(day(0)))).toBe(state);
  });
});

describe('timer commands', () => {
  it('starts an activity and pauses any other running one', () => {
    const { state, newIds, now } = dayOne();
    const [first, second] = newIds as [string, string];
    let next = commands.startActivity(state, first, now);
    expect(findActivity(next, first)).toMatchObject({ status: 'in_progress', timer: { running: true } });

    next = commands.startActivity(next, second, now + 60_000);
    expect(findActivity(next, first)).toMatchObject({
      status: 'in_progress',
      timer: { running: false, accumulatedMs: 60_000 },
    });
    expect(findActivity(next, second)?.timer.running).toBe(true);
  });

  it('pauses and resumes using timestamps', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(state, id, now);
    next = commands.pauseActivity(next, id, now + 120_000);
    next = commands.resumeActivity(next, id, now + 500_000);
    next = commands.pauseActivity(next, id, now + 560_000);
    expect(findActivity(next, id)?.timer).toEqual({
      startedAt: null,
      accumulatedMs: 180_000,
      running: false,
    });
  });

  it('cannot resume or mark an approach before starting', () => {
    const { state, newIds, now } = dayOne();
    expect(() => commands.resumeActivity(state, newIds[0]!, now)).toThrow(/not started/);
    expect(() => commands.recordApproachFound(state, newIds[0]!, now)).toThrow(/not started/);
  });

  it('records the approach time once', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(state, id, now);
    next = commands.recordApproachFound(next, id, now + 600_000);
    next = commands.recordApproachFound(next, id, now + 900_000);
    expect(findActivity(next, id)?.approachMs).toBe(600_000);
  });
});

describe('completeActivity', () => {
  it('completes with the timer total and schedules the review cycle from today', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const slug = findActivity(state, id)!.slug;
    let next = commands.startActivity(state, id, now);
    next = commands.completeActivity(next, id, { outcome: 'solo' }, now + 25 * 60_000);
    expect(findActivity(next, id)).toMatchObject({
      status: 'done',
      outcome: 'solo',
      completedAt: START,
      totalMs: 25 * 60_000,
    });
    const reviews = next.activities.filter((a) => a.slug === slug && a.type !== 'new');
    expect(reviews.map((a) => [a.type, a.dueDate])).toEqual([
      ['recall', day(2)],
      ['rebuild', day(4)],
      ['resolve', day(8)],
      ['blind', day(22)],
    ]);
    expect(next.problemStatus[slug]).toBe('learning');
  });

  it('lets the user override the logged time', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(state, id, now);
    next = commands.completeActivity(
      next,
      id,
      { outcome: 'hint', totalMs: 30 * 60_000 },
      now + 9 * 3_600_000,
    );
    expect(findActivity(next, id)?.totalMs).toBe(30 * 60_000);
  });

  it('rejects completing an activity twice', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const done = commands.completeActivity(state, id, { outcome: 'solo', totalMs: 60_000 }, now);
    expect(() => commands.completeActivity(done, id, { outcome: 'solo' }, now)).toThrow(/already done/);
  });
});

describe('skipActivity', () => {
  it('skips a new problem without replacing it', () => {
    const { state, newIds, now } = dayOne();
    const next = commands.skipActivity(state, newIds[0]!, now);
    expect(findActivity(next, newIds[0]!)?.status).toBe('skipped');
    expect(next.activities).toHaveLength(state.activities.length);
  });

  it('postpones a review to tomorrow instead of dropping it', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const slug = findActivity(state, id)!.slug;
    const done = commands.completeActivity(state, id, { outcome: 'solo', totalMs: 60_000 }, now);
    const recall = done.activities.find((a) => a.slug === slug && a.type === 'recall')!;

    const tomorrow = at(day(2));
    const next = commands.skipActivity(done, recall.id, tomorrow);
    expect(findActivity(next, recall.id)?.status).toBe('skipped');
    const replacement = next.activities.find(
      (a) => a.slug === slug && a.type === 'recall' && a.status === 'planned',
    );
    expect(replacement?.dueDate).toBe(day(3));
  });

  it('keeps one review per problem per day when the retry lands on a day that already has one', () => {
    const { state, slug, recall, rebuild, resolve } = withReviews();
    const plannedReviewsOn = (s: AppState, date: string): string[] =>
      s.activities
        .filter((a) => a.slug === slug && a.dueDate === date && a.status === 'planned' && a.type !== 'new')
        .map((a) => a.type);

    // Skipping the recall on day 3: tomorrow (day 4) already holds the stronger rebuild, so no second review.
    const weaker = commands.skipActivity(state, recall, at(day(3)));
    expect(findActivity(weaker, recall)?.status).toBe('skipped');
    expect(plannedReviewsOn(weaker, day(4))).toEqual(['rebuild']);
    expect(weaker.activities).toHaveLength(state.activities.length);

    // Skipping the resolve on day 3 puts a stronger review on day 4: the rebuild is marked skipped.
    const stronger = commands.skipActivity(state, resolve, at(day(3)));
    expect(plannedReviewsOn(stronger, day(4))).toEqual(['resolve']);
    expect(findActivity(stronger, rebuild)?.status).toBe('skipped');
  });
});

describe('notes, checks and settings', () => {
  const fields = { trigger: 'Click', principle: 'p', pitfall: 'f', complexity: 'O(n)', code: '' };

  it('saves a note with the local date and omits an empty snippet', () => {
    const next = commands.saveNote(newState(), 'two-sum', fields, at(START));
    const note = next.notes['two-sum']!;
    expect(note).toMatchObject({ slug: 'two-sum', trigger: 'Click', updatedAt: START });
    expect('code' in note).toBe(false);
    const withCode = commands.saveNote(next, 'two-sum', { ...fields, code: 'def f(): pass' }, at(START));
    expect(withCode.notes['two-sum']?.code).toBe('def f(): pass');
  });

  it('toggles a checkbox on and off', () => {
    const on = commands.toggleChecked(newState(), 'two-sum');
    expect(on.checked).toEqual({ 'two-sum': true });
    expect(commands.toggleChecked(on, 'two-sum').checked).toEqual({});
  });

  it('validates settings changes', () => {
    const state = newState();
    expect(commands.updateSettings(state, { dailyTargetMin: 120 }).settings.dailyTargetMin).toBe(120);
    expect(() => commands.updateSettings(state, { dailyCapMin: 100 })).toThrow(StateValidationError);
    expect(() => commands.updateSettings(state, { startDate: '2025-13-40' })).toThrow(/startDate/);
    expect(() => commands.updateSettings(state, { morningNotify: '8:30' })).toThrow(/morningNotify/);
  });
});

describe('startExtraPractice', () => {
  it('starts an extra `new` for a problem that was never completed', () => {
    const now = at(START);
    const { state, activityId } = commands.startExtraPractice(newState(), 'median-of-two-sorted-arrays', now);
    const activity = findActivity(state, activityId)!;
    expect(activity).toMatchObject({
      slug: 'median-of-two-sorted-arrays',
      type: 'new',
      extra: true,
      status: 'in_progress',
      dueDate: START,
    });
    expect(activity.timer.running).toBe(true);
    // Skipping extra practice never plans a follow-up.
    const skipped = commands.skipActivity(state, activityId, now);
    expect(skipped.activities.filter((a) => a.slug === 'median-of-two-sorted-arrays')).toHaveLength(1);
  });

  it('starts an extra re-solve for a learned problem', () => {
    const { state, newIds, now } = dayOne();
    const slug = findActivity(state, newIds[0]!)!.slug;
    let next = commands.startActivity(state, newIds[0]!, now);
    next = commands.completeActivity(next, newIds[0]!, { outcome: 'solo' }, now + 25 * 60_000);
    const started = commands.startExtraPractice(next, slug, now + 30 * 60_000);
    expect(findActivity(started.state, started.activityId)).toMatchObject({
      type: 'resolve',
      extra: true,
      status: 'in_progress',
    });
  });

  it('starts the plan\'s own activity when the problem is already planned today', () => {
    const { state, newIds, now } = dayOne();
    const planned = findActivity(state, newIds[0]!)!;
    const started = commands.startExtraPractice(state, planned.slug, now);
    expect(started.activityId).toBe(planned.id);
    expect(started.state.activities).toHaveLength(state.activities.length);
    expect(findActivity(started.state, planned.id)?.status).toBe('in_progress');
  });

  it('rejects problems outside the NeetCode 150 list', () => {
    expect(() => commands.startExtraPractice(newState(), 'not-a-problem', at(START))).toThrow(/NeetCode 150/);
  });
});

describe('revealHint', () => {
  it('records the highest revealed hint on an open activity and never lowers it', () => {
    const { state, newIds } = dayOne();
    const id = newIds[0]!;
    expect(findActivity(state, id)?.hintsUsed).toBeUndefined();
    let next = commands.revealHint(state, id, 1);
    expect(findActivity(next, id)?.hintsUsed).toBe(1);
    next = commands.revealHint(next, id, 3);
    expect(findActivity(next, id)?.hintsUsed).toBe(3);
    expect(commands.revealHint(next, id, 2)).toBe(next);
    expect(findActivity(next, id)?.hintsUsed).toBe(3);
  });

  it('keeps hintsUsed when the activity is completed', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    let next = commands.startActivity(commands.revealHint(state, id, 2), id, now);
    next = commands.completeActivity(next, id, { outcome: 'hint' }, now + 60_000);
    expect(findActivity(next, id)).toMatchObject({ status: 'done', hintsUsed: 2, outcome: 'hint' });
  });

  it('rejects invalid levels and finished or unknown activities', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    expect(() => commands.revealHint(state, id, 0)).toThrow(/Hint level/);
    expect(() => commands.revealHint(state, id, 4)).toThrow(/Hint level/);
    expect(() => commands.revealHint(state, id, 1.5)).toThrow(/Hint level/);
    expect(() => commands.revealHint(state, 'nope', 1)).toThrow(/Unknown activity/);
    const done = commands.completeActivity(state, id, { outcome: 'solo', totalMs: 60_000 }, now);
    expect(() => commands.revealHint(done, id, 1)).toThrow(/already done/);
  });
});

/** Day 1 with the first new problem done, so its recall (day 2), rebuild (day 4) and resolve (day 8) exist. */
function withReviews(): { state: AppState; slug: string; recall: string; rebuild: string; resolve: string } {
  const { state, newIds, now } = dayOne();
  const id = newIds[0]!;
  const slug = findActivity(state, id)!.slug;
  const done = commands.completeActivity(state, id, { outcome: 'solo', totalMs: 60_000 }, now);
  const idOf = (type: string): string => done.activities.find((a) => a.slug === slug && a.type === type)!.id;
  return { state: done, slug, recall: idOf('recall'), rebuild: idOf('rebuild'), resolve: idOf('resolve') };
}

describe('rescheduleReview', () => {
  it('moves the due date of a planned review and keeps everything else', () => {
    const { state, recall } = withReviews();
    const before = findActivity(state, recall)!;
    const next = commands.rescheduleReview(state, recall, day(3), at(day(2)));
    expect(findActivity(next, recall)).toEqual({ ...before, dueDate: day(3) });
    expect(next.activities).toHaveLength(state.activities.length);
    expect(planDay(next, day(2)).items.some((i) => i.activity.id === recall)).toBe(false);
    expect(planDay(next, day(3)).items.some((i) => i.activity.id === recall)).toBe(true);
  });

  it('allows today and moving an overdue review to today', () => {
    const { state, recall } = withReviews();
    expect(planDay(state, day(3)).items.find((i) => i.activity.id === recall)?.overdue).toBe(true);
    const next = commands.rescheduleReview(state, recall, day(3), at(day(3)));
    expect(findActivity(next, recall)?.dueDate).toBe(day(3));
    expect(planDay(next, day(3)).items.find((i) => i.activity.id === recall)?.overdue).toBe(false);
  });

  it('does nothing when the date is unchanged', () => {
    const { state, recall } = withReviews();
    expect(commands.rescheduleReview(state, recall, day(2), at(day(2)))).toBe(state);
  });

  it('rejects past dates, bad dates, new problems, started and finished activities', () => {
    const { state, recall } = withReviews();
    const now = at(day(3));
    expect(() => commands.rescheduleReview(state, recall, day(2), now)).toThrow(/past/);
    expect(() => commands.rescheduleReview(state, recall, '2025-02-30', now)).toThrow(/Invalid date/);
    expect(() => commands.rescheduleReview(state, 'nope', day(5), now)).toThrow(/Unknown activity/);
    const newId = state.activities.find((a) => a.type === 'new')!.id;
    expect(() => commands.rescheduleReview(state, newId, day(5), now)).toThrow(/Only scheduled reviews/);
    const started = commands.startActivity(state, recall, now);
    expect(() => commands.rescheduleReview(started, recall, day(5), now)).toThrow(/in_progress/);
    const done = commands.completeActivity(started, recall, { outcome: 'solo', totalMs: 1 }, now);
    expect(() => commands.rescheduleReview(done, recall, day(5), now)).toThrow(/done/);
    const extra = commands.startExtraPractice(state, 'median-of-two-sorted-arrays', now);
    expect(() => commands.rescheduleReview(extra.state, extra.activityId, day(5), now)).toThrow(/Only scheduled reviews/);
  });

  it('keeps the stronger review when the move lands on a day that already has one for the problem', () => {
    const { state, recall, rebuild } = withReviews();
    // Moving the recall onto the rebuild's day: the weaker recall is skipped (kept in history).
    const weaker = commands.rescheduleReview(state, recall, day(4), at(day(2)));
    expect(findActivity(weaker, recall)?.status).toBe('skipped');
    expect(findActivity(weaker, rebuild)?.status).toBe('planned');
    // Moving the rebuild onto the recall's day: the recall is the weaker one and is skipped.
    const stronger = commands.rescheduleReview(state, rebuild, day(2), at(day(2)));
    expect(findActivity(stronger, rebuild)).toMatchObject({ status: 'planned', dueDate: day(2) });
    expect(findActivity(stronger, recall)?.status).toBe('skipped');
    expect(stronger.activities).toHaveLength(state.activities.length);
  });
});

describe('rescheduleReview limits', () => {
  it('rejects moving a review more than MAX_MOVE_DAYS ahead and allows exactly that far', () => {
    const { state, recall } = withReviews();
    const now = at(day(2));
    const limit = day(2 + commands.MAX_MOVE_DAYS);
    expect(commands.rescheduleReview(state, recall, limit, now)).toBeDefined();
    expect(() => commands.rescheduleReview(state, recall, day(3 + commands.MAX_MOVE_DAYS), now)).toThrow(/at most/);
  });

  it('rejects a day on which the problem already has a review in progress', () => {
    const { state, recall, rebuild } = withReviews();
    const started = commands.startActivity(state, rebuild, at(day(4)));
    expect(() => commands.rescheduleReview(started, recall, day(4), at(day(2)))).toThrow(/in progress/);
    // No second review was created or moved.
    expect(findActivity(started, recall)?.dueDate).toBe(day(2));
  });
});

describe('postponeNew', () => {
  it('skips the activity as postponed, moves the problem back and never drops it', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const slug = findActivity(state, id)!.slug;
    const next = commands.postponeNew(state, id, now);
    expect(findActivity(next, id)).toMatchObject({ status: 'skipped', postponed: true });
    expect(next.activities).toHaveLength(state.activities.length);
    // Still in the queue, now behind the next two problems.
    const queue = programQueue(next);
    expect(queue).toContain(slug);
    expect(queue.indexOf(slug)).toBe(PROGRAM_QUEUE.indexOf(slug) + POSTPONE_BEHIND);
    expect([...queue].sort()).toEqual([...PROGRAM_QUEUE].sort());
  });

  it('offers the postponed problem again later, after the following two, and replaces it today', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const slug = findActivity(state, id)!.slug;
    const next = commands.postponeNew(state, id, now);
    const today = planDay(next, START).items.filter((i) => i.activity.type === 'new');
    expect(today.map((i) => i.activity.slug)).not.toContain(slug);
    expect(today).toHaveLength(2);

    // Do today's two, then the postponed one shows up on a later day instead of vanishing.
    let later = commands.materializeToday(next, now);
    for (const item of today) {
      later = commands.completeActivity(later, item.activity.id, { outcome: 'solo', totalMs: 60_000 }, now);
    }
    const seen = new Set<string>();
    for (let d = 2; d <= 4; d += 1) {
      for (const item of planDay(later, day(d)).items) if (item.activity.type === 'new') seen.add(item.activity.slug);
    }
    expect(seen.has(slug)).toBe(true);
  });

  it('can be repeated: the problem keeps moving back and every problem stays in the queue', () => {
    const { state, newIds, now } = dayOne();
    const slug = findActivity(state, newIds[0]!)!.slug;
    const once = commands.postponeNew(state, newIds[0]!, now);
    const again = planDay(once, START).items.find((i) => i.activity.type === 'new')!;
    const twice = commands.postponeNew(commands.materializeToday(once, now), again.activity.id, now);
    expect(twice.activities.filter((a) => a.postponed)).toHaveLength(2);
    expect(programQueue(twice)).toHaveLength(PROGRAM_QUEUE.length);
    expect(programQueue(twice)).toContain(slug);
    expect(programQueue(twice)).toContain(again.activity.slug);
  });

  it('pauses a running timer and rejects reviews, extra practice and finished activities', () => {
    const { state, newIds, now } = dayOne();
    const id = newIds[0]!;
    const started = commands.startActivity(state, id, now);
    const postponed = commands.postponeNew(started, id, now + 60_000);
    expect(findActivity(postponed, id)?.timer).toMatchObject({ running: false, accumulatedMs: 60_000 });

    const { state: reviewState, recall } = withReviews();
    expect(() => commands.postponeNew(reviewState, recall, now)).toThrow(/Only new problems/);
    const extra = commands.startExtraPractice(state, 'median-of-two-sorted-arrays', now);
    expect(() => commands.postponeNew(extra.state, extra.activityId, now)).toThrow(/Only new problems/);
    expect(() => commands.postponeNew(postponed, id, now)).toThrow(/already skipped/);
  });

  it('a plain skip no longer drops the problem: it returns to the queue', () => {
    const { state, newIds, now } = dayOne();
    const slug = findActivity(state, newIds[0]!)!.slug;
    const skipped = commands.skipActivity(state, newIds[0]!, now);
    const later = new Set<string>();
    for (let d = 1; d <= 6; d += 1) {
      for (const item of planDay(skipped, day(d)).items) later.add(item.activity.slug);
    }
    expect(later.has(slug)).toBe(true);
  });
});
