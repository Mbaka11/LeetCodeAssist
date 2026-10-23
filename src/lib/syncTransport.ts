import { deserializeState } from '../core/state';
import type { AppState } from '../core/types';

export const SYNC_MANIFEST = 'lca.sync.manifest.v1';
export const SYNC_PREFIX = 'lca.sync.chunk.';
export const SYNC_QUOTA = 102400;
const CHUNK_SIZE = 7000;
const MAX_DECOMPRESSED = 8 * 1024 * 1024;
export interface SyncArea {
  get(keys: null | string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}
/** `lineage`: generations this snapshot was written on top of (newest first, at most LINEAGE_MAX). Lets a device tell a descendant of its own upload from a concurrent overwrite. */
interface Manifest { version: 1; generation: string; count: number; checksum: string; device?: string; at?: number; lineage?: string[]; }
const LINEAGE_MAX = 32;
const GENERATION_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;
/** Who wrote the cloud copy and when (informational; shown in the sync status). */
export interface RemoteWriter { device: string; at: number }
export class SyncQuotaError extends Error {}
/** The cloud copy exists but cannot be read (incomplete, corrupt, invalid schema or manifest). Only this and quota errors allow replacing it. */
export class SyncRemoteInvalidError extends Error {}

function bytesUsed(items: Record<string, unknown>): number {
  return Object.entries(items).reduce((n, [key, value]) => n + new TextEncoder().encode(key + JSON.stringify(value)).length, 0);
}
async function checksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
async function encode(state: AppState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  if (bytes.length > MAX_DECOMPRESSED) throw new SyncQuotaError('Sync paused: snapshot exceeds the 8 MiB safety limit. Use JSON export/import.');
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (const byte of compressed) binary += String.fromCharCode(byte);
  return btoa(binary);
}
async function decode(encoded: string): Promise<AppState> {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_DECOMPRESSED) throw new Error('Remote snapshot exceeds the safety limit');
      parts.push(value);
    }
  } finally { await reader.cancel(); }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { all.set(part, offset); offset += part.length; }
  return deserializeState(new TextDecoder().decode(all));
}
function manifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid sync manifest');
  const m = value as Manifest;
  if (m.version !== 1 || typeof m.generation !== 'string' || !GENERATION_PATTERN.test(m.generation) || !Number.isInteger(m.count) || m.count < 1 || m.count > 32 || typeof m.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(m.checksum)) throw new Error('Invalid sync manifest');
  if (m.device !== undefined && (typeof m.device !== 'string' || m.device.length > 80)) throw new Error('Invalid sync manifest');
  if (m.at !== undefined && !Number.isFinite(m.at)) throw new Error('Invalid sync manifest');
  if (m.lineage !== undefined && (!Array.isArray(m.lineage) || m.lineage.length > LINEAGE_MAX || m.lineage.some((g) => typeof g !== 'string' || !GENERATION_PATTERN.test(g)))) throw new Error('Invalid sync manifest');
  return m;
}
const chunkKey = (generation: string, index: number): string => `${SYNC_PREFIX}${generation}.${index}`;

export interface RemoteSnapshot { state?: AppState; generation?: string; lineage?: string[]; bytes: number; writer?: RemoteWriter }

/** Throws `SyncRemoteInvalidError` for any unreadable cloud copy; storage-API failures propagate unchanged. */
export async function readRemote(area: SyncArea): Promise<RemoteSnapshot> {
  const items = await area.get(null);
  const bytes = bytesUsed(items);
  if (items[SYNC_MANIFEST] === undefined) return { bytes };
  try {
    const m = manifest(items[SYNC_MANIFEST]);
    let encoded = '';
    for (let i = 0; i < m.count; i++) {
      const chunk = items[chunkKey(m.generation, i)];
      if (typeof chunk !== 'string' || chunk.length > CHUNK_SIZE) throw new Error('Incomplete sync snapshot; local data was not changed');
      encoded += chunk;
    }
    if (await checksum(new TextEncoder().encode(encoded)) !== m.checksum) throw new Error('Sync checksum mismatch; local data was not changed');
    const writer = m.device !== undefined && m.at !== undefined ? { device: m.device, at: m.at } : undefined;
    return { state: await decode(encoded), generation: m.generation, lineage: m.lineage ?? [], bytes, ...(writer ? { writer } : {}) };
  } catch (error) {
    throw new SyncRemoteInvalidError(error instanceof Error ? error.message : String(error));
  }
}

interface PreparedWrite { generation: string; chunks: Record<string, unknown>; count: number; manifest: Manifest }
async function prepare(state: AppState, writer: RemoteWriter | undefined, lineage: string[] | undefined): Promise<PreparedWrite> {
  const encoded = await encode(state);
  const generation = crypto.randomUUID();
  const chunks: Record<string, unknown> = {};
  const count = Math.ceil(encoded.length / CHUNK_SIZE);
  for (let i = 0; i < count; i++) chunks[chunkKey(generation, i)] = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  const m: Manifest = { version: 1, generation, count, checksum: await checksum(new TextEncoder().encode(encoded)), ...(writer ? { device: writer.device.slice(0, 80), at: writer.at } : {}), ...(lineage?.length ? { lineage } : {}) };
  return { generation, chunks, count, manifest: m };
}
const QUOTA_MESSAGE = 'Sync paused: compressed data plus the previous generation exceeds Chrome sync quota (100 KiB). Export JSON or reduce notes/history before retrying.';
const syncKeys = (items: Record<string, unknown>): string[] => Object.keys(items).filter((key) => key === SYNC_MANIFEST || key.startsWith(SYNC_PREFIX));

/**
 * Stage all chunks, then switch one manifest. Old chunks are removed only after publication. A failure before
 * publication removes the staged chunks again; after publication every chunk outside the new generation is removed.
 */
export async function writeRemote(area: SyncArea, state: AppState, expectedGeneration?: string, writer?: RemoteWriter): Promise<{ bytes: number; generation: string }> {
  const existing = await area.get(null);
  const currentManifest = existing[SYNC_MANIFEST] === undefined ? undefined : manifest(existing[SYNC_MANIFEST]);
  if (currentManifest?.generation !== expectedGeneration) throw new Error('Remote sync changed during merge; retry Sync now');
  const lineage = currentManifest ? [currentManifest.generation, ...(currentManifest.lineage ?? [])].slice(0, LINEAGE_MAX) : undefined;
  const { generation, chunks, count, manifest: m } = await prepare(state, writer, lineage);
  const staged = { ...existing, ...chunks, [SYNC_MANIFEST]: m };
  if (bytesUsed(staged) > SYNC_QUOTA || Object.keys(staged).length > 512 || count > 32) throw new SyncQuotaError(QUOTA_MESSAGE);
  try {
    await area.set(chunks);
    // Check again before publishing; Chrome sync is last-writer-wins, not a distributed transaction.
    const latest = (await area.get(SYNC_MANIFEST))[SYNC_MANIFEST];
    if ((latest === undefined ? undefined : manifest(latest).generation) !== expectedGeneration) throw new Error('Remote sync changed during upload; retry Sync now');
    await area.set({ [SYNC_MANIFEST]: m });
  } catch (error) {
    await area.remove(Object.keys(chunks)).catch(() => undefined);
    throw error;
  }
  // The upload is published. Cleanup uses a fresh key list and is best effort: leftovers are removed by the next publish.
  await removeUnreferencedChunks(area, generation);
  return { generation, bytes: bytesUsed({ ...chunks, [SYNC_MANIFEST]: m }) };
}

async function removeUnreferencedChunks(area: SyncArea, keepGeneration: string): Promise<void> {
  try {
    const fresh = await area.get(null);
    const keepPrefix = `${SYNC_PREFIX}${keepGeneration}.`;
    const stale = Object.keys(fresh).filter((key) => key.startsWith(SYNC_PREFIX) && !key.startsWith(keepPrefix));
    if (stale.length) await area.remove(stale);
  } catch { /* published data is intact; a later publish retries the cleanup */ }
}

/**
 * Explicit recovery: removes every sync key, then publishes this snapshot as a fresh lineage. The size check runs
 * before anything is removed so an oversized snapshot cannot leave the cloud empty.
 */
export async function replaceRemote(area: SyncArea, state: AppState, writer?: RemoteWriter): Promise<{ bytes: number; generation: string }> {
  const { generation, chunks, count, manifest: m } = await prepare(state, writer, undefined);
  const items = { ...chunks, [SYNC_MANIFEST]: m };
  const all = await area.get(null);
  const stale = syncKeys(all);
  const staged = { ...Object.fromEntries(Object.entries(all).filter(([key]) => !stale.includes(key))), ...items };
  if (bytesUsed(staged) > SYNC_QUOTA || Object.keys(staged).length > 512 || count > 32) throw new SyncQuotaError(QUOTA_MESSAGE);
  if (stale.length) await area.remove(stale);
  try {
    await area.set(chunks);
    await area.set({ [SYNC_MANIFEST]: m });
  } catch (error) {
    await area.remove(Object.keys(chunks)).catch(() => undefined);
    throw error;
  }
  return { generation, bytes: bytesUsed(items) };
}
