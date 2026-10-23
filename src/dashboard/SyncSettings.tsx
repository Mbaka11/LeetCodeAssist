import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmButton } from '../components/ConfirmButton';
import { describeRecord } from '../core/syncMerge';
import { DEFAULT_SYNC_CONFIG, readSyncInfo, SYNC_CONFIG, SYNC_STATUS, type SyncInfo } from '../lib/sync';
import { SYNC_QUOTA } from '../lib/syncTransport';

const EMPTY_INFO: SyncInfo = { config: DEFAULT_SYNC_CONFIG, status: {}, conflicts: [], backups: [] };

export function useSyncInfo(): SyncInfo {
  const [info, setInfo] = useState(EMPTY_INFO);
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    let alive = true;
    const refresh = (): void => { readSyncInfo(chrome.storage.local).then((next) => { if (alive) setInfo(next); }).catch(() => undefined); };
    const change = (_changes: unknown, area: string): void => { if (area === 'local') refresh(); };
    refresh();
    chrome.storage.onChanged?.addListener(change);
    return () => { alive = false; chrome.storage.onChanged?.removeListener(change); };
  }, []);
  return info;
}

async function request(message: object): Promise<void> {
  const result = await chrome.runtime.sendMessage(message) as { ok?: boolean; error?: string } | undefined;
  if (!result?.ok) throw new Error(result?.error ?? 'Sync worker did not respond. Try again.');
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Shown on every dashboard page while records need a choice or sync has stopped with an error. */
export function SyncBanner() {
  const info = useSyncInfo();
  if (!info.config.enabled || (!info.conflicts.length && !info.status.error)) return null;
  return <div role="status" className="card"><strong>Sync: </strong>{info.conflicts.length ? `${info.conflicts.length} record(s) were changed differently on both devices and need your choice. Other changes keep merging. ` : ''}{info.status.error} <a href="#/settings">Review sync settings</a></div>;
}

export function SyncSettings() {
  const info = useSyncInfo();
  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const run = (task: Promise<unknown>, done = 'Saved.'): void => { task.then(() => setMessage(done), (error: unknown) => setMessage(messageOf(error))); };
  const used = info.status.bytes ?? 0;
  const status = !info.config.enabled ? 'Disabled' : info.status.paused ? 'Paused' : 'Enabled';
  return <Card title="Sync">
    <div className="stack-tight">
      <p>Optional automatic sync through Chrome (<code>chrome.storage.sync</code>) between your own computers: sign in to the same Google account, keep Chrome sync on for extensions, and install this extension with the same extension ID on each computer. No LeetCode login or LeetCode request is involved.</p>
      <label><input type="checkbox" checked={info.config.enabled} onChange={(e) => run(chrome.storage.local.set({ [SYNC_CONFIG]: { ...info.config, enabled: e.target.checked }, [SYNC_STATUS]: { ...info.status, paused: false, error: undefined } }))} /> Enable sync (off by default)</label>
      <div className="row">
        <label>Device name <input aria-label="Sync device name" maxLength={80} value={name ?? info.config.deviceName} onChange={(e) => setName(e.target.value)} /></label>
        <Button onClick={() => { run(chrome.storage.local.set({ [SYNC_CONFIG]: { ...info.config, deviceName: (name ?? '').trim() || DEFAULT_SYNC_CONFIG.deviceName } })); setName(null); }}>Save device name</Button>
      </div>
      <p>Status: {status} · Last check: {info.status.lastSync ? new Date(info.status.lastSync).toLocaleString() : 'Never'}{info.status.remoteDevice ? ` · Last upload by ${info.status.remoteDevice}${info.status.remoteAt ? ` at ${new Date(info.status.remoteAt).toLocaleString()}` : ''}` : ''} · Storage: {used} / {SYNC_QUOTA} bytes ({Math.round((used / SYNC_QUOTA) * 100)}%)</p>
      {used > SYNC_QUOTA * 0.8 && !info.status.paused ? <p role="alert" className="error">Chrome sync storage is more than 80% full. Syncing pauses when the limit is reached; manual JSON export/import keeps working.</p> : null}
      {info.status.error ? <p role="alert" className="error">{info.status.error} Manual JSON export/import is still available.</p> : null}
      {info.status.error && info.config.enabled && info.status.replaceable ? <ConfirmButton prompt="Replace the cloud copy with this device's data? Offered only because the cloud copy is unreadable or the Chrome sync quota is full. If the cloud copy is still readable it is first saved as a local backup here. Other devices then merge this device's data against their own copy and keep their own backups." confirmLabel="Replace cloud copy" onConfirm={() => run(request({ kind: 'lca-sync-replace-cloud' }), 'Cloud copy replaced.')}>Replace cloud copy with this device</ConfirmButton> : null}
      {info.status.deferred ? <p className="muted">{info.status.deferred} record(s) are waiting because a timer is running on the other device; they merge once it is paused or finished there.</p> : null}
      <Button disabled={!info.config.enabled} onClick={() => run(request({ kind: 'lca-sync-now' }), 'Sync requested.')}>Sync now</Button>
      <p className="muted">Changes are combined for about 20 seconds before upload; uploads are at least 30 seconds apart. The worker keeps a snapshot compressed and split into Chrome-sized pieces, and ignores any incomplete or invalid copy. Before each merge that changes this device, a local backup is stored (Settings → Your data). Detection, LeetCode preferences/events/profile data, device names, sync settings and backups are never uploaded. A running timer is never overwritten silently: another device's running timer is applied only after it is paused or finished there, and changing a timer here while the other device changed that activity asks you to choose.</p>
      {info.conflicts.length ? <>
        <h3>Conflicts ({info.conflicts.length})</h3>
        <p>This device is <strong>{info.config.deviceName}</strong>. “Other device” is the last copy received from Chrome sync. Choosing it can replace a running timer on this device. Until you choose, this device keeps its version and everything else still merges.</p>
        <Button onClick={() => run(request({ kind: 'lca-sync-resolve', choices: Object.fromEntries(info.conflicts.map((c) => [c.path, 'local'])) }), 'Kept this device’s versions.')}>Keep all from this device</Button>
        {info.conflicts.map((conflict) => <div className="card stack-tight" key={conflict.path}>
          <p><strong>This device:</strong> {describeRecord(conflict.path, conflict.local)}</p>
          <p><strong>Other device:</strong> {describeRecord(conflict.path, conflict.remote)}</p>
          <details><summary>Show both full versions</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ thisDevice: conflict.local ?? null, otherDevice: conflict.remote ?? null }, null, 2)}</pre></details>
          <div className="row">
            <Button onClick={() => run(request({ kind: 'lca-sync-resolve', choices: { [conflict.path]: 'local' } }), 'Kept this device’s version.')}>Keep this device</Button>
            <Button onClick={() => run(request({ kind: 'lca-sync-resolve', choices: { [conflict.path]: 'remote' } }), 'Took the other device’s version.')}>Take other device</Button>
          </div>
        </div>)}
      </> : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  </Card>;
}

export function SyncBackups() {
  const info = useSyncInfo();
  const [message, setMessage] = useState('');
  return <div className="stack-tight">
    <h3>Local pre-merge backups</h3>
    <p>The latest three snapshots taken before a sync merge or conflict choice (4 MiB limit), kept only on this device. Restore replaces current data, keeps a backup of what it replaces, and is a local change that propagates if sync is enabled. Export JSON for long-term backups.</p>
    {!info.backups.length ? <p className="muted">No sync backups yet.</p> : info.backups.map((backup) => <div className="row" key={backup.id}>
      <span>{new Date(backup.at).toLocaleString()} · {backup.state.activities.length} activities · {Object.keys(backup.state.notes).length} notes</span>
      <ConfirmButton prompt="Replace current data with this backup? If sync is enabled, this change will propagate." confirmLabel="Restore backup" onConfirm={() => { request({ kind: 'lca-sync-restore', id: backup.id }).then(() => setMessage('Backup restored.'), (e: unknown) => setMessage(messageOf(e))); }}>Restore</ConfirmButton>
    </div>)}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
