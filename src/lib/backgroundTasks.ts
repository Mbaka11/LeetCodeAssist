/**
 * The background worker's behaviour with its browser dependencies injected. Nothing is kept in
 * memory between calls: every task re-reads the stored state, so it keeps working after the
 * service worker has been killed and restarted.
 */
import { trainingDateFromTimestamp } from '../core/dates';
import type { AppState } from '../core/types';
import {
  EVENING_ALARM,
  MIDNIGHT_ALARM,
  MORNING_ALARM,
  alarmsToCreate,
  badgeText,
  eveningNotification,
  morningNotification,
  type AlarmSpec,
  type ExistingAlarm,
  type NotificationContent,
} from './reminders';

export const MORNING_NOTIFICATION_ID = 'leetcode-assist-morning';
export const EVENING_NOTIFICATION_ID = 'leetcode-assist-evening';

export interface BackgroundDeps {
  /** The stored state, or null when nothing valid is stored. */
  readState(): Promise<AppState | null>;
  getAlarms(): Promise<ExistingAlarm[]>;
  createAlarm(spec: AlarmSpec): Promise<void>;
  showNotification(id: string, content: NotificationContent): Promise<void>;
  clearNotification(id: string): Promise<void>;
  setBadge(text: string): Promise<void>;
  openDashboard(hash: string): Promise<void>;
  now(): number;
}

export interface BackgroundTasks {
  /** Creates the alarms that are missing or no longer match the settings. */
  refreshAlarms(): Promise<void>;
  refreshBadge(): Promise<void>;
  /** Startup, install and storage changes: alarms and badge. */
  refresh(): Promise<void>;
  handleAlarm(alarm: { name: string; scheduledTime: number }): Promise<void>;
  handleNotificationClick(id: string): Promise<void>;
}

export function createBackgroundTasks(deps: BackgroundDeps): BackgroundTasks {
  const refreshAlarms = async (): Promise<void> => {
    const state = await deps.readState();
    if (!state) return;
    const missing = alarmsToCreate(await deps.getAlarms(), state.settings, deps.now());
    for (const spec of missing) await deps.createAlarm(spec);
  };

  const refreshBadge = async (): Promise<void> => {
    await deps.setBadge(badgeText(await deps.readState(), deps.now()));
  };

  const refresh = async (): Promise<void> => {
    await refreshAlarms();
    await refreshBadge();
  };

  return {
    refreshAlarms,
    refreshBadge,
    refresh,
    async handleAlarm(alarm) {
      const now = deps.now();
      const state = await deps.readState();
      // A notification that fires late (the browser was closed) is only useful on the same day.
      const sameDay = trainingDateFromTimestamp(alarm.scheduledTime) === trainingDateFromTimestamp(now);
      if (state && sameDay) {
        const content =
          alarm.name === MORNING_ALARM
            ? morningNotification(state, now)
            : alarm.name === EVENING_ALARM
              ? eveningNotification(state, now)
              : null;
        if (content) {
          await deps.showNotification(
            alarm.name === MORNING_ALARM ? MORNING_NOTIFICATION_ID : EVENING_NOTIFICATION_ID,
            content,
          );
        }
      }
      // A new day starts: yesterday's summaries must not linger in the notification center.
      if (alarm.name === MIDNIGHT_ALARM) {
        await deps.clearNotification(MORNING_NOTIFICATION_ID);
        await deps.clearNotification(EVENING_NOTIFICATION_ID);
      }
      // A fired alarm is gone: schedule the next one, and the badge always reflects the new moment.
      await refresh();
    },
    async handleNotificationClick(id) {
      if (id !== MORNING_NOTIFICATION_ID && id !== EVENING_NOTIFICATION_ID) return;
      await deps.clearNotification(id);
      await deps.openDashboard('#/today');
    },
  };
}
