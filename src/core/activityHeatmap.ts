import { addDays } from './dates';
import { buildLogRows } from './logs';
import type { AppState } from './types';

export interface ActivityHeatDay {
  date: string;
  minutes: number;
  level: number;
  future: boolean;
}

/** Completed log time only, including existing optional attempts; no live timer or skipped estimates. */
export function activityHeatDays(state: AppState, start: string, count: number, today: string): ActivityHeatDay[] {
  const minutes = new Map<string, number>();
  for (const row of buildLogRows(state)) {
    if (row.status !== 'done') continue;
    minutes.set(row.date, (minutes.get(row.date) ?? 0) + (row.loggedMinutes ?? 0));
  }
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index);
    const total = minutes.get(date) ?? 0;
    return { date, minutes: total, future: date > today,
      level: total === 0 ? 0 : total < 30 ? 1 : total < 60 ? 2 : total < 120 ? 3 : 4 };
  });
}
