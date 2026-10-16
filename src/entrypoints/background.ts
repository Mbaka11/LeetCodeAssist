import { createBackgroundTasks } from '../lib/backgroundTasks';
import { isLeetCodeUrl } from '../lib/leetcodeUrl';
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

  // Side panel: enabled only on LeetCode tabs; the toolbar icon keeps opening the dashboard.
  const syncSidePanel = (tabId: number, url: string | undefined): void => {
    chrome.sidePanel
      .setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: isLeetCodeUrl(url) })
      .catch(report);
  };
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(report);
  chrome.sidePanel.setOptions({ enabled: false }).catch(report);
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) if (tab.id !== undefined) syncSidePanel(tab.id, tab.url);
  }, report);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url !== undefined || changeInfo.status !== undefined) {
      syncSidePanel(tabId, changeInfo.url ?? tab.url);
    }
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then((tab) => syncSidePanel(tabId, tab.url), report);
  });

  // Keyboard shortcut: open the side panel on a LeetCode tab (the dashboard elsewhere).
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'open-side-panel') return;
    if (tab?.id !== undefined && isLeetCodeUrl(tab.url)) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(report);
    } else {
      openDashboard().catch(report);
    }
  });
});
