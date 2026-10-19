// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import type { Activity } from '../core/types';
import type { AppActions } from '../lib/actions';
import type { AcceptedPrompt } from '../lib/leetcodeSubmissions';
import { ActivityCard } from './ActivityCard';

afterEach(cleanup);
const NOW = new Date(2025, 0, 6, 10).getTime();

function setup(patch: Partial<Activity> = {}, initialAccepted?: AcceptedPrompt) {
  const activity: Activity = {
    ...createActivity([], { type: 'new', slug: 'two-sum', dueDate: '2025-01-06', createdAt: '2025-01-06' }),
    status: 'in_progress',
    timer: { running: true, startedAt: NOW - 600_000, accumulatedMs: 0 },
    ...patch,
  };
  const pause = vi.fn(() => Promise.resolve());
  const complete = vi.fn(() => Promise.resolve());
  const actions = { pause, completeActivity: complete } as unknown as AppActions;
  const card = (current: Activity, accepted?: AcceptedPrompt, now = NOW, autoOpenAccepted = true) => (
    <StrictMode>
      <ActivityCard activity={current} actions={actions} now={now} accepted={accepted} autoOpenAccepted={autoOpenAccepted} />
    </StrictMode>
  );
  const view = render(card(activity, initialAccepted));
  return {
    activity, pause, complete,
    update: (accepted?: AcceptedPrompt, current = activity, now = NOW + 60_000, autoOpenAccepted = true) =>
      view.rerender(card(current, accepted, now, autoOpenAccepted)),
  };
}

const verdict = (acceptedAt = NOW + 30_000): AcceptedPrompt => ({
  acceptedAt, lang: 'python', python: true, attemptsBefore: 0,
});

describe('fresh Accepted opens Finish without saving', () => {
  it('pauses once, opens Finish and waits for Save result (including StrictMode)', async () => {
    const { activity, pause, complete, update } = setup();
    expect(screen.queryByText('How did it go?')).toBeNull();
    update(verdict());
    expect(pause).toHaveBeenCalledExactlyOnceWith(activity.id);
    expect(screen.getByText('How did it go?')).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Solo/ }) as HTMLInputElement).checked).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    // A pause/storage render and a timer tick must not re-trigger the effect.
    update(verdict(), { ...activity, timer: { running: false, startedAt: null, accumulatedMs: 630_000 } });
    expect(pause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    expect(complete).toHaveBeenCalledExactlyOnceWith(activity.id, 'solo', undefined, '2025-01-06');
    await waitFor(() => expect(screen.queryByText('How did it go?')).toBeNull());
  });

  it('keeps Hint pre-selected when hints were used', () => {
    const { update, complete } = setup({ hintsUsed: 2 });
    update(verdict());
    expect((screen.getByRole('radio', { name: /Hint/ }) as HTMLInputElement).checked).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not reopen after Cancel for the same event, but opens for a later Accepted', () => {
    const { update, pause, complete } = setup();
    update(verdict());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    update(verdict());
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(pause).toHaveBeenCalledTimes(1);
    update(verdict(NOW + 90_000), undefined, NOW + 100_000);
    expect(screen.getByText('How did it go?')).toBeTruthy();
    expect(pause).toHaveBeenCalledTimes(2);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not auto-open an existing event on mount or an older event loaded later', () => {
    const old = verdict(NOW - 1000);
    const first = setup({}, old);
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(first.pause).not.toHaveBeenCalled();
    cleanup();
    const second = setup();
    second.update(old);
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(second.pause).not.toHaveBeenCalled();
    // The advisory button still lets the user act on a stored result explicitly.
    fireEvent.click(screen.getByRole('button', { name: 'Finish this activity…' }));
    expect(screen.getByText('How did it go?')).toBeTruthy();
  });

  it.each(['planned', 'done', 'skipped'] as const)('does not auto-open a %s activity', (status) => {
    const { update, pause, complete } = setup({ status });
    update(verdict());
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(pause).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not reuse a verdict when starting a previously planned activity', () => {
    const { activity, update, pause } = setup({ status: 'planned' });
    update(verdict());
    update(verdict(), { ...activity, status: 'in_progress' });
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(pause).not.toHaveBeenCalled();
  });

  it('consumes a verdict on a non-selected card so pausing the selected card cannot open a second form', () => {
    const { update, pause } = setup();
    update(verdict(), undefined, NOW + 60_000, false);
    expect(screen.queryByText('How did it go?')).toBeNull();
    update(verdict(), undefined, NOW + 60_000, true);
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(pause).not.toHaveBeenCalled();
    update(verdict(NOW + 90_000), undefined, NOW + 100_000, true);
    expect(screen.getByText('How did it go?')).toBeTruthy();
  });

  it('does not carry a verdict into a different activity rendered in the same card', () => {
    const { activity, update, pause } = setup();
    update(verdict(), { ...activity, id: 'next-attempt' });
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(pause).not.toHaveBeenCalled();
  });

  it('keeps the non-Python notice when Accepted automatically opens the form', () => {
    const { update } = setup();
    update({ ...verdict(), lang: 'cpp', python: false });
    expect(screen.getByRole('status').textContent).toContain('C++');
    expect(screen.getByRole('status').textContent).toContain('meant to be practised in Python');
  });

  it('ignores a verdict from before the current timer run', () => {
    const { update, pause } = setup({ timer: { running: true, startedAt: NOW + 40_000, accumulatedMs: 0 } });
    update(verdict());
    expect(screen.queryByText('How did it go?')).toBeNull();
    expect(pause).not.toHaveBeenCalled();
  });

  it('opens a paused activity without issuing another pause', () => {
    const { update, pause } = setup({ timer: { running: false, startedAt: null, accumulatedMs: 600_000 } });
    update(verdict());
    expect(screen.getByText('How did it go?')).toBeTruthy();
    expect(pause).not.toHaveBeenCalled();
  });

  it('leaves an already-open manual form and its selected outcome alone', () => {
    const { update, pause, complete } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('radio', { name: /Solution/ }));
    update(verdict());
    expect((screen.getByRole('radio', { name: /Solution/ }) as HTMLInputElement).checked).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });

  it('surfaces a pause error without saving the result', async () => {
    const { update, pause, complete } = setup();
    pause.mockRejectedValueOnce(new Error('Storage unavailable'));
    update(verdict());
    expect(await screen.findByText('Storage unavailable')).toBeTruthy();
    expect(complete).not.toHaveBeenCalled();
  });
});
