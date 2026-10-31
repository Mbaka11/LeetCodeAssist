// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProblemActivities } from '../components/ProblemActivities';
import { defaultState } from '../core/state';
import type { Activity } from '../core/types';
import { createActions, type AppActions } from '../lib/actions';
import { materializeToday, startActivity } from '../lib/commands';
import type { SubmissionEvent } from '../lib/leetcodeSubmissions';
import { isTypingTarget, panelShortcutFromEvent } from '../lib/panelShortcuts';
import type { AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { ProblemPanel } from './ProblemPanel';

const NOW = new Date(2025, 0, 7, 10).getTime();
afterEach(cleanup);

function Harness({ store, actions, slug, events = [], now = NOW }: {
  store: AppStore; actions: AppActions; slug: string | null; events?: readonly SubmissionEvent[]; now?: number;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? <ProblemPanel state={snapshot.state} actions={actions} slug={slug} now={now}
    submissionEvents={events} openDashboard={() => undefined} openProblem={() => undefined} /> : null;
}

function planned() {
  const state = materializeToday(defaultState('2025-01-06'), NOW - 600_000);
  const activity = state.activities.find((a) => a.type === 'new')!;
  return { state, activity };
}
function started() {
  const { state, activity } = planned();
  return { initial: startActivity(state, activity.id, NOW - 600_000), activity };
}

function key(init: KeyboardEventInit, target: Element | Document = document.body): boolean {
  return fireEvent.keyDown(target, { altKey: true, ...init });
}
const altT = (target?: Element) => key({ key: 't', code: 'KeyT' }, target);
const altR = (target?: Element) => key({ key: 'r', code: 'KeyR' }, target);
const altDigit = (n: number, target?: Element) => key({ key: String(n), code: `Digit${n}` }, target);
const altEnter = (target?: Element) => key({ key: 'Enter', code: 'Enter' }, target);

async function activityOf(store: AppStore, id: string): Promise<Activity> {
  return (await store.readState()).activities.find((a) => a.id === id)!;
}

describe('side-panel keyboard shortcuts', () => {
  it('Alt+T starts a planned activity, then pauses and resumes it', async () => {
    const { state, activity } = planned();
    const app = createTestApp(state);
    const actions = createActions(app.store, () => NOW);
    render(<Harness store={app.store} actions={actions} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Start' });

    expect(altT()).toBe(false); // handled keys are default-prevented
    await waitFor(async () => expect(await activityOf(app.store, activity.id)).toMatchObject({ status: 'in_progress', timer: { running: true } }));
    await screen.findByRole('button', { name: 'Pause' });

    altT();
    await waitFor(async () => expect((await activityOf(app.store, activity.id)).timer.running).toBe(false));
    await screen.findByRole('button', { name: 'Resume' });

    altT();
    await waitFor(async () => expect((await activityOf(app.store, activity.id)).timer.running).toBe(true));
  });

  it('Alt+R opens Finish and pauses; Alt+1..4 choose the outcome; Alt+Enter saves only a valid form', async () => {
    const { initial, activity } = started();
    const app = createTestApp(initial);
    const actions = createActions(app.store, () => NOW);
    render(<Harness store={app.store} actions={actions} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });

    altR();
    await screen.findByText('How did it go?');
    await waitFor(async () => expect((await activityOf(app.store, activity.id)).timer.running).toBe(false));
    const labels = ['Solo', 'Hint', 'Solution', 'Stuck'];
    for (const [index, label] of labels.entries()) {
      altDigit(index + 1);
      await waitFor(() => expect(screen.getByRole('radio', { name: new RegExp(label) })).toHaveProperty('checked', true));
    }

    // Invalid form (no minutes): Alt+Enter does nothing.
    const minutes = screen.getByRole('spinbutton', { name: 'Time logged (min)' });
    fireEvent.change(minutes, { target: { value: '' } });
    altEnter();
    expect((await activityOf(app.store, activity.id)).status).toBe('in_progress');

    fireEvent.change(minutes, { target: { value: '12' } });
    altDigit(3);
    altEnter();
    await waitFor(async () => expect(await activityOf(app.store, activity.id)).toMatchObject({ status: 'done', outcome: 'solution', totalMs: 12 * 60_000 }));
  });

  it('Alt+Enter without an outcome does not save, and the timer key is ignored while Finish is open', async () => {
    const { initial, activity } = started();
    const app = createTestApp(initial);
    render(<Harness store={app.store} actions={createActions(app.store, () => NOW)} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    altR();
    await screen.findByText('How did it go?');
    await waitFor(async () => expect((await activityOf(app.store, activity.id)).timer.running).toBe(false));
    const before = await activityOf(app.store, activity.id);
    altEnter();
    altT();
    altR();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await activityOf(app.store, activity.id)).toEqual(before);
    expect(screen.getByText('How did it go?')).toBeTruthy();
  });

  it('ignores shortcuts typed in text fields, textareas, selects and editable regions', async () => {
    const { initial, activity } = started();
    const app = createTestApp(initial);
    render(<Harness store={app.store} actions={createActions(app.store, () => NOW)} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    const before = await activityOf(app.store, activity.id);

    const notes = document.querySelector('textarea') ?? document.querySelector('input[type="text"]');
    expect(notes).toBeTruthy();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(editable);
    altT(notes!);
    altR(notes!);
    altT(editable);
    altR(editable);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await activityOf(app.store, activity.id)).toEqual(before);
    expect(screen.queryByText('How did it go?')).toBeNull();

    altR();
    await screen.findByText('How did it go?');
    const field = screen.getByRole('spinbutton', { name: 'Time logged (min)' });
    const select = document.createElement('select');
    document.body.append(select);
    for (const target of [field, select]) {
      altDigit(2, target);
      altEnter(target);
    }
    expect(screen.getByRole('radio', { name: /Hint/ })).toHaveProperty('checked', false);
    expect((await activityOf(app.store, activity.id)).status).toBe('in_progress');
    editable.remove();
    select.remove();
  });

  it('ignores keys without exactly Alt, and shortcuts do nothing outside the side panel cards', async () => {
    const { initial, activity } = started();
    const app = createTestApp(initial);
    render(<Harness store={app.store} actions={createActions(app.store, () => NOW)} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    const before = await activityOf(app.store, activity.id);
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' });
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT', ctrlKey: true, altKey: true });
    fireEvent.keyDown(document.body, { key: 'T', code: 'KeyT', shiftKey: true, altKey: true });
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT', altKey: true, metaKey: true });
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT', altKey: true, repeat: true });
    fireEvent.keyDown(document.body, { key: 'L', code: 'KeyL', altKey: true, shiftKey: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await activityOf(app.store, activity.id)).toEqual(before);
  });

  it('shows a Shortcuts disclosure that Alt+? toggles and that lists every shortcut', async () => {
    const { initial, activity } = started();
    const app = createTestApp(initial);
    render(<Harness store={app.store} actions={createActions(app.store, () => NOW)} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    const details = document.querySelector('details.shortcuts-help') as HTMLDetailsElement;
    expect(details.querySelector('summary')!.textContent).toBe('Shortcuts');
    expect(details.open).toBe(false);
    key({ key: '?', code: 'Slash', shiftKey: true });
    await waitFor(() => expect(details.open).toBe(true));
    for (const keys of ['Alt+T', 'Alt+R', 'Alt+1 … Alt+4', 'Alt+Enter', 'Alt+?']) expect(screen.getByText(keys)).toBeTruthy();
    key({ key: '?', code: 'Slash', shiftKey: true });
    await waitFor(() => expect(details.open).toBe(false));
  });

  it('does not interfere with the Accepted auto-Finish: it still opens, pauses and saves nothing', async () => {
    const { initial, activity } = started();
    const app = createTestApp(initial);
    const actions = createActions(app.store, () => NOW);
    const page = render(<Harness store={app.store} actions={actions} slug={activity.slug} />);
    await screen.findByRole('button', { name: 'Pause' });
    const events: SubmissionEvent[] = [{ type: 'check', slug: activity.slug, state: 'SUCCESS', status_msg: 'Accepted', lang: 'python', at: NOW + 1000 }];
    page.rerender(<Harness store={app.store} actions={actions} slug={activity.slug} events={events} now={NOW + 1000} />);
    await screen.findByText('How did it go?');
    await waitFor(async () => expect((await activityOf(app.store, activity.id)).timer.running).toBe(false));
    expect((await activityOf(app.store, activity.id)).status).toBe('in_progress');
    expect(screen.getByRole('radio', { name: /Solo/ })).toHaveProperty('checked', true);
    // The pre-selected outcome is untouched by unrelated keys, and the timer key stays inert in the form.
    altT();
    expect(screen.getByRole('radio', { name: /Solo/ })).toHaveProperty('checked', true);
    expect((await activityOf(app.store, activity.id)).timer.running).toBe(false);
  });

  it('is not registered where the card is not the side panel selection (dashboard cards)', async () => {
    const { state, activity } = planned();
    const app = createTestApp(state);
    const actions = createActions(app.store, () => NOW);
    render(<ProblemActivities items={[{ activity }]} history={state.activities} now={NOW} actions={actions} />);
    altT();
    altR();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await activityOf(app.store, activity.id)).status).toBe('planned');
  });
});

describe('panelShortcutFromEvent and isTypingTarget', () => {
  const event = (init: KeyboardEventInit, target?: Element): KeyboardEvent => {
    const e = new KeyboardEvent('keydown', { bubbles: true, ...init });
    if (target) Object.defineProperty(e, 'target', { value: target });
    return e;
  };

  it('maps the Alt combinations', () => {
    expect(panelShortcutFromEvent(event({ altKey: true, key: 't', code: 'KeyT' }))).toBe('timer');
    expect(panelShortcutFromEvent(event({ altKey: true, key: 'r', code: 'KeyR' }))).toBe('finish');
    expect(panelShortcutFromEvent(event({ altKey: true, key: 'Enter', code: 'Enter' }))).toBe('save');
    expect(panelShortcutFromEvent(event({ altKey: true, key: '2', code: 'Digit2' }))).toBe('outcome-hint');
    expect(panelShortcutFromEvent(event({ altKey: true, key: '4', code: 'Numpad4' }))).toBe('outcome-stuck');
    expect(panelShortcutFromEvent(event({ altKey: true, key: '?', code: 'Slash', shiftKey: true }))).toBe('help');
    // Option-style layouts: the code identifies the key even when `key` is a symbol.
    expect(panelShortcutFromEvent(event({ altKey: true, key: '†', code: 'KeyT' }))).toBe('timer');
    expect(panelShortcutFromEvent(event({ altKey: true, key: '5', code: 'Digit5' }))).toBeNull();
    expect(panelShortcutFromEvent(event({ key: 't', code: 'KeyT' }))).toBeNull();
  });

  it('treats text inputs, textareas, selects and contenteditable as typing, but not radios, checkboxes or buttons', () => {
    const make = (html: string): Element => {
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.append(host);
      return host.firstElementChild!;
    };
    for (const html of ['<input type="text">', '<input>', '<input type="number">', '<input type="time">', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"><span></span></div>', '<div contenteditable=""></div>']) {
      expect(isTypingTarget(make(html))).toBe(true);
    }
    expect(isTypingTarget(make('<div contenteditable="true"><span id="inner"></span></div>').querySelector('#inner'))).toBe(true);
    for (const html of ['<input type="radio">', '<input type="checkbox">', '<button></button>', '<div></div>', '<div contenteditable="false"></div>']) {
      expect(isTypingTarget(make(html))).toBe(false);
    }
    expect(isTypingTarget(null)).toBe(false);
  });
});
