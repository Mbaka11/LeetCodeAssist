import { describe, expect, it } from 'vitest';
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
    // 08:30 already passed today: tomorrow. 20:00 and midnight: later today / tonight.
    expect(specs[0]!.when).toBe(at(day(2), 8, 30));
    expect(specs[1]!.when).toBe(at(START, 20, 0));
    expect(specs[2]!.when).toBe(at(day(2), 0, 0) + 5000);
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
      { name: MIDNIGHT_ALARM, scheduledTime: at(day(2), 0, 0) + 5000 },
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
  it('reminds while the daily target is not met', () => {
    const note = eveningNotification(newState(), at(START, 20, 0))!;
    expect(note.message).toMatch(/^0 min of 2h30 logged today · \d+ left \(/);
  });

  it('stays quiet once the target is met', () => {
    const state = simulateDay(newState(), day(1), { minutes: 80 }).state;
    expect(eveningNotification(state, at(START, 20, 0))).toBeNull();
  });

  it('reports all-done-but-short when everything is finished under the target', () => {
    const state = simulateDay(newState(), day(1), { minutes: 10 }).state;
    const note = eveningNotification(state, at(START, 20, 0))!;
    expect(note.message).toContain('all planned activities are done');
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

  it("rolls over at midnight: the same state shows the next day's count", () => {
    const state = simulateDay(newState(), day(1)).state;
    expect(badgeText(state, at(day(1), 23, 59))).toBe('');
    expect(Number(badgeText(state, at(day(2), 0, 1)))).toBeGreaterThan(0);
  });
});
