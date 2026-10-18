import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// These are stylesheet contract checks only. They cannot prove how the page lays out in a browser.
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Declarations of the first rule whose selector list is exactly `selector` (at the start of a line). */
function rule(selector: string, source = css): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

/** The body of the first `@media` block that starts with `query`. */
function media(query: string): string {
  const start = css.indexOf(`@media ${query} {`);
  expect(start, `@media ${query}`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf('\n}\n', start);
  return css.slice(start, end).split('\n').slice(1).map((line: string) => line.replace(/^ {2}/, '')).join('\n');
}

describe('calendar summary stylesheet contract', () => {
  it('stacks the summary cards by default and puts them side by side from 1000px', () => {
    expect(rule('.cal-summary')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    const wide = media('(min-width: 1000px)');
    expect(rule('.cal-summary', `\n${wide}`)).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1\.1fr\)\s*minmax\(0,\s*1fr\)/,
    );
  });

  it('matches the card heights side by side while keeping stacked cards at their natural heights', () => {
    expect(rule('.cal-summary')).toContain('align-items: start');
    const wide = media('(min-width: 1000px)');
    expect(rule('.cal-summary', `\n${wide}`)).toContain('align-items: stretch');
  });

  it('lets the cards shrink so a narrow screen has no horizontal page overflow', () => {
    expect(rule('.cal-summary > .card')).toContain('min-width: 0');
    expect(rule('.heat-grid')).toContain('overflow-x: auto');
  });

  it('scopes the compact padding and sizes to the calendar summary and leaves the global card alone', () => {
    expect(rule('.card')).toContain('padding: 16px 18px');
    expect(rule('.cal-summary > .card')).toContain('padding: 10px 14px');
    expect(rule('.stat-value')).toContain('font-size: 1.4rem');
    expect(rule('.stat-hint')).toContain('font-size: 0.8rem');
    const value = /font-size:\s*([\d.]+)rem/.exec(rule('.cal-summary .stat-value'));
    const hint = /font-size:\s*([\d.]+)rem/.exec(rule('.cal-summary .stat-hint'));
    expect(Number(value![1])).toBeGreaterThanOrEqual(1);
    expect(Number(hint![1])).toBeGreaterThanOrEqual(0.75);
  });

  it('does not clip the day popovers', () => {
    for (const selector of ['.cal-summary', '.calendar-grid', '.cal-cell', '.cal-popover']) {
      expect(rule(selector)).not.toMatch(/overflow\s*:\s*(hidden|auto|scroll)/);
    }
  });

  it('widens only the calendar page', () => {
    expect(rule('.page.page-calendar')).toContain('max-width: 1120px');
    expect(rule('.page')).toContain('max-width: 900px');
  });
});
