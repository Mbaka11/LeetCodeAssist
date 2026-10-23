// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import { localDateFromTimestamp } from '../core/dates';
import { getProblemMetadata } from '../core/problemMetadata';
import { defaultState } from '../core/state';
import { ProblemView } from '../dashboard/ProblemView';
import type { AppActions } from '../lib/actions';
import { ProblemPanel } from '../sidepanel/ProblemPanel';
import { ProblemMetadataSection } from './ProblemMetadata';

afterEach(cleanup);
const actions = new Proxy({}, { get: () => vi.fn(() => Promise.resolve()) }) as AppActions;
function metadataRegion() { return screen.getByRole('region', { name: 'Problem metadata' }); }
function expand() {
  const details = metadataRegion().querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
}

describe('shared problem metadata', () => {
  it('shows qualified evidence with its public source, honest dates and disclaimer', () => {
    render(<ProblemMetadataSection slug="lru-cache" state={defaultState('2025-01-06')} />);
    expect(screen.getByText('Reported at Amazon — LRU Cache variation')).toBeTruthy();
    expect(screen.getByText(/exact canonical question is not verified/)).toBeTruthy();
    expect(screen.getByText(/not independently confirmed or employer-endorsed/)).toBeTruthy();
    expect(screen.getByText(/Publication date: unknown.*Interview date: 12\/13, year unknown/)).toBeTruthy();
    expect(screen.getAllByText(/not a fresh source check/).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/may mirror or rewrite other reports/).length).toBeGreaterThan(0);
    const link = screen.getByRole('link', { name: /Amazon India/ });
    expect(link.getAttribute('href')).toBe('https://leetcode.com/discuss/post/6304191/Amazon-India-or-SDE-1-or-University-Grad/');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows curated similar questions, difficulty, own progress, rationale and both destinations without scheduling', () => {
    const state = { ...defaultState('2025-01-06'), checked: { '3sum': true }, problemStatus: { 'contains-duplicate': 'mastered' as const } };
    render(<ProblemMetadataSection slug="two-sum" state={state} />);
    expect(screen.getByText('Reported at Google — canonical topic')).toBeTruthy();
    expect(screen.getByText('Mastered')).toBeTruthy();
    expect(screen.getByText('Checked solved')).toBeTruthy();
    const similar = metadataRegion().querySelector('.metadata-similar')!;
    expect(similar.querySelectorAll('li')).toHaveLength(getProblemMetadata('two-sum')!.similarProblems.length);
    expect(within(similar as HTMLElement).getAllByText('Medium').length).toBeGreaterThan(0);
    expect(screen.getByText('Sorted input changes the pair-search tradeoffs.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '3Sum' }).getAttribute('href')).toBe('#/problem/3sum');
    expect(similar.querySelector('a[href="https://leetcode.com/problems/3sum/"]')).toBeTruthy();
    expect(state.activities).toEqual([]);
    expect(screen.queryByRole('button', { name: /Start|Schedule/ })).toBeNull();
  });

  it('keeps absent company associations explicitly unknown', () => {
    render(<ProblemMetadataSection slug="binary-search" state={defaultState('2025-01-06')} />);
    expect(screen.getByText(/Not documented for this problem/)).toBeTruthy();
    expect(screen.getByText(/Missing evidence does not mean/)).toBeTruthy();
  });

  it('protects review/hide-hint content until explicit disclosure and resets for a new slug', () => {
    const state = defaultState('2025-01-06');
    const { rerender } = render(<ProblemMetadataSection key="two-sum" slug="two-sum" state={state} protectedReview />);
    expect(metadataRegion().querySelector('details')!.open).toBe(false);
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expect(screen.queryByText('Sorted input changes the pair-search tradeoffs.')).toBeNull();
    expand();
    expect(screen.getByLabelText('Data structures and techniques')).toBeTruthy();
    rerender(<ProblemMetadataSection key="lru-cache" slug="lru-cache" state={state} collapsed />);
    expect(metadataRegion().querySelector('details')!.open).toBe(false);
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    rerender(<ProblemMetadataSection key="hidden" slug="two-sum" state={{ ...state, settings: { ...state.settings, roadmapHideTechniques: true } }} />);
    expect(metadataRegion().querySelector('details')!.open).toBe(false);
  });

  it('integrates in the problem sheet; review transition and slug change reset an expanded section', () => {
    const now = Date.now();
    const today = localDateFromTimestamp(now);
    const state = defaultState(today);
    const { rerender } = render(<ProblemView slug="two-sum" state={state} actions={actions} />);
    expect(metadataRegion().querySelector('details')!.open).toBe(true);
    const review = createActivity([], { slug: 'two-sum', type: 'recall', dueDate: today, createdAt: today });
    rerender(<ProblemView slug="two-sum" state={{ ...state, activities: [review] }} actions={actions} />);
    expect(metadataRegion().querySelector('details')!.open).toBe(false);
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expand();
    rerender(<ProblemView slug="valid-anagram" state={state} actions={actions} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Valid Anagram');
    expect(screen.queryByText('Sorted input changes the pair-search tradeoffs.')).toBeNull();
  });

  it.each(['rebuild', 'resolve', 'blind', 'retry'] as const)('keeps %s review hints and recommendation rationales unmounted until disclosure', (type) => {
    const today = localDateFromTimestamp(Date.now());
    const state = defaultState(today);
    const activity = createActivity([], { slug: 'two-sum', type, dueDate: today, createdAt: today });
    render(<ProblemView slug="two-sum" state={{ ...state, activities: [activity] }} actions={actions} />);
    expect(metadataRegion().querySelector('details')!.open).toBe(false);
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expect(screen.queryByText('Sorted input changes the pair-search tradeoffs.')).toBeNull();
    expand();
    expect(screen.getByLabelText('Data structures and techniques')).toBeTruthy();
    expect(screen.getByText('Sorted input changes the pair-search tradeoffs.')).toBeTruthy();
  });

  it('preserves an open Finish form and independent timer records across disclosure/settings rerenders', () => {
    const now = Date.now();
    const today = localDateFromTimestamp(now);
    const activity = { ...createActivity([], { slug: 'two-sum', type: 'recall', dueDate: today, createdAt: today }), status: 'in_progress' as const,
      timer: { startedAt: null, accumulatedMs: 300_000, running: false } };
    const other = { ...createActivity([activity], { slug: 'valid-anagram', type: 'resolve', dueDate: today, createdAt: today }), status: 'in_progress' as const,
      timer: { startedAt: now - 60_000, accumulatedMs: 120_000, running: true } };
    const state = { ...defaultState(today), activities: [activity, other] };
    const props = { state, actions, now, openDashboard: vi.fn(), openProblem: vi.fn(), slug: 'two-sum' };
    const { rerender } = render(<ProblemPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    const minutes = screen.getByRole('spinbutton', { name: 'Time logged (min)' }) as HTMLInputElement;
    fireEvent.change(minutes, { target: { value: '17' } });
    expand();
    rerender(<ProblemPanel {...props} now={now + 1000} state={{ ...state, settings: { ...state.settings, roadmapDetail: 'detailed' } }} />);
    expect(screen.getByRole('spinbutton', { name: 'Time logged (min)' })).toBe(minutes);
    expect(minutes.value).toBe('17');
    expect((screen.getByRole('radio', { name: /Hint/ }) as HTMLInputElement).checked).toBe(true);
    expect(state.activities.map((a) => a.timer)).toEqual([
      { startedAt: null, accumulatedMs: 300_000, running: false },
      { startedAt: now - 60_000, accumulatedMs: 120_000, running: true },
    ]);
  });

  it('is collapsed in the side panel, uses dashboard navigation and resets when the active slug changes', async () => {
    const now = Date.now();
    const today = localDateFromTimestamp(now);
    const state = defaultState(today);
    const openDashboard = vi.fn();
    const props = { state, actions, now, openDashboard, openProblem: vi.fn() };
    const { rerender } = render(<ProblemPanel {...props} slug="two-sum" />);
    expect(metadataRegion().querySelector('details')!.open).toBe(false);
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expand();
    fireEvent.click(screen.getByRole('link', { name: '3Sum' }));
    expect(openDashboard).toHaveBeenCalledWith('#/problem/3sum');
    rerender(<ProblemPanel {...props} slug="valid-anagram" />);
    await waitFor(() => expect(metadataRegion().querySelector('details')!.open).toBe(false));
    expect(screen.queryByLabelText('Data structures and techniques')).toBeNull();
    expect(screen.queryByText('Sorted input changes the pair-search tradeoffs.')).toBeNull();
  });
});
