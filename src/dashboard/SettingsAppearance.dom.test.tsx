// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import { createActions } from '../lib/actions';
import { APPEARANCE_KEY, startAppearance } from '../lib/appearance';
import { STORAGE_KEY } from '../lib/storage';
import { createTestApp, installChromeGlobal } from '../lib/testing';
import { SettingsView } from './SettingsView';

afterEach(() => {
  cleanup();
  delete (globalThis as { chrome?: unknown }).chrome;
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-text-size');
});

describe('Settings: appearance', () => {
  it('changes theme and text size on this device only, applying them live', async () => {
    const app = createTestApp(defaultState('2026-01-01'));
    installChromeGlobal(app.mock);
    const stop = startAppearance();
    const stateBefore = structuredClone(app.mock.data[STORAGE_KEY]);
    render(<SettingsView state={defaultState('2026-01-01')} actions={createActions(app.store)} />);

    const theme = screen.getByLabelText('Theme') as HTMLSelectElement;
    const size = screen.getByLabelText('Text size') as HTMLSelectElement;
    expect([theme.value, size.value]).toEqual(['system', 'normal']);

    fireEvent.change(theme, { target: { value: 'light' } });
    await waitFor(() => expect(app.mock.data[APPEARANCE_KEY]).toEqual({ theme: 'light', textSize: 'normal' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));

    fireEvent.change(size, { target: { value: 'large' } });
    await waitFor(() => expect(app.mock.data[APPEARANCE_KEY]).toEqual({ theme: 'light', textSize: 'large' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-text-size')).toBe('large'));

    fireEvent.change(theme, { target: { value: 'system' } });
    await waitFor(() => expect(document.documentElement.hasAttribute('data-theme')).toBe(false));
    // The program data are untouched: no write to the state key, nothing synced.
    expect(app.mock.data[STORAGE_KEY]).toEqual(stateBefore);
    expect(screen.getByText(/not exported, not synced, and Reset all data keeps it/)).toBeTruthy();
    stop();
  });
});
