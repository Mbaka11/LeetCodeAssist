import { describe, expect, it } from 'vitest';
import { morningNotification, summarizeToday } from '../lib/reminders';
import {
  BUDGETED_TYPES,
  DEFAULT_BUDGETS,
  effectiveBudgets,
  estimatedMinutes,
  expectedNewMinutes,
} from './activities';
import { calendarDays } from './calendar';
import { planDay } from './planner';
import { projectDay } from './projection';
import { BUDGET_MAX_MINUTES, deserializeState, serializeState, validateState } from './state';
import { day, newState, planAndComplete, simulateDay } from './testing';
import type { AppState, BudgetOverrides } from './types';

function withBudgets(budgets: BudgetOverrides): AppState {
  const state = newState();
  return { ...state, settings: { ...state.settings, budgets } };
}

describe('review budgets by difficulty', () => {
  it('has a default for every type and difficulty, rising with difficulty', () => {
    for (const type of BUDGETED_TYPES) {
      const { Easy, Medium, Hard } = DEFAULT_BUDGETS[type];
      expect(Easy).toBeLessThan(Medium);
      expect(Medium).toBeLessThan(Hard);
    }
    expect(DEFAULT_BUDGETS.new).toEqual({ Easy: 25, Medium: 40, Hard: 50 });
    expect(DEFAULT_BUDGETS.recall).toEqual({ Easy: 5, Medium: 8, Hard: 10 });
    expect(DEFAULT_BUDGETS.rebuild).toEqual({ Easy: 10, Medium: 15, Hard: 18 });
    expect(DEFAULT_BUDGETS.retry).toEqual({ Easy: 10, Medium: 15, Hard: 18 });
    expect(DEFAULT_BUDGETS.resolve).toEqual({ Easy: 15, Medium: 25, Hard: 30 });
    expect(DEFAULT_BUDGETS.blind).toEqual({ Easy: 15, Medium: 20, Hard: 25 });
  });

  it('applies partial overrides and falls back to the defaults for the rest', () => {
    const overrides: BudgetOverrides = { recall: { Medium: 7 }, new: { Hard: 60 } };
    // two-sum is Easy, 3sum Medium, trapping-rain-water Hard.
    expect(estimatedMinutes('recall', '3sum', overrides)).toBe(7);
    expect(estimatedMinutes('recall', 'two-sum', overrides)).toBe(5);
    expect(estimatedMinutes('recall', 'trapping-rain-water', overrides)).toBe(10);
    expect(estimatedMinutes('new', 'trapping-rain-water', overrides)).toBe(60);
    expect(estimatedMinutes('new', '3sum', overrides)).toBe(40);
    expect(estimatedMinutes('recall', 'made-up', overrides)).toBe(7); // unknown problem = Medium
  });

  it('never changes the benchmark budget', () => {
    expect(estimatedMinutes('benchmark', 'two-sum', { new: { Easy: 99 } })).toBe(30);
  });

  it('builds the full table shown in Settings', () => {
    const table = effectiveBudgets({ blind: { Hard: 45 } });
    expect(table.blind).toEqual({ Easy: 15, Medium: 20, Hard: 45 });
    expect(table.recall).toEqual(DEFAULT_BUDGETS.recall);
    expect(Object.keys(table).sort()).toEqual([...BUDGETED_TYPES].sort());
    expect(effectiveBudgets()).toEqual(DEFAULT_BUDGETS);
  });

  it('averages the Easy and Medium new budgets for the expected new problems', () => {
    expect(expectedNewMinutes()).toBe(33); // (25 + 40) / 2 rounded
    expect(expectedNewMinutes({ new: { Easy: 10, Medium: 20 } })).toBe(15);
  });
});

describe('budget overrides apply everywhere', () => {
  const overrides: BudgetOverrides = { new: { Easy: 10 }, recall: { Easy: 3 } };

  it('the planner budgets items, totals and the cap with the overrides', () => {
    const plan = planDay(withBudgets(overrides), day(1));
    const news = plan.items.filter((i) => i.activity.type === 'new');
    expect(news.map((i) => i.minutes)).toEqual([10, 10]); // two-sum, valid-anagram (Easy)
    expect(plan.plannedMinutes).toBe(30 + 30 + 10 + 10);
    expect(planDay(newState(), day(1)).plannedMinutes).toBe(110);
  });

  it('larger budgets leave room for fewer problems under the cap', () => {
    const plan = planDay(withBudgets({ new: { Easy: 100 } }), day(1));
    // 60 benchmark + 100 for the first Easy fits (160); a second one (260) does not.
    expect(plan.items.filter((i) => i.activity.type === 'new')).toHaveLength(1);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.capMinutes);
  });

  it('planDay takes the budgets of the settings argument', () => {
    const state = newState();
    const plan = planDay(state, day(1), { ...state.settings, budgets: overrides });
    expect(plan.items.filter((i) => i.activity.type === 'new').map((i) => i.minutes)).toEqual([10, 10]);
  });

  it('the projection uses them for future days', () => {
    const base = planAndComplete(newState(), day(1), 'two-sum', 'new', 'solo', 20);
    const custom: AppState = { ...base, settings: { ...base.settings, budgets: { recall: { Easy: 3 } } } };
    const recallMinutes = (state: AppState): number | undefined =>
      projectDay(state, day(2), day(2)).items.find((i) => i.type === 'recall' && i.slug === 'two-sum')
        ?.minutes;
    expect(recallMinutes(base)).toBe(5);
    expect(recallMinutes(custom)).toBe(3);
  });

  it('the calendar uses them for entries and day totals, including expected new problems', () => {
    const state = withBudgets({ new: { Easy: 10, Medium: 20 } });
    const days = calendarDays(state, day(1));
    const future = days.find((d) => d.date === day(3))!;
    const expectedNew = future.entries.filter((e) => e.type === 'new');
    expect(expectedNew.length).toBeGreaterThan(0);
    expect(expectedNew.every((e) => e.minutes === 15)).toBe(true);
    const today = days.find((d) => d.date === day(1))!;
    expect(today.entries.filter((e) => e.type === 'new').map((e) => e.minutes)).toEqual([10, 10]);
    const defaults = calendarDays(newState(), day(1)).find((d) => d.date === day(1))!;
    expect(defaults.plannedMinutes - today.plannedMinutes).toBe(30);
  });

  it('reminders sum the overridden budgets', () => {
    const noon = new Date(2025, 0, 6, 12).getTime(); // program day 1
    const defaults = summarizeToday(newState(), noon)!;
    const custom = summarizeToday(withBudgets(overrides), noon)!;
    expect(defaults.remainingMinutes - custom.remainingMinutes).toBe(30);
    expect(morningNotification(withBudgets({ new: { Easy: 10 } }), noon)?.message).toContain('~1h20');
  });

  it('applies to reviews scheduled later', () => {
    const state = simulateDay(withBudgets({ recall: { Easy: 3, Medium: 4 } }), day(1)).state;
    const recalls = planDay(state, day(2)).items.filter((i) => i.activity.type === 'recall');
    expect(recalls.length).toBeGreaterThan(0);
    for (const item of recalls) expect(item.minutes).toBeLessThanOrEqual(4);
  });
});

describe('settings.budgets validation', () => {
  const base = newState();
  const withSettings = (budgets: unknown): unknown => ({
    ...base,
    settings: { ...base.settings, budgets },
  });

  it('is optional: saved data without it stays valid and is not given one', () => {
    const restored = validateState(JSON.parse(serializeState(base)));
    expect(restored.settings).not.toHaveProperty('budgets');
    expect(validateState(withSettings(undefined)).settings).not.toHaveProperty('budgets');
  });

  it('round-trips partial overrides', () => {
    const state = withBudgets({ recall: { Medium: 12 }, new: { Easy: 20, Hard: 55 } });
    expect(deserializeState(serializeState(state))).toEqual(state);
  });

  it('drops empty overrides', () => {
    expect(validateState(withSettings({})).settings).not.toHaveProperty('budgets');
    expect(validateState(withSettings({ recall: {} })).settings).not.toHaveProperty('budgets');
  });

  it('accepts the boundaries 1 and 180', () => {
    const settings = validateState(withSettings({ blind: { Easy: 1, Hard: BUDGET_MAX_MINUTES } })).settings;
    expect(settings.budgets).toEqual({ blind: { Easy: 1, Hard: 180 } });
  });

  it('rejects unknown keys, non-integers and out-of-range values with a path', () => {
    expect(() => validateState(withSettings({ benchmark: { Easy: 30 } }))).toThrow(/settings\.budgets\.benchmark/);
    expect(() => validateState(withSettings({ recall: { Trivial: 3 } }))).toThrow(/Trivial/);
    expect(() => validateState(withSettings({ recall: { Easy: 0 } }))).toThrow(/settings\.budgets\.recall\.Easy/);
    expect(() => validateState(withSettings({ recall: { Easy: 181 } }))).toThrow(/recall\.Easy/);
    expect(() => validateState(withSettings({ recall: { Easy: 2.5 } }))).toThrow(/integer/);
    expect(() => validateState(withSettings({ recall: { Easy: '5' } }))).toThrow(/recall\.Easy/);
    expect(() => validateState(withSettings({ recall: { Easy: Number.NaN } }))).toThrow(/recall\.Easy/);
    expect(() => validateState(withSettings({ recall: 5 }))).toThrow(/settings\.budgets\.recall/);
    expect(() => validateState(withSettings([]))).toThrow(/settings\.budgets/);
    expect(() => validateState(withSettings('x'))).toThrow(/settings\.budgets/);
  });
});
