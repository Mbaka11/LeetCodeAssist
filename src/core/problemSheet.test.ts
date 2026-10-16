import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { planDay } from './planner';
import { attemptHistory, isNotesLocked, nextReview, openActivityToday } from './problemSheet';
import { START, complete, day, newState, planAndComplete } from './testing';
import type { ActivityType, AppState } from './types';

const SLUG = 'two-sum';

function withActivity(
  state: AppState,
  type: ActivityType,
  dueDate: string,
  patch: Partial<AppState['activities'][number]> = {},
): AppState {
  const activity = { ...createActivity(state.activities, { type, slug: SLUG, dueDate, createdAt: START }), ...patch };
  return { ...state, activities: [...state.activities, activity] };
}

describe('isNotesLocked', () => {
  it('is unlocked with no review activities', () => {
    expect(isNotesLocked(newState(), SLUG, day(3))).toBe(false);
  });

  it('is unlocked while the new activity is in progress', () => {
    const state = withActivity(newState(), 'new', day(1), { status: 'in_progress' });
    expect(isNotesLocked(state, SLUG, day(1))).toBe(false);
  });

  it('locks when a review is due today or overdue, not when it is in the future', () => {
    const state = withActivity(newState(), 'recall', day(3));
    expect(isNotesLocked(state, SLUG, day(2))).toBe(false);
    expect(isNotesLocked(state, SLUG, day(3))).toBe(true);
    expect(isNotesLocked(state, SLUG, day(5))).toBe(true);
  });

  it('locks while a review is in progress, even a future-dated one', () => {
    const state = withActivity(newState(), 'resolve', day(8), { status: 'in_progress' });
    expect(isNotesLocked(state, SLUG, day(2))).toBe(true);
  });

  it('unlocks once the review is done or skipped', () => {
    expect(isNotesLocked(withActivity(newState(), 'recall', day(3), { status: 'skipped' }), SLUG, day(3))).toBe(false);
    const done = withActivity(newState(), 'recall', day(3), { status: 'done', completedAt: day(3) });
    expect(isNotesLocked(done, SLUG, day(3))).toBe(false);
  });

  it('ignores stale optional practice from an earlier day', () => {
    const state = withActivity(newState(), 'blind', day(7), { extra: true });
    expect(isNotesLocked(state, SLUG, day(7))).toBe(true);
    expect(isNotesLocked(state, SLUG, day(8))).toBe(false);
  });
});

describe('nextReview and attemptHistory', () => {
  it('finds the earliest planned review after completing a new problem', () => {
    let state = newState();
    state = planAndComplete(state, day(1), 'valid-anagram', 'new', 'solo');
    const next = nextReview(state, 'valid-anagram', day(1));
    expect(next).toMatchObject({ type: 'recall', dueDate: day(2) });
    expect(nextReview(state, 'unknown-slug', day(1))).toBeUndefined();
  });

  it('lists completed attempts, most recent first', () => {
    let state = newState();
    state = planAndComplete(state, day(1), 'valid-anagram', 'new', 'hint', 35);
    const recall = state.activities.find((a) => a.type === 'recall' && a.slug === 'valid-anagram')!;
    state = complete(state, recall.id, 'solo', day(2), 4);
    const history = attemptHistory(state, 'valid-anagram');
    expect(history.map((a) => [a.type, a.outcome, a.totalMs])).toEqual([
      ['recall', 'solo', 4 * 60_000],
      ['new', 'hint', 35 * 60_000],
    ]);
  });
});

describe('openActivityToday', () => {
  it("finds the problem's planned activity in today's plan, persisted or not", () => {
    const state = newState();
    const planned = planDay(state, day(1)).items.find((i) => i.activity.type === 'new')!;
    expect(openActivityToday(state, planned.activity.slug, day(1))?.id).toBe(planned.activity.id);
    expect(openActivityToday(state, 'median-of-two-sorted-arrays', day(1))).toBeUndefined();
  });

  it('prefers a started activity and ignores finished ones', () => {
    const state = newState();
    const [first, second] = planDay(state, day(1)).items.filter((i) => i.activity.type === 'new');
    const started = {
      ...state,
      activities: [
        { ...first!.activity, status: 'done' as const, completedAt: day(1) },
        { ...second!.activity, status: 'in_progress' as const },
      ],
    };
    expect(openActivityToday(started, first!.activity.slug, day(1))).toBeUndefined();
    expect(openActivityToday(started, second!.activity.slug, day(1))?.status).toBe('in_progress');
  });
});
