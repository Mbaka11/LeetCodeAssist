import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { addDays, trainingDateFromTimestamp as localDateFromTimestamp } from '../core/dates';
import { simulateDay } from '../core/testing';
import { getProblem } from '../data/neetcode150';
import { PROGRAM_QUEUE } from '../data/program';
import { formatMinutes } from '../lib/format';
import { defaultState } from '../core/state';
import type { AppActions } from '../lib/actions';
import { calendarDays } from '../core/calendar';
import { materializePlan, planDay } from '../core/planner';
import { projectDay } from '../core/projection';
import { CalendarView, DayPopoverContent, entryRows, popoverAlignsToEnd } from './CalendarView';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const today = localDateFromTimestamp(Date.now());

describe('CalendarView (render smoke test)', () => {
  it('shows 30 days with markers, today, the start date picker and separate streak, plan done and time logged stats', () => {
    const html = renderToStaticMarkup(<CalendarView state={defaultState(today)} actions={actions} />);
    expect(html.match(/class="cal-day/g)).toHaveLength(30);
    expect(html).toContain('cal-today');
    expect(html).toContain('Consolidation');
    expect(html).toContain('Benchmark');
    expect(html).toContain('Program start (day 1)');
    expect(html).toContain('Streak');
    expect(html).toContain('Plan done');
    expect(html).toContain('0 of 1 days');
    expect(html).toContain('finished 80%+ of the day&#x27;s core plan');
    expect(html).toContain('Time logged');
    expect(html).toContain('last 7 days · 0 min total');
    expect(html).not.toContain('Daily goal met');
    expect(html).toContain('planned');
    // Overall progress and the per-day minutes bar.
    expect(html).toContain('Problems learned');
    expect(html).toContain(`0/${PROGRAM_QUEUE.length}`);
    expect(html).toContain('Days elapsed');
    expect(html).toContain('1/30');
    expect(html.match(/<span class="cal-bar[ "]/g)).toHaveLength(30);
    // Each day sits in a cell with an always-mounted, hidden popover that its button points to; the
    // popover content is only rendered on hover or focus.
    expect(html.match(/class="cal-cell"/g)).toHaveLength(30);
    expect(html.match(/aria-describedby="/g)).toHaveLength(30);
    expect(html.match(/class="cal-popover" hidden=""/g)).toHaveLength(30);
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain('cal-popover-list');
    expect(html).not.toContain('Assumes you do each day');
    expect(html).not.toContain(' title="Day');
    // Day detail of today lists the benchmark pair.
    expect(html).toContain('Day 1 ·');
    expect(html).toContain('Contains Duplicate');
  });

  it('shows done, carried and streak/plan done flags for past days', () => {
    const start = addDays(today, -2);
    let state = defaultState(start);
    state = simulateDay(state, start, { minutes: 45 }).state;
    const html = renderToStaticMarkup(<CalendarView state={state} actions={actions} />);
    expect(html).toContain('Streak day');
    expect(html).toContain('Plan done');
    expect(html).not.toContain('Goal met');
    expect(html).toContain('cal-day cal-past plan-done');
    expect(html).toContain('Time logged');
    expect(html).toContain('carried');
  });
});

describe('CalendarView compact summary (render smoke test)', () => {
  it('puts the overview and the streak card in one summary row before the day grid', () => {
    const html = renderToStaticMarkup(<CalendarView state={defaultState(today)} actions={actions} />);
    const summary = html.indexOf('class="cal-summary"');
    const overview = html.indexOf('class="card cal-overview"');
    const streak = html.indexOf('class="card cal-streak"');
    const grid = html.indexOf('class="calendar-grid"');
    expect(summary).toBeGreaterThanOrEqual(0);
    expect(overview).toBeGreaterThan(summary);
    expect(streak).toBeGreaterThan(overview);
    expect(grid).toBeGreaterThan(streak);
    expect(html.match(/class="card cal-/g)).toHaveLength(2);
    // The old stacked banner cards are gone: the day detail is the only card after the grid.
    expect(html.slice(grid).match(/<section class="card/g)).toHaveLength(1);
  });

  it('collapses the explanations and the start date editor behind details controls', () => {
    const html = renderToStaticMarkup(<CalendarView state={defaultState(today)} actions={actions} />);
    expect(html).toContain('<summary>How these are counted</summary>');
    expect(html).toContain('<summary>Change start date</summary>');
    expect(html.match(/<details class="cal-details"/g)).toHaveLength(2);
    expect(html).not.toContain('<details class="cal-details" open');
    expect(html).toContain('Save start date');
  });

  it('shows the distinct worked total with its breakdown next to the separate program counter', () => {
    const start = addDays(today, -1);
    const state = simulateDay(defaultState(start), start, { bonus: true }).state;
    const html = renderToStaticMarkup(<CalendarView state={state} actions={actions} />);
    expect(html).toContain('class="worked-total"');
    expect(html).toContain('Program 2/50 · Benchmarks 2/6 · Bonus 2');
    expect(html).toContain('>6</span><span class="worked-total-label">problems worked');
    expect(html).toContain('Reviews never add to it');
    // The program counter is separate and unchanged by the bonus problems.
    expect(html).toContain(`2/${PROGRAM_QUEUE.length}`);
    expect(html).toContain('Problems learned');
  });

  it('shows a finished bonus with its badge in the day detail', () => {
    const state = simulateDay(defaultState(today), today, { bonus: true }).state;
    const html = renderToStaticMarkup(<CalendarView state={state} actions={actions} />);
    expect(html).toContain('<span class="badge badge-warn">Bonus</span>');
  });

  it('labels an open bonus offer as optional, not as a to-do', () => {
    const state = materializePlan(defaultState(today), planDay(defaultState(today), today));
    const html = renderToStaticMarkup(<CalendarView state={state} actions={actions} />);
    expect(html).toContain('badge-warn">Bonus</span>');
    expect(html).toContain('>Optional</span>');
  });
});

describe('popoverAlignsToEnd', () => {
  it('flips the popover to the right edge of the cell when it would overflow the viewport', () => {
    expect(popoverAlignsToEnd(0, 1200)).toBe(false);
    expect(popoverAlignsToEnd(800, 1200)).toBe(false);
    expect(popoverAlignsToEnd(1100, 1200)).toBe(true);
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
