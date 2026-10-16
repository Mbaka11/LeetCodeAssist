import { describe, expect, it } from 'vitest';
import { createActivity } from './activities';
import { addDays } from './dates';
import { applyOutcome } from './reviews';
import { deserializeState, serializeState } from './state';
import { startTimer } from './timer';
import {
  START,
  activitiesOf,
  complete,
  day,
  newState,
  plannedOf,
  planAndComplete,
} from './testing';
import type { AppState } from './types';

const SLUG = 'two-sum';

/** State with `two-sum` learned (new completed) on program day `completedDay`. */
function learnedOn(completedDay: number, outcome: 'solo' | 'hint' | 'solution' | 'stuck' = 'solo'): AppState {
  return planAndComplete(newState(), day(completedDay), SLUG, 'new', outcome, 25);
}

function dueDates(state: AppState, type: Parameters<typeof plannedOf>[2]): string[] {
  return plannedOf(state, SLUG, type).map((a) => a.dueDate);
}

describe('applyOutcome: new activities', () => {
  it('creates the review cycle from the completion date (decisive test)', () => {
    const state = learnedOn(1);
    expect(dueDates(state, 'recall')).toEqual([day(2)]);
    expect(dueDates(state, 'rebuild')).toEqual([day(4)]);
    expect(dueDates(state, 'resolve')).toEqual([day(8)]);
    expect(dueDates(state, 'blind')).toEqual([day(22)]);
    expect(state.problemStatus[SLUG]).toBe('learning');

    const done = activitiesOf(state, SLUG, 'new')[0]!;
    expect(done.status).toBe('done');
    expect(done.completedAt).toBe(day(1));
    expect(done.outcome).toBe('solo');
    expect(done.totalMs).toBe(25 * 60_000);

    const restored = deserializeState(serializeState(state));
    expect(restored).toEqual(state);
    expect(dueDates(restored, 'recall')).toEqual([day(2)]);
    expect(dueDates(restored, 'rebuild')).toEqual([day(4)]);
    expect(dueDates(restored, 'resolve')).toEqual([day(8)]);
    expect(dueDates(restored, 'blind')).toEqual([day(22)]);
  });

  it('shifts the whole cycle when the new problem is completed late', () => {
    // Planned on day 1, only finished on day 3.
    const state: AppState = {
      ...newState(),
      activities: [
        createActivity([], { type: 'new', slug: SLUG, dueDate: day(1), createdAt: day(1) }),
      ],
    };
    const late = complete(state, state.activities[0]!.id, 'hint', day(3));
    expect(dueDates(late, 'recall')).toEqual([day(4)]);
    expect(dueDates(late, 'rebuild')).toEqual([day(6)]);
    expect(dueDates(late, 'resolve')).toEqual([day(10)]);
    expect(dueDates(late, 'blind')).toEqual([day(24)]);
  });

  it('schedules reviews after day 30 (learned on day 29, resolve on day 36)', () => {
    const state = learnedOn(29);
    expect(dueDates(state, 'resolve')).toEqual([day(36)]);
    expect(dueDates(state, 'blind')).toEqual([day(50)]);
  });

  it('starts the cycle even when the first attempt needed the solution', () => {
    const state = learnedOn(1, 'solution');
    expect(dueDates(state, 'recall')).toEqual([day(2)]);
    expect(state.problemStatus[SLUG]).toBe('learning');
  });

  it('is a no-op when the activity is already done and throws for unknown ids', () => {
    const state = learnedOn(1);
    const doneId = activitiesOf(state, SLUG, 'new')[0]!.id;
    expect(complete(state, doneId, 'stuck', day(5))).toBe(state);
    expect(() => complete(state, 'missing', 'solo', day(1))).toThrow(/Unknown activity/);
  });

  it('does not mutate its input and keeps history append-only', () => {
    const before = learnedOn(1);
    const snapshot = JSON.stringify(before);
    const recall = plannedOf(before, SLUG, 'recall')[0]!;
    const after = complete(before, recall.id, 'solo', day(2));
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(after.activities.length).toBeGreaterThanOrEqual(before.activities.length);
    for (const old of before.activities) {
      const kept = after.activities.find((a) => a.id === old.id)!;
      expect(kept).toBeDefined();
      expect(kept.dueDate).toBe(old.dueDate);
      expect(kept.createdAt).toBe(old.createdAt);
    }
  });

  it('pauses a running timer and uses the elapsed time as total', () => {
    const base = newState();
    const activity = {
      ...createActivity([], { type: 'new', slug: SLUG, dueDate: day(1), createdAt: day(1) }),
      timer: startTimer({ startedAt: null, accumulatedMs: 60_000, running: false }, 1_000),
      approachMs: 120_000,
    };
    const state = { ...base, activities: [activity] };
    const next = applyOutcome(state, activity.id, { outcome: 'solo', completedDate: day(1), now: 31_000 });
    const done = next.activities[0]!;
    expect(done.totalMs).toBe(90_000);
    expect(done.approachMs).toBe(120_000);
    expect(done.timer.running).toBe(false);
    expect(done.timer.accumulatedMs).toBe(90_000);
  });
});

describe('applyOutcome: recall and rebuild failures', () => {
  it.each(['solution', 'stuck'] as const)('schedules a retry the next day after %s on recall', (outcome) => {
    const learned = learnedOn(1);
    const recall = plannedOf(learned, SLUG, 'recall')[0]!;
    const state = complete(learned, recall.id, outcome, day(2));
    expect(dueDates(state, 'retry')).toEqual([day(3)]);
    expect(state.problemStatus[SLUG]).toBe('consolidating');
    // The normal cycle continues.
    expect(dueDates(state, 'rebuild')).toEqual([day(4)]);
    expect(dueDates(state, 'resolve')).toEqual([day(8)]);
    expect(dueDates(state, 'blind')).toEqual([day(22)]);
  });

  it('schedules a retry the next day after a failed rebuild, relative to the actual date', () => {
    const learned = learnedOn(1);
    const rebuild = plannedOf(learned, SLUG, 'rebuild')[0]!;
    const state = complete(learned, rebuild.id, 'solution', day(5)); // done a day late
    expect(dueDates(state, 'retry')).toEqual([day(6)]);
    expect(dueDates(state, 'resolve')).toEqual([day(8)]);
  });

  it.each(['solo', 'hint'] as const)('does not schedule a retry after %s', (outcome) => {
    const learned = learnedOn(1);
    const recall = plannedOf(learned, SLUG, 'recall')[0]!;
    const state = complete(learned, recall.id, outcome, day(2));
    expect(plannedOf(state, SLUG, 'retry')).toHaveLength(0);
    expect(state.problemStatus[SLUG]).toBe('learning');
  });

  it('does not schedule more retries after a failed retry', () => {
    const learned = learnedOn(1);
    const recall = plannedOf(learned, SLUG, 'recall')[0]!;
    let state = complete(learned, recall.id, 'stuck', day(2));
    const retry = plannedOf(state, SLUG, 'retry')[0]!;
    state = complete(state, retry.id, 'solution', day(3));
    expect(plannedOf(state, SLUG, 'retry')).toHaveLength(0);
    expect(state.problemStatus[SLUG]).toBe('consolidating');
  });
});

describe('applyOutcome: resolve', () => {
  function atResolve(): AppState {
    return learnedOn(1);
  }

  it('keeps blind at +21 after a solo resolve and marks the problem reviewed', () => {
    const learned = atResolve();
    const resolve = plannedOf(learned, SLUG, 'resolve')[0]!;
    const state = complete(learned, resolve.id, 'solo', day(8));
    expect(state.problemStatus[SLUG]).toBe('reviewed');
    expect(dueDates(state, 'blind')).toEqual([day(22)]);
    expect(plannedOf(state, SLUG, 'rebuild')).toHaveLength(0);
  });

  it('does not schedule a new blind after a solo extra resolve on a mastered problem', () => {
    const learned = atResolve();
    const mastered = { ...learned, problemStatus: { ...learned.problemStatus, [SLUG]: 'mastered' as const } };
    const stripped = {
      ...mastered,
      activities: mastered.activities.filter((a) => !(a.slug === SLUG && a.type === 'blind')),
    };
    const resolve = plannedOf(stripped, SLUG, 'resolve')[0]!;
    const state = complete(stripped, resolve.id, 'solo', day(30));
    expect(state.problemStatus[SLUG]).toBe('mastered');
    expect(plannedOf(state, SLUG, 'blind')).toHaveLength(0);
  });

  it('keeps blind anchored to the new completion when resolve is done late', () => {
    const learned = atResolve();
    const resolve = plannedOf(learned, SLUG, 'resolve')[0]!;
    const state = complete(learned, resolve.id, 'solo', day(12));
    expect(dueDates(state, 'blind')).toEqual([day(22)]);
  });

  it.each(['hint', 'solution', 'stuck'] as const)(
    'reschedules rebuild +3, resolve +7 and blind +21 after %s',
    (outcome) => {
      const learned = atResolve();
      const resolve = plannedOf(learned, SLUG, 'resolve')[0]!;
      const state = complete(learned, resolve.id, outcome, day(8));
      expect(state.problemStatus[SLUG]).toBe('consolidating');
      expect(dueDates(state, 'rebuild')).toEqual([day(11)]);
      expect(dueDates(state, 'resolve')).toEqual([day(15)]);
      // blind is pushed to resolve-day + 14 = day 29 (completion + 21).
      expect(dueDates(state, 'blind')).toEqual([day(29)]);
      // The superseded blind is kept in history as skipped.
      const oldBlind = activitiesOf(state, SLUG, 'blind').find((a) => a.dueDate === day(22))!;
      expect(oldBlind.status).toBe('skipped');
    },
  );

  it('bases the consolidation on the actual (late) resolve date', () => {
    const learned = atResolve();
    const resolve = plannedOf(learned, SLUG, 'resolve')[0]!;
    const state = complete(learned, resolve.id, 'hint', day(10));
    expect(dueDates(state, 'rebuild')).toEqual([day(13)]);
    expect(dueDates(state, 'resolve')).toEqual([day(17)]);
    expect(dueDates(state, 'blind')).toEqual([day(31)]);
  });

  it('reaches reviewed and a blind at resolve-day + 14 after a consolidated resolve succeeds', () => {
    let state = atResolve();
    state = complete(state, plannedOf(state, SLUG, 'resolve')[0]!.id, 'hint', day(8));
    state = complete(state, plannedOf(state, SLUG, 'rebuild')[0]!.id, 'solo', day(11));
    state = complete(state, plannedOf(state, SLUG, 'resolve')[0]!.id, 'solo', day(15));
    expect(state.problemStatus[SLUG]).toBe('reviewed');
    expect(dueDates(state, 'blind')).toEqual([day(29)]);
  });

  it('adds a blind at resolve-day + 14 when none is pending', () => {
    let state = atResolve();
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.type === 'blind' ? { ...a, status: 'skipped' as const } : a,
      ),
    };
    state = complete(state, plannedOf(state, SLUG, 'resolve')[0]!.id, 'solo', day(8));
    expect(dueDates(state, 'blind')).toEqual([day(22)]);
  });

  it('a solo resolve covers an overdue rebuild and recall of the same problem', () => {
    const learned = atResolve();
    const resolve = plannedOf(learned, SLUG, 'resolve')[0]!;
    const state = complete(learned, resolve.id, 'solo', day(9));
    expect(plannedOf(state, SLUG, 'recall')).toHaveLength(0);
    expect(plannedOf(state, SLUG, 'rebuild')).toHaveLength(0);
    expect(activitiesOf(state, SLUG, 'recall')[0]!.status).toBe('skipped');
  });
});

describe('applyOutcome: blind', () => {
  function atBlind(): AppState {
    let state = learnedOn(1);
    state = complete(state, plannedOf(state, SLUG, 'resolve')[0]!.id, 'solo', day(8));
    return state;
  }

  it('masters the problem after a solo blind', () => {
    const state0 = atBlind();
    const state = complete(state0, plannedOf(state0, SLUG, 'blind')[0]!.id, 'solo', day(22));
    expect(state.problemStatus[SLUG]).toBe('mastered');
  });

  it.each(['hint', 'solution', 'stuck'] as const)(
    'consolidates and schedules a resolve +7 after %s',
    (outcome) => {
      const state0 = atBlind();
      const state = complete(state0, plannedOf(state0, SLUG, 'blind')[0]!.id, outcome, day(22));
      expect(state.problemStatus[SLUG]).toBe('consolidating');
      expect(dueDates(state, 'resolve')).toEqual([day(29)]);
    },
  );
});

describe('applyOutcome: merging overlapping reviews', () => {
  it('keeps only the stronger review (retry beats rebuild) on the same day', () => {
    const learned = learnedOn(1);
    const recall = plannedOf(learned, SLUG, 'recall')[0]!;
    // Recall is done 2 days late and fails: retry lands on day 4, the same day as rebuild.
    const state = complete(learned, recall.id, 'solution', day(3));
    const onDay4 = state.activities.filter(
      (a) => a.slug === SLUG && a.dueDate === day(4) && a.status === 'planned',
    );
    expect(onDay4.map((a) => a.type)).toEqual(['retry']);
    const rebuild = activitiesOf(state, SLUG, 'rebuild')[0]!;
    expect(rebuild.status).toBe('skipped');
  });

  it('never creates a weaker review on a day that already has a stronger one', () => {
    // Consolidation after a failed resolve puts a rebuild on day 11; a failing recall that
    // lands a retry there must win, and a later weaker one must not appear.
    let state = learnedOn(1);
    state = complete(state, plannedOf(state, SLUG, 'resolve')[0]!.id, 'hint', day(8));
    expect(dueDates(state, 'rebuild')).toEqual([day(11)]);
    const manualRecall = createActivity(state.activities, {
      type: 'recall',
      slug: SLUG,
      dueDate: day(10),
      createdAt: day(9),
    });
    state = { ...state, activities: [...state.activities, manualRecall] };
    state = complete(state, manualRecall.id, 'stuck', day(10));
    const onDay11 = state.activities.filter(
      (a) => a.slug === SLUG && a.dueDate === day(11) && a.status === 'planned',
    );
    expect(onDay11.map((a) => a.type)).toEqual(['retry']);
  });

  it('keeps the stronger resolve over a recall that lands on the same day', () => {
    let state = learnedOn(1);
    // A failed blind schedules resolve +7 (day 29), where a weaker recall is already planned.
    state = complete(state, plannedOf(state, SLUG, 'resolve')[0]!.id, 'solo', day(8));
    const extra = createActivity(state.activities, {
      type: 'recall',
      slug: SLUG,
      dueDate: day(29),
      createdAt: day(8),
    });
    state = { ...state, activities: [...state.activities, extra] };
    state = complete(state, plannedOf(state, SLUG, 'blind')[0]!.id, 'stuck', day(22));
    const onDay29 = state.activities.filter(
      (a) => a.slug === SLUG && a.dueDate === day(29) && a.status === 'planned',
    );
    expect(onDay29.map((a) => a.type)).toEqual(['resolve']);
  });
});

describe('applyOutcome: benchmarks', () => {
  it('completes without creating follow-ups or changing problem status', () => {
    const state = planAndComplete(newState(), day(1), 'contains-duplicate', 'benchmark', 'solo', 18);
    expect(state.problemStatus['contains-duplicate']).toBeUndefined();
    const types = state.activities.filter((a) => a.slug === 'contains-duplicate').map((a) => a.type);
    expect(types).toEqual(['benchmark']);
    expect(activitiesOf(state, 'contains-duplicate')[0]!.totalMs).toBe(18 * 60_000);
  });
});

describe('review generation helpers', () => {
  it('uses ids that stay unique when the same activity is re-created', () => {
    const state = learnedOn(1);
    const ids = state.activities.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(START).toBe(addDays(day(1), 0));
  });
});
