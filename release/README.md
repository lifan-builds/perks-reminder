# Perks Reminder AMEX reader release

Version 1.5.0 opens earlier, keeps saved benefits browsable during refresh, and keeps up to four benefit requests in flight. Coverage shows how many benefits are included for sync and explains every exclusion. Benefits stay first: a compact header, search by card or benefit, Remaining and Used filters, and a clear Refresh action. Sync to Perks Reminder opens a separate tab where users choose what to add. The Chrome popup opens the Amex benefits page directly.

Cards update automatically after sign-in. Canceled cards keep their saved history. Existing reader data is preserved during the update. Enable one edition at a time.

Build with `npm run build:amex-reader-extension`. This directory contains the Chrome ZIP, unpacked Chrome extension, and Tampermonkey userscript. Building does not publish them.
