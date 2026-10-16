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

  it('sends the evening reminder only while the target is not met', async () => {
    const ctx = setup();
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();

    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.get(EVENING_NOTIFICATION_ID)?.message).toContain('logged today');

    // Meet the target the next day and the reminder stays quiet.
    ctx.browser.notifications.clear();
    ctx.clock.now = at(day(2), 9);
    await ctx.actions.materializeToday();
    const ids = (await ctx.store.readState()).activities.filter((a) => a.dueDate === day(2)).map((a) => a.id);
    for (const id of ids) await ctx.actions.completeActivity(id, 'solo', 60 * 60_000);
    await fire(ctx, EVENING_ALARM);
    expect(ctx.browser.notifications.size).toBe(0);
  });

  it('updates the badge on every state change and at midnight, without any worker memory', async () => {
    const ctx = setup(at(START, 9));
    await ctx.actions.initialize(START);
    await ctx.startWorker().refresh();
    const before = Number(ctx.browser.badge);

    await ctx.actions.materializeToday();
    const first = (await ctx.store.readState()).activities.find((a) => a.type === 'new')!;
    await ctx.actions.completeActivity(first.id, 'solo', 25 * 60_000);
    await ctx.startWorker().refresh(); // a brand-new worker, as after the old one was killed
    expect(Number(ctx.browser.badge)).toBe(before - 1);

    // Midnight alarm: the badge shows the new day's plan.
    await ctx.startWorker().refresh();
    await fire(ctx, MIDNIGHT_ALARM);
    expect(ctx.clock.now).toBeGreaterThanOrEqual(at(day(2), 0, 0));
    expect(Number(ctx.browser.badge)).toBeGreaterThan(0);
    expect(ctx.browser.alarms.get(MIDNIGHT_ALARM)).toBe(at(day(3), 0, 0) + 5000);
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
