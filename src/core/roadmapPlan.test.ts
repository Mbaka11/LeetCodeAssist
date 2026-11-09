import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { programEndDate, roadmapPlan, upcomingFirstDates } from './roadmapPlan';
import { defaultState } from './state';
import { programGoal, PROGRAM_QUEUE } from '../data/program';

const start = '2025-01-06';
const base = defaultState(start);

describe('roadmapPlan (planned by day 60)', () => {
  const upcoming = upcomingFirstDates(base, start, programEndDate(base));

  it('forecasts the program goal over the 60 days at a 210-minute cap, inside the program dates', () => {
    expect(programEndDate(base)).toBe(addDays(start, 59));
    const roomy = { ...base, settings: { ...base.settings, dailyCapMin: 210 } };
    const queued = PROGRAM_QUEUE.filter((slug) => upcomingFirstDates(roomy, start, programEndDate(roomy)).has(slug)).length;
    expect(queued).toBeGreaterThanOrEqual(programGoal());
    for (const date of upcoming.values()) {
      expect(date >= start && date <= programEndDate(base)).toBe(true);
    }
  });

  it('counts per catalog, difficulty and category, with planned between worked and total', () => {
    for (const catalog of ['neetcode150', 'blind75'] as const) {
      const plan = roadmapPlan(base, catalog, start, upcoming);
      expect(plan.overall.total).toBe(catalog === 'neetcode150' ? 150 : 75);
      expect(plan.overall.worked).toBe(0);
      expect(plan.overall.planned).toBeGreaterThan(0);
      expect(plan.overall.planned).toBeLessThanOrEqual(plan.overall.total);
      const byDifficulty = Object.values(plan.byDifficulty);
      expect(byDifficulty.reduce((n, c) => n + c.planned, 0)).toBe(plan.overall.planned);
      expect([...plan.byCategory.values()].reduce((n, c) => n + c.planned, 0)).toBe(plan.overall.planned);
    }
    const nc = roadmapPlan(base, 'neetcode150', start, upcoming);
    const blind = roadmapPlan(base, 'blind75', start, upcoming);
    expect(blind.overall.planned).toBeLessThanOrEqual(nc.overall.planned);
  });

  it('counts a ticked problem as worked and planned, and plans nothing once the program is over', () => {
    const ticked = { ...base, checked: { 'lru-cache': true } };
    const plan = roadmapPlan(ticked, 'neetcode150', start, upcoming);
    expect(plan.overall.worked).toBe(1);
    expect(plan.byCategory.get('Linked List')!.planned).toBeGreaterThanOrEqual(1);
    expect(upcomingFirstDates(base, addDays(start, 60), programEndDate(base)).size).toBe(0);
  });
});
