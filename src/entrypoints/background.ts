import { openDashboard } from '../lib/openDashboard';

export default defineBackground(() => {
  chrome.action.onClicked.addListener(() => {
    void openDashboard();
  });
  // Alarms, notifications and the badge are added in a later stage.
});
