import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { addDays, localDateFromTimestamp } from '../core/dates';
import { simulateDay } from '../core/testing';
import { getProblem } from '../data/neetcode150';
import { formatMinutes } from '../lib/format';
import { defaultState } from '../core/state';
import type { AppActions } from '../lib/actions';
import { calendarDays } from '../core/calendar';
import { projectDay } from '../core/projection';
import { CalendarView, DayPopoverContent, entryRows } from './CalendarView';

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
    // Overall progress and the per-day minutes bar.
    expect(html).toContain('Problems learned');
    expect(html).toContain('0/53');
    expect(html).toContain('Days elapsed');
    expect(html).toContain('1/30');
    expect(html.match(/<span class="cal-bar[ "]/g)).toHaveLength(30);
    // Each day sits in a cell that can show the popover; it is not rendered until hover or focus.
    expect(html.match(/class="cal-cell"/g)).toHaveLength(30);
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain(' title="Day');
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

describe('day popover content', () => {
  const state = defaultState(today);

  it('lists the real entries of today with type, problem, minutes and the total', () => {
    const day = calendarDays(state, today)[0]!;
    const html = renderToStaticMarkup(
      <DayPopoverContent day={day} rows={entryRows(day)} totalMinutes={day.plannedMinutes} projected={false} />,
    );
    expect(html).toContain('Day 1 ·');
    expect(html).toContain('Benchmark');
    expect(html).toContain('Contains Duplicate');
    expect(html).toContain('~30 min');
    expect(html).toContain('Total');
    expect(html).not.toContain('projected');
  });

  it('labels a projection of a future day as projected, with its activities and total', () => {
    const days = calendarDays(state, today);
    const day = days[1]!;
    const projection = projectDay(state, day.date, today);
    expect(projection.items.some((i) => i.type === 'recall')).toBe(true);
    const html = renderToStaticMarkup(
      <DayPopoverContent
        day={day}
        projected
        rows={projection.items.map((i, n) => ({
          key: String(n),
          type: i.type,
          title: getProblem(i.slug)?.title ?? i.slug,
          minutes: i.minutes,
        }))}
        totalMinutes={projection.totalMinutes}
      />,
    );
    expect(html).toContain('projected');
    expect(html).toContain('Recall');
    expect(html).toContain('Assumes you do each day');
    expect(html).toContain(`~${formatMinutes(projection.totalMinutes)}`);
  });

  it('says so when nothing is planned', () => {
    const day = calendarDays(state, today)[6]!;
    const html = renderToStaticMarkup(
      <DayPopoverContent day={day} rows={[]} totalMinutes={0} projected />,
    );
    expect(html).toContain('Nothing planned.');
  });
});
