/**
 * Automatic sync orchestration. The background worker owns every upload; the dashboard only writes the local
 * sync config and sends messages. All state writes run under the same Web Lock as `AppStore` commands.
 */
import { applyRecords, baseAfterSync, canonical, mergeStates, publishableState, stateRecords, type SyncConflict } from '../core/syncMerge';
import { validateState } from '../core/state';
import type { AppState } from '../core/types';
import { STORAGE_KEY } from './storage';
import { readRemote, replaceRemote, writeRemote, SyncQuotaError, SyncRemoteInvalidError, type SyncArea } from './syncTransport';

export const SYNC_CONFIG = 'lca.sync.config.v1';
export const SYNC_STATUS = 'lca.sync.status.v1';
/** Last remote snapshot this device merged or published (the three-way merge base). Local only. */
export const SYNC_BASE = 'lca.sync.base.v1';
/**
 * Set after this device uploads: the generation it published and the merge base it had just before. If the next
 * remote copy is neither that generation nor a descendant of it (another device overwrote it concurrently), the
 * merge uses `base` instead of our own upload, so our not-yet-seen changes are merged rather than treated as deleted.
 * `null` once a later merge has settled it. Local only.
 */
export const SYNC_OWN = 'lca.sync.own.v1';
export const SYNC_CONFLICTS = 'lca.sync.conflicts.v1';
export const SYNC_BACKUPS = 'lca.sync.backups.v1';
export const SYNC_ALARM = 'lca-sync';
export const SYNC_WRITE_GAP_MS = 30_000;
export const SYNC_BACKUP_COUNT = 3;
/** Keeps state + base + backups comfortably inside the 10 MB chrome.storage.local quota. */
export const SYNC_BACKUP_MAX_BYTES = 4 * 1024 * 1024;

export interface SyncConfig { enabled: boolean; deviceName: string; }
export interface SyncStatus {
  lastSync?: number;
  lastWrite?: number;
  bytes?: number;
  error?: string;
  paused?: boolean;
  remoteDevice?: string;
  remoteAt?: number;
  /** Records waiting because the other device has a running timer on them. */
  deferred?: number;
  /** The cloud copy is unreadable or the quota is exhausted: "Replace cloud copy" is a valid recovery. */
  replaceable?: boolean;
}
/** `at`: when we published. A marker older than SYNC_OWN_MAX_AGE_MS is ignored, so a long-idle device does not mistake
 * a long line of legitimate descendants (beyond the manifest lineage) for an overwrite. */
interface SyncOwn { generation: string; base: AppState | null; at?: number }
export const SYNC_OWN_MAX_AGE_MS = 60 * 60 * 1000;
export interface SyncBackup { id: string; at: number; state: AppState; }
export interface SyncInfo { config: SyncConfig; status: SyncStatus; conflicts: SyncConflict[]; backups: SyncBackup[]; }
export const DEFAULT_SYNC_CONFIG: SyncConfig = { enabled: false, deviceName: 'This computer' };

export async function readSyncInfo(local: SyncArea): Promise<SyncInfo> {
  const data = await local.get([SYNC_CONFIG, SYNC_STATUS, SYNC_CONFLICTS, SYNC_BACKUPS]);
  return {
    config: (data[SYNC_CONFIG] as SyncConfig | undefined) ?? DEFAULT_SYNC_CONFIG,
    status: (data[SYNC_STATUS] as SyncStatus | undefined) ?? {},
    conflicts: (data[SYNC_CONFLICTS] as SyncConflict[] | undefined) ?? [],
    backups: (data[SYNC_BACKUPS] as SyncBackup[] | undefined) ?? [],
  };
}

function backupBefore(old: SyncBackup[], state: AppState, now: number): SyncBackup[] {
  const next: SyncBackup[] = [{ id: crypto.randomUUID(), at: now, state }, ...old].slice(0, SYNC_BACKUP_COUNT);
  const size = (items: SyncBackup[]): number => new TextEncoder().encode(JSON.stringify(items)).length;
  while (size(next) > SYNC_BACKUP_MAX_BYTES && next.length > 1) next.pop();
  if (size(next) > SYNC_BACKUP_MAX_BYTES) throw new Error('Sync paused: a pre-merge backup would exceed 4 MiB. Export JSON and reduce data before syncing.');
  return next;
}

/** Dashboard-side: keep a local copy of the current data before a JSON import replaces it (only when sync is enabled). */
export async function backupBeforeLocalReplace(local: SyncArea, now: () => number = Date.now): Promise<void> {
  await withStateLock(async () => {
    const info = await readSyncInfo(local);
    if (!info.config.enabled) return;
    const raw = (await local.get(STORAGE_KEY))[STORAGE_KEY];
    if (raw === undefined) return;
    let current: AppState;
    try {
      current = validateState(raw);
    } catch {
      // Invalid stored data cannot be backed up as a state; importing is the recovery path, so never block it.
      return;
    }
    await local.set({ [SYNC_BACKUPS]: backupBefore(info.backups, current, now()) });
  });
}

const sameRecords = (a: AppState | undefined, b: AppState | undefined): boolean => canonical(stateRecords(a)) === canonical(stateRecords(b));

/** Uses the same Web Lock as all AppStore commands, so imports/timers cannot race a merge. */
export async function withStateLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request('leetcode-assist-state', task) : task();
}

export function createSyncService(local: SyncArea, remote: SyncArea, now: () => number = Date.now) {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(() => withStateLock(task));
    queue = result.catch(() => undefined);
    return result;
  };
  const failure = (status: SyncStatus, error: unknown): SyncStatus => ({
    ...status,
    error: error instanceof Error ? error.message : String(error),
    paused: error instanceof SyncQuotaError,
    replaceable: error instanceof SyncQuotaError || error instanceof SyncRemoteInvalidError,
  });
  const runLocked = async (): Promise<void> => {
    const info = await readSyncInfo(local);
    if (!info.config.enabled || info.status.paused) return;
    let status: SyncStatus = { ...info.status, error: undefined, replaceable: undefined };
    try {
      const data = await local.get([STORAGE_KEY, SYNC_BASE, SYNC_OWN]);
      if (data[STORAGE_KEY] === undefined) return;
      const state = validateState(data[STORAGE_KEY]);
      const base = data[SYNC_BASE] === undefined ? undefined : validateState(data[SYNC_BASE]);
      const own = readOwn(data[SYNC_OWN], now());
      // Corrupt, partial or invalid remote data throws here, before anything local is changed.
      const incoming = await readRemote(remote);
      status.bytes = incoming.bytes;
      if (incoming.writer) { status.remoteDevice = incoming.writer.device; status.remoteAt = incoming.writer.at; }
      let current = state;
      let held: SyncConflict[] = [];
      let deferred: SyncConflict[] = [];
      let baseNext = base;
      if (incoming.state) {
        // Our own upload is a valid merge base only if the remote is that upload or was written on top of it.
        // Otherwise another device overwrote it without having seen it: merge against the base from before our upload.
        const overwritten = own !== undefined && incoming.generation !== own.generation && !incoming.lineage?.includes(own.generation);
        const mergeBase = overwritten ? own.base : base;
        const merged = mergeStates(mergeBase, state, incoming.state, info.conflicts);
        deferred = merged.deferred;
        held = [...merged.conflicts, ...deferred];
        current = merged.state;
        baseNext = baseAfterSync(incoming.state, deferred);
        const updates: Record<string, unknown> = {};
        if (!sameRecords(state, current)) {
          // Backup and merged state are one local write: no merge is applied if the backup cannot be stored.
          updates[SYNC_BACKUPS] = backupBefore(info.backups, state, now());
          updates[STORAGE_KEY] = current;
        }
        if (canonical(info.conflicts) !== canonical(merged.conflicts)) updates[SYNC_CONFLICTS] = merged.conflicts;
        if (!sameRecords(base, baseNext)) updates[SYNC_BASE] = baseNext;
        // Keep the marker while the remote is still our own upload (including the echo of that upload):
        // a later overwrite by another device that never saw it must still be merged against the prior base.
        if (own && incoming.generation !== own.generation) updates[SYNC_OWN] = null;
        if (Object.keys(updates).length) await local.set(updates);
        status.deferred = deferred.length;
      } else {
        status.deferred = 0;
      }
      const outgoing = publishableState(current, held);
      const dirty = !incoming.state || !sameRecords(outgoing, incoming.state);
      if (dirty && (status.lastWrite === undefined || now() - status.lastWrite >= SYNC_WRITE_GAP_MS)) {
        // Persist the gate before any remote operation, including failures/restarts.
        status.lastWrite = now();
        await local.set({ [SYNC_STATUS]: status });
        const uploaded = await writeRemote(remote, outgoing, incoming.generation, { device: info.config.deviceName, at: now() });
        status.bytes = uploaded.bytes;
        const priorBase = incoming.state ? baseNext : base;
        const published: SyncOwn = { generation: uploaded.generation, base: priorBase ?? null, at: now() };
        await local.set({ [SYNC_BASE]: baseAfterSync(outgoing, deferred), [SYNC_OWN]: published });
      }
      status.lastSync = now();
    } catch (error) {
      status = failure(status, error);
    }
    await local.set({ [SYNC_STATUS]: status });
  };
  return {
    /**
     * One merge-and-publish pass. All calls, including "Sync now", share a 30-second write gate
     * (at most 120 uploads/hour, about 360 Chrome sync write operations, below the 1800/hour limit).
     */
    run: () => exclusive(runLocked),
    /** "Sync now": clears a pause or error and runs, inside the same queue so it cannot clobber a concurrent pass. */
    syncNow: () => exclusive(async () => {
      const info = await readSyncInfo(local);
      await local.set({ [SYNC_STATUS]: { ...info.status, paused: false, error: undefined, replaceable: undefined } });
      await runLocked();
    }),
    /** Applies the user's per-record choices. "This device" keeps the latest local record, not a stale dialog copy. */
    resolve: (choices: Record<string, 'local' | 'remote'>) => exclusive(async () => {
      const info = await readSyncInfo(local);
      const state = validateState((await local.get(STORAGE_KEY))[STORAGE_KEY]);
      const changes: Record<string, unknown> = {};
      for (const conflict of info.conflicts) if (choices[conflict.path] === 'remote') changes[conflict.path] = conflict.remote;
      const next = applyRecords(state, changes);
      const updates: Record<string, unknown> = { [SYNC_CONFLICTS]: info.conflicts.filter((c) => !choices[c.path]) };
      if (!sameRecords(state, next)) {
        updates[SYNC_BACKUPS] = backupBefore(info.backups, state, now());
        updates[STORAGE_KEY] = next;
      }
      await local.set(updates);
    }),
    /** Restoring is a local change set: it propagates like an import and keeps a backup of what it replaces. */
    restore: (id: string) => exclusive(async () => {
      const info = await readSyncInfo(local);
      const backup = info.backups.find((item) => item.id === id);
      if (!backup) throw new Error('Backup no longer exists');
      const state = validateState((await local.get(STORAGE_KEY))[STORAGE_KEY]);
      await local.set({
        [STORAGE_KEY]: validateState(backup.state),
        [SYNC_BACKUPS]: backupBefore(info.backups, state, now()),
        [SYNC_CONFLICTS]: [],
      });
    }),
    /** The local program was removed (reset): forget the base so a new setup adopts the cloud copy instead of deleting it. */
    localReset: () => exclusive(async () => {
      await local.remove([SYNC_BASE, SYNC_CONFLICTS, SYNC_OWN]);
    }),
    /**
     * Recovery for an unreadable cloud copy or an exhausted quota: replace it with this device's data. Refuses while
     * the cloud copy is readable and the quota is not the problem. A readable copy that is replaced is first kept as a local backup.
     */
    replaceCloudCopy: () => exclusive(async () => {
      const info = await readSyncInfo(local);
      let readable: AppState | undefined;
      let unreadable = false;
      try {
        readable = (await readRemote(remote)).state;
      } catch (error) {
        if (!(error instanceof SyncRemoteInvalidError)) throw error;
        unreadable = true;
      }
      if (!unreadable && !info.status.paused) throw new Error('The cloud copy is readable, so it was not replaced. Use Sync now to merge it.');
      let status: SyncStatus = { ...info.status, error: undefined, paused: false, replaceable: undefined };
      try {
        const data = await local.get([STORAGE_KEY, SYNC_BASE]);
        const local0 = validateState(data[STORAGE_KEY]);
        let state = local0;
        let conflicts = info.conflicts;
        let outgoing = local0;
        let deferred: SyncConflict[] = [];
        if (readable) {
          // A readable copy (quota pause) may hold changes from another device made during the pause: merge them first,
          // so replacing never drops them. Keep the readable copy as a backup too.
          const base = data[SYNC_BASE] === undefined ? undefined : validateState(data[SYNC_BASE]);
          const merged = mergeStates(base, local0, readable, info.conflicts);
          state = merged.state;
          conflicts = merged.conflicts;
          deferred = merged.deferred;
          outgoing = publishableState(state, [...merged.conflicts, ...merged.deferred]);
          const backups = backupBefore(backupBefore(info.backups, local0, now()), readable, now());
          await local.set({ [SYNC_BACKUPS]: backups, ...(sameRecords(local0, state) ? {} : { [STORAGE_KEY]: state }) });
        }
        const uploaded = await replaceRemote(remote, outgoing, { device: info.config.deviceName, at: now() });
        status = { ...status, bytes: uploaded.bytes, lastWrite: now(), lastSync: now(), deferred: deferred.length };
        const published: SyncOwn = { generation: uploaded.generation, base: null, at: now() };
        await local.set({ [SYNC_BASE]: baseAfterSync(outgoing, deferred), [SYNC_OWN]: published, [SYNC_CONFLICTS]: conflicts });
      } catch (error) {
        status = failure(status, error);
      }
      await local.set({ [SYNC_STATUS]: status });
    }),
  };
}

function readOwn(value: unknown, now: number): { generation: string; base: AppState | undefined } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const own = value as SyncOwn;
  if (typeof own.generation !== 'string') return undefined;
  if (typeof own.at !== 'number' || now - own.at > SYNC_OWN_MAX_AGE_MS) return undefined;
  try {
    return { generation: own.generation, base: own.base ? validateState(own.base) : undefined };
  } catch {
    // A corrupt local marker must not wedge sync: fall back to the ordinary base.
    return undefined;
  }
}
