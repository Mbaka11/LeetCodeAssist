import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { workedTotals } from '../core/worked';
import { planDay } from '../core/planner';
import { complete, day, newState, simulateDay } from '../core/testing';
import { WorkedTotal, workedBreakdown } from './WorkedTotal';

describe('WorkedTotal', () => {
  it('shows zero with the breakdown and the explanation before anything is finished', () => {
    const html = renderToStaticMarkup(<WorkedTotal totals={workedTotals(newState())} />);
    expect(html).toContain('>0</span>');
    expect(html).toContain('problems worked');
    expect(html).toContain('Program 0/50 · Benchmarks 0/6 · Bonus 0');
    expect(html).not.toContain('Other');
    expect(html).toContain('Reviews never add to it');
    expect(html).toContain('a bonus never replaces a program problem');
  });

  it('counts program, benchmark and bonus problems once each', () => {
    const state = simulateDay(newState(), day(1), { bonus: true }).state;
    const totals = workedTotals(state);
    expect(workedBreakdown(totals)).toBe('Program 2/50 · Benchmarks 2/6 · Bonus 2');
    expect(totals.total).toBe(6);
    const html = renderToStaticMarkup(<WorkedTotal totals={totals} />);
    expect(html).toContain('>6</span>');
    expect(html).toContain('Program 2/50 · Benchmarks 2/6 · Bonus 2');
  });

  it('does not increase when reviews of the same problems are completed', () => {
    let state = simulateDay(newState(), day(1)).state;
    const before = workedTotals(state).total;
    const second = simulateDay(state, day(2));
    state = second.state;
    expect(second.plan.items.some((item) => item.activity.type === 'recall')).toBe(true);
    // Day 2 completes the recalls of day 1 plus its new problems: only the new problems are added.
    const newToday = second.plan.items.filter((item) => item.activity.type === 'new').length;
    expect(newToday).toBeGreaterThan(0);
    expect(workedTotals(state).total).toBe(before + newToday);
  });

  it('shows Other only when a worked problem is outside the program, benchmarks and bonus pool', () => {
    expect(workedBreakdown({ program: 1, programTotal: 50, benchmark: 0, benchmarkTotal: 6, bonus: 0, other: 2, total: 3 })).toBe(
      'Program 1/50 · Benchmarks 0/6 · Bonus 0 · Other 2',
    );
  });

  it('uses the singular for one problem', () => {
    const state = newState();
    const plan = planDay(state, day(1));
    const planned = { ...state, activities: plan.items.map((i) => i.activity) };
    const one = complete(planned, plan.items.find((i) => i.activity.type === 'new')!.activity.id, 'solo', day(1));
    expect(renderToStaticMarkup(<WorkedTotal totals={workedTotals(one)} />)).toContain('problem worked');
  });
});
