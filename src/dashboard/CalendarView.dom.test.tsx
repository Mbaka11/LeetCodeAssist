// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { defaultState } from '../core/state';
import { simulateDay } from '../core/testing';
import type { AppActions } from '../lib/actions';
import { errorFromStatus, utcDayStart, type ProfileCache } from '../lib/leetcodeProfile';
import { LEETCODE_PREFS_KEY, PROFILE_CACHE_KEY } from '../lib/leetcodeStorage';
import { createMockChromeStorage, flush, installChromeGlobal, type MockChromeStorage } from '../lib/testing';
import { CalendarView } from './CalendarView';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const today = localDateFromTimestamp(Date.now());

let mock: MockChromeStorage;
let messages: unknown[];

function profile(patch: Partial<ProfileCache> = {}): ProfileCache {
  const now = Date.now();
  const day = utcDayStart(now);
  return {
    username: 'neo',
    fetchedAt: now - 5 * 60_000,
    attemptedAt: now - 5 * 60_000,
    calendar: { reportedStreak: null, reportedActiveDays: null, activeYears: [], days: { [String(day)]: 2, [String(day - 86_400)]: 1 } },
    ...patch,
  };
}

async function renderCalendar(cache: ProfileCache | null, state = defaultState(today)) {
  mock.data[LEETCODE_PREFS_KEY] = { detectionEnabled: true, username: 'neo' };
  if (cache) mock.data[PROFILE_CACHE_KEY] = cache;
  const view = render(<CalendarView state={state} actions={actions} />);
  await waitFor(() => expect(view.container.querySelector('.streak-footer')).toBeTruthy());
  await act(flush);
  return view;
}

beforeEach(() => {
  mock = createMockChromeStorage();
  messages = installChromeGlobal(mock);
});
afterEach(cleanup);

describe('CalendarView compact layout structure (DOM)', () => {
  it('has the overview and the streak card in one summary row followed by the day grid and detail (activity minutes live in Logs)', async () => {
    const { container } = await renderCalendar(profile());
    const root = container.firstElementChild!;
    const children = [...root.children].map((el) => el.className.split(' ')[0]);
    expect(children).toEqual(['cal-summary', 'calendar-grid', 'card']);
    expect(container.querySelector('.activity-heatmap')).toBeNull();
    const summary = root.querySelector('.cal-summary')!;
    expect([...summary.children].map((el) => el.className)).toEqual(['card cal-overview', 'card cal-streak']);
    expect(container.querySelectorAll('.calendar-grid .cal-day')).toHaveLength(30);
  });

  it('shows Refresh, the username, the age and the compact numbers in the streak card', async () => {
    const { container } = await renderCalendar(profile());
    const card = container.querySelector<HTMLElement>('.cal-streak')!;
    expect(within(card).getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Open the LeetCode profile of neo' }).textContent).toBe('@neo ↗');
    expect(within(card).getByText('Updated 5 min ago')).toBeTruthy();
    expect(within(card).getByText('Current')).toBeTruthy();
    expect(within(card).getByText('Longest')).toBeTruthy();
    expect(within(card).getByText('Active days')).toBeTruthy();
    expect(card.querySelectorAll('.heat-week')).toHaveLength(16);
    expect(card.querySelector('.heat-grid-compact')).toBeTruthy();
  });

  it('clicking Refresh asks the background worker for a forced refresh', async () => {
    const { container } = await renderCalendar(profile());
    messages.length = 0;
    fireEvent.click(within(container.querySelector<HTMLElement>('.cal-streak')!).getByRole('button', { name: 'Refresh' }));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ force: true });
  });

  it('keeps Refresh visible while paused (disabled) and in an error state', async () => {
    const paused = await renderCalendar(profile({ blockedUntil: Date.now() + 10 * 60_000 }));
    const button = within(paused.container.querySelector<HTMLElement>('.cal-streak')!).getByRole('button', {
      name: 'Refresh paused',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(paused.container.querySelector('.cal-streak')!.textContent).toContain('retry in');
    cleanup();

    const failed = await renderCalendar(profile({ error: errorFromStatus(500) }));
    const card = failed.container.querySelector<HTMLElement>('.cal-streak')!;
    expect(within(card).getByRole('alert').textContent).toContain('server problem');
    expect(within(card).getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(within(card).getByText(/Updated/)).toBeTruthy();
  });

  it('keeps the start date editor and the explanations behind keyboard-reachable details controls', async () => {
    const { container } = await renderCalendar(profile());
    const details = [...container.querySelectorAll<HTMLDetailsElement>('.cal-overview details')];
    expect(details.map((d) => d.querySelector('summary')!.textContent)).toEqual([
      'How these are counted',
      'Change start date',
    ]);
    expect(details.every((d) => !d.open)).toBe(true);
    const startDate = details[1]!;
    expect(within(startDate).getByLabelText('Program start (day 1)')).toBeTruthy();
    expect(within(startDate).getByRole('button', { name: 'Save start date' })).toBeTruthy();
  });

  it('shows today by default and switches the detail with one click on a day', async () => {
    const { container } = await renderCalendar(profile(), defaultState(addDays(today, -2)));
    expect(container.querySelector('.calendar-grid + section h2')!.textContent).toMatch(/^Day 3 ·/);
    const first = container.querySelectorAll<HTMLElement>('.cal-day')[0]!;
    fireEvent.click(first);
    expect(container.querySelector('.calendar-grid + section h2')!.textContent).toMatch(/^Day 1 ·/);
    expect(first.getAttribute('aria-pressed')).toBe('true');
  });

  it('still opens the day popover on focus and closes it with Escape', async () => {
    const { container } = await renderCalendar(profile());
    const cell = container.querySelectorAll<HTMLElement>('.cal-cell')[1]!;
    const popover = cell.querySelector<HTMLElement>('.cal-popover')!;
    expect(popover.hidden).toBe(true);
    fireEvent.focus(cell.querySelector('button')!);
    expect(popover.hidden).toBe(false);
    expect(cell.querySelector('button')!.getAttribute('aria-describedby')).toBe(popover.id);
    expect(within(popover).getByText('projected')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(popover.hidden).toBe(true);
    fireEvent.mouseEnter(cell);
    expect(popover.hidden).toBe(false);
    fireEvent.mouseLeave(cell);
    expect(popover.hidden).toBe(true);
  });

  it('shows the worked total on the overview with the breakdown', async () => {
    const start = addDays(today, -1);
    const state = simulateDay(defaultState(start), start, { bonus: true }).state;
    const { container } = await renderCalendar(profile(), state);
    const total = container.querySelector<HTMLElement>('.cal-overview .worked-total')!;
    expect(total.textContent).toContain('6problems worked');
    expect(total.textContent).toContain('Program 2/50 · Benchmarks 2/6 · Bonus 2');
  });
});
