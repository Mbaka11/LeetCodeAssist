/** Local calendar date helpers. Dates are plain `YYYY-MM-DD` strings. */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function toUtcDayNumber(date: string): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new Error(`Invalid date string: "${date}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: "${date}"`);
  }
  return Math.round(utc / MS_PER_DAY);
}

function fromUtcDayNumber(dayNumber: number): string {
  const d = new Date(dayNumber * MS_PER_DAY);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    toUtcDayNumber(value);
    return true;
  } catch {
    return false;
  }
}

/** Formats a Date as a calendar date in the machine's local timezone. */
export function formatLocalDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** Local calendar date for a timestamp (ms since epoch). */
export function localDateFromTimestamp(now: number): string {
  return formatLocalDate(new Date(now));
}

/** All training days run from 04:00 local time to 04:00 the next day. */
export const TRAINING_DAY_START_HOUR = 4;

export function trainingDateFromTimestamp(now: number): string {
  const date = new Date(now);
  const calendarDate = formatLocalDate(date);
  // Compare local wall-clock hours, not now - 4 hours: DST days are not always 24 hours long.
  return date.getHours() < TRAINING_DAY_START_HOUR ? addDays(calendarDate, -1) : calendarDate;
}

/** The real start timestamp of the training day containing `now` (also DST-safe). */
export function trainingDayStart(now: number): number {
  const [year, month, day] = trainingDateFromTimestamp(now).split('-').map(Number);
  return new Date(year!, month! - 1, day!, TRAINING_DAY_START_HOUR).getTime();
}

export function addDays(date: string, days: number): string {
  return fromUtcDayNumber(toUtcDayNumber(date) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  return toUtcDayNumber(to) - toUtcDayNumber(from);
}

/** 1-based program day: `startDate` is day 1. Dates before the start give values <= 0. */
export function dayIndex(startDate: string, date: string): number {
  return diffDays(startDate, date) + 1;
}

/** Inverse of `dayIndex`. */
export function dateFromDayIndex(startDate: string, index: number): string {
  return addDays(startDate, index - 1);
}

export function compareDates(a: string, b: string): number {
  return diffDays(b, a);
}
