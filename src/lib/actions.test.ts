import { describe, expect, it } from 'vitest';
import { planDay } from '../core/planner';
import { START, day } from '../core/testing';
import type { AppState } from '../core/types';
import { createActions } from './actions';
import { STORAGE_KEY, chromeStorageBackend, createAppStore } from './storage';
import { createMockChromeStorage, flush } from './testing';

function at(date: string, hour = 10): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, 0, 0).getTime();
}

async function setup(startNow = at(START)) {
  const mock = createMockChromeStorage();
  const store = createAppStore(chromeStorageBackend(mock.area, mock.changed));
  store.subscribe(() => {});
  const clock = { now: startNow };
  const actions = createActions(store, () => clock.now);
  await actions.initialize(START);
  const state = (): Promise<AppState> => store.readState();
  return { mock, store, clock, actions, state };
}

describe('app actions on a chrome.storage mock', () => {
  it('runs a full day: start, approach found, complete, and persists the review cycle', async () => {
    const { actions, clock, state, mock } = await setup();
    await actions.materializeToday();
    const firstNew = (await state()).activities.find((a) => a.type === 'new')!;

    await actions.startActivity(firstNew.id);
    clock.now += 12 * 60_000;
    await actions.markApproachFound(firstNew.id);
    clock.now += 18 * 60_000;
    await actions.completeActivity(firstNew.id, 'solo');

    const after = await state();
    const done = after.activities.find((a) => a.id === firstNew.id)!;
    expect(done).toMatchObject({
      status: 'done',
      outcome: 'solo',
      approachMs: 12 * 60_000,
      totalMs: 30 * 60_000,
      completedAt: START,
    });
    expect(
      after.activities.filter((a) => a.slug === firstNew.slug && a.type !== 'new').map((a) => a.dueDate),
    ).toEqual([day(2), day(4), day(8), day(22)]);
    expect(mock.data[STORAGE_KEY]).toBeDefined();
  });

  it('materializes lazily when starting an activity that is not persisted yet', async () => {
    const { actions, state } = await setup();
    const planned = planDay(await state(), START).items.find((i) => i.activity.type === 'new')!;
    expect(planned.persisted).toBe(false);
    await actions.startActivity(planned.activity.id);
    const after = await state();
    expect(after.activities.find((a) => a.id === planned.activity.id)?.status).toBe('in_progress');
    expect(planDay(after, START).items.every((i) => i.persisted)).toBe(true);
  });

  it('keeps a running timer across a reload (derived from timestamps)', async () => {
    const { actions, clock, mock, state } = await setup();
    const planned = planDay(await state(), START).items.find((i) => i.activity.type === 'new')!;
    await actions.startActivity(planned.activity.id);

    // A fresh store (page reload) reads the same running timer.
    const reloaded = createAppStore(chromeStorageBackend(mock.area, mock.changed));
    const reloadedState = await reloaded.readState();
    const activity = reloadedState.activities.find((a) => a.id === planned.activity.id)!;
    expect(activity.timer).toEqual({ startedAt: clock.now, accumulatedMs: 0, running: true });
  });

  it('rolls over to the next day using the clock', async () => {
    const { actions, clock, state } = await setup();
    await actions.materializeToday();
    const first = (await state()).activities.find((a) => a.type === 'new')!;
    await actions.startActivity(first.id);
    await actions.completeActivity(first.id, 'solo', 25 * 60_000);

    clock.now = at(day(2));
    await actions.materializeToday();
    const recall = (await state()).activities.find((a) => a.type === 'recall' && a.slug === first.slug)!;
    expect(recall.dueDate).toBe(day(2));
    expect(planDay(await state(), day(2)).items.map((i) => i.activity.id)).toContain(recall.id);
  });

  it('saves notes, toggles checks and updates settings', async () => {
    const { actions, state } = await setup();
    await actions.saveNote('two-sum', {
      trigger: 'Click',
      principle: 'complement lookup',
      pitfall: 'same index twice',
      complexity: 'O(n) / O(n)',
      code: 'def two_sum(nums, target): ...',
    });
    await actions.toggleChecked('two-sum');
    await actions.updateSettings({ dailyTargetMin: 120, dailyCapMin: 150 });
    const after = await state();
    expect(after.notes['two-sum']?.code).toContain('two_sum');
    expect(after.checked['two-sum']).toBe(true);
    expect(after.settings).toMatchObject({ dailyTargetMin: 120, dailyCapMin: 150 });

    await expect(actions.updateSettings({ dailyCapMin: 10 })).rejects.toThrow(/dailyCapMin/);
    expect((await state()).settings.dailyCapMin).toBe(150);
  });

  it('exports JSON that imports back into an empty store, and rejects invalid imports', async () => {
    const { actions, state } = await setup();
    await actions.toggleChecked('two-sum');
    const json = await actions.exportJson();

    const other = await setup();
    await other.actions.reset();
    await other.actions.importJson(json);
    expect(await other.state()).toEqual(await state());

    await expect(other.actions.importJson('not json')).rejects.toThrow(/not valid JSON/);
    await expect(other.actions.importJson('{"version":1}')).rejects.toThrow();
    expect(await other.state()).toEqual(await state());
  });

  it('resets back to the first-run state', async () => {
    const { actions, store, mock } = await setup();
    await actions.reset();
    await flush();
    expect(store.getSnapshot().status).toBe('empty');
    expect(mock.data[STORAGE_KEY]).toBeUndefined();
  });
});
