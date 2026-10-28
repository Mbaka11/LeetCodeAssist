// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultState, serializeState } from '../core/state';
import {
  APPEARANCE_KEY,
  APPEARANCE_MIRROR_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  normalizeAppearance,
  readMirroredAppearance,
  saveAppearance,
  startAppearance,
  writeMirroredAppearance,
} from './appearance';
import { createLeetCodeStorage } from './leetcodeStorage';
import { STORAGE_KEY } from './storage';
import { createMockChromeStorage, createTestApp, flush, installChromeGlobal } from './testing';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-text-size');
});
afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('appearance preference', () => {
  it('defaults to the system theme at normal size and repairs each field on its own', () => {
    expect(normalizeAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance('dark')).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({ theme: 'light', textSize: 'huge' })).toEqual({ theme: 'light', textSize: 'normal' });
    expect(normalizeAppearance({ theme: 'sepia', textSize: 'large' })).toEqual({ theme: 'system', textSize: 'large' });
    expect(normalizeAppearance({ theme: 'dark', textSize: 'small', extra: 1 })).toEqual({ theme: 'dark', textSize: 'small' });
  });

  it('sets data attributes only for non-default values', () => {
    const root = document.documentElement;
    applyAppearance(root, { theme: 'dark', textSize: 'large' });
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-text-size')).toBe('large');
    applyAppearance(root, { theme: 'light', textSize: 'small' });
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-text-size')).toBe('small');
    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-text-size')).toBe(false);
  });

  it('keeps a localStorage mirror and tolerates a broken or missing one', () => {
    expect(readMirroredAppearance()).toEqual(DEFAULT_APPEARANCE);
    writeMirroredAppearance({ theme: 'dark', textSize: 'small' });
    expect(readMirroredAppearance()).toEqual({ theme: 'dark', textSize: 'small' });
    localStorage.setItem(APPEARANCE_MIRROR_KEY, '{not json');
    expect(readMirroredAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(readMirroredAppearance({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_APPEARANCE);
    expect(() => writeMirroredAppearance(DEFAULT_APPEARANCE, { setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });

  it('startAppearance applies the mirror at once and then follows chrome.storage.local, refreshing the mirror', async () => {
    const mock = createMockChromeStorage();
    installChromeGlobal(mock);
    writeMirroredAppearance({ theme: 'dark', textSize: 'normal' });
    const stop = startAppearance();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark'); // before storage answered
    await flush();
    // Storage is the truth: it has nothing stored, so the defaults apply and the mirror follows.
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(readMirroredAppearance()).toEqual(DEFAULT_APPEARANCE);

    await saveAppearance(DEFAULT_APPEARANCE, { theme: 'light', textSize: 'large' });
    await flush();
    expect(mock.data[APPEARANCE_KEY]).toEqual({ theme: 'light', textSize: 'large' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
    expect(readMirroredAppearance()).toEqual({ theme: 'light', textSize: 'large' });
    stop();
  });

  it('is device-local: separate key, not in the state, the export or the sync data, and reset keeps it', async () => {
    const { actions, store, mock } = createTestApp(defaultState('2025-01-06'));
    installChromeGlobal(mock);
    await saveAppearance(DEFAULT_APPEARANCE, { theme: 'dark', textSize: 'small' });
    expect(Object.keys(mock.data).sort()).toEqual([APPEARANCE_KEY, STORAGE_KEY].sort());

    const state = await store.readState();
    expect(JSON.stringify(state)).not.toContain('small');
    expect(JSON.stringify(state)).not.toContain(APPEARANCE_KEY);
    expect(serializeState(state)).toBe(serializeState(defaultState('2025-01-06')));
    expect(await actions.exportJson()).not.toMatch(/textSize|"theme"|appearance/i);

    await actions.reset();
    await createLeetCodeStorage(mock.area).clearAll();
    expect(mock.data[APPEARANCE_KEY]).toEqual({ theme: 'dark', textSize: 'small' });
  });
});
