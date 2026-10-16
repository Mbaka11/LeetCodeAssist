import { problemUrl } from '../data/neetcode150';
import { canNavigateTabTo } from './leetcodeUrl';

let knownWindowId: number | undefined;

function refreshWindowId(): void {
  chrome.windows.getCurrent().then(
    (window) => {
      knownWindowId = window.id;
    },
    () => undefined,
  );
}

/**
 * Remembers the id of this page's window (and refreshes it on focus, in case the tab moved to another
 * window) so a click handler can open the side panel without awaiting.
 */
export function rememberCurrentWindow(): void {
  if (typeof chrome === 'undefined' || !chrome.windows) return;
  refreshWindowId();
  window.addEventListener('focus', refreshWindowId);
}

/**
 * Opens the global side panel in this page's window. Chrome only allows it inside a user gesture, so the
 * call is made synchronously whenever the window id is already known (see `rememberCurrentWindow`).
 */
export function openSidePanelInWindow(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.sidePanel) return Promise.resolve();
  if (knownWindowId !== undefined) return chrome.sidePanel.open({ windowId: knownWindowId });
  return chrome.windows.getCurrent().then((window) => {
    if (window.id === undefined) throw new Error('The current window is unknown');
    knownWindowId = window.id;
    return chrome.sidePanel.open({ windowId: window.id });
  });
}

/** Same as `openSidePanelInWindow` for click handlers that must not fail (for example on a link). */
export function openSidePanelBestEffort(): void {
  try {
    openSidePanelInWindow().catch(() => undefined);
  } catch {
    // The side panel API is unavailable (for example in a test): nothing to do.
  }
}

/** Opens a problem on LeetCode: in the active tab when it is a LeetCode or empty page, else in a new tab. */
export async function openProblemInBrowser(slug: string): Promise<void> {
  const url = problemUrl(slug);
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id !== undefined && canNavigateTabTo(active.url)) {
    await chrome.tabs.update(active.id, { url, active: true });
  } else {
    await chrome.tabs.create({ url });
  }
}
