import { describe, expect, it } from 'vitest';
import type { AppState } from '../core/types';
import { materializePlan, planDay } from '../core/planner';
import { START, complete, day, newState, simulateDay } from '../core/testing';
import {
  EVENING_ALARM,
  MIDNIGHT_ALARM,
  MORNING_ALARM,
  alarmsToCreate,
  badgeText,
  describeActivities,
  eveningNotification,
  morningNotification,
  summarizeToday,
} from './reminders';

function at(date: string, hour = 10, minute = 0): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute, 0).getTime();
}

describe('alarmsToCreate', () => {
  const settings = newState().settings; // 08:30 / 20:00

  it('creates all three alarms on a fresh install', () => {
    const now = at(START, 9);
    const specs = alarmsToCreate([], settings, now);
    expect(specs.map((s) => s.name)).toEqual([MORNING_ALARM, EVENING_ALARM, MIDNIGHT_ALARM]);
    // Morning passed: tomorrow; evening today; training rollover tomorrow at 04:00.
    expect(specs[0]!.when).toBe(at(day(2), 8, 30));
    expect(specs[1]!.when).toBe(at(START, 20, 0));
    expect(specs[2]!.when).toBe(at(day(2), 4, 0) + 5000);
  });

  it('leaves alarms that match the settings alone and recreates missing ones', () => {
    const now = at(START, 9);
    const existing = [
      { name: MORNING_ALARM, scheduledTime: at(day(2), 8, 30) },
      { name: EVENING_ALARM, scheduledTime: at(START, 20, 0) },
    ];
    expect(alarmsToCreate(existing, settings, now).map((s) => s.name)).toEqual([MIDNIGHT_ALARM]);
  });

  it('recomputes alarms whose time no longer matches the settings', () => {
    const now = at(START, 9);
    const existing = [
      { name: MORNING_ALARM, scheduledTime: at(day(2), 8, 30) },
      { name: EVENING_ALARM, scheduledTime: at(START, 20, 0) },
      { name: MIDNIGHT_ALARM, scheduledTime: at(day(2), 4, 0) + 5000 },
    ];
    const changed = { ...settings, morningNotify: '09:30', eveningNotify: '21:15' };
    expect(alarmsToCreate(existing, changed, now)).toEqual([
      { name: MORNING_ALARM, when: at(START, 9, 30) },
      { name: EVENING_ALARM, when: at(START, 21, 15) },
    ]);
  });

  it('recreates an alarm whose scheduled time is already in the past', () => {
    const now = at(START, 9);
    const existing = [{ name: EVENING_ALARM, scheduledTime: at(START, 8, 0) }];
    expect(alarmsToCreate(existing, settings, now).some((s) => s.name === EVENING_ALARM)).toBe(true);
  });
});

describe('morning summary', () => {
  it('words the day like "2 new, 3 recalls, 4 rebuilds · ~2h20"', () => {
    let state = newState();
    for (const n of [1, 2, 3]) state = simulateDay(state, day(n)).state;
    const note = morningNotification(state, at(day(4), 8, 30))!;
    expect(note.title).toBe('LeetCode Assist · Day 4');
    expect(note.message).toMatch(/^Today: \d new, \d recalls, \d+ rebuilds · ~(\d+ min|\dh(\d{2})?)$/);
  });

  it('uses singular nouns for a single activity', () => {
    const state = simulateDay(newState(), day(1)).state;
    const plan = planDay(state, day(2));
    const onlyRecall = plan.items.filter((i) => i.activity.type === 'recall').slice(0, 1);
    expect(describeActivities(onlyRecall)).toBe('1 recall');
  });

  it('is null before the start date and when nothing is left', () => {
    expect(morningNotification(newState(), at(day(0), 8, 30))).toBeNull();
    const done = simulateDay(newState(), day(1)).state;
    expect(morningNotification(done, at(day(1), 21, 0))).toBeNull();
  });
});

describe('eveningNotification', () => {
  function partialDay(minutes: number, doneCount: number): AppState {
    let state = materializePlan(newState(), planDay(newState(), START));
    for (const activity of state.activities.slice(0, doneCount)) state = complete(state, activity.id, 'solo', START, minutes);
    return state;
  }

  it('summarises an untouched day as "Today: 0 done, N left, 0 min logged"', () => {
    const total = planDay(newState(), START).items.length;
    expect(eveningNotification(newState(), at(START, 20, 0))!.message).toBe(`Today: 0 done, ${total} left, 0 min logged`);
  });

  it('summarises a partial day with done, left and logged minutes', () => {
    const total = planDay(newState(), START).items.length;
    const note = eveningNotification(partialDay(20, 3), at(START, 20, 0))!;
    expect(note.title).toBe('LeetCode Assist · Evening check');
    expect(note.message).toBe(`Today: 3 done, ${total - 3} left, 60 min logged`);
  });

  it('stays quiet once the whole core plan is done, even under the daily target', () => {
    const state = simulateDay(newState(), day(1), { minutes: 10 }).state;
    expect(eveningNotification(state, at(START, 20, 0))).toBeNull();
    expect(eveningNotification(simulateDay(newState(), day(1), { minutes: 80 }).state, at(START, 20, 0))).toBeNull();
  });

  it('with the setting off, still sends the summary for a finished day', () => {
    const done = simulateDay(newState(), day(1), { minutes: 10 }).state;
    const total = planDay(done, START).items.length;
    const off = { ...done, settings: { ...done.settings, eveningOnlyIfOpen: false } };
    expect(eveningNotification(off, at(START, 20, 0))!.message).toBe(`Today: ${total} done, 0 left, ${total * 10} min logged`);
    // The explicit true value behaves like the default (absent).
    const on = { ...done, settings: { ...done.settings, eveningOnlyIfOpen: true } };
    expect(eveningNotification(on, at(START, 20, 0))).toBeNull();
  });

  it('with the setting off, an open day reads the same as with it on', () => {
    const off = { ...newState(), settings: { ...newState().settings, eveningOnlyIfOpen: false } };
    expect(eveningNotification(off, at(START, 20, 0))!.message).toBe(eveningNotification(newState(), at(START, 20, 0))!.message);
  });

  it('is silent before the program starts, with the setting on or off', () => {
    const off = { ...newState(), settings: { ...newState().settings, eveningOnlyIfOpen: false } };
    expect(eveningNotification(newState(), at(day(0), 20, 0))).toBeNull();
    expect(eveningNotification(off, at(day(0), 20, 0))).toBeNull();
  });

  it('does not wait for activities that were skipped: the plan has nothing left once they are all skipped or done', () => {
    let state = materializePlan(newState(), planDay(newState(), START));
    state = { ...state, activities: state.activities.map((a) => ({ ...a, status: 'skipped' as const })) };
    const summary = summarizeToday(state, at(START, 20, 0))!;
    expect(summary.open.every((item) => item.activity.status !== 'skipped')).toBe(true);
    // Skipped items are never counted as waiting; whatever the planner still has open is exactly what the reminder reports.
    expect(eveningNotification(state, at(START, 20, 0))?.message).toBe(`Today: ${summary.done} done, ${summary.open.length} left, 0 min logged`);
  });

  it('caps live timer minutes at the 04:00 training-day boundary', () => {
    let state = materializePlan(newState(), planDay(newState(), START));
    const first = state.activities[0]!;
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === first.id ? { ...a, status: 'in_progress' as const, timer: { startedAt: at(day(0), 22), accumulatedMs: 0, running: true } } : a,
      ),
    };
    expect(summarizeToday(state, at(START, 5))!.loggedMs).toBe(3_600_000);
  });

  it('counts a running timer towards the logged time', () => {
    let state = materializePlan(newState(), planDay(newState(), START));
    const first = state.activities[0]!;
    state = {
      ...state,
      activities: state.activities.map((a) =>
        a.id === first.id
          ? { ...a, status: 'in_progress', timer: { startedAt: at(START, 18), accumulatedMs: 0, running: true } }
          : a,
      ),
    };
    expect(summarizeToday(state, at(START, 20, 0))!.loggedMs).toBe(2 * 3_600_000);
  });

  it('uses the 90 minute target on consolidation days', () => {
    expect(summarizeToday(newState(), at(day(7), 20, 0))!.targetMinutes).toBe(90);
  });

  it('is null before the start date', () => {
    expect(eveningNotification(newState(), at(day(0), 20, 0))).toBeNull();
  });
});

describe('badgeText', () => {
  it('shows the number of remaining activities and drops as they are completed', () => {
    const state = newState();
    const plan = planDay(state, START);
    expect(badgeText(state, at(START))).toBe(String(plan.items.length));

    const persisted = materializePlan(state, plan);
    const next = complete(persisted, persisted.activities[0]!.id, 'solo', START);
    expect(badgeText(next, at(START))).toBe(String(plan.items.length - 1));
  });

  it('is empty when everything is done, before the start, or without data', () => {
    expect(badgeText(simulateDay(newState(), day(1)).state, at(day(1), 21))).toBe('');
    expect(badgeText(newState(), at(day(0)))).toBe('');
    expect(badgeText(null, at(START))).toBe('');
  });

  it("stays on the same plan after midnight and rolls over at 04:00", () => {
    const state = simulateDay(newState(), day(1)).state;
    expect(badgeText(state, at(day(1), 23, 59))).toBe('');
    expect(badgeText(state, at(day(2), 0, 1))).toBe('');
    expect(badgeText(state, at(day(2), 3, 59))).toBe('');
    expect(Number(badgeText(state, at(day(2), 4, 0)))).toBeGreaterThan(0);
  });
});
