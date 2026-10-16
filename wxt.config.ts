import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LeetCode Assist',
    description:
      'A 30-day LeetCode bootcamp on the NeetCode 150 roadmap: daily plan, spaced reviews, timers and notes.',
    permissions: ['storage', 'alarms', 'notifications', 'sidePanel', 'tabs'],
    host_permissions: ['https://leetcode.com/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'LeetCode Assist' },
  },
});
