import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // Public SPKI key pins the unpacked extension ID across computers. No private key is stored.
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkYHn5edk5Wj3PQJeU7ocIuAD5B09sgTTgc0m2PMiPXEJainoB37cri9juGaej8ixf/bRGLMtQkOTvZtTKXmO0DKsloXS1Uigoq3qnQwExrkkKoCKNb3BPBcF9XEPfPA5eUtmHx6cHul85+6mhAdXQkW9DN6V/gm5jPd79x6EPtUusjt1hdfFtwx5cEGQihQWGEq8AI1YXZd69hj7Nv/8uJvgZWgzeeq4iAszeWleGxLLJAdGzDS5faQdzqghOgkP8bzCs0zw3XZdLIjVdLUDHj+VCulEayzVOw+uC3NeRuDPac16fWfv4B+vjQIbgo73+xSoEldRkBXf1FFVFMQwxQIDAQAB",
    name: 'LeetCode Assist',
    description:
      'A 30-day LeetCode bootcamp on the NeetCode 150 roadmap: daily plan, spaced reviews, timers and notes.',
    minimum_chrome_version: '116',
    permissions: ['storage', 'alarms', 'notifications', 'sidePanel', 'tabs'],
    host_permissions: ['https://leetcode.com/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'LeetCode Assist' },
    commands: {
      'open-side-panel': {
        suggested_key: { default: 'Alt+Shift+L' },
        description: 'Open the LeetCode Assist side panel',
      },
    },
  },
});
