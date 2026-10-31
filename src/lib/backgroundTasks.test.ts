import { describe, expect, it } from 'vitest';
import { START, day } from '../core/testing';
import { createActions } from './actions';
import {
  EVENING_NOTIFICATION_ID,
  MORNING_NOTIFICATION_ID,
  createBackgroundTasks,
  type BackgroundDeps,
} from './backgroundTasks';
import { EVENING_ALARM, MIDNIGHT_ALARM, MORNING_ALARM, type ExistingAlarm } from './reminders';
import { chromeStorageBackend, createAppStore } from './storage';
import { createMockChromeStorage } from './testing';

function at(date: string, hour = 10, minute = 0): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute, 0).getTime();
}

/** A fake browser: alarms, notifications and the badge are plain data that outlive "service worker" instances. */
function setup(initialNow = at(START, 7)) {
  const mock = createMockChromeStorage();
  const clock = { now: initialNow };
  const browser = {
    alarms: new Map<string, number>(),
    notifications: new Map<string, { title: string; message: string }>(),
    badge: '',
    dashboardOpened: [] as string[],
  };

  /** Each call builds a fresh worker with no memory, like a restarted service worker. */
  const startWorker = () => {
    const store = createAppStore(chromeStorageBackend(mock.area, mock.changed));
    const deps: BackgroundDeps = {
      readState: () => store.readState().catch(() => null),
      getAlarms: async (): Promise<ExistingAlarm[]> =>
        [...browser.alarms].map(([name, scheduledTime]) => ({ name, scheduledTime })),
      createAlarm: async ({ name, when }) => void browser.alarms.set(name, when),
      showNotification: async (id, content) => void browser.notifications.set(id, content),
      clearNotification: async (id) => void browser.notifications.delete(id),
      setBadge: async (text) => {
        browser.badge = text;
      },
      openDashboard: async (hash) => void browser.dashboardOpened.push(hash),
      now: () => clock.now,
    };
    return createBackgroundTasks(deps);
  };

  const store = createAppStore(chromeStorageBackend(mock.area, mock.changed));
  store.subscribe(() => {});
  const actions = createActions(store, () => clock.now);
  return { mock, clock, browser, startWorker, actions, store };
}

/** Fires an alarm the way Chrome does: it disappears, then the worker handles it. */
async function fire(
  ctx: ReturnType<typeof setup>,
  name: string,
): Promise<void> {
  const scheduledTime = ctx.browser.alarms.get(name)!;
  ctx.browser.alarms.delete(name);
  ctx.clock.now = scheduledTime + 1000;
  await ctx.startWorker().handleAlarm({ name, scheduledTime });
}

describe('background tasks', () => {
  it('does nothing before the first-run setup', async () => {
    const ctx = setup();
    await ctx.startWorker().refresh();
    expect(ctx.browser.alarms.size).toBe(0);
    expect(ctx.browser.badge).toBe('');
  });

  it('schedules the alarms and the badge on install or startup', async () => {
    const ctx = setup();
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    expect([...ctx.browser.alarms.keys()].sort()).toEqual([EVENING_ALARM, MIDNIGHT_ALARM, MORNING_ALARM].sort());
    expect(ctx.browser.alarms.get(MORNING_ALARM)).toBe(at(START, 8, 30));
    expect(Number(ctx.browser.badge)).toBeGreaterThan(0);
  });

  it('recomputes alarms when the notification times change', async () => {
    const ctx = setup();
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    await ctx.actions.updateSettings({ morningNotify: '09:15', eveningNotify: '21:00' });
    await ctx.startWorker().refresh();
    expect(ctx.browser.alarms.get(MORNING_ALARM)).toBe(at(START, 9, 15));
    expect(ctx.browser.alarms.get(EVENING_ALARM)).toBe(at(START, 21, 0));
  });

  it('shows the morning summary, reschedules itself and opens the dashboard on click', async () => {
    const ctx = setup();
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();

    await fire(ctx, MORNING_ALARM);
    const note = ctx.browser.notifications.get(MORNING_NOTIFICATION_ID)!;
    expect(note.message).toMatch(/^Today: 2 new, 2 benchmarks · ~/);
    expect(ctx.browser.alarms.get(MORNING_ALARM)).toBe(at(day(2), 8, 30));

    await ctx.startWorker().handleNotificationClick(MORNING_NOTIFICATION_ID);
    expect(ctx.browser.dashboardOpened).toEqual(['#/today']);
    expect(ctx.browser.notifications.has(MORNING_NOTIFICATION_ID)).toBe(false);
  });

  it('ignores clicks on foreign notifications', async () => {
    const ctx = setup();
    await ctx.startWorker().handleNotificationClick('something-else');
    expect(ctx.browser.dashboardOpened).toEqual([]);
  });

  it('sends the evening summary only while today is not done', async () => {
    const ctx = setup();
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();

    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.get(EVENING_NOTIFICATION_ID)?.message).toMatch(/^Today: 0 done, 4 left, 0 min logged$/);

    // Finish the whole plan the next day and the reminder stays quiet.
    ctx.browser.notifications.clear();
    ctx.clock.now = at(day(2), 9);
    await ctx.actions.materializeToday();
    const ids = (await ctx.store.readState()).activities.filter((a) => a.dueDate === day(2)).map((a) => a.id);
    for (const id of ids) await ctx.actions.completeActivity(id, 'solo', 60 * 60_000);
    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.size).toBe(0);
  });

  it('updates the badge on every state change and at 04:00, without worker memory', async () => {
    const ctx = setup(at(START, 9));
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    const before = Number(ctx.browser.badge);

    await ctx.actions.materializeToday();
    const first = (await ctx.store.readState()).activities.find((a) => a.type === 'new')!;
    await ctx.actions.completeActivity(first.id, 'solo', 25 * 60_000);
    await ctx.startWorker().refresh(); // a brand-new worker, as after the old one was killed
    expect(Number(ctx.browser.badge)).toBe(before - 1);

    // The legacy alarm ID now fires at 04:00: the badge shows the new training day's plan.
    await ctx.startWorker().refresh();
    await fire(ctx, MIDNIGHT_ALARM);
    expect(ctx.clock.now).toBeGreaterThanOrEqual(at(day(2), 0, 0));
    expect(Number(ctx.browser.badge)).toBeGreaterThan(0);
    expect(ctx.browser.alarms.get(MIDNIGHT_ALARM)).toBe(at(day(3), 4, 0) + 5000);
  });

  it('skips a notification that fires on a later day than scheduled', async () => {
    const ctx = setup();
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    const scheduledTime = ctx.browser.alarms.get(MORNING_ALARM)!;
    ctx.browser.alarms.delete(MORNING_ALARM);
    ctx.clock.now = at(day(3), 9);
    await ctx.startWorker().handleAlarm({ name: MORNING_ALARM, scheduledTime });
    expect(ctx.browser.notifications.size).toBe(0);
    expect(ctx.browser.alarms.has(MORNING_ALARM)).toBe(true);
  });
});

describe('smart evening reminder', () => {
  async function finishToday(ctx: ReturnType<typeof setup>, date: string): Promise<void> {
    ctx.clock.now = at(date, 12);
    await ctx.actions.materializeToday();
    const ids = (await ctx.store.readState()).activities.filter((a) => a.dueDate === date && a.status === 'planned').map((a) => a.id);
    for (const id of ids) await ctx.actions.completeActivity(id, 'solo', 10 * 60_000);
  }

  it('shows a partial-day summary in the evening', async () => {
    const ctx = setup(at(START, 7));
    await ctx.actions.initialize(START);
    ctx.clock.now = at(START, 12);
    await ctx.actions.materializeToday();
    const first = (await ctx.store.readState()).activities[0]!;
    await ctx.actions.completeActivity(first.id, 'solo', 25 * 60_000);
    await ctx.startWorker().refresh();
    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.get(EVENING_NOTIFICATION_ID)?.message).toBe('Today: 1 done, 3 left, 25 min logged');
  });

  it('is silent on a finished day and speaks again when the setting is turned off', async () => {
    const ctx = setup(at(START, 7));
    await ctx.actions.initialize(START);
    await finishToday(ctx, START);
    await ctx.startWorker().refresh();
    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.has(EVENING_NOTIFICATION_ID)).toBe(false);

    await ctx.actions.updateSettings({ eveningOnlyIfOpen: false });
    expect((await ctx.store.readState()).settings.eveningOnlyIfOpen).toBe(false);
    ctx.clock.now = at(START, 20, 0) + 1000;
    await ctx.startWorker().handleAlarm({ name: EVENING_ALARM, scheduledTime: at(START, 20, 0) });
    expect(ctx.browser.notifications.get(EVENING_NOTIFICATION_ID)?.message).toMatch(/^Today: 4 done, 0 left, \d+ min logged$/);

    // Switching back to the default removes the field again.
    await ctx.actions.updateSettings({ eveningOnlyIfOpen: undefined });
    expect((await ctx.store.readState()).settings).not.toHaveProperty('eveningOnlyIfOpen');
  });

  it('drops an evening alarm delivered after 04:00 and clears stale notifications at the cutoff', async () => {
    const ctx = setup(at(START, 7));
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    await fire(ctx, MORNING_ALARM);
    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.size).toBe(2);

    await fire(ctx, MIDNIGHT_ALARM);
    expect(ctx.browser.notifications.size).toBe(0);

    // Laptop asleep past the cutoff: yesterday's 20:00 alarm arrives at 04:30.
    ctx.clock.now = at(day(2), 4, 30);
    await ctx.startWorker().handleAlarm({ name: EVENING_ALARM, scheduledTime: at(START, 20, 0) });
    expect(ctx.browser.notifications.size).toBe(0);
  });

  it('after skipped days the next evening reminder describes the current day only', async () => {
    const ctx = setup(at(START, 7));
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    // Nothing is done on days 1-3 and the browser is closed; it is restarted on day 4 in the afternoon.
    ctx.browser.alarms.clear();
    ctx.clock.now = at(day(4), 15);
    await ctx.startWorker().refresh();
    expect(ctx.browser.alarms.get(EVENING_ALARM)).toBe(at(day(4), 20, 0));
    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.get(EVENING_NOTIFICATION_ID)?.message).toMatch(/^Today: 0 done, \d+ left, 0 min logged$/);
    // Only one reminder: nothing is replayed for the skipped days.
    expect(ctx.browser.notifications.size).toBe(1);
  });
});
