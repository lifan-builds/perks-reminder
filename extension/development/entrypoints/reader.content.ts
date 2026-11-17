import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: [
    'https://global.americanexpress.com/*',
    'https://www.perks-reminder.com/integrations/amex-sync',
  ],
  runAt: 'document_end',
  allFrames: false,
  async main() {
    // The shared runtime guards against duplicate panels. Refresh the test tab
    // after rebuilding so its existing scanner and login watcher are disposed.
    await import('../../../src/extension/content-entry');
  },
});
