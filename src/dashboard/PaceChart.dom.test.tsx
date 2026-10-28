// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { emptyChecklist } from '../core/practice';
import { defaultState } from '../core/state';
import type { Activity, ActivityType, AppState } from '../core/types';
import { LogsView } from './LogsView';
import { PaceChart } from './PaceChart';

afterEach(cleanup);

let counter = 0;
function done(slug: string, type: ActivityType, completedAt: string, minutes: number): Activity {
  return { ...createActivity([], { slug, type, dueDate: completedAt, createdAt: completedAt }), id: `p${counter++}`, status: 'done', completedAt, outcome: 'solo', totalMs: minutes * 60_000 };
}
const EASY = 'two-sum', MEDIUM = 'group-anagrams';
const withActivities = (activities: Activity[], extra: Partial<AppState> = {}): AppState => ({ ...defaultState('2025-01-01'), activities, ...extra });

describe('PaceChart', () => {
  it('shows an explanatory empty state and no chart without logged time', () => {
    render(<PaceChart state={withActivities([])} />);
    expect(screen.getByRole('heading', { name: 'Pace by month' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('No completed activities with logged time yet');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('draws one labelled chart per difficulty with sample counts, a text table and the guideline caveat', () => {
    render(<PaceChart state={withActivities([
      done(EASY, 'new', '2025-03-02', 10), done(EASY, 'new', '2025-03-03', 20), done(EASY, 'new', '2025-03-04', 30),
      done(EASY, 'recall', '2025-03-05', 6), done(EASY, 'new', '2025-05-05', 14), done(MEDIUM, 'new', '2025-04-01', 33),
    ])} />);
    const charts = screen.getAllByRole('img');
    expect(charts.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Easy: median logged minutes per month, 2 months with samples. Editorial guideline 15 minutes, not data. A data table follows.',
      'Medium: median logged minutes per month, 1 month with samples. Editorial guideline 30 minutes, not data. A data table follows.',
      'Hard: median logged minutes per month, no samples. Editorial guideline 45 minutes, not data. A data table follows.',
    ]);
    // Responsive: the SVG scales with its container instead of a fixed pixel size.
    for (const chart of charts) { expect(chart.getAttribute('viewBox')).toBeTruthy(); expect(chart.getAttribute('width')).toBeNull(); }
    expect(screen.getByText('Showing at most the last 12 months (2025-03 to 2025-05). First attempts: 5 samples; reviews: 1 sample.')).toBeTruthy();
    const easy = screen.getAllByRole('table')[0]!;
    expect(within(easy).getByRole('rowheader', { name: '2025-03' }).closest('tr')!.textContent).toBe('2025-0320 min (n=3)6 min (n=1)—');
    expect(within(easy).getByRole('rowheader', { name: '2025-05' }).closest('tr')!.textContent).toBe('2025-0514 min (n=1)——');
    expect(within(easy).queryByRole('rowheader', { name: '2025-04' })).toBeNull();
    expect(easy.querySelector('caption')!.textContent).toContain('Guideline 15 min is editorial, not data');
    // Markers expose their numbers; fewer than 3 samples are hollow.
    const firstMarkers = charts[0]!.querySelectorAll('g.pace-first circle');
    expect([...firstMarkers].map((m) => m.classList.contains('pace-few'))).toEqual([false, true]);
    expect(charts[0]!.querySelector('title')!.textContent).toBe('Easy, First attempts, 2025-03: median 20 min from 3 samples');
    expect(charts[0]!.textContent).toContain('Guideline 15 min (editorial, not data)');
    expect(charts[1]!.textContent).toContain('Guideline 30 min (editorial, not data)');
    expect(charts[2]!.textContent).toContain('Guideline 45 min (editorial, not data)');
    expect(screen.getByText(/not measured data and not a target/)).toBeTruthy();
    expect(screen.getByText(/no trend or forecast/)).toBeTruthy();
    // No line is drawn across a gap or from a single month.
    expect(charts[0]!.querySelector('path.pace-line')).toBeNull();
    expect(screen.queryByText(/Simulation durations/)).toBeNull();
    expect(screen.getByText('No Hard samples in these months.')).toBeTruthy();
  });

  it('joins only consecutive months that both have samples', () => {
    render(<PaceChart state={withActivities([done(EASY, 'new', '2025-03-02', 10), done(EASY, 'new', '2025-04-02', 12), done(EASY, 'new', '2025-06-02', 14)])} />);
    const path = screen.getAllByRole('img')[0]!.querySelector('g.pace-first path.pace-line')!;
    expect(path.getAttribute('d')!.match(/M/g)).toHaveLength(1);
  });

  it('overlays simulation medians as a separate, labelled series when simulations exist', () => {
    const endedAt = new Date(2025, 2, 15, 12).getTime();
    const state = withActivities([done(MEDIUM, 'new', '2025-03-02', 31)], { simulations: {
      a: { id: 'a', createdAt: endedAt - 28 * 60_000, endedAt, durationMs: 28 * 60_000, slug: MEDIUM, mode: 'global', outcome: 'solved', checklist: emptyChecklist(), targetMinutes: 35, reflection: '' },
    } });
    render(<PaceChart state={state} />);
    expect(screen.getByText(/Simulation durations \(Practice, separate from logged time\)/)).toBeTruthy();
    expect(screen.getByText(/simulations: 1 sample/)).toBeTruthy();
    const medium = screen.getAllByRole('table')[0]!;
    expect(within(medium).getByRole('rowheader', { name: '2025-03' }).closest('tr')!.textContent).toBe('2025-0331 min (n=1)—28 min (n=1)');
    expect(screen.getAllByRole('img')[1]!.querySelectorAll('g.pace-sim polygon')).toHaveLength(1);
  });

  it('only simulations still produce a chart', () => {
    const endedAt = new Date(2025, 2, 15, 12).getTime();
    render(<PaceChart state={withActivities([], { simulations: { a: { id: 'a', createdAt: endedAt - 20 * 60_000, endedAt, durationMs: 20 * 60_000, slug: EASY, mode: 'global', outcome: 'partial', checklist: emptyChecklist(), targetMinutes: 25, reflection: '' } } })} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getAllByRole('table')[0]!.textContent).toContain('20 min (n=1)');
  });

  it('appears in Logs without changing the log table or its filters', () => {
    render(<LogsView state={withActivities([done(EASY, 'new', '2025-03-02', 10)])} />);
    expect(screen.getByRole('heading', { name: 'Pace by month' })).toBeTruthy();
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(3);
  });
});
