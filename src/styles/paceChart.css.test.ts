import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Stylesheet contract checks only; they cannot prove how the page lays out in a browser.
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('pace chart stylesheet contract', () => {
  it('scales the SVG to its container and wraps the panels so a 360px page needs no horizontal scroll', () => {
    expect(css).toMatch(/\.pace-svg \{[^}]*width: 100%;[^}]*height: auto;/);
    expect(css).toMatch(/\.pace-panels \{[^}]*minmax\(min\(100%, 300px\), 1fr\)/);
  });
  it('marks few-sample points with a hollow fill and gives each series its own color', () => {
    expect(css).toMatch(/\.pace-few \{[^}]*fill: var\(--surface\)/);
    for (const name of ['pace-first', 'pace-review', 'pace-sim', 'pace-guide']) expect(css).toContain(`.${name} {`);
  });
});
