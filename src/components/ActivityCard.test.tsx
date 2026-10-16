import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import type { Activity, ActivityType } from '../core/types';
import type { AppActions } from '../lib/actions';
import { ActivityCard } from './ActivityCard';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const now = new Date(2025, 0, 6, 10).getTime();

function card(type: ActivityType, patch: Partial<Activity> = {}): string {
  const activity: Activity = {
    ...createActivity([], { type, slug: 'two-sum', dueDate: '2025-01-06', createdAt: '2025-01-06' }),
    ...patch,
  };
  return renderToStaticMarkup(<ActivityCard activity={activity} now={now} actions={actions} />);
}

describe('ActivityCard secondary action', () => {
  it('offers Postpone (not Skip) for a new problem', () => {
    const html = card('new');
    expect(html).toContain('Postpone');
    expect(html).not.toContain('>Skip<');
    expect(html).not.toContain('Move…');
  });

  it('offers Move… for a planned review', () => {
    for (const type of ['recall', 'rebuild', 'resolve', 'blind', 'retry'] as const) {
      const html = card(type);
      expect(html, type).toContain('Move…');
      expect(html, type).not.toContain('Postpone');
    }
  });

  it('keeps Skip for benchmarks and optional practice, and a stop button for a started review', () => {
    expect(card('benchmark')).toContain('>Skip<');
    expect(card('resolve', { extra: true })).toContain('>Skip<');
    const started = card('recall', {
      status: 'in_progress',
      timer: { startedAt: now, accumulatedMs: 0, running: true },
    });
    expect(started).toContain('Stop, redo tomorrow');
    expect(started).not.toContain('Move…');
  });

  it('shows the hints used on a finished attempt', () => {
    const html = card('new', { status: 'done', outcome: 'hint', completedAt: '2025-01-06', totalMs: 600_000, hintsUsed: 2 });
    expect(html).toContain('2 hints');
  });
});
