// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import type { Activity } from '../core/types';
import type { AppActions } from '../lib/actions';
import { ActivityCard } from './ActivityCard';
import { ProblemActivities } from './ProblemActivities';

afterEach(cleanup);
const NOW = new Date(2025, 0, 7, 10).getTime();
const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
function activity(type: 'new' | 'recall' | 'resolve', patch: Partial<Activity> = {}): Activity {
  return { ...createActivity([], { slug: 'two-sum', type, dueDate: '2025-01-07', createdAt: '2025-01-07' }), ...patch };
}

function cards(items: Activity[], overrides: Partial<Parameters<typeof ProblemActivities>[0]> = {}) {
  return <ProblemActivities items={items.map((a) => ({ activity: a }))} history={items}
    now={NOW} actions={actions} {...overrides} />;
}

describe('classic display for a single problem activity', () => {
  it.each(['new', 'recall', 'resolve'] as const)('renders one %s exactly like the original unnumbered ActivityCard', (type) => {
    const single = activity(type);
    const grouped = render(cards([single]));
    expect(grouped.container.querySelector('.attempt-number')).toBeNull();
    expect(grouped.container.querySelector('.problem-group-head')).toBeNull();
    expect(grouped.container.querySelector('.activity-attempt')).toBeNull();
    expect(screen.queryByText(/1 activity/)).toBeNull();
    const html = grouped.container.querySelector('article')!.outerHTML;
    cleanup();
    const original = render(<ActivityCard activity={single} now={NOW} actions={actions} />);
    expect(original.container.querySelector('article')!.outerHTML).toBe(html);
  });

  it('does not number a list of different problems with just one activity each', () => {
    const { container } = render(cards([activity('recall'), activity('recall', { id: 'other', slug: 'valid-anagram' })]));
    expect(container.querySelectorAll('.problem-single')).toHaveLength(2);
    expect(container.querySelectorAll('.attempt-number')).toHaveLength(0);
    expect(container.querySelectorAll('.activity-title')).toHaveLength(2);
  });

  it('forwards single-card problem links to the dashboard callback in compact side-panel mode', () => {
    const open = vi.fn();
    const { container } = render(cards([activity('recall')], { compact: true, openProblemSheet: open }));
    fireEvent.click(screen.getByRole('link', { name: 'Two Sum' }));
    expect(open).toHaveBeenCalledExactlyOnceWith('two-sum');
    expect(screen.queryByRole('link', { name: 'LeetCode ↗' })).toBeNull();
    expect(container.querySelector('.attempt-number')).toBeNull();
  });

  it('keeps a Finish form and all edited values when a single card becomes a numbered group and back', async () => {
    const first = activity('recall', { status: 'in_progress', timer: { running: true, startedAt: NOW - 600_000, accumulatedMs: 0 } });
    const second = activity('resolve', { id: 'extra-resolve', extra: true });
    const complete = vi.fn(() => Promise.resolve());
    const realActions = { ...actions, pause: () => Promise.resolve(), completeActivity: complete } as AppActions;
    const page = render(cards([first], { actions: realActions }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time logged (min)' }), { target: { value: '13' } });

    page.rerender(cards([first, second], { actions: realActions }));
    expect(page.container.querySelectorAll('.attempt-number')).toHaveLength(2);
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(page.container.querySelectorAll('.activity-title')).toHaveLength(1);
    expect(screen.getByText('2 activities · 0 done')).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Hint/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('spinbutton', { name: 'Time logged (min)' }) as HTMLInputElement).value).toBe('13');
    expect(screen.getByText('2025-01-07')).toBeTruthy();

    page.rerender(cards([first], { actions: realActions }));
    expect(page.container.querySelectorAll('.attempt-number')).toHaveLength(0);
    expect(screen.getByText('How did it go?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(() => expect(screen.queryByText('How did it go?')).toBeNull());
    expect(complete).toHaveBeenCalledExactlyOnceWith(first.id, 'hint', 13 * 60_000, '2025-01-07');
  });
});


describe('focused ProblemActivities', () => {
  it('keeps every attempt mounted while showing only the selected attempt and preserves an edited Finish form', async () => {
    const first = activity('recall', { status: 'in_progress', timer: { running: false, startedAt: null, accumulatedMs: 600_000 } });
    const second = activity('resolve', { id: 'second' });
    const page = render(cards([first, second], { selectedActivityId: first.id }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const minutes = screen.getByRole('spinbutton', { name: 'Time logged (min)' });
    fireEvent.change(minutes, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    page.rerender(cards([first, second], { selectedActivityId: first.id, focused: true }));
    expect(page.container.querySelectorAll('article')).toHaveLength(2);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Time logged (min)' })).toBe(minutes);
    page.rerender(cards([first, second], { selectedActivityId: first.id, focused: false }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(minutes).toHaveProperty('value', '14');
    expect(screen.getByRole('radio', { name: /Hint/ })).toHaveProperty('checked', true);
  });
});
