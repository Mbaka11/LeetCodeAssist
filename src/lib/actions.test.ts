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

  it('starts extra practice on a problem outside the plan and finishes it into a review cycle', async () => {
    const { actions, clock, state } = await setup();
    await actions.startExtraPractice('median-of-two-sorted-arrays');
    const started = (await state()).activities.find((a) => a.slug === 'median-of-two-sorted-arrays')!;
    expect(started).toMatchObject({ type: 'new', extra: true, status: 'in_progress' });

    clock.now += 30 * 60_000;
    await actions.completeActivity(started.id, 'solo');
    const after = await state();
    expect(after.problemStatus['median-of-two-sorted-arrays']).toBe('learning');
    expect(
      after.activities.filter((a) => a.slug === 'median-of-two-sorted-arrays' && a.type === 'recall'),
    ).toHaveLength(1);
    await expect(actions.startExtraPractice('nope')).rejects.toThrow(/NeetCode 150/);
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

  it('saves budget overrides and resets them to the defaults', async () => {
    const { actions, state } = await setup();
    await actions.updateSettings({ budgets: { blind: { Hard: 30 } } });
    expect((await state()).settings.budgets).toEqual({ blind: { Hard: 30 } });
    await expect(actions.updateSettings({ budgets: { blind: { Hard: 500 } } })).rejects.toThrow(/budgets/);
    expect((await state()).settings.budgets).toEqual({ blind: { Hard: 30 } });
    await actions.updateSettings({ budgets: undefined });
    expect((await state()).settings).not.toHaveProperty('budgets');
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

describe('moving, postponing and hints through the store', () => {
  it('reveals hints on a not-yet-persisted activity and keeps them across reloads', async () => {
    const { actions, state } = await setup();
    const planned = planDay(await state(), START).items.find((i) => i.activity.type === 'new')!;
    expect(planned.persisted).toBe(false);
    await actions.revealHint(planned.activity.id, 2);
    const after = await state();
    expect(after.activities.find((a) => a.id === planned.activity.id)?.hintsUsed).toBe(2);
    await expect(actions.revealHint(planned.activity.id, 9)).rejects.toThrow(/Hint level/);
  });

  it('postpones a new problem: it is skipped, flagged and the queue order is saved', async () => {
    const { actions, state } = await setup();
    const planned = planDay(await state(), START).items.find((i) => i.activity.type === 'new')!;
    await actions.postpone(planned.activity.id);
    const after = await state();
    expect(after.activities.find((a) => a.id === planned.activity.id)).toMatchObject({
      status: 'skipped',
      postponed: true,
    });
    expect(after.queue).toBeDefined();
    expect(after.queue).toContain(planned.activity.slug);
    expect(planDay(after, START).items.map((i) => i.activity.slug)).not.toContain(planned.activity.slug);
  });

  it('moves a review to another day and refuses a past day', async () => {
    const { actions, clock, state } = await setup();
    await actions.materializeToday();
    const first = (await state()).activities.find((a) => a.type === 'new')!;
    await actions.startActivity(first.id);
    clock.now += 10 * 60_000;
    await actions.completeActivity(first.id, 'solo');
    const recall = (await state()).activities.find((a) => a.slug === first.slug && a.type === 'recall')!;
    expect(recall.dueDate).toBe(day(2));

    await actions.moveReview(recall.id, day(3));
    expect((await state()).activities.find((a) => a.id === recall.id)?.dueDate).toBe(day(3));
    await expect(actions.moveReview(recall.id, '2024-01-01')).rejects.toThrow(/past/);
  });
});

describe('presentation-only record updates', () => {
  it('merges favorites and named presets per key without affecting program data; exports and imports them', async () => {
    const { actions, state } = await setup();
    const before = await state();
    const filters = { search: '', category: '', difficulty: '' as const, status: '' as const,
      access: '' as const, scope: '' as const, technique: '', structure: '', company: '', favoritesOnly: true };
    await Promise.all([actions.toggleFavorite('two-sum'), actions.toggleFavorite('valid-anagram')]);
    await Promise.all([
      actions.saveRoadmapFilter('one', { name: 'First', filters }),
      actions.saveRoadmapFilter('two', { name: 'Second', filters }),
    ]);
    await actions.toggleFavorite('two-sum');
    await actions.saveRoadmapFilter('one', { name: 'Renamed', filters });
    await actions.deleteRoadmapFilter('two');
    await actions.updateSettings({ sidePanelFocus: true });
    const after = await state();
    expect(after.favorites).toEqual({ 'two-sum': false, 'valid-anagram': true });
    expect(after.savedRoadmapFilters).toEqual({ one: { name: 'Renamed', filters } });
    expect(after.activities).toEqual(before.activities);
    expect(after.checked).toEqual(before.checked);
    expect(after.problemStatus).toEqual(before.problemStatus);
    const json = await actions.exportJson();
    await actions.initialize(START);
    await actions.importJson(json);
    expect(await state()).toEqual(after);
  });
  it('rejects an invalid named filter atomically', async () => {
    const { actions, state } = await setup();
    const before = await state();
    await expect(actions.saveRoadmapFilter('invalid', { name: '', filters: {} } as never)).rejects.toThrow();
    expect(await state()).toEqual(before);
  });
});
