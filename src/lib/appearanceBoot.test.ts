import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_MIRROR_KEY, DEFAULT_APPEARANCE, applyAppearance, type Appearance } from './appearance';

// public/appearance-boot.js runs before the first paint (a classic script, outside the bundle). It must
// set the same attributes as applyAppearance(); it is executed here against stand-ins for the page.
const bootScript = readFileSync(new URL('../../public/appearance-boot.js', import.meta.url), 'utf8');

class FakeRoot {
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

function runBoot(mirror: string | null): FakeRoot {
  const root = new FakeRoot();
  const localStorage = { getItem: (key: string) => (key === APPEARANCE_MIRROR_KEY ? mirror : null) };
  new Function('localStorage', 'document', bootScript)(localStorage, { documentElement: root });
  return root;
}

describe('public/appearance-boot.js', () => {
  it.each(
    (['system', 'dark', 'light'] as const).flatMap((theme) => (['small', 'normal', 'large'] as const).map((textSize) => ({ theme, textSize }))),
  )('applies %j like applyAppearance', (appearance: Appearance) => {
    const expected = new FakeRoot();
    applyAppearance(expected as unknown as HTMLElement, appearance);
    expect(runBoot(JSON.stringify(appearance)).attributes).toEqual(expected.attributes);
  });

  it('leaves the defaults alone for a missing, broken or hostile mirror', () => {
    for (const mirror of [null, '', '{not json', 'null', JSON.stringify({ theme: '<script>', textSize: 7 }), JSON.stringify(DEFAULT_APPEARANCE)]) {
      expect(runBoot(mirror).attributes.size).toBe(0);
    }
  });

  it('does not throw when localStorage is blocked', () => {
    const root = new FakeRoot();
    const blocked = { getItem: () => { throw new Error('blocked'); } };
    expect(() => new Function('localStorage', 'document', bootScript)(blocked, { documentElement: root })).not.toThrow();
    expect(root.attributes.size).toBe(0);
  });
});
