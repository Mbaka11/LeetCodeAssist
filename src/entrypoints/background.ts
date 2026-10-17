import { createBackgroundTasks } from '../lib/backgroundTasks';
import { createLeetCodeBackground } from '../lib/leetcodeBackground';
import { chromeLeetCodeStorage } from '../lib/leetcodeStorage';
import { openDashboard } from '../lib/openDashboard';
import { STORAGE_KEY, chromeStorageBackend, createAppStore } from '../lib/storage';

const SIDE_PANEL_PATH = 'sidepanel.html';

/**
 * Everything is registered synchronously at worker start and nothing is kept in memory: when Chrome
 * kills the worker, the next event (alarm, storage change, click) restarts it and the handlers
 * rebuild their view from `chrome.storage.local`.
 */
export default defineBackground(() => {
  const store = createAppStore(chromeStorageBackend());
  const tasks = createBackgroundTasks({
    readState: () => store.readState().catch(() => null),
    getAlarms: () => chrome.alarms.getAll(),
    createAlarm: (spec) => chrome.alarms.create(spec.name, { when: spec.when }),
    showNotification: async (id, content) => {
      await chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('/icon/128.png'),
        title: content.title,
        message: content.message,
      });
    },
    clearNotification: async (id) => {
      await chrome.notifications.clear(id);
    },
    setBadge: async (text) => {
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color: '#3b6cf6' });
    },
    openDashboard,
    now: Date.now,
  });
  const report = (error: unknown): void => console.error('LeetCode Assist background task failed', error);

  // Toolbar icon: open or focus the dashboard.
  chrome.action.onClicked.addListener(() => {
    void openDashboard();
  });

  // Notifications, badge and alarms.
  chrome.alarms.onAlarm.addListener((alarm) => {
    tasks.handleAlarm(alarm).catch(report);
  });
  chrome.notifications.onClicked.addListener((id) => {
    tasks.handleNotificationClick(id).catch(report);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    // Covers settings changes (alarm times) and activity changes (badge).
    if (area === 'local' && STORAGE_KEY in changes) tasks.refresh().catch(report);
  });
  chrome.runtime.onInstalled.addListener(() => {
    tasks.refresh().catch(report);
  });
  chrome.runtime.onStartup.addListener(() => {
    tasks.refresh().catch(report);
  });
  // Also on every worker start, for example after it was killed and woken by an event.
  tasks.refresh().catch(report);

  // LeetCode features: relayed submission verdicts (stored only while detection is on) and the optional
  // streak refresh requested by the dashboard. Messages from any other sender are ignored.
  const leetcode = createLeetCodeBackground({
    storage: chromeLeetCodeStorage(),
    extensionId: chrome.runtime.id,
    extensionUrlPrefix: chrome.runtime.getURL(''),
    now: Date.now,
  });
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const reply = leetcode.handleMessage(message, { id: sender.id, url: sender.url });
    if (!reply) return false;
    reply.then(sendResponse, (error: unknown) => {
      report(error);
      sendResponse(undefined);
    });
    return true;
  });

  // Side panel: one global panel for the whole window, enabled once. It stays open while the user
  // switches or opens tabs and shows what to do for whichever page is active. The toolbar icon keeps
  // opening the dashboard.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(report);
  chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true }).catch(report);

  // Keyboard shortcut: open the side panel in the window of the active tab. The window id comes from
  // the event so the call happens inside the user gesture. Without a tab the fallback below is best
  // effort only: it awaits a lookup first, so Chrome may reject `open` for lack of a user gesture
  // (the failure is reported, not fatal).
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'open-side-panel') return;
    if (tab?.windowId !== undefined) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(report);
      return;
    }
    chrome.windows
      .getLastFocused()
      .then((window) => (window.id === undefined ? undefined : chrome.sidePanel.open({ windowId: window.id })))
      .catch(report);
  });
});
