import { isLeetCodeUrl } from './leetcodeUrl';

export type OpenSidePanelResult = 'opened' | 'no-leetcode-tab';

/** Opens the side panel on a LeetCode tab (the active one when possible). Must run from a user gesture. */
export async function openSidePanelOnLeetCode(): Promise<OpenSidePanelResult> {
  const tabs = (await chrome.tabs.query({})).filter((tab) => tab.id !== undefined && isLeetCodeUrl(tab.url));
  const current = await chrome.windows.getCurrent();
  const target =
    tabs.find((tab) => tab.active && tab.windowId === current.id) ??
    tabs.find((tab) => tab.active) ??
    tabs[0];
  if (target?.id === undefined) return 'no-leetcode-tab';
  await chrome.sidePanel.open({ tabId: target.id });
  await chrome.tabs.update(target.id, { active: true });
  await chrome.windows.update(target.windowId, { focused: true });
  return 'opened';
}
