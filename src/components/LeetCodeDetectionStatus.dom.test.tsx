// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubmissionEvent } from '../lib/leetcodeSubmissions';
import { LeetCodeDetectionStatus } from './LeetCodeDetectionStatus';

afterEach(cleanup);
const NOW = new Date(2025, 0, 7, 10, 5).getTime();
const accepted: SubmissionEvent = { type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Accepted', lang: 'python', at: NOW - 60_000 };
const submit: SubmissionEvent = { ...accepted, type: 'submit', state: 'SUBMITTED', status_msg: '', lang: '', at: NOW - 120_000 };
function show(props: Partial<Parameters<typeof LeetCodeDetectionStatus>[0]> = {}) {
  return render(<LeetCodeDetectionStatus enabled events={[]} now={NOW} {...props} />);
}
const feedback = () => screen.getByRole('status');

describe('LeetCode detection indicator', () => {
  it('shows an enabled setting without claiming that the observer is connected', () => {
    show();
    expect(screen.getByText('Detection on')).toBeTruthy();
    expect(screen.getAllByText('None recorded')).toHaveLength(2);
    expect(feedback().textContent).toBe('No events recorded yet.');
    const help = screen.getByText('Why did Finish not open?').closest('details')!;
    expect(help.open).toBe(false);
    fireEvent.click(screen.getByText('Why did Finish not open?'));
    expect(help.textContent).toContain('not that the page observer is connected');
    expect(help.textContent).toContain('never headers, cookies or full responses');
  });

  it('shows the latest Submit and Accepted with distinct timestamps, titles and language', () => {
    const other = { ...accepted, slug: 'valid-anagram' };
    show({ events: [submit, other], currentSlug: 'two-sum', activityStarted: true });
    const observations = screen.getAllByRole('definition');
    // The global observations explicitly name their problems; context never treats the other Accepted as a match.
    expect(screen.getByText('Last Submit')).toBeTruthy();
    expect(screen.getByText('Last Accepted')).toBeTruthy();
    expect(screen.getByText('Today 10:03')).toBeTruthy();
    expect(screen.getByText('Today 10:04')).toBeTruthy();
    expect(screen.getByText(/Valid Anagram · Python/)).toBeTruthy();
    expect(feedback().textContent).toContain('no later final result');
    expect(observations).toHaveLength(2);
  });

  it('retains old observations while off without implying a new result will open Finish', () => {
    show({ enabled: false, events: [submit, accepted], currentSlug: 'two-sum', activityStarted: true });
    expect(screen.getByText('Detection off')).toBeTruthy();
    expect(screen.getByText('Today 10:04')).toBeTruthy();
    expect(feedback().textContent).toContain('No new events are recorded');
    expect(feedback().textContent).not.toContain('Accepted received');
  });

  it('explains why a detected Accepted does not open a form when the activity is not started', () => {
    show({ events: [submit, accepted], currentSlug: 'two-sum', activityStarted: false });
    expect(feedback().textContent).toContain('No activity is currently in progress');
    expect(screen.queryByText('How did it go?')).toBeNull();
  });

  it('shows the latest failed verdict rather than reassuring with an older Accepted', () => {
    show({ events: [submit, accepted, { ...accepted, at: NOW, status_msg: 'Wrong Answer' }], currentSlug: 'two-sum' });
    expect(feedback().textContent).toBe('Last result: Wrong Answer. Only Accepted opens Finish.');
    expect(screen.getByText('Today 10:04')).toBeTruthy();
  });

  it('changes context without hiding global history or confusing problems', () => {
    const props = { enabled: true, events: [submit, accepted], now: NOW };
    const page = show({ ...props, currentSlug: 'two-sum', activityStarted: true });
    expect(feedback().textContent).toContain('Accepted received');
    page.rerender(<LeetCodeDetectionStatus {...props} currentSlug="valid-anagram" activityStarted />);
    expect(feedback().textContent).toBe('No events received for this problem yet.');
    expect(screen.getByText('Today 10:04')).toBeTruthy();
  });

  it('shows explicit local dates after midnight instead of calling an old event Today', () => {
    show({ events: [submit, accepted], now: new Date(2025, 0, 8, 0, 1).getTime() });
    expect(screen.getByText('2025-01-07 10:03')).toBeTruthy();
    expect(screen.getByText('2025-01-07 10:04')).toBeTruthy();
    const times = document.querySelectorAll('time');
    expect(times[0]?.getAttribute('datetime')).toBe(new Date(submit.at).toISOString());
  });

  it('opens Settings only on an explicit click and does not send requests or control activities', () => {
    const open = vi.fn();
    show({ onOpenSettings: open, events: [submit, accepted] });
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Save result' })).toBeNull();
  });
});
