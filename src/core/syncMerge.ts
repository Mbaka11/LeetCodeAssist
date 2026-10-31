/**
 * Deterministic three-way merge of two `AppState` snapshots against the last synced base.
 *
 * Granularity ("records"): each activity (by id, including its corrections audit), each note (by slug),
 * each `checked` / `problemStatus` / `favorites` entry, each saved filter, simulation and drill result (by id),
 * each settings field, and the `queue` and `interviewPrep` as one value each. A record changed on one side only is taken from that side;
 * a record changed differently on both sides is a conflict.
 */
import { getProblem } from '../data/neetcode150';
import { DEFAULT_SETTINGS, validateState } from './state';
import type { Activity, AppState } from './types';

export interface SyncConflict {
  path: string;
  base?: unknown;
  local?: unknown;
  remote?: unknown;
}

export interface MergeResult {
  state: AppState;
  /** Both versions changed differently; the local version is kept until the user chooses. */
  conflicts: SyncConflict[];
  /**
   * Records whose other-device version has a running timer. They are not adopted until that timer is paused or
   * finished there; the local version is kept and the other version is left untouched in the cloud copy.
   */
  deferred: SyncConflict[];
}

/** Stable comparison ignores object insertion order, but not array order. */
export function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const collections = ['notes', 'checked', 'problemStatus', 'favorites', 'savedRoadmapFilters', 'simulations', 'drillSessions'] as const;

export function stateRecords(state: AppState | undefined): Record<string, unknown> {
  if (!state) return {};
  const records: Record<string, unknown> = {};
  for (const activity of state.activities) records[`activities/${activity.id}`] = activity;
  for (const field of collections) {
    for (const [key, value] of Object.entries(state[field] ?? {})) records[`${field}/${key}`] = value;
  }
  for (const [key, value] of Object.entries(state.settings)) records[`settings/${key}`] = value;
  if (state.queue !== undefined) records.queue = state.queue;
  if (state.interviewPrep !== undefined) records.interviewPrep = state.interviewPrep;
  return records;
}

/** Applies record-level changes (`undefined` deletes) and validates the whole result. */
export function applyRecords(state: AppState, changes: Record<string, unknown>): AppState {
  const records = { ...stateRecords(state), ...changes };
  const result: Record<string, unknown> = { version: 1, settings: {}, activities: [], notes: {}, checked: {}, problemStatus: {} };
  // Preserve absent optional collections in old backups.
  for (const field of collections) if (state[field] !== undefined) result[field] = {};
  const settings: Record<string, unknown> = {};
  result.settings = settings;
  for (const [path, value] of Object.entries(records)) {
    if (value === undefined) continue;
    if (path === 'queue' || path === 'interviewPrep') { result[path] = value; continue; }
    const slash = path.indexOf('/');
    const field = path.slice(0, slash);
    const key = path.slice(slash + 1);
    if (field === 'activities') (result.activities as unknown[]).push(value);
    else if (field === 'settings') settings[key] = value;
    else {
      const collection = (result[field] ??= {}) as Record<string, unknown>;
      // defineProperty keeps record IDs such as "__proto__" ordinary own keys.
      Object.defineProperty(collection, key, { value, enumerable: true, configurable: true, writable: true });
    }
  }
  return validateState(result);
}

function isRunning(value: unknown): boolean {
  return !!value && typeof value === 'object' && 'timer' in value &&
    (value as { timer?: { running?: boolean } }).timer?.running === true;
}

/**
 * An untouched, still-planned activity with its generated `type:slug:date` id. Both devices generate the same id when
 * they open the same day, so such a record carries no user work and never conflicts with a worked version.
 */
function isPristineActivity(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const a = value as Activity;
  return a.status === 'planned' && !a.timer.running && a.timer.startedAt === null && a.timer.accumulatedMs === 0 &&
    a.approachMs === undefined && a.totalMs === undefined && a.outcome === undefined && a.completedAt === undefined && a.completedAtMs === undefined &&
    a.corrections === undefined && a.hintsUsed === undefined && a.postponed === undefined &&
    new RegExp(`^${a.type}:${a.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:${a.dueDate}(#\\d+)?$`).test(a.id);
}

/** True when a device has only its first-run defaults, so the first sync can adopt the other device's data whole. */
export function isUntouchedState(state: AppState): boolean {
  const settings = state.settings as unknown as Record<string, unknown>;
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  const settingsDefault = Object.entries(settings).every(([key, value]) => key === 'startDate' || canonical(value) === canonical(defaults[key]));
  return settingsDefault && state.activities.every(isPristineActivity) && state.queue === undefined && state.interviewPrep === undefined &&
    collections.every((field) => Object.keys(state[field] ?? {}).length === 0);
}

interface Classified { changes: Record<string, unknown>; conflicts: SyncConflict[]; deferred: SyncConflict[] }

function classify(b: Record<string, unknown>, l: Record<string, unknown>, r: Record<string, unknown>, pending: SyncConflict[], only?: (path: string) => boolean): Classified {
  const previous = new Map(pending.map((c) => [c.path, c]));
  const out: Classified = { changes: {}, conflicts: [], deferred: [] };
  const paths = [...new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r), ...previous.keys()])].sort();
  for (const path of paths) {
    if (only && !only(path)) continue;
    const before = previous.has(path) ? previous.get(path)!.base : b[path];
    const left = l[path], right = r[path];
    if (canonical(left) === canonical(right)) continue;
    const conflict: SyncConflict = { path, base: before, local: left, remote: right };
    // The other device did not touch this record since the last sync: our change simply gets published.
    if (canonical(right) === canonical(before)) continue;
    const localUnchanged = canonical(left) === canonical(before);
    if (path.startsWith('activities/')) {
      if (isRunning(right)) {
        if (left === undefined || localUnchanged || isPristineActivity(left)) out.deferred.push(conflict);
        else out.conflicts.push(conflict);
        continue;
      }
      if (isRunning(left)) { out.conflicts.push(conflict); continue; }
      if (isPristineActivity(left) && right !== undefined) {
        // Two pristine copies may differ only in bookkeeping (createdAt); both devices pick the same one.
        if (!isPristineActivity(right) || canonical(right) < canonical(left)) out.changes[path] = right;
        continue;
      }
      if (isPristineActivity(right) && left !== undefined && !localUnchanged) continue;
    }
    if (localUnchanged) out.changes[path] = right;
    else out.conflicts.push(conflict);
  }
  return out;
}

/** Settings fields are validated together (e.g. cap >= target); an invalid combination becomes conflicts instead. */
export function mergeStates(base: AppState | undefined, local: AppState, remote: AppState, pending: SyncConflict[] = []): MergeResult {
  if (!base && pending.length === 0 && isUntouchedState(local)) return { state: remote, conflicts: [], deferred: [] };
  const b = stateRecords(base), l = stateRecords(local), r = stateRecords(remote);
  const first = classify(b, l, r, pending);
  try {
    return { state: applyRecords(local, first.changes), conflicts: first.conflicts, deferred: first.deferred };
  } catch (error) {
    const settingsChanges = Object.keys(first.changes).filter((path) => path.startsWith('settings/'));
    if (settingsChanges.length === 0) throw error;
    const changes = { ...first.changes };
    const conflicts = [...first.conflicts];
    for (const path of settingsChanges) {
      delete changes[path];
      conflicts.push({ path, base: b[path], local: l[path], remote: r[path] });
    }
    return { state: applyRecords(local, changes), conflicts: conflicts.sort((x, y) => x.path.localeCompare(y.path)), deferred: first.deferred };
  }
}

/** Unresolved local versions stay on this device; publishing must not erase the other version. */
export function publishableState(state: AppState, held: SyncConflict[]): AppState {
  return applyRecords(state, Object.fromEntries(held.map((c) => [c.path, c.remote])));
}

/** The base to remember after a sync: deferred records keep this device's value so they stay "unchanged here". */
export function baseAfterSync(synced: AppState, deferred: SyncConflict[]): AppState {
  return deferred.length ? applyRecords(synced, Object.fromEntries(deferred.map((c) => [c.path, c.local]))) : synced;
}

/** Plain-language one-line summary of a record for conflict lists (problem, type, status/outcome/date). */
export function describeRecord(path: string, value: unknown): string {
  if (value === undefined) return 'Not present (deleted or never created)';
  const slash = path.indexOf('/');
  const field = slash < 0 ? path : path.slice(0, slash);
  const key = slash < 0 ? '' : path.slice(slash + 1);
  const title = (slug: string): string => getProblem(slug)?.title ?? slug;
  const o = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const text = (v: unknown): string => String(v);
  if (field === 'activities') {
    const parts = [title(text(o.slug)), text(o.type), text(o.status).replace('_', ' ')];
    if ((o.timer as { running?: boolean } | undefined)?.running) parts.push('timer running');
    if (o.outcome !== undefined) parts.push(`outcome ${text(o.outcome)}`);
    parts.push(o.completedAt !== undefined ? `completed ${text(o.completedAt)}` : `due ${text(o.dueDate)}`);
    if (Array.isArray(o.corrections) && o.corrections.length) parts.push(`${o.corrections.length} correction(s)`);
    return parts.join(' · ');
  }
  if (field === 'notes') return `Notes for ${title(key)} · updated ${text(o.updatedAt)}${o.trigger ? ` · cue "${text(o.trigger)}"` : ''}`;
  if (field === 'checked') return `${title(key)}: ${value === true ? 'checked as solved' : 'not checked'}`;
  if (field === 'problemStatus') return `${title(key)}: status ${text(value)}`;
  if (field === 'favorites') return `${title(key)}: ${value === true ? 'starred' : 'not starred'}`;
  if (field === 'savedRoadmapFilters') return `Saved filter "${text(o.name)}"`;
  if (field === 'simulations') return `Simulation of ${title(text(o.slug))}${o.part !== undefined ? ` (problem ${text(o.part)} of a two-problem session)` : ''} · outcome ${text(o.outcome)} · ${new Date(Number(o.endedAt)).toISOString().slice(0, 10)}`;
  if (field === 'interviewPrep') return `Interview prep · ${text(o.companyId)} · ${text(o.date)}`;
  if (field === 'drillSessions') return `Drill session · score ${text(o.score)}/${text(o.total)} · ${new Date(Number(o.endedAt)).toISOString().slice(0, 10)}`;
  if (field === 'settings') return `Setting ${key}: ${JSON.stringify(value)}`;
  if (field === 'queue') return `New-problem queue (${Array.isArray(value) ? value.length : 0} problems, starting with ${Array.isArray(value) && value.length ? title(text(value[0])) : 'none'})`;
  return JSON.stringify(value);
}
