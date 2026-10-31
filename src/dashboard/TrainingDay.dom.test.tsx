// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import { materializeToday } from '../lib/commands';
import type { AppActions } from '../lib/actions';
import { TodayView } from './TodayView';
import { ProblemPanel } from '../sidepanel/ProblemPanel';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const at = (day: number, hour: number, minute = 0) => new Date(2025, 0, day, hour, minute).getTime();

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('training-day dashboard and side panel', () => {
  it('keeps the day-15 benchmarks at 01:00, then exposes them as catch-up after 04:00', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(31, 1));
    const state = materializeToday(defaultState('2025-01-16'), at(30, 23, 40));
    render(<TodayView state={state} actions={actions} />);
    expect(screen.getByRole('heading', { name: 'Day 15 of 30' })).toBeTruthy();
    expect(screen.getByText(/Training day:.*changes at 04:00/)).toBeTruthy();
    const benchmarks = state.activities.filter((a) => a.type === 'benchmark' && a.dueDate === '2025-01-30');
    expect(benchmarks).toHaveLength(2);
    for (const benchmark of benchmarks) {
      const card = document.querySelector(`.activity-title[href="#/problem/${benchmark.slug}"]`)!.closest('article')!;
      expect(within(card).getByRole('button', { name: 'Start' })).toBeTruthy();
    }
    act(() => vi.advanceTimersByTime(3 * 60 * 60_000));
    expect(screen.getByRole('heading', { name: 'Day 16 of 30' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Missed benchmarks (4)' })).toBeTruthy();
    expect(screen.getByText(/credits the current training day, not its original date/)).toBeTruthy();
  });

  it('updates an open side-panel Finish date automatically at the cutoff without losing edits', () => {
    const state = materializeToday(defaultState('2025-01-16'), at(30, 23, 40));
    const benchmark = state.activities.find((a) => a.type === 'benchmark' && a.dueDate === '2025-01-30')!;
    const started = { ...state, activities: state.activities.map((a) => a.id === benchmark.id
      ? { ...a, status: 'in_progress' as const, timer: { running: false, startedAt: null, accumulatedMs: 10 * 60_000 } } : a) };
    const page = (now: number) => <ProblemPanel state={started} actions={actions} now={now} slug={benchmark.slug}
      openDashboard={() => undefined} openProblem={() => undefined} />;
    const view = render(page(at(31, 3, 59)));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('radio', { name: /Solo/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time logged (min)' }), { target: { value: '17' } });
    expect(screen.getByText('2025-01-30')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Completed on' })).toBeNull();
    view.rerender(page(at(31, 4)));
    expect(screen.getByText('2025-01-31')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Solo/ })).toHaveProperty('checked', true);
    expect(screen.getByRole('spinbutton', { name: 'Time logged (min)' })).toHaveProperty('value', '17');
    expect(screen.getByRole('button', { name: 'Save result' })).toHaveProperty('disabled', false);
  });
});
