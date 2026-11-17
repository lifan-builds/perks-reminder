# Perks Reminder AMEX Benefit Reader 1.5.0

## Chrome Web Store short description

Track your Amex benefits across cards. See what’s remaining, what’s used, and sync to Perks Reminder.

## Long description

See your American Express benefits together in one panel on the Amex website.

- Refresh automatically after you sign in, or choose Refresh whenever you need an update.
- Browse saved benefits immediately while fresh results arrive.
- Search by benefit, card name, or card ending. Switch between Remaining and Used.
- See which benefits are included for sync and why any items were excluded.
- Choose Sync to Perks Reminder to review benefits in a separate tab before adding them.
- Keep saved history for canceled cards.

Version 1.5.0 improves refresh speed and keeps search responsive during updates. Your existing saved reader data is preserved.

The reader uses your existing Amex session. It does not enroll offers or change your Amex account. Benefit observations are stored in your browser; transfer to Perks Reminder happens only when you choose Sync to Perks Reminder. Use one edition at a time: Chrome extension or Tampermonkey userscript.

Perks Reminder is independent and is not affiliated with or endorsed by American Express.

Privacy: https://www.perks-reminder.com/privacy
Support: https://github.com/lifan-builds/perks-reminder/issues

## Single-purpose statement

View American Express benefit usage across your cards and optionally send selected observations to Perks Reminder for review.

## Permission justification

- storage: saves benefit observations, local card fingerprints, and the temporary sync handoff on this device.
- global.americanexpress.com: displays the benefits panel and reads account, tracker, and catalog data through the existing signed-in session. Refresh begins after sign-in on a new page load and when the user chooses Refresh.
- www.perks-reminder.com/integrations/amex-sync: delivers the handoff only after the user chooses Sync to Perks Reminder.

No tabs, activeTab, scripting, background worker, analytics, or remote executable code is used.

## Data-use answers

- Handles card names, card endings, benefit amounts, usage, enrollment status, periods, and a local card fingerprint for app functionality.
- Uses the existing browser session without reading passwords or cookies. Amex account identifiers are used transiently for the correct card's requests and a local fingerprint; raw responses and account tokens are not saved or included in the handoff.
- Stores observations locally. An explicit sync transfers normalized observations to Perks Reminder for its preview and confirmation flow.
- No sale, advertising use, or unrelated sharing of reader observations.

## Release notes

1.5.0 — Faster benefit refresh with up to four requests at a time. Saved benefits remain searchable while refreshing. Clear coverage counts show which benefits are included for sync. Improved cancellation, recovery after interruption, and support for more Amex benefits. Existing saved data is preserved.
