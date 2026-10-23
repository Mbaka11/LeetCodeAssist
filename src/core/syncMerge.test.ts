import { describe, expect, it } from 'vitest';
import { defaultState, validateState } from './state';
import { applyRecords, baseAfterSync, canonical, describeRecord, isUntouchedState, mergeStates, publishableState, stateRecords } from './syncMerge';
import type { Activity, AppState } from './types';

const base = (): AppState => defaultState('2026-01-01');
const note = () => ({ slug: 'two-sum', trigger: '', principle: '', pitfall: '', complexity: '', updatedAt: '2026-01-01' });
const activity = (id: string, running = false): Activity => ({ id, slug: 'two-sum', type: 'new', dueDate: '2026-01-01', createdAt: '2026-01-01', status: running ? 'in_progress' : 'planned', timer: { running, startedAt: running ? 100 : null, accumulatedMs: 0 } });

describe('three-way record merge', () => {
  it.each([
    ['local only', false, true, false, true, 0],
    ['remote only', false, false, true, true, 0],
    ['both same', false, true, true, true, 0],
    ['both different', undefined, true, false, true, 1],
  ] as const)('%s', (_label, before, left, right, expected, count) => {
    const b: AppState = { ...base(), checked: before === undefined ? {} : { 'two-sum': before } };
    const l = { ...base(), checked: { 'two-sum': left } }, r = { ...base(), checked: { 'two-sum': right } };
    const result = mergeStates(b, l, r);
    expect(result.state.checked['two-sum']).toBe(expected);
    expect(result.conflicts).toHaveLength(count);
  });
  it('merges distinct record IDs and per-field settings without merging nested records', () => {
    const l = { ...base(), activities: [activity('a')], favorites: { 'two-sum': true }, settings: { ...base().settings, dailyCapMin: 200 } };
    const r = { ...base(), activities: [activity('b')], checked: { 'three-sum': true }, settings: { ...base().settings, dailyTargetMin: 100 } };
    const result = mergeStates(base(), l, r);
    expect(result.conflicts).toEqual([]);
    expect(result.state.activities.map((a) => a.id)).toEqual(['a', 'b']);
    expect(result.state.settings).toMatchObject({ dailyCapMin: 200, dailyTargetMin: 100 });
    expect(result.state.favorites).toEqual(l.favorites);
    expect(result.state.checked).toEqual(r.checked);
  });
  it('treats notes, corrections, saved filters, status and queue as whole records', () => {
    const b = { ...base(), activities: [{ ...activity('a'), status: 'done' as const, outcome: 'solo' as const, totalMs: 100, completedAt: '2026-01-01' }], notes: { x: { slug: 'x', trigger: '', principle: '', pitfall: '', complexity: '', updatedAt: '2026-01-01' } } };
    const l = applyRecords(b, { 'activities/a': { ...b.activities[0], corrections: [{ at: 1, previousDate: '2026-01-01' }] }, 'notes/x': { ...b.notes.x, trigger: 'local' }, queue: ['two-sum'], 'problemStatus/x': 'learning' });
    const r = applyRecords(b, { 'activities/a': { ...b.activities[0], corrections: [{ at: 2, previousDate: '2026-01-01' }] }, 'notes/x': { ...b.notes.x, principle: 'remote' }, queue: ['valid-anagram'], 'problemStatus/x': 'mastered' });
    const result = mergeStates(b, l, r);
    expect(result.conflicts.map((c) => c.path)).toEqual(['activities/a', 'notes/x', 'problemStatus/x', 'queue']);
  });
  it('handles deletion vs unchanged and deletion vs edit', () => {
    const b = { ...base(), favorites: { x: true } };
    expect(mergeStates(b, { ...base(), favorites: {} }, b).state.favorites).toEqual({});
    const result = mergeStates(b, { ...base(), favorites: {} }, { ...b, favorites: { x: false } });
    expect(result.conflicts[0]).toMatchObject({ path: 'favorites/x', remote: false });
    expect(publishableState(result.state, result.conflicts).favorites).toEqual({ x: false });
  });
  it('never conflicts with its own unpublished timer start, and publishes it', () => {
    const b = { ...base(), activities: [activity('a')] };
    const l = { ...b, activities: [activity('a', true)] };
    const result = mergeStates(b, l, b);
    expect(result.conflicts).toEqual([]);
    expect(result.deferred).toEqual([]);
    expect(result.state.activities).toEqual(l.activities);
  });
  it('asks before another device replaces a running local timer, even if only that device changed', () => {
    const b = { ...base(), activities: [activity('a', true)] };
    const done = { ...activity('a'), status: 'done' as const, outcome: 'solo' as const, totalMs: 5, completedAt: '2026-01-01' };
    const result = mergeStates(b, b, { ...b, activities: [done] });
    expect(result.conflicts.map((c) => c.path)).toEqual(['activities/a']);
    expect(result.state.activities[0]!.timer.running).toBe(true);
    expect(publishableState(result.state, result.conflicts).activities).toEqual([done]);
  });
  it('defers a timer running on the other device until it is paused there, without losing either side', () => {
    const b = { ...base(), activities: [activity('a')] };
    const r = { ...b, activities: [activity('a', true)] };
    const first = mergeStates(b, b, r);
    expect(first.conflicts).toEqual([]);
    expect(first.deferred.map((c) => c.path)).toEqual(['activities/a']);
    expect(first.state.activities).toEqual(b.activities);
    expect(publishableState(first.state, first.deferred).activities).toEqual(r.activities);
    // Next pass: the remembered base keeps the record "unchanged here", so the pause is adopted automatically.
    const remembered = baseAfterSync(r, first.deferred);
    expect(remembered.activities).toEqual(b.activities);
    expect(mergeStates(remembered, first.state, r).deferred).toHaveLength(1);
    const paused = { ...b, activities: [{ ...activity('a'), status: 'in_progress' as const, timer: { running: false, startedAt: null, accumulatedMs: 900 } }] };
    const second = mergeStates(remembered, first.state, paused);
    expect(second.deferred).toEqual([]);
    expect(second.state.activities).toEqual(paused.activities);
  });
  it('defers a running remote activity that this device does not have at all', () => {
    const r = { ...base(), activities: [activity('a', true)] };
    const result = mergeStates(base(), base(), r);
    expect(result.deferred.map((c) => c.path)).toEqual(['activities/a']);
    expect(result.state.activities).toEqual([]);
    expect(baseAfterSync(r, result.deferred).activities).toEqual([]);
  });
  it('raises a conflict when both devices changed the same activity with running timers', () => {
    const b = { ...base(), activities: [activity('a')] };
    const l = { ...b, activities: [activity('a', true)] };
    const r = { ...b, activities: [{ ...activity('a', true), timer: { running: true, startedAt: 7, accumulatedMs: 0 } }] };
    expect(mergeStates(b, l, r).conflicts).toHaveLength(1);
  });
  it('treats untouched generated activities as unworked: no conflicts, same winner on both devices', () => {
    const worked = { ...activity('new:two-sum:2026-01-01'), id: 'new:two-sum:2026-01-01', status: 'done' as const, outcome: 'solo' as const, totalMs: 10, completedAt: '2026-01-01' };
    const planned = { ...activity('x'), id: 'new:two-sum:2026-01-01' };
    const plannedLater = { ...planned, createdAt: '2026-01-02' };
    const a = { ...base(), activities: [worked] }, b = { ...base(), activities: [planned] };
    expect(mergeStates(undefined, b, a).conflicts).toEqual([]);
    expect(mergeStates(undefined, b, a).state.activities).toEqual([worked]);
    expect(mergeStates(undefined, a, b).state.activities).toEqual([worked]);
    expect(mergeStates(undefined, { ...base(), activities: [planned], notes: { n: note() } }, { ...base(), activities: [plannedLater] }).state.activities)
      .toEqual(mergeStates(undefined, { ...base(), activities: [plannedLater], notes: { n: note() } }, { ...base(), activities: [planned] }).state.activities);
    // A rescheduled planned review no longer matches its generated id and is real work to preserve.
    const moved = { ...planned, dueDate: '2026-01-09' };
    expect(mergeStates({ ...base(), activities: [planned] }, { ...base(), activities: [moved] }, { ...base(), activities: [worked] }).conflicts).toHaveLength(1);
  });
  it('lets a first sync adopt the other device whole only when this device is untouched', () => {
    const remote = { ...base(), settings: { ...base().settings, startDate: '2025-12-01', dailyTargetMin: 100 }, checked: { x: true } };
    const fresh = { ...base(), settings: { ...base().settings, startDate: '2026-02-02' }, activities: [{ ...activity('x'), id: 'new:two-sum:2026-01-01' }] };
    expect(isUntouchedState(fresh)).toBe(true);
    expect(mergeStates(undefined, fresh, remote).state).toEqual(remote);
    const used = { ...fresh, checked: { y: true } };
    expect(isUntouchedState(used)).toBe(false);
    const merged = mergeStates(undefined, used, remote);
    expect(merged.conflicts.map((c) => c.path).sort()).toEqual(['settings/dailyTargetMin', 'settings/startDate']);
    expect(merged.state.checked).toEqual({ y: true, x: true });
  });
  it('turns an invalid combination of independently merged settings into conflicts', () => {
    const b = base();
    const l = { ...b, settings: { ...b.settings, dailyCapMin: 120, dailyTargetMin: 100 } };
    const r = { ...b, settings: { ...b.settings, dailyTargetMin: 170 } };
    const result = mergeStates(b, l, r);
    expect(result.conflicts.map((c) => c.path)).toContain('settings/dailyTargetMin');
    expect(validateState(result.state).settings.dailyCapMin).toBeGreaterThanOrEqual(validateState(result.state).settings.dailyTargetMin);
  });
  it('converges: independent non-conflicting changes merge to the same records from either side', () => {
    const b = { ...base(), activities: [activity('a'), activity('b')], favorites: { x: true } };
    const l = { ...b, activities: [{ ...activity('a'), status: 'skipped' as const }, activity('b'), activity('c')], favorites: { x: true, y: true } };
    const r = { ...b, activities: [activity('a'), { ...activity('b'), status: 'skipped' as const }], checked: { z: true } };
    const lr = mergeStates(b, l, r), rl = mergeStates(b, r, l);
    expect(lr.conflicts).toEqual([]);
    expect(canonical(stateRecords(lr.state))).toBe(canonical(stateRecords(rl.state)));
  });
  it('describes conflicting records with problem, type, status, outcome and date', () => {
    const done = { ...activity('a'), slug: 'two-sum', status: 'done' as const, outcome: 'hint' as const, completedAt: '2026-01-03' };
    expect(describeRecord('activities/a', done)).toBe('Two Sum · new · done · outcome hint · completed 2026-01-03');
    expect(describeRecord('activities/a', activity('a', true))).toContain('timer running');
    expect(describeRecord('checked/two-sum', true)).toBe('Two Sum: checked as solved');
    expect(describeRecord('notes/two-sum', undefined)).toContain('Not present');
    expect(describeRecord('simulations/s', { slug: 'two-sum', outcome: 'solved', endedAt: 0 })).toBe('Simulation of Two Sum · outcome solved · 1970-01-01');
  });
  it('keeps unresolved conflicts across repeated syncs and adopts matching versions', () => {
    const l = { ...base(), checked: { x: true } }, r = { ...base(), checked: { x: false } };
    const first = mergeStates(base(), l, r);
    expect(mergeStates(r, l, r, first.conflicts).conflicts).toEqual(first.conflicts);
    expect(mergeStates(r, r, r, first.conflicts).conflicts).toEqual([]);
  });
  it('old state and absent base merge without adding optional fields', () => {
    expect(mergeStates(undefined, base(), base())).toEqual({ state: base(), conflicts: [], deferred: [] });
    expect(validateState(mergeStates(base(), base(), base()).state)).toEqual(base());
  });
  it('canonical comparison is deterministic and prototype-like record IDs remain safe', () => {
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
    const result = applyRecords(base(), { 'favorites/__proto__': true });
    expect(Object.hasOwn(result.favorites!, '__proto__')).toBe(true);
    expect({}.toString()).toBe('[object Object]');
  });
});
