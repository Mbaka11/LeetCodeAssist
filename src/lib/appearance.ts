/**
 * Device-local appearance preference (theme and text size).
 *
 * It lives under its own `chrome.storage.local` key: it is NOT part of `AppState`, is never exported to
 * the JSON backup and never synced (a phone-sized window and a desktop monitor want different sizes, and
 * the theme is a property of the screen). "Reset all data" does not clear it. The values are applied as
 * `data-theme` and `data-text-size` on `<html>`; with no attribute the page follows the system theme at
 * the normal size. A copy in `localStorage` of the extension origin lets `public/appearance-boot.js` set
 * the attributes before the first paint; `chrome.storage.local` stays the source of truth.
 */
import { useSyncExternalStore } from 'react';
import { createWatchedValue } from './leetcodeStorage';

export const APPEARANCE_KEY = 'leetcodeAssist.appearance.v1';
/** `localStorage` copy read synchronously at page start. Keep in sync with `public/appearance-boot.js`. */
export const APPEARANCE_MIRROR_KEY = 'leetcodeAssist.appearance.mirror';

export const THEMES = ['system', 'dark', 'light'] as const;
export const TEXT_SIZES = ['small', 'normal', 'large'] as const;
export type ThemePreference = (typeof THEMES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Appearance {
  theme: ThemePreference;
  textSize: TextSize;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: 'system', textSize: 'normal' };

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Follow the system',
  dark: 'Dark',
  light: 'Light',
};
export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: 'Small',
  normal: 'Normal',
  large: 'Large',
};

/** Each field falls back to its default on its own, so one bad value never resets the other. */
export function normalizeAppearance(raw: unknown): Appearance {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_APPEARANCE;
  const r = raw as Record<string, unknown>;
  return {
    theme: THEMES.find((theme) => theme === r.theme) ?? DEFAULT_APPEARANCE.theme,
    textSize: TEXT_SIZES.find((size) => size === r.textSize) ?? DEFAULT_APPEARANCE.textSize,
  };
}

/** The defaults are expressed by the absence of an attribute, so the CSS defaults stay the single source. */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  if (appearance.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', appearance.theme);
  if (appearance.textSize === 'normal') root.removeAttribute('data-text-size');
  else root.setAttribute('data-text-size', appearance.textSize);
}

export function readMirroredAppearance(storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage()): Appearance {
  try {
    const text = storage?.getItem(APPEARANCE_MIRROR_KEY);
    return normalizeAppearance(text ? JSON.parse(text) : undefined);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeMirroredAppearance(appearance: Appearance, storage: Pick<Storage, 'setItem'> | undefined = safeLocalStorage()): void {
  try {
    storage?.setItem(APPEARANCE_MIRROR_KEY, JSON.stringify(appearance));
  } catch {
    // The mirror only avoids a flash; losing it is harmless.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

const appearanceValue = createWatchedValue<Appearance>(APPEARANCE_KEY, normalizeAppearance, DEFAULT_APPEARANCE);

export const useAppearance = (): Appearance =>
  useSyncExternalStore(appearanceValue.subscribe, appearanceValue.getSnapshot, appearanceValue.getSnapshot);

/** Writes the preference to this device's `chrome.storage.local` (every open extension page follows it). */
export function saveAppearance(current: Appearance, change: Partial<Appearance>): Promise<void> {
  return chrome.storage.local.set({ [APPEARANCE_KEY]: normalizeAppearance({ ...current, ...change }) });
}

/** Extension page start: apply the mirrored value at once, then follow `chrome.storage.local`. */
export function startAppearance(root: HTMLElement = document.documentElement): () => void {
  applyAppearance(root, readMirroredAppearance());
  return appearanceValue.subscribe(() => {
    const appearance = appearanceValue.getSnapshot();
    applyAppearance(root, appearance);
    writeMirroredAppearance(appearance);
  });
}
