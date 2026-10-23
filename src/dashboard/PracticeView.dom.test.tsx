// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavBar } from '../components/NavBar';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { parseRoute } from '../lib/route';
import { createTestApp } from '../lib/testing';
import { PracticeView } from './PracticeView';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
async function setup(initial: AppState = { ...defaultState('2025-01-01'), checked: { 'two-sum': true } }) {
  const app = createTestApp(initial);
  function Harness() {
    const snapshot = useSyncExternalStore(app.store.subscribe, app.store.getSnapshot);
    return snapshot.status === 'ready' ? <PracticeView state={snapshot.state} actions={app.actions} /> : null;
  }
  render(<Harness />);
  await screen.findByRole('button', { name: 'Start interview' });
  return app;
}
function choose(label: string, value: string) { fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } }); }

describe('Practice route and optional interviews', () => {
  it('exposes a dashboard nav item and route', () => {
    expect(parseRoute('#/practice')).toEqual({ view: 'practice' });
    render(<NavBar route={{ view: 'practice' }} />);
    expect(screen.getByRole('link', { name: 'Practice' }).getAttribute('href')).toBe('#/practice');
    expect(screen.getByRole('link', { name: 'Practice' }).getAttribute('aria-current')).toBe('page');
  });
  it('starts, counts down, ticks checklist, self-rates and saves to isolated history without program mutation', async () => {
    let now = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { store } = await setup();
    const initial = await store.readState();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    const active = screen.getByLabelText('Active interview');
    expect(within(active).getByRole('heading', { name: 'Two Sum' })).toBeTruthy();
    expect(within(active).getByRole('timer').textContent).toBe('35:00');
    expect(within(active).getByRole('link', { name: 'Open on LeetCode' }).getAttribute('href')).toContain('/two-sum/');
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expect(screen.queryByText('Hashing')).toBeNull();
    expect(screen.queryByLabelText('Interview history')).toBeNull();
    expect(screen.queryByLabelText('Category', { exact: true })).toBeNull();
    fireEvent.click(screen.getByLabelText('Clarify requirements'));
    fireEvent.click(screen.getByLabelText('Communicate'));
    now += 60_000;
    act(() => vi.advanceTimersByTime(1000));
    expect(within(active).getByRole('timer').textContent).toBe('34:00');
    expect(await store.readState()).toEqual(initial);
    fireEvent.click(screen.getByRole('button', { name: 'End interview' }));
    choose('Self-rating', 'solved');
    fireEvent.change(screen.getByLabelText('Short reflection'), { target: { value: 'Discuss assumptions first.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save interview result' }));
    await screen.findByLabelText('Interview history');
    expect(screen.getByText('Discuss assumptions first.')).toBeTruthy();
    const after = await store.readState();
    const record = Object.values(after.simulations ?? {})[0]!;
    expect(record).toMatchObject({ createdAt: 100_000, endedAt: 160_000, durationMs: 60_000, targetMinutes: 35, slug: 'two-sum', mode: 'global', outcome: 'solved', checklist: { clarify: true, communicate: true }, reflection: 'Discuss assumptions first.' });
    expect(after).toEqual({ ...initial, simulations: { [record.id]: record } });
  });
  it('shows expiry without auto-saving or program changes, and permits explicit discard', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { store } = await setup();
    const before = await store.readState();
    choose('Interview length', '25');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    now = 26 * 60_000;
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer').textContent).toBe('0:00');
    expect(screen.getByText(/Time is up/)).toBeTruthy();
    expect(await store.readState()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Discard session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard interview' }));
    expect(screen.getByRole('button', { name: 'Start interview' })).toBeTruthy();
    expect(await store.readState()).toEqual(before);
  });
  it('starts with no unworked spoilers and supports explicit pool/difficulty/category choices', async () => {
    const { store } = await setup(defaultState('2025-01-01'));
    expect((screen.getByRole('button', { name: 'Start interview' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No matching problems/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Include unworked catalog/));
    choose('Difficulty', 'Easy'); choose('Category', 'Arrays & Hashing');
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.getByLabelText('Active interview')).toBeTruthy();
    expect((await store.readState()).activities).toEqual([]);
  });
  it('lists disabled insufficient companies, enables distinct >=5 pools and preserves evidence/caveats after saving', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { store } = await setup(defaultState('2025-01-01'));
    const pool = screen.getByLabelText('Interview pool');
    for (const name of ['Shopify', 'Stripe', 'Datadog', 'Snowflake']) {
      const option = within(pool).getByRole('option', { name: `${name} — Not enough documented data` }) as HTMLOptionElement;
      expect(option.disabled).toBe(true);
    }
    for (const name of ['Google', 'Amazon', 'Microsoft', 'Meta', 'Apple', 'Uber', 'Bloomberg', 'NVIDIA']) {
      expect((within(pool).getByRole('option', { name: new RegExp(`${name} — .*documented topics`) }) as HTMLOptionElement).disabled).toBe(false);
    }
    choose('Interview pool', 'google');
    expect(screen.getByText(/not independently confirmed or employer-endorsed/)).toBeTruthy();
    expect(screen.getByText(/No pattern-similar fallback/)).toBeTruthy();
    expect(screen.getByText(/AI-reworded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.queryByText('Reported at Google — canonical topic')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'End interview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save interview result' }));
    const history = await screen.findByLabelText('Interview history');
    expect(within(history).getByText('Reported at Google — canonical topic')).toBeTruthy();
    expect(within(history).getByRole('link', { name: /Google.*L4.*Aug 2026/ }).getAttribute('href')).toContain('interviewexperiences.in');
    expect(within(history).getByText(/uncorroborated self-report/)).toBeTruthy();
    const after = await store.readState();
    expect(Object.values(after.simulations ?? {})[0]).toMatchObject({ companyId: 'google', slug: 'two-sum', mode: 'company' });
    expect(after.activities).toEqual([]); expect(after.checked).toEqual({}); expect(after.problemStatus).toEqual({});
  });
  it('surfaces save failure without discarding reflection and supports retry', async () => {
    const { actions, store } = await setup();
    const save = vi.spyOn(actions, 'saveSimulation').mockRejectedValueOnce(new Error('Storage is full'));
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    fireEvent.click(screen.getByRole('button', { name: 'End interview' }));
    fireEvent.change(screen.getByLabelText('Short reflection'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save interview result' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Storage is full');
    expect((screen.getByLabelText('Short reflection') as HTMLTextAreaElement).value).toBe('Keep me');
    expect((await store.readState()).simulations).toBeUndefined();
    save.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Save interview result' }));
    await screen.findByLabelText('Interview history');
    expect(Object.values((await store.readState()).simulations ?? {})).toHaveLength(1);
  });
});

describe('Practice drills', () => {
  it('scores immediate correct feedback, saves short sessions and leaves mandatory data unchanged', async () => {
    const { store } = await setup();
    const before = await store.readState();
    fireEvent.click(screen.getByRole('button', { name: 'Pattern drills' }));
    choose('Question kind', 'outline');
    fireEvent.click(screen.getByRole('button', { name: 'Start drills' }));
    expect(screen.getByText('Question 1/1')).toBeTruthy();
    expect(screen.getByText('Locate two different positions whose values reach a target total.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /For each value, look up target/ }));
    expect(screen.getByText('Correct', { exact: true })).toBeTruthy();
    expect(screen.getByText(/Earlier-value lookup finds a partner/)).toBeTruthy();
    expect(within(screen.getByLabelText('Answer choices')).getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(await store.readState()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Finish drills' }));
    expect(screen.getByText('Session score: 1/1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save drill score' }));
    await screen.findByLabelText('Drill history');
    const after = await store.readState();
    const record = Object.values(after.drillSessions ?? {})[0]!;
    expect(record).toMatchObject({ score: 1, total: 1, includeUnworked: false, answers: [{ slug: 'two-sum', kind: 'outline', correct: true }] });
    expect(after).toEqual({ ...before, drillSessions: { [record.id]: record } });
  });
  it('advances a mixed N-question session with one score contribution per first choice', async () => {
    const { store } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pattern drills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start drills' }));
    for (let index = 0; index < 3; index++) {
      expect(screen.getByText(`Question ${index + 1}/3`)).toBeTruthy();
      const choices = within(screen.getByLabelText('Answer choices'));
      const correct = choices.queryByRole('button', { name: 'Hashing' }) ?? choices.queryByRole('button', { name: 'Hash Table' }) ?? choices.getByRole('button', { name: /For each value, look up target/ });
      fireEvent.click(correct);
      fireEvent.click(screen.getByRole('button', { name: index === 2 ? 'Finish drills' : 'Next question' }));
    }
    expect(screen.getByText('Session score: 3/3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save drill score' }));
    await screen.findByLabelText('Drill history');
    const record = Object.values((await store.readState()).drillSessions ?? {})[0]!;
    expect(record.score).toBe(3);
    expect(new Set(record.answers.map((answer) => answer.kind)).size).toBe(3);
  });

  it('explains an incorrect answer and records zero rather than permitting a second guess', async () => {
    const { store } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pattern drills' }));
    choose('Question kind', 'outline');
    fireEvent.click(screen.getByRole('button', { name: 'Start drills' }));
    fireEvent.click(screen.getByRole('button', { name: /Store the current value first/ }));
    expect(screen.getByText('Not quite')).toBeTruthy();
    expect(screen.getByText(/could match itself/)).toBeTruthy();
    expect(screen.getByText(/Intended answer: For each value/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish drills' }));
    expect(screen.getByText('Session score: 0/1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save drill score' }));
    await screen.findByLabelText('Drill history');
    expect(Object.values((await store.readState()).drillSessions ?? {})[0]?.score).toBe(0);
  });
  it('requires explicit hint enablement when techniques are hidden; unworked outlines remain unavailable', async () => {
    const state = defaultState('2025-01-01'); state.settings.roadmapHideTechniques = true;
    await setup(state);
    fireEvent.click(screen.getByRole('button', { name: 'Pattern drills' }));
    const start = () => screen.getByRole('button', { name: 'Start drills' }) as HTMLButtonElement;
    expect(start().disabled).toBe(true);
    expect((screen.getByLabelText('Show hint-based drills') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText(/Include unworked problems — warning/));
    expect(start().disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Show hint-based drills'));
    expect(start().disabled).toBe(false);
    choose('Question kind', 'outline'); expect(start().disabled).toBe(true);
    choose('Question kind', 'technique'); expect(start().disabled).toBe(false);
    fireEvent.click(start());
    expect(screen.getByText('Which is a useful technique?')).toBeTruthy();
    expect(screen.queryByText('Which pseudo-code outline is correct?')).toBeNull();
  });
  it('moves keyboard focus to Next after an answer disables the choices, and to Finish on the last question', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pattern drills' }));
    choose('Question kind', 'outline');
    fireEvent.click(screen.getByRole('button', { name: 'Start drills' }));
    const first = within(screen.getByLabelText('Answer choices')).getAllByRole('button')[0]!;
    first.focus();
    fireEvent.click(first);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Finish drills' })));
  });
  it('asks before NavBar leaves an active interview or drill session, and not otherwise', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await setup();
    render(<NavBar route={{ view: 'practice' }} />);
    const leave = (): boolean => fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(leave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(leave()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String(confirm.mock.calls[0]![0])).toContain('discarded');
    // Choosing "leave" lets the navigation proceed; the current view is never prompted for.
    confirm.mockReturnValue(true);
    expect(leave()).toBe(true);
    expect(fireEvent.click(screen.getByRole('link', { name: 'Practice' }))).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Discard session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard interview' }));
    expect(leave()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Pattern drills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start drills' }));
    confirm.mockReturnValue(false);
    expect(leave()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(3);
  });
});
