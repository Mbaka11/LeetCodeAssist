// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavBar } from '../components/NavBar';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { createTestApp } from '../lib/testing';
import { PracticeView } from './PracticeView';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const TWO_WORKED: AppState = { ...defaultState('2025-01-01'), checked: { 'two-sum': true, 'valid-anagram': true } };
const MIN = 60_000;
let now = 1_000_000;

async function setup(initial: AppState = TWO_WORKED) {
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const app = createTestApp(initial);
  function Harness() {
    const snapshot = useSyncExternalStore(app.store.subscribe, app.store.getSnapshot);
    return snapshot.status === 'ready' ? <PracticeView state={snapshot.state} actions={app.actions} /> : null;
  }
  render(<Harness />);
  await screen.findByRole('button', { name: 'Start interview' });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  return app;
}
/** Moves the clock and lets the one-second UI tick pick it up. */
function advance(ms: number) { now += ms; act(() => vi.advanceTimersByTime(1000)); }
const headingText = (pattern: RegExp) => screen.getByRole('heading', { name: pattern }).textContent!;
const startSession = () => fireEvent.click(screen.getByRole('button', { name: 'Start two-problem session' }));

describe('Two-problem interview session', () => {
  it('runs both problems with a skipped break, per-problem checklist and rating, then saves linked records', async () => {
    const { store } = await setup();
    const initial = await store.readState();
    startSession();
    const active = screen.getByLabelText('Active two-problem session');
    const first = headingText(/^Problem 1 of 2: /).replace('Problem 1 of 2: ', '');
    expect(within(active).getByRole('link', { name: 'Open on LeetCode' })).toBeTruthy();
    expect(within(active).getByRole('timer', { name: 'Problem time elapsed' }).textContent).toBe('0:00');
    // No spoilers or history while a session is active.
    expect(screen.queryByLabelText('Interview history')).toBeNull();
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expect(screen.queryByText('Hashing')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByLabelText('Clarify requirements'));
    fireEvent.click(screen.getByLabelText('Code'));
    advance(10 * MIN);
    expect(screen.getByRole('timer', { name: 'Problem time elapsed' }).textContent).toBe('10:00');
    expect(await store.readState()).toEqual(initial);
    fireEvent.click(screen.getByRole('button', { name: 'End problem 1' }));
    fireEvent.change(screen.getByLabelText('Self-rating'), { target: { value: 'solved' } });
    fireEvent.change(screen.getByLabelText('Short reflection'), { target: { value: 'First went fine.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to break' }));
    // Break screen: second problem still hidden, break is skippable.
    expect(screen.getByRole('timer', { name: 'Break time remaining' }).textContent).toBe('5:00');
    expect(screen.queryByRole('heading', { name: /Problem 2 of 2/ })).toBeNull();
    advance(2 * MIN);
    expect(screen.getByRole('timer', { name: 'Break time remaining' }).textContent).toBe('3:00');
    fireEvent.click(screen.getByRole('button', { name: 'Skip break' }));
    const second = headingText(/^Problem 2 of 2: /).replace('Problem 2 of 2: ', '');
    expect(second).not.toBe(first);
    // The break is not part of the second problem's time.
    expect(screen.getByRole('timer', { name: 'Problem time elapsed' }).textContent).toBe('0:00');
    fireEvent.click(screen.getByLabelText('Communicate'));
    advance(20 * MIN);
    fireEvent.click(screen.getByRole('button', { name: 'End problem 2' }));
    fireEvent.change(screen.getByLabelText('Self-rating'), { target: { value: 'not' } });
    fireEvent.click(screen.getByRole('button', { name: 'View session summary' }));
    const summary = screen.getByLabelText('Session summary');
    expect(within(summary).getByText(/Total time: 30:00/)).toBeTruthy();
    expect(within(summary).getByText(/Checklist completion 3\/16/)).toBeTruthy();
    expect(within(summary).getByText(/Solved · 10:00 · Checklist 2\/8/)).toBeTruthy();
    expect(within(summary).getByText(/Not solved · 20:00 · Checklist 1\/8/)).toBeTruthy();
    expect(within(summary).getByText('First went fine.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Session reflection'), { target: { value: 'Pace the second one better.' } });
    expect(await store.readState()).toEqual(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));
    const history = await screen.findByLabelText('Interview history');
    const entry = within(history).getByLabelText('Two-problem session');
    expect(within(entry).getByText(/Total time 30:00 · Checklist 3\/16 · Outcomes: solved, not solved/)).toBeTruthy();
    expect(within(entry).getByText('Pace the second one better.')).toBeTruthy();
    expect(within(entry).getByRole('heading', { name: `Problem 1: ${first}` })).toBeTruthy();
    expect(within(entry).getByRole('heading', { name: `Problem 2: ${second}` })).toBeTruthy();
    const after = await store.readState();
    const [one, two] = Object.values(after.simulations!).sort((a, b) => a.part! - b.part!);
    expect(after.simulations).toBeDefined();
    expect(Object.keys(after.simulations!)).toHaveLength(2);
    expect(one).toMatchObject({ part: 1, outcome: 'solved', durationMs: 10 * MIN, targetMinutes: 45, mode: 'global', reflection: 'First went fine.', checklist: { clarify: true, code: true, communicate: false } });
    expect(two).toMatchObject({ part: 2, outcome: 'not', durationMs: 20 * MIN, sessionReflection: 'Pace the second one better.', checklist: { communicate: true, clarify: false } });
    expect(one!.sessionReflection).toBeUndefined();
    expect(one!.sessionId).toBeTruthy();
    expect(one!.sessionId).toBe(two!.sessionId);
    expect(two!.createdAt).toBeGreaterThanOrEqual(one!.endedAt);
    // Nothing but the two records changed: no activity, status, check or program data.
    expect(after).toEqual({ ...initial, simulations: after.simulations });
  });

  it('shows the 45-minute reminder banner for each problem, without saving or stopping the timer', async () => {
    const { store } = await setup();
    const initial = await store.readState();
    startSession();
    advance(44 * MIN + 59_000);
    expect(screen.queryByRole('status')).toBeNull();
    advance(1000);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('45 minutes reached for this problem');
    advance(5 * MIN);
    expect(screen.getByRole('timer', { name: 'Problem time elapsed' }).textContent).toBe('50:00');
    expect(screen.getByRole('status')).toBeTruthy();
    expect(await store.readState()).toEqual(initial);
    fireEvent.click(screen.getByRole('button', { name: 'End problem 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to break' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip break' }));
    // The second problem has its own clock and its own banner.
    expect(screen.queryByText(/45 minutes reached/)).toBeNull();
    advance(45 * MIN);
    expect(screen.getByText(/45 minutes reached/)).toBeTruthy();
  });

  it('offers to start problem 2 once the five-minute break is over, and never starts it by itself', async () => {
    await setup();
    startSession();
    fireEvent.click(screen.getByRole('button', { name: 'End problem 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to break' }));
    advance(5 * MIN);
    expect(screen.getByRole('timer', { name: 'Break time remaining' }).textContent).toBe('0:00');
    expect(screen.getByText('Break over.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip break' })).toBeNull();
    advance(10 * MIN);
    expect(screen.queryByRole('heading', { name: /Problem 2 of 2/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start problem 2' }));
    expect(screen.getByRole('heading', { name: /Problem 2 of 2/ })).toBeTruthy();
    expect(screen.getByRole('timer', { name: 'Problem time elapsed' }).textContent).toBe('0:00');
  });

  it('goes straight to problem 2 when the break option is off', async () => {
    await setup();
    fireEvent.click(screen.getByLabelText(/5-minute break between the problems/));
    startSession();
    fireEvent.click(screen.getByRole('button', { name: 'End problem 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start problem 2' }));
    expect(screen.queryByLabelText('Break')).toBeNull();
    expect(screen.getByRole('heading', { name: /Problem 2 of 2/ })).toBeTruthy();
  });

  it('needs two eligible problems, and the single-problem simulation still works', async () => {
    const { store } = await setup({ ...defaultState('2025-01-01'), checked: { 'two-sum': true } });
    const start = screen.getByRole('button', { name: 'Start two-problem session' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText(/needs at least two eligible problems/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    fireEvent.click(screen.getByRole('button', { name: 'End interview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save interview result' }));
    await screen.findByLabelText('Interview history');
    const record = Object.values((await store.readState()).simulations!)[0]!;
    expect(record.sessionId).toBeUndefined();
    expect(record.part).toBeUndefined();
  });

  it('draws from an enabled company pool and saves company mode on both records', async () => {
    const { store } = await setup(defaultState('2025-01-01'));
    fireEvent.change(screen.getByLabelText('Interview pool', { exact: true }), { target: { value: 'google' } });
    startSession();
    for (const label of ['End problem 1', 'Continue to break', 'Skip break', 'End problem 2', 'View session summary', 'Save session']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    await screen.findByLabelText('Interview history');
    const records = Object.values((await store.readState()).simulations!);
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.mode === 'company' && r.companyId === 'google')).toBe(true);
    expect(new Set(records.map((r) => r.slug)).size).toBe(2);
    // Per-problem evidence appears only after saving.
    expect(within(screen.getByLabelText('Interview history')).getAllByText(/Reported at Google/).length).toBeGreaterThan(0);
  });

  it('keeps the unsaved session on a save failure and retries', async () => {
    const { actions, store } = await setup();
    const save = vi.spyOn(actions, 'saveSimulationSession').mockRejectedValueOnce(new Error('Storage is full'));
    startSession();
    for (const label of ['End problem 1', 'Continue to break', 'Skip break', 'End problem 2', 'View session summary']) fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.change(screen.getByLabelText('Session reflection'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Storage is full');
    expect((screen.getByLabelText('Session reflection') as HTMLTextAreaElement).value).toBe('Keep me');
    expect((await store.readState()).simulations).toBeUndefined();
    save.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));
    await screen.findByLabelText('Interview history');
    expect(Object.values((await store.readState()).simulations ?? {})).toHaveLength(2);
  });

  it('asks before leaving and can discard the whole session without saving anything', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { store } = await setup();
    const initial = await store.readState();
    render(<NavBar route={{ view: 'practice' }} />);
    startSession();
    expect(fireEvent.click(screen.getByRole('link', { name: 'Settings' }))).toBe(false);
    expect(String(confirm.mock.calls[0]![0])).toContain('discarded');
    expect((screen.getByRole('button', { name: 'Interview prep' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard two-problem session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard session' }));
    expect(screen.getByRole('button', { name: 'Start two-problem session' })).toBeTruthy();
    expect(fireEvent.click(screen.getByRole('link', { name: 'Settings' }))).toBe(true);
    expect(await store.readState()).toEqual(initial);
  });
});
