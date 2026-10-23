import { createSyncService, readSyncInfo, SYNC_ALARM, SYNC_CONFIG } from './sync';
import { STORAGE_KEY } from './storage';
import { SYNC_MANIFEST } from './syncTransport';

const POLL_ALARM = `${SYNC_ALARM}-poll`;
/** Local changes are coalesced for this long before the worker merges and uploads (Chrome clamps alarms to >= 30 s). */
const DEBOUNCE_MS = 20_000;

/** Only the worker uploads. Durable alarms survive MV3 worker suspension. */
export function registerSyncBackground(): void {
  const service = createSyncService(chrome.storage.local, chrome.storage.sync);
  const report = (error: unknown): void => console.error('LeetCode Assist sync failed', error);
  const schedule = async (): Promise<void> => {
    if (!(await readSyncInfo(chrome.storage.local)).config.enabled) {
      await chrome.alarms.clear(SYNC_ALARM);
      await chrome.alarms.clear(POLL_ALARM);
      return;
    }
    if (!(await chrome.alarms.get(SYNC_ALARM))) await chrome.alarms.create(SYNC_ALARM, { when: Date.now() + DEBOUNCE_MS });
    if (!(await chrome.alarms.get(POLL_ALARM))) await chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const state = changes[STORAGE_KEY];
      if (state && state.newValue === undefined) service.localReset().catch(report);
      else if (state || SYNC_CONFIG in changes) schedule().catch(report);
    }
    // The other device published a new generation: merge soon.
    if (area === 'sync' && SYNC_MANIFEST in changes) service.run().catch(report);
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM || alarm.name === POLL_ALARM) service.run().catch(report);
  });
  chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || !message || typeof message !== 'object' || !('kind' in message)) return false;
    const request = message as { kind: unknown; choices?: unknown; id?: unknown };
    let task: Promise<unknown>;
    if (request.kind === 'lca-sync-now') {
      task = service.syncNow().then(schedule);
    } else if (request.kind === 'lca-sync-resolve' && request.choices && typeof request.choices === 'object' && Object.values(request.choices).every((v) => v === 'local' || v === 'remote')) {
      task = service.resolve(request.choices as Record<string, 'local' | 'remote'>).then(schedule);
    } else if (request.kind === 'lca-sync-restore' && typeof request.id === 'string') {
      task = service.restore(request.id).then(schedule);
    } else if (request.kind === 'lca-sync-replace-cloud') {
      task = service.replaceCloudCopy();
    } else return false;
    task.then(() => reply({ ok: true }), (error: unknown) => reply({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  });
  schedule().catch(report);
}
