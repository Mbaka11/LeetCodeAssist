import { describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import { INTERVIEW_STEPS } from '../core/practiceTypes';
import type { AppState } from '../core/types';
import { createActions } from './actions';
import { createAppStore, STORAGE_KEY } from './storage';
import { backupBeforeLocalReplace, createSyncService, readSyncInfo, SYNC_BACKUPS, SYNC_BASE, SYNC_CONFIG, SYNC_CONFLICTS, SYNC_OWN, SYNC_OWN_MAX_AGE_MS, SYNC_STATUS, SYNC_BACKUP_MAX_BYTES } from './sync';
import { readRemote, replaceRemote, writeRemote, SYNC_MANIFEST, SYNC_PREFIX, SyncQuotaError, SyncRemoteInvalidError, type SyncArea } from './syncTransport';

/** Chrome JSON storage semantics, with real byte/item/count and rolling write-operation limits. */
class MockArea implements SyncArea {
  items: Record<string, unknown> = {};
  writes: number[] = [];
  time = 0;
  onSet?: (items: Record<string, unknown>) => Promise<void>;
  constructor(private quotas = true) {}
  async get(keys: null | string | string[]): Promise<Record<string, unknown>> {
    const entries = keys === null ? Object.entries(this.items) : (Array.isArray(keys) ? keys : [keys]).filter((k) => Object.hasOwn(this.items, k)).map((k) => [k, this.items[k]]);
    return JSON.parse(JSON.stringify(Object.fromEntries(entries))) as Record<string, unknown>;
  }
  private operation(): void {
    if (this.quotas && (this.writes.filter((n) => this.time - n < 60_000).length >= 120 || this.writes.filter((n) => this.time - n < 3_600_000).length >= 1800)) throw new Error('MAX_WRITE_OPERATIONS');
    this.writes.push(this.time);
  }
  async set(items: Record<string, unknown>): Promise<void> {
    const data = JSON.parse(JSON.stringify(items)) as Record<string, unknown>;
    const next = { ...this.items, ...data };
    const bytes = Object.entries(next).map(([k, v]) => new TextEncoder().encode(k + JSON.stringify(v)).length);
    if (this.quotas && (bytes.some((b) => b > 8192) || bytes.reduce((a, b) => a + b, 0) > 102400 || Object.keys(next).length > 512)) throw new Error('QUOTA_BYTES');
    this.operation();
    this.items = next;
    await this.onSet?.(data);
  }
  async remove(keys: string | string[]): Promise<void> {
    this.operation();
    for (const key of Array.isArray(keys) ? keys : [keys]) delete this.items[key];
  }
}
const state = (): AppState => defaultState('2026-01-01');
function noise(length: number): string {
  let result = '';
  for (let offset = 0; offset < length; offset += 32000) {
    const data = crypto.getRandomValues(new Uint8Array(Math.min(32000, length - offset)));
    for (const n of data) result += String.fromCharCode(33 + n % 90);
  }
  return result;
}
const withNote = (code: string): AppState => ({ ...state(), notes: { 'two-sum': { slug: 'two-sum', trigger: '', principle: '', pitfall: '', complexity: '', code, updatedAt: '2026-01-01' } } });
async function setup(initial = state()) {
  const local = new MockArea(false), remote = new MockArea();
  await local.set({ [STORAGE_KEY]: initial, [SYNC_CONFIG]: { enabled: true, deviceName: 'Windows' } });
  let clock = 100000;
  const service = createSyncService(local, remote, () => clock);
  return { local, remote, service, advance: (ms = 30001) => { clock += ms; remote.time += ms; } };
}

describe('sync gzip generation transport with Chrome quota mock', () => {
  it('round-trips multiple quota-safe chunks and preserves optional/old state', async () => {
    const remote = new MockArea();
    const input = withNote(noise(18000));
    const uploaded = await writeRemote(remote, input);
    expect(Object.keys(remote.items).filter((k) => k.startsWith(SYNC_PREFIX)).length).toBeGreaterThan(1);
    expect((await readRemote(remote)).state).toEqual(input);
    await writeRemote(remote, state(), uploaded.generation);
    expect((await readRemote(remote)).state).toEqual(state());
    expect(Object.keys(remote.items).filter((k) => k.includes(uploaded.generation))).toEqual([]);
  });
  it('switches manifest only after chunks exist; staged generations do not affect readers', async () => {
    const remote = new MockArea();
    const first = await writeRemote(remote, state());
    const next = { ...state(), checked: { x: true } };
    let staged = false;
    remote.onSet = async (items) => {
      if (!Object.hasOwn(items, SYNC_MANIFEST)) { staged = true; expect((await readRemote(remote)).state).toEqual(state()); }
      else expect((await readRemote(remote)).state).toEqual(next);
    };
    await writeRemote(remote, next, first.generation);
    expect(staged).toBe(true);
  });
  it('ignores absent sync data, rejects partial, checksum-corrupt and invalid schema snapshots', async () => {
    const remote = new MockArea();
    expect(await readRemote(remote)).toEqual({ bytes: 0 });
    await writeRemote(remote, state());
    const key = Object.keys(remote.items).find((k) => k.startsWith(SYNC_PREFIX))!;
    const chunk = remote.items[key];
    delete remote.items[key];
    await expect(readRemote(remote)).rejects.toThrow('Incomplete');
    remote.items[key] = String(chunk).slice(1);
    await expect(readRemote(remote)).rejects.toThrow('checksum');
    const bad = new MockArea();
    await writeRemote(bad, { ...state(), version: 2 } as unknown as AppState);
    await expect(readRemote(bad)).rejects.toThrow();
  });
  it('rejects stale-generation writes rather than replacing newer data', async () => {
    const remote = new MockArea();
    const first = await writeRemote(remote, state());
    await writeRemote(remote, state(), first.generation);
    await expect(writeRemote(remote, state(), first.generation)).rejects.toThrow('changed during merge');
  });
  it('checks full staging footprint, per-item and item-count quotas before writing', async () => {
    const remote = new MockArea();
    await expect(writeRemote(remote, withNote(noise(110000)))).rejects.toBeInstanceOf(SyncQuotaError);
    expect(remote.writes).toHaveLength(0);
    for (let i = 0; i < 512; i++) remote.items[`other-${i}`] = '';
    await expect(writeRemote(remote, state())).rejects.toBeInstanceOf(SyncQuotaError);
    expect(remote.writes).toHaveLength(0);
    await expect(new MockArea().set({ oversized: 'x'.repeat(8192) })).rejects.toThrow('QUOTA');
  });
});

describe('automatic sync service', () => {
  it('defaults off, leaves old local data untouched, and uploads when enabled', async () => {
    const local = new MockArea(false), remote = new MockArea();
    await local.set({ [STORAGE_KEY]: state() });
    const service = createSyncService(local, remote);
    await service.run();
    expect(remote.items).toEqual({});
    expect((await readSyncInfo(local)).config.enabled).toBe(false);
    await local.set({ [SYNC_CONFIG]: { enabled: true, deviceName: 'Mac' } });
    await service.run();
    expect((await readRemote(remote)).state).toEqual(state());
    expect(local.items[STORAGE_KEY]).toEqual(state());
  });
  it('merges non-conflicting remote work, backs up atomically, and restores as a propagating local change', async () => {
    const { local, remote, service, advance } = await setup();
    await service.run(); advance();
    const generation = (await readRemote(remote)).generation;
    await writeRemote(remote, { ...state(), checked: { x: true } }, generation);
    await service.run();
    expect((local.items[STORAGE_KEY] as AppState).checked.x).toBe(true);
    const info = await readSyncInfo(local);
    expect(info.backups).toHaveLength(1);
    expect(info.backups[0]!.state).toEqual(state());
    await service.restore(info.backups[0]!.id); advance();
    await service.run();
    expect((await readRemote(remote)).state?.checked).toEqual({});
    expect((await readSyncInfo(local)).backups).toHaveLength(2);
  });
  it('persists conflicts, publishes other changes, and resolves each side or all-local choices', async () => {
    const { local, remote, service, advance } = await setup();
    await service.run(); advance();
    await local.set({ [STORAGE_KEY]: { ...state(), checked: { x: true, y: true, local: true } } });
    await writeRemote(remote, { ...state(), checked: { x: false, y: false, remote: true } }, (await readRemote(remote)).generation);
    await service.run();
    let info = await readSyncInfo(local);
    expect(info.conflicts.map((c) => c.path)).toEqual(['checked/x', 'checked/y']);
    expect((local.items[STORAGE_KEY] as AppState).checked).toEqual({ x: true, y: true, local: true, remote: true });
    expect((await readRemote(remote)).state?.checked).toEqual({ x: false, y: false, local: true, remote: true });
    advance(); await service.run();
    expect((await readSyncInfo(local)).conflicts).toHaveLength(2);
    await service.resolve({ 'checked/x': 'remote', 'checked/y': 'local' });
    advance(); await service.run();
    info = await readSyncInfo(local);
    expect(info.conflicts).toEqual([]);
    expect((await readRemote(remote)).state?.checked).toEqual({ x: false, y: true, local: true, remote: true });
    expect(info.backups.length).toBeLessThanOrEqual(3);
  });
  it('protects running timers and resolves with latest local rather than stale conflict data', async () => {
    const active = { id: 'a', slug: 'two-sum', type: 'new' as const, status: 'in_progress' as const, dueDate: '2026-01-01', createdAt: '2026-01-01', timer: { running: true, startedAt: 1, accumulatedMs: 0 } };
    const { local, remote, service, advance } = await setup({ ...state(), activities: [active] });
    await writeRemote(remote, { ...state(), activities: [{ ...active, timer: { ...active.timer, startedAt: 2 } }] });
    await service.run();
    expect((local.items[STORAGE_KEY] as AppState).activities[0]!.timer.startedAt).toBe(1);
    expect((await readSyncInfo(local)).conflicts).toHaveLength(1);
    const latest = { ...active, timer: { running: false, startedAt: null, accumulatedMs: 500 } };
    await local.set({ [STORAGE_KEY]: { ...state(), activities: [latest] } });
    await service.resolve({ 'activities/a': 'local' });
    advance(); await service.run();
    // The other device's still-running version remains protected until an explicit choice; resolution
    // must acknowledge that remote running version, not regenerate the same conflict forever.
    expect((local.items[STORAGE_KEY] as AppState).activities[0]).toEqual(latest);
    expect((await readSyncInfo(local)).conflicts).toEqual([]);
    expect((await readRemote(remote)).state?.activities[0]).toEqual(latest);
  });
  it('handles JSON import as local changes relative to the synced base; old backups still import', async () => {
    const { local, remote, service, advance } = await setup();
    await service.run(); advance();
    const store = createAppStore({ read: async () => local.items[STORAGE_KEY], write: (s) => local.set({ [STORAGE_KEY]: s }), clear: () => local.remove(STORAGE_KEY), onChange: () => () => undefined });
    const actions = createActions(store);
    await actions.importJson(JSON.stringify({ ...state(), checked: { imported: true } }));
    await writeRemote(remote, { ...state(), checked: { remote: true } }, (await readRemote(remote)).generation);
    await service.run();
    expect((await readRemote(remote)).state?.checked).toEqual({ imported: true, remote: true });
    expect((await readSyncInfo(local)).conflicts).toEqual([]);
  });
  it('merges optional simulations, drill results and saved filters independently by ID', async () => {
    const checklist = Object.fromEntries(Object.keys(INTERVIEW_STEPS).map((s) => [s, true]));
    const simulation = { id: 's', slug: 'two-sum', createdAt: 0, endedAt: 100, mode: 'global', outcome: 'solved', checklist, durationMs: 100, targetMinutes: 25, reflection: '' };
    const drill = { id: 'd', createdAt: 0, endedAt: 100, includeUnworked: false, answers: [{ slug: 'two-sum', kind: 'outline', correct: true }], score: 1, total: 1 };
    const { local, remote, service } = await setup();
    await local.set({ [STORAGE_KEY]: { ...state(), simulations: { s: simulation } } });
    await writeRemote(remote, { ...state(), drillSessions: { d: drill } } as unknown as AppState);
    await service.run();
    const result = local.items[STORAGE_KEY] as AppState;
    expect(result.simulations?.s).toEqual(simulation);
    expect(result.drillSessions?.d).toEqual(drill);
    expect(result.activities).toEqual([]);
  });
  it('pauses oversized sync with clear status and keeps manual data/export intact', async () => {
    const input = withNote(noise(110000));
    const { local, remote, service } = await setup(input);
    await service.run();
    expect((await readSyncInfo(local)).status).toMatchObject({ paused: true, error: expect.stringContaining('quota') });
    expect(local.items[STORAGE_KEY]).toEqual(input);
    expect(remote.items[SYNC_MANIFEST]).toBeUndefined();
    await service.run();
    expect(remote.writes).toHaveLength(0);
  });
  it('rejects corrupted remote before changing local data/base/conflicts/backups', async () => {
    const { local, remote, service } = await setup();
    await writeRemote(remote, { ...state(), checked: { remote: true } });
    delete remote.items[Object.keys(remote.items).find((k) => k.startsWith(SYNC_PREFIX))!];
    await service.run();
    expect((await readSyncInfo(local)).status.error).toContain('Incomplete');
    expect(local.items[STORAGE_KEY]).toEqual(state());
    expect(local.items[SYNC_BASE]).toBeUndefined();
    expect(local.items[SYNC_CONFLICTS]).toBeUndefined();
    expect(local.items[SYNC_BACKUPS]).toBeUndefined();
  });
  it('coalesces rapid Sync now calls and stays within rolling Chrome write limits', async () => {
    const { local, remote, service, advance } = await setup();
    for (let i = 0; i < 130; i++) {
      await local.set({ [STORAGE_KEY]: { ...state(), checked: { [`change-${i}`]: true } } });
      await service.run();
    }
    expect(remote.writes).toHaveLength(2);
    advance(); await service.run();
    expect(remote.writes.length).toBeLessThanOrEqual(5);
    expect((await readSyncInfo(local)).status.error).toBeUndefined();
    expect((local.items[SYNC_STATUS] as { lastWrite: number }).lastWrite).toBe(130001);
  });
});

describe('automatic sync service: devices, timers and recovery', () => {
  const planned = { id: 'new:two-sum:2026-01-01', slug: 'two-sum', type: 'new' as const, status: 'planned' as const, dueDate: '2026-01-01', createdAt: '2026-01-01', timer: { running: false, startedAt: null, accumulatedMs: 0 } };
  const running = { ...planned, status: 'in_progress' as const, timer: { running: true, startedAt: 5, accumulatedMs: 0 } };
  const remoteState = async (remote: MockArea): Promise<AppState> => (await readRemote(remote)).state!;

  it('uploads a local timer start without raising a conflict against its own previous upload', async () => {
    const { local, remote, service, advance } = await setup({ ...state(), activities: [planned] });
    await service.run(); advance();
    await local.set({ [STORAGE_KEY]: { ...state(), activities: [running] } });
    await service.run();
    expect((await readSyncInfo(local)).conflicts).toEqual([]);
    expect((await remoteState(remote)).activities).toEqual([running]);
    expect((local.items[STORAGE_KEY] as AppState).activities).toEqual([running]);
  });
  it('does not mirror a timer running on the other device until it is paused there', async () => {
    const { local, remote, service, advance } = await setup({ ...state(), activities: [planned] });
    await service.run(); advance();
    await writeRemote(remote, { ...state(), activities: [running] }, (await readRemote(remote)).generation);
    await service.run(); advance();
    expect((local.items[STORAGE_KEY] as AppState).activities).toEqual([planned]);
    expect((await readSyncInfo(local)).status.deferred).toBe(1);
    expect((await readSyncInfo(local)).conflicts).toEqual([]);
    expect((await remoteState(remote)).activities).toEqual([running]);
    await service.run(); advance();
    expect((await remoteState(remote)).activities).toEqual([running]);
    const paused = { ...running, timer: { running: false, startedAt: null, accumulatedMs: 4000 } };
    await writeRemote(remote, { ...state(), activities: [paused] }, (await readRemote(remote)).generation);
    await service.run();
    expect((local.items[STORAGE_KEY] as AppState).activities).toEqual([paused]);
    expect((await readSyncInfo(local)).status.deferred).toBe(0);
  });
  it("asks before replacing a running local timer with the other device's finished record", async () => {
    const { local, remote, service, advance } = await setup({ ...state(), activities: [running] });
    await service.run(); advance();
    const done = { ...planned, status: 'done' as const, outcome: 'solo' as const, totalMs: 9000, completedAt: '2026-01-01' };
    await writeRemote(remote, { ...state(), activities: [done] }, (await readRemote(remote)).generation);
    await service.run();
    expect((await readSyncInfo(local)).conflicts.map((c) => c.path)).toEqual(['activities/new:two-sum:2026-01-01']);
    expect((local.items[STORAGE_KEY] as AppState).activities).toEqual([running]);
    await service.resolve({ 'activities/new:two-sum:2026-01-01': 'remote' });
    expect((local.items[STORAGE_KEY] as AppState).activities).toEqual([done]);
    expect((await readSyncInfo(local)).backups[0]!.state.activities).toEqual([running]);
  });
  it("lets an untouched second computer adopt the first computer's data on its first sync, after a backup", async () => {
    const first = { ...state(), checked: { a: true }, activities: [{ ...planned, status: 'done' as const, outcome: 'solo' as const, totalMs: 1, completedAt: '2026-01-01' }] };
    const remote = new MockArea();
    await writeRemote(remote, first, undefined, { device: 'Windows', at: 5 });
    const local = new MockArea(false);
    const mine = { ...state(), settings: { ...state().settings, startDate: '2026-03-03' }, activities: [{ ...planned, id: 'new:two-sum:2026-03-03', dueDate: '2026-03-03' }] };
    await local.set({ [STORAGE_KEY]: mine, [SYNC_CONFIG]: { enabled: true, deviceName: 'Mac' } });
    await createSyncService(local, remote, () => 1_000_000).run();
    expect(local.items[STORAGE_KEY]).toEqual(first);
    const info = await readSyncInfo(local);
    expect(info.conflicts).toEqual([]);
    expect(info.backups[0]!.state).toEqual(mine);
    expect(info.status).toMatchObject({ remoteDevice: 'Windows', remoteAt: 5 });
    expect(await remoteState(remote)).toEqual(first);
  });
  it('after a local reset the new setup adopts the cloud copy instead of deleting it', async () => {
    const data = { ...state(), checked: { keep: true } };
    const { local, remote, service, advance } = await setup(data);
    await service.run(); advance();
    await local.remove(STORAGE_KEY);
    await service.run();
    await service.localReset();
    expect(local.items[SYNC_BASE]).toBeUndefined();
    await local.set({ [STORAGE_KEY]: state() });
    await service.run();
    expect(local.items[STORAGE_KEY]).toEqual(data);
    expect((await remoteState(remote)).checked).toEqual({ keep: true });
  });
  it('keeps at most three backups under the size cap and backs up only when data changes', async () => {
    const { local, remote, service, advance } = await setup();
    await service.run();
    for (let i = 0; i < 5; i++) {
      advance();
      await writeRemote(remote, { ...state(), checked: { [`k${i}`]: true } }, (await readRemote(remote)).generation);
      await service.run();
      await service.run();
    }
    const backups = (await readSyncInfo(local)).backups;
    expect(backups).toHaveLength(3);
    expect(Object.keys(backups[0]!.state.checked)).toEqual(['k3']);
    expect(JSON.stringify(backups).length).toBeLessThan(SYNC_BACKUP_MAX_BYTES);
  });
  it('recovers from a corrupt cloud copy only through an explicit replacement', async () => {
    const { local, remote, service, advance } = await setup({ ...state(), checked: { mine: true } });
    await writeRemote(remote, state());
    remote.items[SYNC_MANIFEST] = { version: 1, generation: 'g', count: 1, checksum: 'bad' };
    await service.run();
    expect((await readSyncInfo(local)).status.error).toBeTruthy();
    expect(local.items[STORAGE_KEY]).toEqual({ ...state(), checked: { mine: true } });
    advance();
    await service.replaceCloudCopy();
    expect((await readSyncInfo(local)).status.error).toBeUndefined();
    expect((await remoteState(remote)).checked).toEqual({ mine: true });
    expect(Object.keys(remote.items).filter((k) => k.startsWith(SYNC_PREFIX)).length).toBe(1);
  });
  it('reports same-ID simulation records with different content as a conflict', async () => {
    const checklist = Object.fromEntries(Object.keys(INTERVIEW_STEPS).map((k) => [k, true]));
    const sim = (outcome: string) => ({ id: 's', slug: 'two-sum', createdAt: 0, endedAt: 100, mode: 'global', outcome, checklist, durationMs: 100, targetMinutes: 25, reflection: '' });
    const { local, remote, service } = await setup({ ...state(), simulations: { s: sim('solved') } } as unknown as AppState);
    await writeRemote(remote, { ...state(), simulations: { s: sim('partial') } } as unknown as AppState);
    await service.run();
    const conflicts = (await readSyncInfo(local)).conflicts;
    expect(conflicts.map((c) => c.path)).toEqual(['simulations/s']);
    expect((local.items[STORAGE_KEY] as AppState).simulations?.s).toEqual(sim('solved'));
  });
  it('adopts remote data from an old-schema backup without optional fields', async () => {
    const { local, remote, service } = await setup({ ...state(), checked: { a: true } });
    await service.run();
    expect((await remoteState(remote)).favorites).toBeUndefined();
    const old = { version: 1, settings: state().settings, activities: [], notes: {}, problemStatus: {}, checked: { a: true, b: true } };
    await writeRemote(remote, old as AppState, (await readRemote(remote)).generation);
    await service.run();
    expect(local.items[STORAGE_KEY]).toEqual(old);
    expect((local.items[STORAGE_KEY] as AppState).favorites).toBeUndefined();
  });
});

/** One computer: its own local area and clock, a view of the shared Chrome sync area that can lag behind. */
class LaggedView implements SyncArea {
  frozen: Record<string, unknown> | undefined;
  constructor(private shared: MockArea) {}
  freeze(): void { this.frozen = JSON.parse(JSON.stringify(this.shared.items)) as Record<string, unknown>; }
  thaw(): void { this.frozen = undefined; }
  async get(keys: null | string | string[]): Promise<Record<string, unknown>> {
    const frozen = this.frozen;
    if (!frozen) return this.shared.get(keys);
    const names = keys === null ? Object.keys(frozen) : Array.isArray(keys) ? keys : [keys];
    return JSON.parse(JSON.stringify(Object.fromEntries(names.filter((k) => Object.hasOwn(frozen, k)).map((k) => [k, frozen[k]])))) as Record<string, unknown>;
  }
  set(items: Record<string, unknown>): Promise<void> { return this.shared.set(items); }
  remove(keys: string | string[]): Promise<void> { return this.shared.remove(keys); }
}
async function device(shared: MockArea, name: string, initial: AppState) {
  const local = new MockArea(false);
  await local.set({ [STORAGE_KEY]: initial, [SYNC_CONFIG]: { enabled: true, deviceName: name } });
  const view = new LaggedView(shared);
  let clock = 100000;
  return { local, view, service: createSyncService(local, view, () => clock), advance: () => { clock += 30001; shared.time += 30001; }, state: (): AppState => local.items[STORAGE_KEY] as AppState };
}
const noteWith = (code: string): AppState['notes'] => withNote(code).notes;

describe('sync: concurrent uploads from two computers', () => {
  it("keeps A's note when B overwrites A's upload before A's manifest reaches B", async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', state());
    const b = await device(shared, 'B', state());
    await a.service.run(); a.advance();
    await b.service.run(); b.advance();
    // B's Chrome has not received A's next upload yet.
    b.view.freeze();
    await a.local.set({ [STORAGE_KEY]: { ...state(), notes: noteWith('from A') } });
    await a.service.run(); a.advance();
    await b.local.set({ [STORAGE_KEY]: { ...state(), checked: { fromB: true } } });
    await b.service.run(); b.advance();
    expect((await readRemote(shared)).state?.notes).toEqual({});
    // A now sees B's copy, which does not contain A's note. A's note is merged, not deleted.
    await a.service.run(); a.advance();
    expect(a.state().notes['two-sum']?.code).toBe('from A');
    expect(a.state().checked).toEqual({ fromB: true });
    expect((await readRemote(shared)).state?.notes['two-sum']?.code).toBe('from A');
    expect((await readSyncInfo(a.local)).conflicts).toEqual([]);
    // B receives the merged result.
    b.view.thaw();
    await b.service.run();
    expect(b.state().notes['two-sum']?.code).toBe('from A');
    expect(b.state().checked).toEqual({ fromB: true });
  });
  it("does not turn the other device's merged result into conflicts when it descends from our upload", async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', state());
    const b = await device(shared, 'B', state());
    await a.service.run(); a.advance();
    await b.service.run(); b.advance();
    await a.local.set({ [STORAGE_KEY]: { ...state(), notes: noteWith('v1') } });
    await a.service.run(); a.advance();
    await b.service.run(); b.advance();
    await b.local.set({ [STORAGE_KEY]: { ...b.state(), checked: { fromB: true } } });
    await b.service.run(); b.advance();
    expect(b.state().notes['two-sum']?.code).toBe('v1');
    await a.local.set({ [STORAGE_KEY]: { ...a.state(), notes: noteWith('v2') } });
    await a.service.run();
    expect((await readSyncInfo(a.local)).conflicts).toEqual([]);
    expect(a.state().notes['two-sum']?.code).toBe('v2');
    expect(a.state().checked).toEqual({ fromB: true });
  });
  it('records the published generation with the pre-upload base, keeps it through its echo, clears it after another generation', async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', { ...state(), checked: { x: true } });
    await a.service.run(); a.advance();
    const own = a.local.items[SYNC_OWN] as { generation: string; base: AppState | null };
    expect(own.generation).toBe((await readRemote(shared)).generation);
    expect(own.base).toBeNull();
    await a.service.run();
    expect(a.local.items[SYNC_OWN]).toEqual(own);
    await writeRemote(shared, { ...state(), checked: { x: true } }, own.generation);
    await a.service.run();
    expect(a.local.items[SYNC_OWN]).toBeNull();
  });
  it("keeps A's note when A's own upload echo is processed before B's blind overwrite arrives", async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', state());
    const b = await device(shared, 'B', state());
    await a.service.run(); a.advance();
    await b.service.run(); b.advance();
    b.view.freeze();
    await a.local.set({ [STORAGE_KEY]: { ...state(), notes: noteWith('from A') } });
    await a.service.run(); a.advance();
    // Echo: A's own manifest change and poll alarm run again before B's overwrite lands.
    await a.service.run(); a.advance();
    await a.service.run(); a.advance();
    await b.local.set({ [STORAGE_KEY]: { ...state(), checked: { fromB: true } } });
    await b.service.run(); b.advance();
    expect((await readRemote(shared)).state?.notes).toEqual({});
    await a.service.run(); a.advance();
    expect(a.state().notes['two-sum']?.code).toBe('from A');
    expect(a.state().checked).toEqual({ fromB: true });
    expect((await readRemote(shared)).state?.notes['two-sum']?.code).toBe('from A');
    b.view.thaw();
    await b.service.run();
    expect(b.state().notes['two-sum']?.code).toBe('from A');
    expect(b.state().checked).toEqual({ fromB: true });
  });
  it('ignores an own-upload marker older than an hour, so a long-idle device does not resurrect remote deletions', async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', { ...state(), checked: { x: true } });
    await a.service.run(); a.advance();
    // Much later, another device's copy no longer lists A's generation in its lineage and has deleted x.
    await replaceRemote(shared, { ...state(), checked: { y: true } });
    const later = createSyncService(a.local, a.view, () => 100000 + SYNC_OWN_MAX_AGE_MS + 120000);
    await later.run();
    expect(a.state().checked).toEqual({ y: true });
    expect((await readSyncInfo(a.local)).conflicts).toEqual([]);
  });
  it('accepts a long line of legitimate descendants through the manifest lineage', async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', { ...state(), checked: { x: true } });
    await a.service.run(); a.advance();
    let generation = (await readRemote(shared)).generation;
    for (let i = 0; i < 12; i++) generation = (await writeRemote(shared, { ...state(), checked: { x: true, [`g${i}`]: true } }, generation)).generation;
    await writeRemote(shared, { ...state(), checked: { g11: true } }, generation);
    await a.service.run();
    expect(a.state().checked).toEqual({ g11: true });
    expect((await readSyncInfo(a.local)).conflicts).toEqual([]);
  });
  it('ignores a corrupt local own-upload marker instead of failing every pass', async () => {
    const shared = new MockArea();
    const a = await device(shared, 'A', { ...state(), checked: { x: true } });
    await a.service.run(); a.advance();
    a.local.items[SYNC_OWN] = { generation: 'g', base: { junk: true }, at: 100000 };
    await a.service.run();
    expect((await readSyncInfo(a.local)).status.error).toBeUndefined();
  });
  it('writes a manifest lineage so descendants can be recognised', async () => {
    const remote = new MockArea();
    const first = await writeRemote(remote, state());
    const second = await writeRemote(remote, state(), first.generation);
    const third = await writeRemote(remote, state(), second.generation);
    expect((await readRemote(remote)).lineage).toEqual([second.generation, first.generation]);
    expect(third.generation).toBe((await readRemote(remote)).generation);
  });
});

describe('sync: replacing the cloud copy is a bounded recovery', () => {
  const orphans = (remote: MockArea, count: number): void => { for (let i = 0; i < count; i++) remote.items[`${SYNC_PREFIX}orphan.${i}`] = 'x'.repeat(6900); };

  it('marks only unreadable and quota failures as replaceable', async () => {
    const corrupt = await setup();
    await writeRemote(corrupt.remote, state());
    corrupt.remote.items[SYNC_MANIFEST] = { version: 1, generation: 'g', count: 1, checksum: 'bad' };
    await corrupt.service.run();
    expect((await readSyncInfo(corrupt.local)).status).toMatchObject({ replaceable: true, paused: false });
    await expect(readRemote(corrupt.remote)).rejects.toBeInstanceOf(SyncRemoteInvalidError);
    // A stale expected generation is a benign race, not a corrupt cloud copy.
    const race = await setup({ ...state(), checked: { a: true } });
    await race.service.run(); race.advance();
    const stale = JSON.parse(JSON.stringify(race.remote.items)) as Record<string, unknown>;
    await writeRemote(race.remote, state(), (await readRemote(race.remote)).generation);
    await race.local.set({ [STORAGE_KEY]: { ...state(), checked: { a: true, b: true } } });
    let reads = 0;
    const staleFirstRead: SyncArea = { get: async (keys) => (reads++ === 0 ? JSON.parse(JSON.stringify(stale)) as Record<string, unknown> : race.remote.get(keys)), set: (items) => race.remote.set(items), remove: (keys) => race.remote.remove(keys) };
    await createSyncService(race.local, staleFirstRead, () => 500000).run();
    expect((await readSyncInfo(race.local)).status.error).toContain('Remote sync changed');
    expect((await readSyncInfo(race.local)).status.replaceable).toBe(false);
    const quota = await setup(withNote(noise(110000)));
    await quota.service.run();
    expect((await readSyncInfo(quota.local)).status).toMatchObject({ replaceable: true, paused: true });
  });
  it('refuses to replace a readable cloud copy and leaves it untouched', async () => {
    const { local, remote, service } = await setup({ ...state(), checked: { mine: true } });
    await writeRemote(remote, { ...state(), checked: { theirs: true } });
    local.items[SYNC_STATUS] = { error: 'Remote sync changed during merge; retry Sync now' };
    const before = JSON.stringify(remote.items);
    await expect(service.replaceCloudCopy()).rejects.toThrow('readable');
    expect(JSON.stringify(remote.items)).toBe(before);
  });
  it('recovers a quota pause caused by leaked chunks, saving the readable cloud copy as a local backup first', async () => {
    const { local, remote, service, advance } = await setup({ ...state(), checked: { mine: true } });
    await writeRemote(remote, { ...state(), checked: { theirs: true } });
    orphans(remote, 15);
    await service.run();
    expect((await readSyncInfo(local)).status).toMatchObject({ paused: true, replaceable: true });
    advance();
    await service.replaceCloudCopy();
    const info = await readSyncInfo(local);
    expect(info.status.paused).toBe(false);
    expect(info.status.replaceable).toBeFalsy();
    expect(info.status.error).toBeUndefined();
    expect(info.backups[0]!.state.checked).toEqual({ theirs: true });
    // The failed pass had already merged the readable cloud copy into this device, so the replacement keeps both.
    expect((await readRemote(remote)).state?.checked).toEqual({ mine: true, theirs: true });
    expect(Object.keys(remote.items).filter((k) => k.includes('orphan'))).toEqual([]);
  });
  it('does not empty the cloud copy when this device data cannot fit', async () => {
    const { local, remote, service } = await setup(withNote(noise(110000)));
    await writeRemote(remote, state());
    local.items[SYNC_STATUS] = { paused: true, error: 'Sync paused: quota', replaceable: true };
    const before = JSON.stringify(remote.items);
    await service.replaceCloudCopy();
    expect((await readSyncInfo(local)).status.paused).toBe(true);
    expect(JSON.stringify(remote.items)).toBe(before);
    await expect(replaceRemote(remote, withNote(noise(110000)))).rejects.toBeInstanceOf(SyncQuotaError);
  });
  it('Sync now clears a pause inside the service queue and retries', async () => {
    const { local, remote, service } = await setup({ ...state(), checked: { mine: true } });
    local.items[SYNC_STATUS] = { paused: true, error: 'Sync paused: quota', replaceable: true };
    await service.run();
    expect(remote.items[SYNC_MANIFEST]).toBeUndefined();
    await service.syncNow();
    expect((await readSyncInfo(local)).status.paused).toBe(false);
    expect((await readRemote(remote)).state?.checked).toEqual({ mine: true });
  });
});

describe('sync: failed and abandoned uploads leave no orphan chunks', () => {
  const chunkKeys = (remote: MockArea): string[] => Object.keys(remote.items).filter((k) => k.startsWith(SYNC_PREFIX));
  it('removes staged chunks when publishing the manifest fails', async () => {
    const remote = new MockArea();
    const first = await writeRemote(remote, state());
    const keep = chunkKeys(remote);
    const set = remote.set.bind(remote);
    remote.set = async (items) => { if (Object.hasOwn(items, SYNC_MANIFEST)) throw new Error('MAX_WRITE_OPERATIONS'); await set(items); };
    await expect(writeRemote(remote, withNote(noise(18000)), first.generation)).rejects.toThrow('MAX_WRITE_OPERATIONS');
    expect(chunkKeys(remote)).toEqual(keep);
    expect((await readRemote(remote)).generation).toBe(first.generation);
  });
  it('removes staged chunks when another device publishes while staging', async () => {
    const remote = new MockArea();
    const first = await writeRemote(remote, state());
    const keep = chunkKeys(remote);
    remote.onSet = async () => { remote.onSet = undefined; remote.items[SYNC_MANIFEST] = { ...(remote.items[SYNC_MANIFEST] as object), generation: 'other-device' }; };
    await expect(writeRemote(remote, state(), first.generation)).rejects.toThrow('changed during upload');
    expect(chunkKeys(remote)).toEqual(keep);
  });
  it('after a successful publish removes leaked chunks from any earlier generation, using a fresh key list', async () => {
    const remote = new MockArea();
    const first = await writeRemote(remote, state());
    remote.items[`${SYNC_PREFIX}leaked-1.0`] = 'x';
    remote.items[`${SYNC_PREFIX}leaked-2.3`] = 'x';
    remote.items.unrelated = 'keep';
    const second = await writeRemote(remote, withNote(noise(18000)), first.generation);
    expect(chunkKeys(remote).every((k) => k.startsWith(`${SYNC_PREFIX}${second.generation}.`))).toBe(true);
    expect(remote.items.unrelated).toBe('keep');
    expect((await readRemote(remote)).generation).toBe(second.generation);
  });
});

describe('sync: local backup before a JSON import', () => {
  it('stores the current data as a backup only when sync is enabled', async () => {
    const local = new MockArea(false);
    await local.set({ [STORAGE_KEY]: { ...state(), checked: { before: true } } });
    await backupBeforeLocalReplace(local, () => 7);
    expect(local.items[SYNC_BACKUPS]).toBeUndefined();
    await local.set({ [SYNC_CONFIG]: { enabled: true, deviceName: 'Windows' } });
    await backupBeforeLocalReplace(local, () => 7);
    const backups = (await readSyncInfo(local)).backups;
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatchObject({ at: 7, state: { checked: { before: true } } });
  });
  it('never blocks the import recovery path when stored data is invalid', async () => {
    const local = new MockArea(false);
    await local.set({ [STORAGE_KEY]: { junk: true }, [SYNC_CONFIG]: { enabled: true, deviceName: 'Windows' } });
    await expect(backupBeforeLocalReplace(local)).resolves.toBeUndefined();
    expect(local.items[SYNC_BACKUPS]).toBeUndefined();
  });
  it('leaves things alone when there is no local program yet', async () => {
    const local = new MockArea(false);
    await local.set({ [SYNC_CONFIG]: { enabled: true, deviceName: 'Windows' } });
    await backupBeforeLocalReplace(local);
    expect(local.items[SYNC_BACKUPS]).toBeUndefined();
  });
});
