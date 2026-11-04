// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { complete, day, newState } from '../core/testing';
import type { AppState } from '../core/types';
import { createActions } from '../lib/actions';
import { STORAGE_KEY } from '../lib/storage';
import { createTestApp, installChromeGlobal } from '../lib/testing';
import { SettingsView } from './SettingsView';

afterEach(() => {
  cleanup();
  delete (globalThis as { chrome?: unknown }).chrome;
});

function stateWithEasyNewTimes(minutes: number): AppState {
  let state = newState();
  for (const slug of ['two-sum', 'valid-anagram', 'contains-duplicate', 'valid-palindrome', 'valid-parentheses', 'binary-search']) {
    const activity = createActivity(state.activities, { type: 'new', slug, dueDate: day(1), createdAt: day(1) });
    state = complete({ ...state, activities: [...state.activities, activity] }, activity.id, 'solo', day(1), minutes);
  }
  return state;
}

describe('Settings: Calibrate from my logs', () => {
  it('fills the budget table from the logs without saving, then saves on request', async () => {
    const state = stateWithEasyNewTimes(10);
    const app = createTestApp(state);
    installChromeGlobal(app.mock);
    render(<SettingsView state={state} actions={createActions(app.store)} />);

    const input = screen.getByLabelText('New Easy budget in minutes') as HTMLInputElement;
    expect(input.value).toBe('25');
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate from my logs' }));
    expect(input.value).toBe('13'); // median 10 min + 25 % margin
    expect(screen.getByText(/Filled 1 cell from 6 finished activities/)).toBeTruthy();
    expect(screen.getByLabelText('Calibrated cells').textContent).toContain('New · Easy: median 10 min over 6 finished, +25% margin → 13 min (was 25)');
    // Nothing is stored yet.
    expect((app.mock.data[STORAGE_KEY] as AppState).settings.budgets).toBeUndefined();
    // Cells without enough data keep their value.
    expect((screen.getByLabelText('New Hard budget in minutes') as HTMLInputElement).value).toBe('50');

    fireEvent.click(screen.getByRole('button', { name: 'Save budgets' }));
    await waitFor(() => expect((app.mock.data[STORAGE_KEY] as AppState).settings.budgets).toEqual({ new: { Easy: 13 } }));
  });

  it('says so when there is not enough data and leaves the table alone', () => {
    const state = newState();
    const app = createTestApp(state);
    installChromeGlobal(app.mock);
    render(<SettingsView state={state} actions={createActions(app.store)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate from my logs' }));
    expect(screen.getByText(/Not enough finished activities yet/)).toBeTruthy();
    expect((screen.getByLabelText('New Easy budget in minutes') as HTMLInputElement).value).toBe('25');
  });
});
