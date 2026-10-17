import { RUNTIME_SUBMISSION_KIND, eventFromWindowMessage } from '../lib/leetcodeSubmissions';

/**
 * Isolated-world half of the passive "Accepted" detection: validates the window messages posted by
 * `leetcode-observer.content.ts` (same window, same origin, strict shape) and relays the event to the
 * background worker, which decides whether to store it.
 */
export default defineContentScript({
  matches: ['https://leetcode.com/problems/*'],
  runAt: 'document_start',
  noScriptStartedPostMessage: true,
  main() {
    window.addEventListener('message', (message: MessageEvent) => {
      if (message.source !== window || message.origin !== window.location.origin) return;
      const event = eventFromWindowMessage(message.data);
      if (!event) return;
      try {
        chrome.runtime.sendMessage({ kind: RUNTIME_SUBMISSION_KIND, event }).catch(() => undefined);
      } catch {
        // The extension was reloaded or updated: this page's script is orphaned and goes quiet.
      }
    });
  },
});
