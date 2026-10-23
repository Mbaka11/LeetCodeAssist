// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import { ActivityHeatmap } from './ActivityHeatmap';

afterEach(cleanup);
describe('ActivityHeatmap', () => {
  it('labels every program and recent date, shows local minute thresholds and future days without profile data', () => {
    render(<ActivityHeatmap state={defaultState('2025-01-01')} today="2025-01-05" />);
    const program = screen.getByRole('group', { name: 'Program days 1–30: logged minutes per day' });
    const recent = screen.getByRole('group', { name: 'Recent 12 weeks: logged minutes per day' });
    expect(within(program).getAllByRole('img')).toHaveLength(30);
    expect(within(recent).getAllByRole('img')).toHaveLength(84);
    expect(within(program).getByRole('img', { name: '2025-01-06: 0 minutes logged (future)' })).toHaveProperty('title', '2025-01-06: 0 minutes logged (future)');
    expect(within(recent).getByRole('img', { name: '2025-01-05: 0 minutes logged' })).toBeTruthy();
    expect(screen.getByLabelText(/Minutes legend: 0, under 30/)).toBeTruthy();
    expect(program.classList.contains('heat-grid')).toBe(true); // shares the responsive scrolling grid
  });
});
