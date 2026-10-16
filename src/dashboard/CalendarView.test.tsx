import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { simulateDay } from '../core/testing';
import { defaultState } from '../core/state';
import type { AppActions } from '../lib/actions';
import { CalendarView } from './CalendarView';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const today = localDateFromTimestamp(Date.now());

describe('CalendarView (render smoke test)', () => {
  it('shows 30 days with markers, today, the start date picker and separate streak/goal stats', () => {
    const html = renderToStaticMarkup(<CalendarView state={defaultState(today)} actions={actions} />);
    expect(html.match(/class="cal-day/g)).toHaveLength(30);
    expect(html).toContain('cal-today');
    expect(html).toContain('Consolidation');
    expect(html).toContain('Benchmark');
    expect(html).toContain('Program start (day 1)');
    expect(html).toContain('Streak');
    expect(html).toContain('Daily goal met');
    expect(html).toContain('planned');
    // Day detail of today lists the benchmark pair.
    expect(html).toContain('Day 1 ·');
    expect(html).toContain('Contains Duplicate');
  });

  it('shows done, carried and streak/goal flags for past days', () => {
    const start = addDays(today, -2);
    let state = defaultState(start);
    state = simulateDay(state, start, { minutes: 45 }).state;
    const html = renderToStaticMarkup(<CalendarView state={state} actions={actions} />);
    expect(html).toContain('Streak day');
    expect(html).toContain('Goal met');
    expect(html).toContain('carried');
  });
});
