import { installSubmissionObserver } from '../lib/leetcodeObserver';
import { windowMessage } from '../lib/leetcodeSubmissions';

/**
 * Runs in the page's own (MAIN) world so it can see the page's `fetch` / `XMLHttpRequest` calls. It is
 * purely passive: requests and responses are never altered, and only whitelisted fields of submission
 * verdicts leave this script (as a window message to the isolated relay, `leetcode-relay.content.ts`).
 * It has no access to extension APIs.
 */
export default defineContentScript({
  matches: ['https://leetcode.com/problems/*'],
  world: 'MAIN',
  runAt: 'document_start',
  noScriptStartedPostMessage: true,
  main() {
    installSubmissionObserver(window, (event) => {
      window.postMessage(windowMessage(event), window.location.origin);
    });
  },
});
