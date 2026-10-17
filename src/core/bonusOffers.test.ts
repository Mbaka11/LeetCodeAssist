import { describe, expect, it } from 'vitest';
import { BONUS_POOL } from '../data/bonus';
import { getProblem } from '../data/neetcode150';
import { PROGRAM_QUEUE } from '../data/program';
import { createActivity } from './activities';
import { programProgress } from './calendar';
import { materializePlan, planDay, type DayPlan } from './planner';
import { projectDay } from './projection';
import { applyOutcome } from './reviews';
import { deserializeState, problemStats, serializeState, validateState } from './state';
import { complete, day, newState, plannedOf, simulateDay } from './testing';
import type { Activity, AppState } from './types';

const slugsOf = (plan: DayPlan): string[] => plan.bonuses.map((b) => b.activity.slug);
const idsOf = (plan: DayPlan): string[] => plan.bonuses.map((b) => b.activity.id);

/** Plans and persists `date`, then completes every open offer (30 minutes each); returns the slugs done. */
function completeOffers(state: AppState, date: string): { state: AppState; slugs: string[] } {
  const plan = planDay(state, date);
  let next = materializePlan(state, plan);
  for (const offer of plan.bonuses) next = complete(next, offer.activity.id, 'solo', date, 30);
  return { state: next, slugs: slugsOf(plan) };
}

function withActivity(
  state: AppState,
  type: Activity['type'],
  slug: string,
  dueDate: string,
  patch: Partial<Activity> = {},
): AppState {
  const activity = { ...createActivity(state.activities, { type, slug, dueDate, createdAt: dueDate }), ...patch };
  return { ...state, activities: [...state.activities, activity] };
}

describe('bonus offers: two optional slots', () => {
  it('offers two uncompleted problems in pool order, outside every core total', () => {
    const state = newState();
    const plan = planDay(state, day(1));
    const core = planDay(state, day(1), undefined, { bonusPool: [] });
    expect(slugsOf(plan)).toEqual([BONUS_POOL[0], BONUS_POOL[1]]);
    expect(core.bonuses).toEqual([]);
    expect(plan.items.map((i) => i.activity.id)).toEqual(core.items.map((i) => i.activity.id));
    expect(plan.plannedMinutes).toBe(core.plannedMinutes);
    expect(plan.remainingMinutes).toBe(core.remainingMinutes);
    expect(plan.pace).toEqual(core.pace);
    expect(plan.carriedOver).toEqual(core.carriedOver);
    expect(plan.bonuses.some((b) => plan.items.includes(b))).toBe(false);
  });

  it('shows the offers (marked by bonusRoomMinutes) even when the core plan fills the cap', () => {
    const state = newState();
    const tight = { ...state.settings, dailyTargetMin: 5, dailyCapMin: 10 };
    const plan = planDay(state, day(1), tight);
    expect(plan.plannedMinutes).toBeGreaterThan(plan.capMinutes); // the benchmark pair alone exceeds it
    expect(plan.bonusRoomMinutes).toBe(0);
    expect(plan.bonuses).toHaveLength(2);
    const roomy = planDay(state, day(1), { ...state.settings, dailyCapMin: 180 });
    expect(roomy.bonusRoomMinutes).toBe(180 - roomy.plannedMinutes);
  });

  it('replenishes a completed slot at once and keeps the other offer', () => {
    let state = materializePlan(newState(), planDay(newState(), day(1)));
    const first = planDay(state, day(1));
    state = complete(state, first.bonuses[0]!.activity.id, 'solo', day(1), 30);
    const after = planDay(state, day(1));
    expect(after.bonuses).toHaveLength(2);
    expect(after.bonuses[0]!.activity.id).toBe(first.bonuses[1]!.activity.id);
    expect(slugsOf(after)).not.toContain(first.bonuses[0]!.activity.slug);
    expect(after.completedBonuses.map((b) => b.activity.slug)).toEqual([first.bonuses[0]!.activity.slug]);
    expect(after.plannedMinutes).toBe(first.plannedMinutes);
  });

  it('can complete both offers again and again on the same day without a duplicate slug', () => {
    let state = newState();
    const seen: string[] = [];
    for (let round = 0; round < 5; round += 1) {
      const result = completeOffers(state, day(1));
      expect(result.slugs, `round ${round}`).toHaveLength(2);
      seen.push(...result.slugs);
      state = result.state;
    }
    expect(new Set(seen).size).toBe(10);
    expect(seen).toEqual(BONUS_POOL.slice(0, 10));
    expect(planDay(state, day(1)).completedBonuses).toHaveLength(10);
    // Their time is logged on that day, but the core plan did not change.
    expect(planDay(state, day(1)).plannedMinutes).toBe(planDay(newState(), day(1)).plannedMinutes);
  });

  it('keeps the same pending offers across a reload, midnight and later days', () => {
    const state = materializePlan(newState(), planDay(newState(), day(1)));
    const ids = idsOf(planDay(state, day(1)));
    expect(ids).toHaveLength(2);
    const reloaded = deserializeState(serializeState(state));
    for (const date of [day(1), day(2), day(9), day(40)]) {
      const plan = planDay(reloaded, date);
      expect(idsOf(plan), date).toEqual(ids);
      expect(plan.bonuses.every((b) => b.persisted && !b.overdue), date).toBe(true);
      expect(plan.carriedOver.some((c) => ids.includes(c.activity.id))).toBe(false);
      expect(materializePlan(reloaded, plan).activities.filter((a) => ids.includes(a.id))).toHaveLength(2);
    }
    // An offer that was never persisted is still the same suggestion when it is planned again.
    expect(slugsOf(planDay(newState(), day(1)))).toEqual(slugsOf(planDay(newState(), day(1))));
  });

  it('keeps stored offers even when the selection would now be different', () => {
    const state = materializePlan(newState(), planDay(newState(), day(1)));
    const reordered = planDay(state, day(2), undefined, { bonusPool: [...BONUS_POOL].reverse() });
    expect(idsOf(reordered)).toEqual(idsOf(planDay(state, day(1))));
  });

  it('does not displace core work when an offer is started', () => {
    const base = materializePlan(newState(), planDay(newState(), day(1)));
    const before = planDay(base, day(1));
    const offer = before.bonuses[0]!.activity;
    const started = {
      ...base,
      activities: base.activities.map((a) =>
        a.id === offer.id
          ? { ...a, status: 'in_progress' as const, timer: { startedAt: 1000, accumulatedMs: 0, running: true } }
          : a,
      ),
    };
    const after = planDay(started, day(1));
    expect(after.items.map((i) => i.activity.id)).toEqual(before.items.map((i) => i.activity.id));
    expect(after.plannedMinutes).toBe(before.plannedMinutes);
    expect(after.remainingMinutes).toBe(before.remainingMinutes);
    expect(idsOf(after)).toEqual(idsOf(before));
  });
});

describe('bonus offers: running, paused and legacy activities', () => {
  it('retains a running or paused bonus with its id, timer and hint usage on a later day', () => {
    const base = materializePlan(newState(), planDay(newState(), day(1)));
    const [first, second] = planDay(base, day(1)).bonuses.map((b) => b.activity);
    const patched = (a: Activity): Activity =>
      a.id === first!.id
        ? { ...a, status: 'in_progress', timer: { startedAt: 5000, accumulatedMs: 7000, running: true }, hintsUsed: 2 }
        : a.id === second!.id
          ? { ...a, status: 'in_progress', timer: { startedAt: null, accumulatedMs: 3000, running: false }, hintsUsed: 1 }
          : a;
    const state = { ...base, activities: base.activities.map(patched) };
    const later = planDay(state, day(5));
    expect(later.bonuses.map((b) => b.activity)).toEqual([patched(first!), patched(second!)]);
    expect(later.bonuses.map((b) => b.activity.id)).toEqual([first!.id, second!.id]);
    // Two started offers fill the slots: nothing new is suggested next to them.
    expect(later.bonuses).toHaveLength(2);
    // Completing a retained one keeps its timer-derived data and starts reviews.
    const done = complete(state, first!.id, 'hint', day(5), 25);
    expect(done.activities.find((a) => a.id === first!.id)).toMatchObject({ status: 'done', hintsUsed: 2, totalMs: 25 * 60_000 });
  });

  it('migrates one planned bonus stored by 0.5 and fills the second slot', () => {
    const legacy = validateState(
      JSON.parse(serializeState(withActivity(newState(), 'new', 'generate-parentheses', day(1)))),
    );
    const plan = planDay(legacy, day(1));
    expect(plan.bonuses).toHaveLength(2);
    expect(plan.bonuses[0]).toMatchObject({ persisted: true });
    expect(plan.bonuses[0]!.activity.id).toBe('new:generate-parentheses:' + day(1));
    expect(plan.bonuses[1]!.persisted).toBe(false);
    expect(slugsOf(plan)).not.toContain(plan.items.map((i) => i.activity.slug)[0]);
    expect(new Set(slugsOf(plan)).size).toBe(2);
  });

  it('upgrades several planned pool activities on different dates without duplicates or lost timers', () => {
    let state = newState();
    state = withActivity(state, 'new', 'generate-parentheses', day(1));
    state = withActivity(state, 'new', 'generate-parentheses', day(2)); // 0.5 stored one per materialized day
    state = withActivity(state, 'new', 'evaluate-reverse-polish-notation', day(3), {
      status: 'in_progress',
      timer: { startedAt: 9000, accumulatedMs: 4000, running: true },
      hintsUsed: 1,
    });
    state = withActivity(state, 'new', 'car-fleet', day(3));
    const running = state.activities.find((a) => a.slug === 'evaluate-reverse-polish-notation')!;

    const plan = planDay(state, day(4));
    const withoutPool: AppState = {
      ...state,
      activities: state.activities.filter((a) => !BONUS_POOL.includes(a.slug)),
    };
    const core = planDay(withoutPool, day(4));
    expect(slugsOf(plan)).toEqual(['generate-parentheses', 'evaluate-reverse-polish-notation']);
    expect(plan.bonuses.map((b) => b.activity.id).sort()).toEqual(
      ['new:evaluate-reverse-polish-notation:' + day(3), 'new:generate-parentheses:' + day(1)].sort(),
    );
    expect(plan.bonuses.find((b) => b.activity.id === running.id)!.activity).toEqual(running);
    expect(plan.bonuses.every((b) => b.persisted && !b.overdue)).toBe(true);
    expect(plan.items.map((i) => i.activity.id)).toEqual(core.items.map((i) => i.activity.id));
    expect(plan.items.some((i) => BONUS_POOL.includes(i.activity.slug))).toBe(false);
    expect(plan.plannedMinutes).toBe(core.plannedMinutes);

    // Materializing adds nothing and keeps the running timer untouched.
    const persisted = materializePlan(state, plan);
    expect(persisted.activities.filter((a) => a.type === 'new' && BONUS_POOL.includes(a.slug))).toHaveLength(4);
    expect(persisted.activities.find((a) => a.id === running.id)).toEqual(running);

    // The hidden twin never resurfaces: once the offer is done, the same problem is not offered again.
    const done = complete(persisted, 'new:generate-parentheses:' + day(1), 'solo', day(4), 30);
    expect(slugsOf(planDay(done, day(4)))).not.toContain('generate-parentheses');
  });

  it('loads a state with one bonus per day exactly as before and keeps its history', () => {
    let state = newState();
    for (let d = 1; d <= 3; d += 1) state = materializePlan(state, planDay(state, day(d)));
    const reloaded = deserializeState(serializeState(state));
    expect(reloaded).toEqual(state);
    expect(planDay(reloaded, day(3)).bonuses).toHaveLength(2);
  });
});

describe('bonus offers: skipping, locking and exhausting the pool', () => {
  const pool = ['valid-sudoku', 'container-with-most-water', 'generate-parentheses'];
  const options = { bonusPool: pool };

  it('postpones a skipped offer instead of deleting it: it returns after the others are worked', () => {
    let state = materializePlan(newState(), planDay(newState(), day(1), undefined, options));
    const first = planDay(state, day(1), undefined, options);
    expect(slugsOf(first)).toEqual(['valid-sudoku', 'container-with-most-water']);
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === first.bonuses[0]!.activity.id ? { ...a, status: 'skipped' as const } : a,
      ),
    };
    const next = planDay(state, day(1), undefined, options);
    expect(slugsOf(next)).toEqual(['container-with-most-water', 'generate-parentheses']);
    expect(state.activities.some((a) => a.id === first.bonuses[0]!.activity.id)).toBe(true); // history kept
    expect(slugsOf(planDay(state, day(2), undefined, options))).toEqual(slugsOf(next)); // not just for today

    state = materializePlan(state, next);
    for (const offer of next.bonuses) state = complete(state, offer.activity.id, 'solo', day(1), 30);
    const last = planDay(state, day(1), undefined, options);
    expect(slugsOf(last)).toEqual(['valid-sudoku']);
    expect(last.bonusHold).toMatchObject({ reason: 'exhausted' });
  });

  it('shows fewer offers with the next prerequisite when the remaining category is locked', () => {
    const plan = planDay(newState(), day(1), undefined, { bonusPool: ['house-robber-ii'] });
    expect(plan.bonuses).toEqual([]);
    expect(plan.bonusHold).toMatchObject({
      reason: 'locked',
      category: '1-D Dynamic Programming',
      nextPrerequisite: 'Two Pointers',
    });
    expect(plan.bonusHold!.message).toContain('Two Pointers');
    expect(materializePlan(newState(), plan).activities).toHaveLength(plan.items.length);

    const partial = planDay(newState(), day(1), undefined, { bonusPool: ['valid-sudoku', 'house-robber-ii'] });
    expect(slugsOf(partial)).toEqual(['valid-sudoku']);
    expect(partial.bonusHold?.reason).toBe('locked');
  });

  it('shows no offers and an exhausted reason once every pool problem is worked', () => {
    let state = newState();
    for (const slug of pool) {
      const activity = { ...createActivity(state.activities, { type: 'new', slug, dueDate: day(1), createdAt: day(1) }) };
      state = { ...state, activities: [...state.activities, activity] };
      state = complete(state, activity.id, 'solo', day(1), 30);
    }
    const plan = planDay(state, day(2), undefined, options);
    expect(plan.bonuses).toEqual([]);
    expect(plan.bonusHold).toMatchObject({ reason: 'exhausted' });
    expect(materializePlan(state, plan).activities.filter((a) => a.type === 'new' && pool.includes(a.slug))).toHaveLength(pool.length);
  });

  it('never proposes advanced categories early in the program', () => {
    const early = new Set(['Arrays & Hashing', 'Two Pointers', 'Stack', 'Sliding Window', 'Binary Search', 'Linked List']);
    const dayOne = planDay(newState(), day(1));
    expect(slugsOf(dayOne).every((s) => early.has(getProblem(s)!.category))).toBe(true);
    const afterDayOne = simulateDay(newState(), day(1)).state;
    const dayTwo = planDay(afterDayOne, day(2));
    expect(dayTwo.bonuses).toHaveLength(2);
    for (const slug of slugsOf(dayTwo)) expect(early.has(getProblem(slug)!.category), slug).toBe(true);
  });

  it('still offers bonuses after day 30 and unlocks every pool problem through prerequisites', () => {
    let state = newState();
    for (let d = 1; d <= 30; d += 1) state = simulateDay(state, day(d)).state;
    const worked = (s: AppState): Set<string> =>
      new Set(s.activities.filter((a) => a.status === 'done' && BONUS_POOL.includes(a.slug)).map((a) => a.slug));
    expect(worked(state).size).toBe(0);
    let d = 31;
    for (; d < 31 + 60 && worked(state).size < BONUS_POOL.length; d += 1) {
      const before = worked(state).size;
      state = simulateDay(state, day(d), { bonus: true }).state;
      expect(worked(state).size, `day ${d}`).toBeGreaterThan(before);
    }
    expect(worked(state).size).toBe(BONUS_POOL.length);
    const end = planDay(state, day(d));
    expect(end.bonuses).toEqual([]);
    expect(end.bonusHold?.reason).toBe('exhausted');
  });
});

describe('bonus offers: completion, program counter and projections', () => {
  const slug = BONUS_POOL[0]!;

  it('starts the review cycle once, and the due reviews are real plan items and debt', () => {
    let state = materializePlan(newState(), planDay(newState(), day(1)));
    const offer = planDay(state, day(1)).bonuses.find((b) => b.activity.slug === slug)!;
    state = complete(state, offer.activity.id, 'solo', day(1), 30);
    const again = applyOutcome(state, offer.activity.id, { outcome: 'solo', completedDate: day(1), now: 0, totalMs: 1 });
    expect(again).toBe(state); // completing twice changes nothing
    expect(plannedOf(state, slug, 'recall').map((a) => a.dueDate)).toEqual([day(2)]);
    expect(plannedOf(state, slug, 'rebuild').map((a) => a.dueDate)).toEqual([day(4)]);
    expect(plannedOf(state, slug, 'resolve').map((a) => a.dueDate)).toEqual([day(8)]);
    expect(plannedOf(state, slug, 'blind').map((a) => a.dueDate)).toEqual([day(22)]);

    const dayTwo = planDay(state, day(2));
    const recall = dayTwo.items.find((i) => i.activity.type === 'recall' && i.activity.slug === slug)!;
    expect(recall.overdue).toBe(false);
    expect(dayTwo.plannedMinutes).toBeGreaterThan(planDay(newState(), day(2)).plannedMinutes - 1);
    const dayThree = planDay(state, day(3));
    expect(dayThree.items.find((i) => i.activity.type === 'recall' && i.activity.slug === slug)?.overdue).toBe(true);
  });

  it('never advances the program counter or pace, and counts as worked', () => {
    const state = completeOffers(materializePlan(newState(), planDay(newState(), day(1))), day(1)).state;
    expect(programProgress(state, day(2)).learned).toBe(0);
    expect(planDay(state, day(2)).pace.actual).toBe(0);
    expect(planDay(state, day(2)).pace.label).toBe('\u22122 behind');
    expect(planDay(state, day(2)).items.some((i) => PROGRAM_QUEUE.includes(i.activity.slug) && i.activity.type === 'new')).toBe(true);
    expect(problemStats(state).overall.worked).toBe(2);
  });

  it('is left out of projections, whether or not offers are stored', () => {
    const stored = materializePlan(newState(), planDay(newState(), day(1)));
    for (const state of [newState(), stored]) {
      const projection = projectDay(state, day(3), day(1));
      expect(projection.items.some((i) => BONUS_POOL.includes(i.slug))).toBe(false);
    }
    expect(projectDay(stored, day(3), day(1))).toEqual(projectDay(newState(), day(3), day(1)));
    expect(JSON.stringify(stored)).toBe(JSON.stringify(materializePlan(newState(), planDay(newState(), day(1)))));
  });
});
