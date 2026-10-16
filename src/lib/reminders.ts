/**
 * Pure logic behind the background worker: which alarms must exist, what the notifications say and
 * what the toolbar badge shows. Everything is derived from the stored state and a timestamp, so it
 * works no matter how often the service worker is killed.
 */
import { localDateFromTimestamp } from '../core/dates';
import { planDay, type PlanItem } from '../core/planner';
import { dailyTargetMinutes } from '../core/state';
import { elapsedMs } from '../core/timer';
import type { ActivityType, AppState, Settings } from '../core/types';
import { formatMinutes } from './format';

export const MORNING_ALARM = 'morning-summary';
export const EVENING_ALARM = 'evening-reminder';
export const MIDNIGHT_ALARM = 'midnight-refresh';

export interface ExistingAlarm {
  name: string;
  scheduledTime: number;
}

export interface AlarmSpec {
  name: string;
  /** Timestamp (ms since epoch) of the next firing. */
  when: number;
}

interface DailyTime {
  name: string;
  hour: number;
  minute: number;
  second: number;
}

/** Offset after midnight so the refresh runs in the new day even with a little clock skew. */
const MIDNIGHT_OFFSET_SECONDS = 5;

function dailyTimes(settings: Settings): DailyTime[] {
  const parse = (time: string): [number, number] => {
    const [hour, minute] = time.split(':').map(Number);
    return [hour ?? 0, minute ?? 0];
  };
  const [morningHour, morningMinute] = parse(settings.morningNotify);
  const [eveningHour, eveningMinute] = parse(settings.eveningNotify);
  return [
    { name: MORNING_ALARM, hour: morningHour, minute: morningMinute, second: 0 },
    { name: EVENING_ALARM, hour: eveningHour, minute: eveningMinute, second: 0 },
    { name: MIDNIGHT_ALARM, hour: 0, minute: 0, second: MIDNIGHT_OFFSET_SECONDS },
  ];
}

/** The next local time strictly after `now` with the given wall-clock time (DST-safe). */
function nextLocalTime(time: DailyTime, now: number): number {
  const candidate = new Date(now);
  candidate.setHours(time.hour, time.minute, time.second, 0);
  if (candidate.getTime() <= now) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(time.hour, time.minute, time.second, 0);
  }
  return candidate.getTime();
}

function matches(alarm: ExistingAlarm, time: DailyTime, now: number): boolean {
  const scheduled = new Date(alarm.scheduledTime);
  return (
    alarm.scheduledTime > now &&
    scheduled.getHours() === time.hour &&
    scheduled.getMinutes() === time.minute &&
    scheduled.getSeconds() === time.second
  );
}

/**
 * The alarms that have to be (re)created: the ones that are missing (an alarm is gone once it has
 * fired) or scheduled for a time that no longer matches the settings. Correct alarms are left alone.
 */
export function alarmsToCreate(
  existing: readonly ExistingAlarm[],
  settings: Settings,
  now: number,
): AlarmSpec[] {
  const specs: AlarmSpec[] = [];
  for (const time of dailyTimes(settings)) {
    const current = existing.find((alarm) => alarm.name === time.name);
    if (current && matches(current, time, now)) continue;
    specs.push({ name: time.name, when: nextLocalTime(time, now) });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Today's summary
// ---------------------------------------------------------------------------

export interface TodaySummary {
  /** Activities of today's plan that are still to do (planned or in progress). */
  open: PlanItem[];
  remainingMinutes: number;
  loggedMs: number;
  targetMinutes: number;
}

/** Null before the program has started. */
export function summarizeToday(state: AppState, now: number): TodaySummary | null {
  const today = localDateFromTimestamp(now);
  const plan = planDay(state, today);
  if (plan.dayIndex < 1) return null;
  const open = plan.items.filter(
    (item) => item.activity.status === 'planned' || item.activity.status === 'in_progress',
  );
  const loggedMs = state.activities.reduce((sum, a) => {
    if (a.status === 'done' && a.completedAt === today) return sum + (a.totalMs ?? 0);
    if (a.status === 'in_progress') return sum + elapsedMs(a.timer, now);
    return sum;
  }, 0);
  return {
    open,
    remainingMinutes: open.reduce((sum, item) => sum + item.minutes, 0),
    loggedMs,
    targetMinutes: dailyTargetMinutes(state.settings, today),
  };
}

/** Toolbar badge text: the number of activities left today, empty when none (or before the start). */
export function badgeText(state: AppState | null, now: number): string {
  const summary = state ? summarizeToday(state, now) : null;
  return summary && summary.open.length > 0 ? String(summary.open.length) : '';
}

const TYPE_ORDER: readonly ActivityType[] = [
  'new',
  'recall',
  'rebuild',
  'resolve',
  'blind',
  'retry',
  'benchmark',
];
const TYPE_NOUNS: Record<ActivityType, readonly [singular: string, plural: string]> = {
  new: ['new', 'new'],
  recall: ['recall', 'recalls'],
  rebuild: ['rebuild', 'rebuilds'],
  resolve: ['re-solve', 're-solves'],
  blind: ['blind', 'blinds'],
  retry: ['retry', 'retries'],
  benchmark: ['benchmark', 'benchmarks'],
};

/** "2 new, 2 recalls, 1 rebuild" */
export function describeActivities(items: readonly PlanItem[]): string {
  const parts: string[] = [];
  for (const type of TYPE_ORDER) {
    const count = items.filter((item) => item.activity.type === type).length;
    if (count > 0) parts.push(`${count} ${TYPE_NOUNS[type][count === 1 ? 0 : 1]}`);
  }
  return parts.join(', ');
}

export interface NotificationContent {
  title: string;
  message: string;
}

/** Morning summary, e.g. "Today: 2 new, 2 recalls, 1 rebuild · ~2h20". Null when there is nothing to do. */
export function morningNotification(state: AppState, now: number): NotificationContent | null {
  const summary = summarizeToday(state, now);
  if (!summary || summary.open.length === 0) return null;
  const plan = planDay(state, localDateFromTimestamp(now));
  return {
    title: `LeetCode Assist · Day ${plan.dayIndex}`,
    message: `Today: ${describeActivities(summary.open)} · ~${formatMinutes(summary.remainingMinutes)}`,
  };
}

/** Evening reminder. Null when the daily target is already met (or the program has not started). */
export function eveningNotification(state: AppState, now: number): NotificationContent | null {
  const summary = summarizeToday(state, now);
  if (!summary) return null;
  const loggedMin = summary.loggedMs / 60_000;
  if (loggedMin >= summary.targetMinutes) return null;
  const logged = `${formatMinutes(loggedMin)} of ${formatMinutes(summary.targetMinutes)} logged today`;
  const left =
    summary.open.length === 0
      ? 'all planned activities are done'
      : `${summary.open.length} left (${describeActivities(summary.open)}) · ~${formatMinutes(summary.remainingMinutes)}`;
  return { title: 'LeetCode Assist · Evening check', message: `${logged} · ${left}` };
}
