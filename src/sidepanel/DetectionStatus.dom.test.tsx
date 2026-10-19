// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import { defaultState } from '../core/state';
import { LeetCodeDetectionCard } from '../dashboard/LeetCodeSettings';
import type { AppActions } from '../lib/actions';
import { createLeetCodeBackground } from '../lib/leetcodeBackground';
import { createLeetCodeStorage } from '../lib/leetcodeStorage';
import { RUNTIME_SUBMISSION_KIND, type SubmissionEvent } from '../lib/leetcodeSubmissions';
import { openDashboard } from '../lib/openDashboard';
import type { StoreSnapshot } from '../lib/storage';
import { createMockChromeStorage, installChromeGlobal } from '../lib/testing';
import { SidePanelApp } from './SidePanelApp';

const context = vi.hoisted(() => ({
  url: 'https://leetcode.com/problems/two-sum/description/' as string | undefined,
  snapshot: { status: 'empty' } as StoreSnapshot,
  actions: new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions,
}));
vi.mock('../lib/useAppState', () => ({ useAppState: () => ({ snapshot: context.snapshot, actions: context.actions }) }));
vi.mock('./useActiveTabUrl', () => ({ useActiveTabUrl: () => context.url }));
vi.mock('../lib/openDashboard', () => ({ openDashboard: vi.fn(() => Promise.resolve()) }));

const NOW = new Date(2025, 0, 7, 10, 5).getTime();
const indicator = () => screen.getByRole('region', { name: 'LeetCode detection status' });
const feedback = () => within(indicator()).getByRole('status');
const result = (at: number, status_msg = 'Accepted'): SubmissionEvent => ({
  type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg, lang: 'python', at,
});

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  context.snapshot = { status: 'empty' };
  context.url = 'https://leetcode.com/problems/two-sum/description/';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('detection status on real watched chrome.storage values', () => {
  it('follows background Submit/Accepted events, an off preference and clearing without probing the network', async () => {
    const mock = createMockChromeStorage();
    const messages = installChromeGlobal(mock);
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ detectionEnabled: true });
    let now = NOW;
    const background = createLeetCodeBackground({ storage, extensionId: 'test', extensionUrlPrefix: 'chrome-extension://test/', now: () => now });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const page = render(<SidePanelApp />);
    await waitFor(() => expect(feedback().textContent).toBe('No events received for this problem yet.'));
    expect(within(indicator()).getByText('Detection on')).toBeTruthy();

    const send = async (event: SubmissionEvent) => {
      await act(async () => {
        await background.handleMessage({ kind: RUNTIME_SUBMISSION_KIND, event }, { id: 'test', url: context.url });
      });
    };
    await send({ ...result(1), type: 'submit', state: 'SUBMITTED', status_msg: '', lang: '' });
    await waitFor(() => expect(feedback().textContent).toContain('no later final result'));
    expect(indicator().querySelectorAll('time')).toHaveLength(1);
    now += 60_000;
    await send(result(1));
    await waitFor(() => expect(feedback().textContent).toContain('No activity is currently in progress'));
    expect(indicator().querySelectorAll('time')).toHaveLength(2);
    expect(within(indicator()).getByText('Today 10:06')).toBeTruthy();

    await act(async () => { await storage.updatePrefs({ detectionEnabled: false }); });
    await waitFor(() => expect(within(indicator()).getByText('Detection off')).toBeTruthy());
    expect(feedback().textContent).toContain('No new events are recorded');
    const before = await storage.readEvents();
    now += 60_000;
    await send(result(1));
    expect(await storage.readEvents()).toEqual(before);

    await act(async () => { await storage.clearEvents(); });
    await waitFor(() => expect(within(indicator()).getAllByText('None recorded')).toHaveLength(2));
    context.url = 'https://example.com/';
    page.rerender(<SidePanelApp />);
    expect(within(indicator()).queryByText(/Current problem:/)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
    fireEvent.click(within(indicator()).getByRole('button', { name: 'Settings' }));
    expect(openDashboard).toHaveBeenCalledWith('#/settings');
  });

  it('does not interfere with fresh Accepted opening Finish below the indicator', async () => {
    const mock = createMockChromeStorage();
    installChromeGlobal(mock);
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ detectionEnabled: true });
    const base = defaultState('2025-01-07');
    const activity = createActivity([], { slug: 'two-sum', type: 'new', dueDate: '2025-01-07', createdAt: '2025-01-07' });
    context.snapshot = { status: 'ready', state: { ...base, activities: [{ ...activity,
      status: 'in_progress', timer: { running: true, startedAt: NOW - 60_000, accumulatedMs: 0 },
    }] } };
    render(<SidePanelApp />);
    await screen.findByRole('button', { name: 'Pause' });
    await waitFor(() => expect(feedback().textContent).toBe('No events received for this problem yet.'));
    expect(screen.queryByText('How did it go?')).toBeNull();
    await act(async () => { await storage.appendEvent(result(NOW + 1000)); });
    await screen.findByText('How did it go?');
    expect(feedback().textContent).toContain('Accepted received');
    expect(screen.getByRole('button', { name: 'Save result' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('How did it go?')).toBeNull();
    // Showing the recorded success is not itself another Finish trigger.
    expect(feedback().textContent).toContain('Accepted received');
  });

  it('keeps observations visible if program data is unreadable without asserting that no activity exists', async () => {
    const mock = createMockChromeStorage();
    installChromeGlobal(mock);
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ detectionEnabled: true });
    await storage.appendEvent(result(NOW - 60_000));
    context.snapshot = { status: 'error', message: 'Invalid program data' };
    render(<SidePanelApp />);
    await within(indicator()).findByText('Today 10:04');
    expect(screen.getByText('Stored data could not be read')).toBeTruthy();
    expect(feedback().textContent).toContain('Accepted received');
    expect(feedback().textContent).not.toContain('No activity is currently in progress');
  });

  it('shares the same status in Settings and clears both latest timestamps with the existing Clear action', async () => {
    const mock = createMockChromeStorage();
    installChromeGlobal(mock);
    const storage = createLeetCodeStorage(mock.area);
    await storage.updatePrefs({ detectionEnabled: true });
    await storage.appendEvent({ ...result(NOW - 120_000), type: 'submit', state: 'SUBMITTED', status_msg: '', lang: '' });
    await storage.appendEvent(result(NOW - 60_000));
    render(<LeetCodeDetectionCard />);
    await within(indicator()).findByText('Today 10:04');
    expect(within(indicator()).getByText('Today 10:03')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Detect accepted submissions' }));
    await waitFor(() => expect(within(indicator()).getByText('Detection off')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Clear detected events' }));
    await waitFor(() => expect(within(indicator()).getAllByText('None recorded')).toHaveLength(2));
    expect(await storage.readEvents()).toEqual([]);
  });
});
