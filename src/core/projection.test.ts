import { describe, expect, it } from 'vitest';
import { planDay } from './planner';
import { projectDay } from './projection';
import { day, newState, simulateDay } from './testing';

describe('projectDay', () => {
  it('is the plain plan for today', () => {
    const state = newState();
    const plan = planDay(state, day(1));
    const projection = projectDay(state, day(1), day(1));
    expect(projection.items.map((i) => [i.type, i.slug])).toEqual(
      plan.items.map((i) => [i.activity.type, i.activity.slug]),
    );
    expect(projection.totalMinutes).toBe(plan.plannedMinutes);
  });

  it("projects the reviews that follow from completing each day's plan until then", () => {
    // Nothing done yet: day 2 holds recalls of day 1's new problems and the next two new problems.
    const state = newState();
    const dayOne = planDay(state, day(1))
      .items.filter((i) => i.activity.type === 'new')
      .map((i) => i.activity.slug);
    const projection = projectDay(state, day(2), day(1));
    const recalls = projection.items.filter((i) => i.type === 'recall').map((i) => i.slug);
    expect(recalls.sort()).toEqual([...dayOne].sort());
    const newSlugs = projection.items.filter((i) => i.type === 'new').map((i) => i.slug);
    expect(newSlugs).toHaveLength(2);
    expect(newSlugs.some((slug) => dayOne.includes(slug))).toBe(false);
    expect(projection.totalMinutes).toBe(projection.items.reduce((n, i) => n + i.minutes, 0));
  });

  it('projects a later review stage from the same assumption (rebuild on day 4)', () => {
    const state = simulateDay(newState(), day(1)).state;
    const learned = state.activities.filter((a) => a.type === 'new' && a.status === 'done').map((a) => a.slug);
    const projection = projectDay(state, day(4), day(2));
    const rebuilds = projection.items.filter((i) => i.type === 'rebuild').map((i) => i.slug);
    expect(rebuilds.sort()).toEqual([...learned].sort());
  });

  it('does not change the state it was given', () => {
    const state = simulateDay(newState(), day(1)).state;
    const before = JSON.stringify(state);
    projectDay(state, day(10), day(2));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('shows the benchmark pair on day 15 and no new problems on a consolidation day', () => {
    const state = newState();
    expect(projectDay(state, day(15), day(1)).items.filter((i) => i.type === 'benchmark')).toHaveLength(2);
    expect(projectDay(state, day(7), day(1)).items.some((i) => i.type === 'new')).toBe(false);
  });

  it('is empty before the program starts', () => {
    expect(projectDay(newState(), day(0), day(-3)).items).toEqual([]);
  });
});
