// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultState, serializeState } from '../core/state';
import { createActions } from '../lib/actions';
import { LEETCODE_SETTINGS_KEY } from '../lib/backupFile';
import { LEETCODE_PREFS_KEY } from '../lib/leetcodeStorage';
import { createTestApp, installChromeGlobal } from '../lib/testing';
import { SettingsView } from './SettingsView';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (globalThis as { chrome?: unknown }).chrome;
});

function setup() {
  const app = createTestApp(defaultState('2026-01-01'));
  installChromeGlobal(app.mock);
  const actions = createActions(app.store);
  const view = render(<SettingsView state={defaultState('2026-01-01')} actions={actions} />);
  return { ...app, actions, container: view.container };
}

function chooseFile(container: HTMLElement, text: string): void {
  const file = new File([text], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => text });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
}

const withSection = (section: unknown, extra: object = {}): string =>
  JSON.stringify({ ...defaultState('2026-03-03'), ...extra, [LEETCODE_SETTINGS_KEY]: section });

describe('Settings: LeetCode settings in import and export', () => {
  it('a legacy file shows no LeetCode checkbox and imports as before without touching the prefs', async () => {
    const { container, mock, store } = setup();
    mock.data[LEETCODE_PREFS_KEY] = { detectionEnabled: false, username: 'keep' };
    chooseFile(container, serializeState(defaultState('2026-03-03')));
    await screen.findByRole('button', { name: 'Import and replace' });
    expect(screen.queryByLabelText(/Also restore LeetCode settings/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Import and replace' }));
    await screen.findByText('Imported backup.json.');
    expect((await store.readState()).settings.startDate).toBe('2026-03-03');
    expect(mock.data[LEETCODE_PREFS_KEY]).toEqual({ detectionEnabled: false, username: 'keep' });
  });

  it('a file with the section offers an unticked checkbox; importing without ticking leaves the prefs alone', async () => {
    const { container, mock } = setup();
    mock.data[LEETCODE_PREFS_KEY] = { detectionEnabled: true, username: 'keep' };
    chooseFile(container, withSection({ username: 'from-file', detectionEnabled: false, showDetectionStatus: true }));
    const box = await screen.findByLabelText(/Also restore LeetCode settings from this file/);
    expect(box).toHaveProperty('checked', false);
    expect(screen.getByText(/username from-file, detection off, status shown/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Import and replace' }));
    await screen.findByText('Imported backup.json.');
    expect(mock.data[LEETCODE_PREFS_KEY]).toEqual({ detectionEnabled: true, username: 'keep' });
  });

  it('restores the LeetCode settings only after the box is ticked', async () => {
    const { container, mock, store } = setup();
    mock.data[LEETCODE_PREFS_KEY] = { detectionEnabled: true, username: 'keep' };
    chooseFile(container, withSection({ username: 'from-file', detectionEnabled: false, showDetectionStatus: true }));
    fireEvent.click(await screen.findByLabelText(/Also restore LeetCode settings from this file/));
    fireEvent.click(screen.getByRole('button', { name: 'Import and replace' }));
    await screen.findByText('Imported backup.json and restored its LeetCode settings.');
    expect((await store.readState()).settings.startDate).toBe('2026-03-03');
    expect(mock.data[LEETCODE_PREFS_KEY]).toEqual({ detectionEnabled: false, showDetectionStatus: true, username: 'from-file' });
  });

  it('cancelling leaves everything untouched and a new file starts with the box unticked again', async () => {
    const { container, mock, store } = setup();
    chooseFile(container, withSection({ detectionEnabled: false }));
    fireEvent.click(await screen.findByLabelText(/Also restore LeetCode settings from this file/));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/Also restore/)).toBeNull();
    expect((await store.readState()).settings.startDate).toBe('2026-01-01');
    expect(mock.data[LEETCODE_PREFS_KEY]).toBeUndefined();
    chooseFile(container, withSection({ detectionEnabled: false }));
    expect(await screen.findByLabelText(/Also restore LeetCode settings from this file/)).toHaveProperty('checked', false);
  });

  it('rejects a malformed section as soon as the file is chosen and changes nothing', async () => {
    const { container, mock, store } = setup();
    mock.data[LEETCODE_PREFS_KEY] = { detectionEnabled: true, username: 'keep' };
    chooseFile(container, withSection({ detectionEnabled: true, events: [1] }, { checked: { imported: true } }));
    await screen.findByText(/Import failed: Invalid "leetcodeSettings" section: unexpected field "events"/);
    expect(screen.queryByRole('button', { name: 'Import and replace' })).toBeNull();
    expect((await store.readState()).checked).toEqual({});
    expect(mock.data[LEETCODE_PREFS_KEY]).toEqual({ detectionEnabled: true, username: 'keep' });
  });

  it('exports the LeetCode preferences by default and leaves them out when unticked, never adding events or profile', async () => {
    const { mock } = setup();
    mock.data[LEETCODE_PREFS_KEY] = { detectionEnabled: false, username: 'me', showDetectionStatus: true };
    mock.data['leetcodeAssist.submissionEvents.v1'] = [{ type: 'check', slug: 'two-sum', state: 'SUCCESS', at: 1 }];
    mock.data['leetcodeAssist.leetcodeProfile.v1'] = { username: 'me', fetchedAt: 1, attemptedAt: 1 };
    const blobs: Blob[] = [];
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    };
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const withPrefs = JSON.parse(await blobs[0]!.text()) as Record<string, unknown>;
    expect(withPrefs[LEETCODE_SETTINGS_KEY]).toEqual({ username: 'me', detectionEnabled: false, showDetectionStatus: true });
    expect(JSON.stringify(withPrefs)).not.toContain('SUCCESS');
    expect(JSON.stringify(withPrefs)).not.toContain('fetchedAt');

    fireEvent.click(screen.getByLabelText('Include LeetCode settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    await waitFor(() => expect(blobs).toHaveLength(2));
    expect(JSON.parse(await blobs[1]!.text())).not.toHaveProperty(LEETCODE_SETTINGS_KEY);
  });
});
