import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Stylesheet contract checks: palette contrast computed from the real CSS, and the data-attribute hooks.
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing block ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start + selector.length + 3, css.indexOf('\n}', start));
}

function variables(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const lightBase = variables(block(':root'));
const systemDark = variables(css.slice(css.indexOf("@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {"), css.indexOf("\n:root[data-theme='dark'] {")));
const forcedDark = variables(block(":root[data-theme='dark']"));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_COLOURS = ['--text', '--muted', '--accent', '--good', '--warn', '--bad', '--tone-resolve', '--tone-blind', '--tone-benchmark'];
const BACKGROUNDS = ['--bg', '--surface', '--surface-2'];

describe.each([
  ['light', lightBase],
  ['dark', { ...lightBase, ...forcedDark }],
] as const)('%s palette', (_name, palette) => {
  it.each(TEXT_COLOURS)('%s text is at least 4.5:1 on every background', (colour) => {
    for (const background of BACKGROUNDS) {
      expect(contrast(palette[colour]!, palette[background]!), `${colour} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps button text readable on the accent fill and form-control outlines visible', () => {
    expect(contrast(palette['--accent-text']!, palette['--accent']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette['--control-border']!, palette['--surface']!)).toBeGreaterThanOrEqual(3);
  });
});

describe('theme switching', () => {
  it('writes the two dark blocks (system dark and forced dark) with the same values', () => {
    const { '--timer-good-fg': _a, ...sameKeys } = forcedDark;
    expect(Object.keys(systemDark).sort()).toEqual(Object.keys(sameKeys).sort());
    expect(systemDark).toEqual(sameKeys);
  });

  it('forces light and dark through data-theme and follows the system only without it', () => {
    expect(css).toContain(":root[data-theme='light'] {\n  color-scheme: light;");
    expect(css).toContain(":root[data-theme='dark'] {\n  color-scheme: dark;");
    expect(css).toContain("@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {");
  });

  it('scales the root font size for small and large text', () => {
    expect(css).toMatch(/:root\[data-text-size='small'\] \{\s*font-size: 13\.5px;/);
    expect(css).toMatch(/:root\[data-text-size='large'\] \{\s*font-size: 17\.5px;/);
  });

  it('keeps the timer colours of both dark selectors identical', () => {
    const timerDark = variables(css.slice(css.indexOf("  :root:not([data-theme='light']) {\n    --timer-good-fg"), css.indexOf("\n:root[data-theme='dark'] {\n  --timer-good-fg")));
    const timerForced = variables(css.slice(css.indexOf("\n:root[data-theme='dark'] {\n  --timer-good-fg"), css.indexOf('\n}', css.indexOf("\n:root[data-theme='dark'] {\n  --timer-good-fg"))));
    expect(Object.keys(timerDark)).toHaveLength(6);
    expect(timerDark).toEqual(timerForced);
  });

  it('uses no hard-coded colours outside variables for badges, heatmap cells and dialogs', () => {
    for (const rule of ['.badge-resolve', '.badge-blind', '.badge-benchmark']) expect(css).not.toMatch(new RegExp(`${rule.replace('.', '\\.')}[^}]*#[0-9a-f]{3,6}`, 'i'));
    expect(css).toMatch(/\.heat-1 \{[^}]*var\(--heat-1\)/);
    expect(css).toContain('box-shadow: var(--dialog-shadow)');
  });
});
