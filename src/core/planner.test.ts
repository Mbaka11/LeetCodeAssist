import { describe, expect, it } from 'vitest';
import { BONUS_POOL } from '../data/bonus';
import { getProblem } from '../data/neetcode150';
import { BENCHMARKS, MAX_NEW_PROBLEMS_PER_DAY, NEW_PROBLEMS_PER_DAY, PROGRAM_QUEUE } from '../data/program';
import { createActivity, estimatedMinutes, isReviewType } from './activities';
import { diffDays } from './dates';
import { programProgress } from './calendar';
import { SOFT_OVERFLOW_MIN, coreNewCount, materializePlan, planDay } from './planner';
import { problemStats } from './state';
import {
  START,
  activitiesOf,
  complete,
  day,
  newState,
  plannedOf,
  planAndComplete,
  simulateDay,
} from './testing';
import type { ActivityType, AppState } from './types';

function addPlanned(
  state: AppState,
  type: ActivityType,
  slug: string,
  dueDate: string,
  createdAt = START,
): AppState {
  const activity = createActivity(state.activities, { type, slug, dueDate, createdAt });
  return { ...state, activities: [...state.activities, activity] };
}

/** Program problems of Medium difficulty (30-minute resolves), in queue order. */
const mediumSlugs = PROGRAM_QUEUE.filter((slug) => getProblem(slug)?.difficulty === 'Medium');

function itemKeys(plan: ReturnType<typeof planDay>): string[] {
  return plan.items.map((i) => `${i.activity.type}:${i.activity.slug}`);
}

describe('planDay: day 1', () => {
  const plan = planDay(newState(), day(1));

  it('plans the benchmark pair and 2 new problems from the queue', () => {
    expect(plan.dayIndex).toBe(1);
    expect(plan.isBenchmarkDay).toBe(true);
    expect(plan.isConsolidationDay).toBe(false);
    expect(itemKeys(plan)).toEqual([
      'benchmark:contains-duplicate',
      'benchmark:product-of-array-except-self',
      'new:two-sum',
      'new:valid-anagram',
    ]);
    expect(plan.plannedMinutes).toBe(30 + 30 + 25 + 25);
    expect(plan.remainingMinutes).toBe(plan.plannedMinutes);
    expect(plan.carriedOver).toEqual([]);
    expect(plan.items.every((i) => !i.persisted)).toBe(true);
  });

  it('offers two optional bonus problems from the pool outside the core minutes', () => {
    expect(plan.bonuses.map((b) => b.activity.slug)).toEqual([BONUS_POOL[0], BONUS_POOL[1]]);
    expect(plan.plannedMinutes).toBe(110);
    expect(plan.bonuses.every((b) => !b.persisted && !plan.items.includes(b))).toBe(true);
  });

  it('reports the targets and the pace relative to the schedule', () => {
    expect(plan.targetMinutes).toBe(150);
    expect(plan.capMinutes).toBe(180);
    expect(plan.pace).toEqual({ actual: 0, expected: 2, delta: 0, label: 'on pace' });
  });

  it('returns an empty plan before the start date', () => {
    const before = planDay(newState(), day(0));
    expect(before.items).toEqual([]);
    expect(before.bonuses).toEqual([]);
    expect(before.dayIndex).toBe(0);
  });
});

describe('planDay: materialization and stability', () => {
  it('persists missing activities once and keeps the plan stable while items are completed', () => {
    let state = newState();
    const first = planDay(state, day(1));
    state = materializePlan(state, first);
    expect(state.activities).toHaveLength(first.items.length + 2); // + two bonus offers
    expect(materializePlan(state, planDay(state, day(1)))).toBe(state);

    const second = planDay(state, day(1));
    expect(second.items.every((i) => i.persisted)).toBe(true);
    expect(second.items.map((i) => i.activity.id)).toEqual(first.items.map((i) => i.activity.id));
    expect(second.bonuses.map((b) => b.activity.id)).toEqual(first.bonuses.map((b) => b.activity.id));

    for (const item of first.items) {
      state = complete(state, item.activity.id, 'solo', day(1));
      const after = planDay(state, day(1));
      expect(after.items.map((i) => i.activity.id)).toEqual(first.items.map((i) => i.activity.id));
      expect(after.plannedMinutes).toBe(first.plannedMinutes);
      expect(after.bonuses.map((b) => b.activity.id)).toEqual(first.bonuses.map((b) => b.activity.id));
    }
    expect(planDay(state, day(1)).remainingMinutes).toBe(0);
  });

  it('does not offer queue problems that were already started or done; a skipped one returns to the queue', () => {
    let state = newState();
    state = materializePlan(state, planDay(state, day(1)));
    const [first, second] = plannedOf(state, 'two-sum', 'new').concat(plannedOf(state, 'valid-anagram', 'new'));
    state = complete(state, first!.id, 'solo', day(1));
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === second!.id ? { ...a, status: 'skipped' as const } : a,
      ),
    };
    const plan = planDay(state, day(2));
    const news = plan.items.filter((i) => i.activity.type === 'new').map((i) => i.activity.slug);
    expect(news).toEqual(['valid-anagram', 'group-anagrams']);
  });

  it('re-offers a planned problem that was never done, and never carries a bonus as debt', () => {
    let state = newState();
    state = materializePlan(state, planDay(state, day(1))); // 2 new + 2 bonus offers, none done
    const plan = planDay(state, day(2));
    const news = plan.items.filter((i) => i.activity.type === 'new').map((i) => i.activity.slug);
    expect(news).toEqual(['two-sum', 'valid-anagram']);
    expect(plan.carriedOver).toEqual([]);
    expect(plan.items.every((i) => i.overdue === false)).toBe(true);
    expect(plan.bonuses.map((b) => b.activity.slug)).toEqual([BONUS_POOL[0], BONUS_POOL[1]]);
    expect(plan.bonuses.every((b) => b.persisted && !b.overdue)).toBe(true); // the same offers, no duplicates
  });

  it('keeps an in-progress new problem from an earlier day on the plan', () => {
    let state = newState();
    state = materializePlan(state, planDay(state, day(1)));
    const started = plannedOf(state, 'two-sum', 'new')[0]!;
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === started.id ? { ...a, status: 'in_progress' as const } : a,
      ),
    };
    const plan = planDay(state, day(2));
    expect(itemKeys(plan)).toContain('new:two-sum');
    expect(plan.items.filter((i) => i.activity.type === 'new')).toHaveLength(2);
  });
});

describe('planDay: reviews', () => {
  it('lists overdue reviews first, then by priority retry > recall > rebuild > resolve > blind', () => {
    let state = newState();
    const slugs = PROGRAM_QUEUE.slice(0, 6);
    state = addPlanned(state, 'blind', slugs[0]!, day(10));
    state = addPlanned(state, 'resolve', slugs[1]!, day(10));
    state = addPlanned(state, 'rebuild', slugs[2]!, day(10));
    state = addPlanned(state, 'recall', slugs[3]!, day(10));
    state = addPlanned(state, 'retry', slugs[4]!, day(10));
    state = addPlanned(state, 'retry', slugs[5]!, day(9)); // overdue
    const plan = planDay(state, day(10));
    expect(plan.items.slice(0, 6).map((i) => i.activity.type)).toEqual([
      'retry', // overdue first
      'retry',
      'recall',
      'rebuild',
      'resolve',
      'blind',
    ]);
    expect(plan.items[0]!.overdue).toBe(true);
    expect(plan.items[1]!.overdue).toBe(false);
  });

  it('does not plan reviews that are due in the future', () => {
    const state = addPlanned(newState(), 'recall', 'two-sum', day(5));
    expect(itemKeys(planDay(state, day(4)))).not.toContain('recall:two-sum');
    expect(itemKeys(planDay(state, day(5)))).toContain('recall:two-sum');
  });

  it('shows one review per problem: the strongest wins and the rest are merged away', () => {
    let state = newState();
    state = addPlanned(state, 'recall', 'two-sum', day(4));
    state = addPlanned(state, 'rebuild', 'two-sum', day(6));
    state = addPlanned(state, 'retry', 'valid-anagram', day(6));
    state = addPlanned(state, 'rebuild', 'valid-anagram', day(6));
    const plan = planDay(state, day(7 + 7)); // plenty late, not a consolidation-day concern here
    const reviews = plan.items.filter((i) => i.activity.type !== 'new');
    const bySlug = reviews.map((i) => `${i.activity.type}:${i.activity.slug}`);
    expect(bySlug).toContain('rebuild:two-sum');
    expect(bySlug).toContain('retry:valid-anagram');
    expect(bySlug).not.toContain('recall:two-sum');
    expect(bySlug).not.toContain('rebuild:valid-anagram');
    expect(plan.mergedAway.map((a) => `${a.type}:${a.slug}`).sort()).toEqual([
      'rebuild:valid-anagram',
      'recall:two-sum',
    ]);
  });

  it('completing the shown review retires the weaker merged one', () => {
    let state = newState();
    state = addPlanned(state, 'recall', 'two-sum', day(4));
    state = addPlanned(state, 'rebuild', 'two-sum', day(6));
    const rebuild = plannedOf(state, 'two-sum', 'rebuild')[0]!;
    state = complete(state, rebuild.id, 'solo', day(6));
    expect(plannedOf(state, 'two-sum', 'recall')).toHaveLength(0);
    expect(planDay(state, day(7)).mergedAway).toEqual([]);
  });

  it('estimates minutes per activity type and problem difficulty', () => {
    // two-sum is Easy, 3sum Medium, trapping-rain-water Hard.
    const slugs = ['two-sum', '3sum', 'trapping-rain-water'];
    const table: Record<ActivityType, [number, number, number]> = {
      recall: [5, 8, 10],
      rebuild: [10, 15, 18],
      retry: [10, 15, 18],
      resolve: [15, 25, 30],
      blind: [15, 20, 25],
      new: [25, 40, 50],
      benchmark: [30, 30, 30],
    };
    for (const [type, minutes] of Object.entries(table) as [ActivityType, number[]][]) {
      expect(slugs.map((slug) => estimatedMinutes(type, slug))).toEqual(minutes);
    }
    expect(estimatedMinutes('new', 'unknown-problem')).toBe(40); // counts as Medium
    expect(estimatedMinutes('recall', 'unknown-problem')).toBe(8);
  });

  it('plans fewer new problems when reviews fill the budget', () => {
    let state = newState();
    // 6 overdue Medium resolves = 150 min; one Easy (25) fits under 180, a second one (175 + 25) does not.
    for (const slug of mediumSlugs.slice(0, 6)) state = addPlanned(state, 'resolve', slug, day(2));
    const plan = planDay(state, day(3));
    expect(plan.items.filter((i) => i.activity.type === 'resolve')).toHaveLength(6);
    expect(plan.items.filter((i) => i.activity.type === 'new')).toHaveLength(1);
    // The two bonus offers stay visible but outside the core budget (nothing is left of the cap).
    expect(plan.bonuses).toHaveLength(2);
    expect(plan.bonusRoomMinutes).toBe(plan.capMinutes - plan.plannedMinutes);
    // Raise the review load until no new problem fits.
    for (const slug of mediumSlugs.slice(6, 8)) state = addPlanned(state, 'resolve', slug, day(2));
    const crowded = planDay(state, day(3));
    expect(crowded.items.filter((i) => i.activity.type === 'new')).toHaveLength(0);
    expect(crowded.bonuses).toHaveLength(2);
    expect(crowded.plannedMinutes).toBeLessThanOrEqual(crowded.capMinutes);
  });
});

describe('planDay: missed days and the cap', () => {
  it('never exceeds the cap and never drops reviews when many are overdue', () => {
    let state = newState();
    const slugs = mediumSlugs.slice(0, 18);
    for (const slug of slugs) state = addPlanned(state, 'resolve', slug, day(2));
    const totalDue = slugs.length;
    let remaining = totalDue;
    let safety = 0;
    let date = 5;
    while (remaining > 0) {
      const plan = planDay(state, day(date));
      expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
      const shown = plan.items.filter((i) => i.activity.type === 'resolve');
      expect(shown.length + plan.carriedOver.length).toBe(remaining);
      expect(shown.length).toBeGreaterThan(0);
      expect(plan.items.filter((i) => i.activity.type === 'new')).toHaveLength(0);
      for (const item of shown) {
        state = materializePlan(state, plan);
        state = complete(state, item.activity.id, 'solo', day(date));
        remaining -= 1;
      }
      date += 1;
      safety += 1;
      expect(safety).toBeLessThan(10);
    }
    expect(date).toBe(5 + 3); // 18 x 30 min at <= 180 min/day => 6 per day => 3 days
  });

  it('carries reviews forward after missing 3 days without dropping any', () => {
    let state = newState();
    for (let d = 1; d <= 3; d += 1) state = simulateDay(state, day(d)).state;
    // Days 4, 5 and 6 are missed entirely.
    const pendingBefore = state.activities.filter(
      (a) => a.type !== 'new' && a.status === 'planned' && a.dueDate <= day(7),
    );
    expect(pendingBefore.length).toBeGreaterThan(0);

    const plan = planDay(state, day(7));
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
    const handled = new Set([
      ...plan.items.map((i) => i.activity.id),
      ...plan.carriedOver.map((i) => i.activity.id),
      ...plan.mergedAway.map((a) => a.id),
    ]);
    for (const review of pendingBefore) expect(handled.has(review.id)).toBe(true);
    // Day 7 is a consolidation day: no new problems even though we are behind.
    expect(plan.items.some((i) => i.activity.type === 'new')).toBe(false);
    expect(plan.pace.delta).toBeLessThan(0);
  });

  it('respects a custom cap from settings', () => {
    let state = newState();
    for (const slug of mediumSlugs.slice(0, 10)) state = addPlanned(state, 'resolve', slug, day(1));
    const plan = planDay(state, day(2), { ...state.settings, dailyCapMin: 100, dailyTargetMin: 90 });
    expect(plan.capMinutes).toBe(100);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(100);
    expect(plan.items).toHaveLength(4); // 4 x 25 min
    expect(plan.carriedOver).toHaveLength(6);
  });

  it('always shows at least one review, even if it alone exceeds the cap', () => {
    const state = addPlanned(newState(), 'resolve', 'two-sum', day(1));
    const plan = planDay(state, day(2), { ...state.settings, dailyTargetMin: 5, dailyCapMin: 10 });
    expect(itemKeys(plan)).toContain('resolve:two-sum');
    expect(plan.items.some((i) => i.activity.type === 'new')).toBe(false);
  });
});

describe('planDay: consolidation days', () => {
  it.each([7, 14, 21, 28])('day %i has no queue problems; a bonus is optional and fits the cap', (n) => {
    let state = newState();
    for (let d = 1; d < n; d += 1) state = simulateDay(state, day(d)).state;
    const plan = planDay(state, day(n));
    expect(plan.isConsolidationDay).toBe(true);
    expect(plan.items.some((i) => i.activity.type === 'new')).toBe(false);
    expect(plan.bonuses).toHaveLength(2);
    for (const offer of plan.bonuses) expect(BONUS_POOL).toContain(offer.activity.slug);
    expect(plan.targetMinutes).toBe(90);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it('tops up with blind practice on learned problems up to 90 minutes, once', () => {
    let state = newState();
    for (let d = 1; d <= 6; d += 1) state = simulateDay(state, day(d)).state;
    const plan = planDay(state, day(7));
    expect(plan.plannedMinutes).toBeGreaterThanOrEqual(90 - 14);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
    const extras = plan.items.filter((i) => i.activity.extra);
    expect(extras.length).toBeGreaterThan(0);
    for (const extra of extras) {
      expect(extra.activity.type).toBe('blind');
      expect(extra.persisted).toBe(false);
    }

    // Persisting and re-planning must not add more practice.
    const stored = materializePlan(state, plan);
    const again = planDay(stored, day(7));
    expect(again.items.map((i) => i.activity.id)).toEqual(plan.items.map((i) => i.activity.id));
  });

  it('lets unfinished optional practice go stale instead of becoming debt', () => {
    let state = newState();
    for (let d = 1; d <= 6; d += 1) state = simulateDay(state, day(d)).state;
    const plan = planDay(state, day(7));
    state = materializePlan(state, plan);
    const extraIds = plan.items.filter((i) => i.activity.extra).map((i) => i.activity.id);
    expect(extraIds.length).toBeGreaterThan(0);
    const next = planDay(state, day(8));
    for (const id of extraIds) {
      expect(next.items.map((i) => i.activity.id)).not.toContain(id);
      expect(next.carriedOver.map((i) => i.activity.id)).not.toContain(id);
    }
  });

  it('does not add practice for problems learned less than 3 days ago', () => {
    let state = newState();
    state = simulateDay(state, day(6)).state; // everything learned on day 6 (but day 6 plan)
    const plan = planDay(state, day(7));
    expect(plan.items.filter((i) => i.activity.extra)).toHaveLength(0);
  });
});

describe('planDay: benchmarks', () => {
  it.each(BENCHMARKS)('plans the reserved pair on day $day', (benchmark) => {
    let state = newState();
    for (let d = 1; d < benchmark.day; d += 1) state = simulateDay(state, day(d)).state;
    const plan = planDay(state, day(benchmark.day));
    expect(plan.isBenchmarkDay).toBe(true);
    const slugs = plan.items.filter((i) => i.activity.type === 'benchmark').map((i) => i.activity.slug);
    expect(slugs).toEqual([benchmark.easy, benchmark.medium]);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
  });

  it('keeps the benchmark even when reviews are overdue, carrying reviews instead', () => {
    let state = newState();
    for (const slug of PROGRAM_QUEUE.slice(0, 12)) state = addPlanned(state, 'resolve', slug, day(14));
    const plan = planDay(state, day(15));
    expect(plan.items.filter((i) => i.activity.type === 'benchmark')).toHaveLength(2);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
    expect(plan.carriedOver.length).toBeGreaterThan(0);
  });

  it('keeps a benchmark started on an earlier day listed until it is finished', () => {
    let state = materializePlan(newState(), planDay(newState(), day(1)));
    const first = activitiesOf(state, BENCHMARKS[0]!.easy, 'benchmark')[0]!;
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === first.id ? { ...a, status: 'in_progress' as const } : a,
      ),
    };
    const next = planDay(state, day(2));
    expect(itemKeys(next)).toContain(`benchmark:${BENCHMARKS[0]!.easy}`);
    expect(itemKeys(next)).not.toContain(`benchmark:${BENCHMARKS[0]!.medium}`);
  });

  it('does not plan a benchmark on other days or re-create a skipped one', () => {
    let state = newState();
    expect(itemKeys(planDay(state, day(2))).some((k) => k.startsWith('benchmark'))).toBe(false);
    state = materializePlan(state, planDay(state, day(1)));
    const first = activitiesOf(state, BENCHMARKS[0]!.easy, 'benchmark')[0]!;
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === first.id ? { ...a, status: 'skipped' as const } : a,
      ),
    };
    const keys = itemKeys(planDay(state, day(1)));
    expect(keys).not.toContain(`benchmark:${BENCHMARKS[0]!.easy}`);
    expect(keys).toContain(`benchmark:${BENCHMARKS[0]!.medium}`);
  });
});

describe('planDay: pace', () => {
  it('reports ahead, behind and on pace', () => {
    let state = newState();
    const doneNew = (slugs: string[]): AppState => {
      let s = state;
      for (const slug of slugs) {
        const activity = createActivity(s.activities, {
          type: 'new',
          slug,
          dueDate: day(1),
          createdAt: day(1),
        });
        s = { ...s, activities: [...s.activities, activity] };
        s = complete(s, activity.id, 'solo', day(1));
      }
      return s;
    };
    expect(planDay(state, day(1)).pace.label).toBe('on pace');
    expect(planDay(state, day(2)).pace.label).toBe('\u22122 behind');
    state = doneNew(PROGRAM_QUEUE.slice(0, 4));
    expect(planDay(state, day(2)).pace).toMatchObject({ actual: 4, expected: 4, delta: 0, label: 'on pace' });
    state = doneNew(PROGRAM_QUEUE.slice(4, 7));
    expect(planDay(state, day(2)).pace).toMatchObject({ delta: 3, label: '+3 ahead' });
    expect(planDay(state, day(8)).pace.expected).toBe(14);
  });
});

describe('planDay: the 30-day program with a perfect user', () => {
  function run(days: number, bonus: boolean) {
    let state = newState();
    const plans = [];
    for (let d = 1; d <= days; d += 1) {
      const result = simulateDay(state, day(d), { bonus });
      plans.push(result.plan);
      state = result.state;
    }
    return { state, plans };
  }

  const { state: finalState, plans } = run(60, true);

  it('respects the cap (plus the soft overflow of a third Easy problem) and keeps benchmark and consolidation days right', () => {
    plans.forEach((plan, i) => {
      const n = i + 1;
      const newCount = plan.items.filter((x) => x.activity.type === 'new').length;
      const limit = newCount > NEW_PROBLEMS_PER_DAY ? plan.capMinutes + SOFT_OVERFLOW_MIN : plan.capMinutes;
      expect(plan.plannedMinutes, `day ${n}`).toBeLessThanOrEqual(limit);
      const types = plan.items.map((x) => x.activity.type);
      if ([7, 14, 21, 28].includes(n)) expect(types).not.toContain('new');
      expect(types.filter((t) => t === 'benchmark').length).toBe([1, 15, 30].includes(n) ? 2 : 0);
    });
  });

  it('plans about 2 new problems on normal days and finishes the queue', () => {
    const learned = new Set(
      finalState.activities
        .filter((a) => a.type === 'new' && a.status === 'done' && PROGRAM_QUEUE.includes(a.slug))
        .map((a) => a.slug),
    );
    expect(learned.size).toBe(PROGRAM_QUEUE.length);
    for (const slug of PROGRAM_QUEUE) expect(learned.has(slug)).toBe(true);
    for (const plan of plans) {
      const news = plan.items.filter((i) => i.activity.type === 'new').map((i) => i.activity.slug);
      expect(news.length).toBeLessThanOrEqual(MAX_NEW_PROBLEMS_PER_DAY);
      // Only an Easy problem may be the third of a day.
      if (news.length > NEW_PROBLEMS_PER_DAY) expect(getProblem(news[2]!)?.difficulty).toBe('Easy');
    }
    expect(plans[1]!.items.filter((i) => i.activity.type === 'new').length).toBeGreaterThanOrEqual(2);
  });

  it('never puts reserved benchmark problems into the learning queue', () => {
    const reserved = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));
    const newSlugs = finalState.activities.filter((a) => a.type === 'new').map((a) => a.slug);
    for (const slug of newSlugs) expect(reserved.has(slug)).toBe(false);
  });

  it('continues reviews after day 30 (learned on day 29 => resolve on day 36)', () => {
    const day29New = finalState.activities.filter(
      (a) => a.type === 'new' && a.completedAt === day(29),
    );
    expect(day29New.length).toBeGreaterThan(0);
    for (const learned of day29New) {
      const resolve = activitiesOf(finalState, learned.slug, 'resolve').find((a) => a.dueDate === day(36));
      expect(resolve, learned.slug).toBeDefined();
      const shown = plans[35]!.items.map((i) => `${i.activity.type}:${i.activity.slug}`);
      expect(shown).toContain(`resolve:${learned.slug}`);
    }
    expect(plans.slice(30, 45).some((p) => p.items.length > 0)).toBe(true);
  });

  it('eventually clears every scheduled review without leaving debt', () => {
    const open = finalState.activities.filter(
      (a) => a.status === 'planned' && a.type !== 'new' && a.dueDate <= day(60),
    );
    expect(open).toEqual([]);
  });

  it('applies the problem status machine to every learned problem', () => {
    for (const slug of PROGRAM_QUEUE) {
      expect(['learning', 'reviewed', 'mastered']).toContain(finalState.problemStatus[slug]);
    }
    expect(Object.values(finalState.problemStatus).filter((s) => s === 'mastered').length).toBeGreaterThan(0);
  });
});

describe('planDay: a struggling user stays within the cap', () => {
  it('handles failures, missed days and consolidation without exceeding the cap', () => {
    let state = newState();
    for (let d = 1; d <= 40; d += 1) {
      if (d % 5 === 3) continue; // misses days
      const outcome = d % 3 === 0 ? 'stuck' : d % 2 === 0 ? 'hint' : 'solo';
      const result = simulateDay(state, day(d), { outcome });
      expect(result.plan.plannedMinutes, `day ${d}`).toBeLessThanOrEqual(result.plan.capMinutes);
      state = result.state;
    }
    const ids = state.activities.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Never more than one active review per problem per due date.
    const seen = new Set<string>();
    for (const a of state.activities) {
      if (a.status !== 'planned' || ['new', 'benchmark'].includes(a.type)) continue;
      const key = `${a.slug}@${a.dueDate}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});

describe('planDay: the soft overflow for a third Easy problem', () => {
  const newSlugs = (plan: ReturnType<typeof planDay>): string[] =>
    plan.items.filter((i) => i.activity.type === 'new').map((i) => i.activity.slug);
  const easyQueue = ['two-sum', 'valid-anagram', 'valid-palindrome', 'binary-search'];

  it('plans a third new problem on a normal day when the next one is Easy', () => {
    const afterDayOne = simulateDay(newState(), day(1)).state;
    const plan = planDay(afterDayOne, day(2));
    // group-anagrams and top-k-frequent-elements are Medium, valid-palindrome is Easy.
    expect(newSlugs(plan)).toEqual(['group-anagrams', 'top-k-frequent-elements', 'valid-palindrome']);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes + SOFT_OVERFLOW_MIN);
  });

  it('plans only two when the next problem is Medium', () => {
    expect(newSlugs(planDay(newState(), day(1)))).toEqual(['two-sum', 'valid-anagram']);
  });

  it('plans only two when the third Easy problem would exceed cap + the soft overflow', () => {
    const state = newState();
    const options = { queue: easyQueue };
    const budgets = { new: { Easy: 40 } };
    const tight = planDay(state, day(2), { ...state.settings, dailyCapMin: 80, budgets }, options);
    expect(newSlugs(tight)).toEqual(['two-sum', 'valid-anagram']); // 80 + 40 > 80 + 30
    const roomy = planDay(state, day(2), { ...state.settings, dailyCapMin: 90, budgets }, options);
    expect(newSlugs(roomy)).toEqual(['two-sum', 'valid-anagram', 'valid-palindrome']); // 120 = 90 + 30
  });

  it('never plans a fourth new problem', () => {
    expect(newSlugs(planDay(newState(), day(2), undefined, { queue: easyQueue }))).toHaveLength(3);
  });

  it('keeps a persisted third Easy problem as a core problem, not as the bonus', () => {
    const state = materializePlan(newState(), planDay(newState(), day(2), undefined, { queue: easyQueue }));
    const replanned = planDay(state, day(2), undefined, { queue: easyQueue });
    expect(newSlugs(replanned)).toEqual(['two-sum', 'valid-anagram', 'valid-palindrome']);
    expect(replanned.items.filter((i) => i.activity.type === 'new').every((i) => i.persisted)).toBe(true);
    expect(replanned.bonuses.every((b) => BONUS_POOL.includes(b.activity.slug))).toBe(true);
  });

  it('does not offer a problem postponed today again as the Easy third problem', () => {
    let state = materializePlan(newState(), planDay(newState(), day(2), undefined, { queue: easyQueue }));
    const first = state.activities.find((a) => a.type === 'new' && a.slug === 'two-sum')!;
    state = {
      ...state,
      activities: state.activities.map((a) => (a.id === first.id ? { ...a, status: 'skipped' as const, postponed: true } : a)),
    };
    // two-sum moved behind the next two: the queue is now valid-anagram, valid-palindrome, two-sum, binary-search.
    const queue = ['valid-anagram', 'valid-palindrome', 'two-sum', 'binary-search'];
    expect(newSlugs(planDay(state, day(2), undefined, { queue }))).not.toContain('two-sum');
  });

  it('adds no new problem on a consolidation day', () => {
    expect(newSlugs(planDay(newState(), day(7), undefined, { queue: easyQueue }))).toEqual([]);
  });

  it('counts the core problems of a day: two, plus a third only when it is Easy', () => {
    expect(coreNewCount([])).toBe(0);
    expect(coreNewCount(['two-sum'])).toBe(1);
    expect(coreNewCount(['two-sum', 'valid-anagram'])).toBe(2);
    expect(coreNewCount(['two-sum', 'valid-anagram', 'valid-palindrome'])).toBe(3);
    expect(coreNewCount(['two-sum', 'valid-anagram', '3sum'])).toBe(2);
    expect(coreNewCount(['two-sum', 'valid-anagram', 'valid-palindrome', 'binary-search'])).toBe(3);
  });
});

describe('planDay: the whole queue by day 30', () => {
  // A perfect user who works exactly the plan (no bonus), planned day by day like the projection does.
  const projected: { plan: ReturnType<typeof planDay>; learnedSoFar: number }[] = [];
  let state = newState();
  for (let d = 1; d <= 30; d += 1) {
    const result = simulateDay(state, day(d));
    state = result.state;
    projected.push({
      plan: result.plan,
      learnedSoFar: new Set(
        state.activities.filter((a) => a.type === 'new' && a.status === 'done').map((a) => a.slug),
      ).size,
    });
  }
  const day30State = state;

  it('introduces every program problem by day 30', () => {
    expect(projected[29]!.learnedSoFar).toBe(PROGRAM_QUEUE.length);
    for (const slug of PROGRAM_QUEUE) {
      expect(activitiesOf(day30State, slug, 'new').some((a) => a.status === 'done'), slug).toBe(true);
    }
  });

  it('keeps every day within the cap plus the soft overflow', () => {
    projected.forEach(({ plan }, i) => {
      expect(plan.plannedMinutes, `day ${i + 1}`).toBeLessThanOrEqual(plan.capMinutes + SOFT_OVERFLOW_MIN);
    });
  });

  it('keeps consolidation days free of new problems', () => {
    for (const n of [7, 14, 21, 28]) {
      expect(projected[n - 1]!.plan.items.some((i) => i.activity.type === 'new'), `day ${n}`).toBe(false);
    }
  });

  it('never leaves a review waiting more than a day', () => {
    projected.forEach(({ plan }, i) => {
      for (const item of plan.items) {
        if (!isReviewType(item.activity.type) || item.activity.extra) continue;
        expect(diffDays(item.activity.dueDate, plan.date), `day ${i + 1} ${item.activity.id}`).toBeLessThanOrEqual(1);
      }
    });
  });

  it('expects the whole queue on day 30 and is on pace after working the plan', () => {
    const pace = planDay(day30State, day(30)).pace;
    expect(pace.expected).toBe(PROGRAM_QUEUE.length);
    expect(pace.actual).toBe(PROGRAM_QUEUE.length);
    expect(pace.label).toBe('on pace');
  });
});
