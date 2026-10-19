// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import { planDay } from '../core/planner';
import { defaultState } from '../core/state';
import type { Activity } from '../core/types';
import { groupActivities } from '../lib/groupActivities';
import type { AppActions } from '../lib/actions';
import { TodayView } from './TodayView';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
describe('Today unfinished-first display', () => {
  it('keeps unfinished cards above finished cards while preserving each partition’s plan order', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2025, 0, 8, 12).getTime());
    const make = (slug: string, done: boolean): Activity => ({
      ...createActivity([], { slug, type: 'recall', dueDate: '2025-01-08', createdAt: '2025-01-07' }),
      ...(done ? { status: 'done' as const, completedAt: '2025-01-08', outcome: 'solo' as const, totalMs: 300_000 } : {}),
    });
    const state = { ...defaultState('2025-01-06'), activities: [make('two-sum', true), make('valid-anagram', false),
      make('best-time-to-buy-and-sell-stock', true), make('top-k-frequent-elements', false)] };
    const before = structuredClone(state);
    const plan = planDay(state, '2025-01-08');
    const groups = groupActivities(plan.items, state.activities);
    const open = groups.filter((g) => g.items.some((i) => i.activity.status !== 'done'));
    const done = groups.filter((g) => g.items.every((i) => i.activity.status === 'done'));
    const { container } = render(<TodayView state={state} actions={actions} />);
    const shown = [...container.querySelectorAll('.problem-groups')][0]!;
    const slugs = [...shown.querySelectorAll('.activity-title')].map((a) => decodeURIComponent(a.getAttribute('href')!.split('/').at(-1)!));
    expect(slugs).toEqual([...open, ...done].map((g) => g.slug));
    expect(done.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    expect(state).toEqual(before);
    for (const link of shown.querySelectorAll('.activity-leetcode')) expect(link.parentElement?.classList.contains('has-leetcode-link')).toBe(true);
  });
});
