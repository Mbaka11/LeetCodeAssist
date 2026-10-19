// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import { parseRoute } from '../lib/route';
import { WeeklyView } from './WeeklyView';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('weekly review navigation and empty evidence', () => {
  it('exposes its dashboard route', () => expect(parseRoute('#/weekly')).toEqual({ view: 'weekly' }));
  it('shows the latest rolling week and lets the user navigate without changing program settings', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2025, 0, 20, 12).getTime());
    const state = defaultState('2025-01-01');
    const before = structuredClone(state);
    render(<WeeklyView state={state} />);
    expect(screen.getByText('2025-01-14 – 2025-01-20')).toBeTruthy();
    expect(screen.getByText('No completed activities in either period.')).toBeTruthy();
    expect(screen.getByText(/No program, review date or budget is changed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous 7 days' }));
    expect(screen.getByText('2025-01-07 – 2025-01-13')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Latest 7 days' }));
    expect(screen.getByText('2025-01-14 – 2025-01-20')).toBeTruthy();
    expect(state).toEqual(before);
  });
});
