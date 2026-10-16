import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  dateFromDayIndex,
  dayIndex,
  diffDays,
  formatLocalDate,
  isValidDateString,
  localDateFromTimestamp,
} from './dates';

describe('dates', () => {
  it('adds days across month, year and leap-year boundaries', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDays('2025-01-06', 21)).toBe('2025-01-27');
    expect(addDays('2025-01-06', 0)).toBe('2025-01-06');
  });

  it('is not affected by daylight saving transitions', () => {
    expect(addDays('2025-03-09', 1)).toBe('2025-03-10');
    expect(addDays('2025-10-26', 1)).toBe('2025-10-27');
    expect(diffDays('2025-03-08', '2025-03-10')).toBe(2);
    expect(diffDays('2025-10-25', '2025-10-27')).toBe(2);
  });

  it('computes differences in whole days', () => {
    expect(diffDays('2025-01-01', '2025-01-31')).toBe(30);
    expect(diffDays('2025-01-31', '2025-01-01')).toBe(-30);
    expect(diffDays('2025-01-01', '2025-01-01')).toBe(0);
    expect(diffDays('2024-12-31', '2025-12-31')).toBe(365);
  });

  it('computes 1-based day indexes from the start date', () => {
    expect(dayIndex('2025-01-06', '2025-01-06')).toBe(1);
    expect(dayIndex('2025-01-06', '2025-01-07')).toBe(2);
    expect(dayIndex('2025-01-06', '2025-02-04')).toBe(30);
    expect(dayIndex('2025-01-06', '2025-01-05')).toBe(0);
    expect(dateFromDayIndex('2025-01-06', 30)).toBe('2025-02-04');
    expect(dateFromDayIndex('2025-01-06', 1)).toBe('2025-01-06');
  });

  it('compares dates', () => {
    expect(compareDates('2025-01-01', '2025-01-02')).toBeLessThan(0);
    expect(compareDates('2025-01-02', '2025-01-01')).toBeGreaterThan(0);
    expect(compareDates('2025-01-02', '2025-01-02')).toBe(0);
  });

  it('validates date strings', () => {
    expect(isValidDateString('2025-01-06')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2025-02-29')).toBe(false);
    expect(isValidDateString('2025-13-01')).toBe(false);
    expect(isValidDateString('2025-1-1')).toBe(false);
    expect(isValidDateString('nope')).toBe(false);
    expect(isValidDateString(20250106)).toBe(false);
    expect(() => addDays('bad', 1)).toThrow();
  });

  it('formats local dates', () => {
    expect(formatLocalDate(new Date(2025, 0, 6, 23, 59))).toBe('2025-01-06');
    expect(formatLocalDate(new Date(2025, 11, 5, 0, 0))).toBe('2025-12-05');
    expect(localDateFromTimestamp(new Date(2025, 5, 7, 12).getTime())).toBe('2025-06-07');
  });
});
