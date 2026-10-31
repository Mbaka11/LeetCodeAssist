// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { addDays, trainingDateFromTimestamp } from '../core/dates';
import { defaultState } from '../core/state';
import { createActions, type AppActions } from '../lib/actions';
import { materializeToday, startActivity } from '../lib/commands';
import { createLeetCodeBackground } from '../lib/leetcodeBackground';
import { installSubmissionObserver, type ObservedWindow } from '../lib/leetcodeObserver';
import { createLeetCodeStorage, createWatchedValue, SUBMISSION_EVENTS_KEY, type WatchedValue } from '../lib/leetcodeStorage';
import { eventFromWindowMessage, normalizeEvents, RUNTIME_SUBMISSION_KIND, windowMessage, type SubmissionEvent } from '../lib/leetcodeSubmissions';
import type { AppStore } from '../lib/storage';
import { createTestApp, flush } from '../lib/testing';
import { ProblemPanel } from './ProblemPanel';

afterEach(cleanup);

function Harness({ store, actions, events, slug, now }: {
  store: AppStore;
  actions: AppActions;
  events: WatchedValue<readonly SubmissionEvent[]>;
  slug: string;
  now: () => number;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const detected = useSyncExternalStore(events.subscribe, events.getSnapshot);
  return snapshot.status === 'ready' ? (
    <ProblemPanel state={snapshot.state} actions={actions} slug={slug} now={now()}
      submissionEvents={detected} openDashboard={() => undefined} openProblem={() => undefined} />
  ) : null;
}

describe('v2 check → validated storage → side panel Finish (synthetic integration)', () => {
  it.each([10, 1])('opens only for a matching Accepted and automatically dates a save at %s:00', async (hour) => {
    let now = new Date(2025, 0, 6, hour).getTime();
    const today = trainingDateFromTimestamp(now);
    const planned = materializeToday(defaultState(addDays(today, -1)), now - 600_000);
    const activity = planned.activities.find((a) => a.type === 'new')!;
    const { mock, store } = createTestApp(startActivity(planned, activity.id, now - 600_000));
    const actions = createActions(store, () => now);
    const storage = createLeetCodeStorage(mock.area);
    const events = createWatchedValue<readonly SubmissionEvent[]>(
      SUBMISSION_EVENTS_KEY, normalizeEvents, [], () => ({ area: mock.area, changed: mock.changed }),
    );
    const background = createLeetCodeBackground({
      storage, extensionId: 'test-extension', extensionUrlPrefix: 'chrome-extension://test-extension/', now: () => now,
    });
    const requests: Array<{ url: string; status: string }> = [];
    const deliveries: Array<Promise<unknown>> = [];
    let result = 'Wrong Answer';
    const win: ObservedWindow = {
      location: { href: `https://leetcode.com/problems/${activity.slug}/description/` },
      fetch: (async (url) => {
        requests.push({ url: String(url), status: result });
        return new Response(JSON.stringify({ state: 'SUCCESS', status_msg: result, lang: 'python', code_output: 'ignored' }));
      }) as typeof fetch,
    };
    installSubmissionObserver(win, (event) => {
      const relayed = eventFromWindowMessage(windowMessage(event));
      const delivery = background.handleMessage({ kind: RUNTIME_SUBMISSION_KIND, event: relayed }, {
        id: 'test-extension', url: win.location.href,
      });
      if (delivery) deliveries.push(delivery);
    }, () => now);
    render(<Harness store={store} actions={actions} events={events} slug={activity.slug} now={() => now} />);
    await screen.findByRole('button', { name: 'Pause' });

    const submitAndCheck = async (id: number, slug: string, status: string): Promise<void> => {
      now += 60_000;
      result = status;
      await act(async () => {
        await win.fetch!(`/problems/${slug}/submit/`, { method: 'POST', body: 'never inspected' });
        await win.fetch!(`/submissions/detail/${id}/v2/check/`);
        await flush();
        await Promise.all(deliveries);
      });
    };
    await submitAndCheck(101, activity.slug, 'Wrong Answer');
    expect(screen.queryByText('How did it go?')).toBeNull();
    await submitAndCheck(102, 'different-problem', 'Accepted');
    expect(screen.queryByText('How did it go?')).toBeNull();
    await submitAndCheck(103, activity.slug, 'Accepted');
    await screen.findByText('How did it go?');
    await waitFor(async () => {
      const current = (await store.readState()).activities.find((a) => a.id === activity.id)!;
      expect(current.status).toBe('in_progress');
      expect(current.timer.running).toBe(false);
      expect(current.timer.accumulatedMs).toBe(13 * 60_000);
    });
    expect((await store.readState()).activities.filter((a) => a.status === 'done')).toHaveLength(0);
    expect((await storage.readEvents()).filter((e) => e.type === 'check')).toHaveLength(3);
    // The observer made no extra network requests and never stored non-whitelisted fields.
    expect(requests).toHaveLength(6);
    expect(JSON.stringify(await storage.readEvents())).not.toContain('code_output');

    const completedDate = today;
    expect(screen.queryByRole('combobox', { name: 'Completed on' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
    await waitFor(async () => {
      const current = (await store.readState()).activities.find((a) => a.id === activity.id)!;
      expect(current.status).toBe('done');
      expect(current.outcome).toBe('solo');
      expect(current.totalMs).toBe(13 * 60_000);
      expect(current.completedAt).toBe(completedDate);
    });
    expect((await store.readState()).activities.find((a) => a.slug === activity.slug && a.type === 'recall')?.dueDate)
      .toBe(addDays(completedDate, 1));
  });
});
