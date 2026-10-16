import { useEffect, useState } from 'react';

/** URL of the active tab in this window; follows tab switches and in-tab navigation (including single-page navigation). */
export function useActiveTabUrl(): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const refresh = (): void => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(
        ([tab]) => {
          if (!cancelled) setUrl(tab?.url);
        },
        () => undefined,
      );
    };
    const onUpdated = (_tabId: number, changeInfo: { url?: string; status?: string }, tab: chrome.tabs.Tab): void => {
      if (tab.active && (changeInfo.url !== undefined || changeInfo.status === 'complete')) refresh();
    };
    refresh();
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(refresh);
    chrome.windows.onFocusChanged.addListener(refresh);
    return () => {
      cancelled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.windows.onFocusChanged.removeListener(refresh);
    };
  }, []);

  return url;
}
