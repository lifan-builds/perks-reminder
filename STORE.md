# Reader store metadata

Release: 1.5.0. Prepared 2026-11-02.

## Listing

Use `release/listing-copy.md` for the Chrome listing and `release/greasy-fork-description.md` for the userscript listing. Release artifacts and hashes are under `release/`.

## Privacy and data use

The reader refreshes benefits automatically after sign-in on a new Amex page load and on manual Refresh. It stores normalized observations locally. A user-triggered sync transfers card names, endings, benefit amounts/status/periods, and source identities to Perks Reminder for preview and confirmation. Raw provider responses, passwords, cookies, and account tokens are not persisted or included in the handoff. Account tokens are used transiently for provider reads and local fingerprints.

The linked public policy is https://www.perks-reminder.com/privacy. The user separately approved the privacy-page-only release. Commit `59f4698` is deployed and the public page was verified to describe automatic refresh and temporary token use accurately.

## Chrome Web Store

Existing item: https://chromewebstore.google.com/detail/idpcieaeladegdoelljadhcggjndclpk

Version 1.5.0 submitted November 3, 2026. Dashboard status verified as **Pending review**, with automatic publication after approval enabled. Published version remains 1.0.1 until approval.

### Single purpose

View American Express benefit usage across cards, with an optional reviewed transfer to Perks Reminder.

### Permissions justification

See `release/listing-copy.md`. The package requests storage and two narrowly scoped content-script match surfaces; no new permission is added in 1.5.0.

### Reviewer notes

Open the American Express benefits page in a signed-in US card account. The panel refreshes automatically, displays saved benefits while loading, and supports search, Remaining/Used filters, Refresh and Cancel. Sync to Perks Reminder opens a separate preview and confirmation flow. The publisher's personal account credentials are not supplied. Offline reproducible benchmark: `node scripts/benchmark-amex-reader.mjs <label>`.

## Greasy Fork

Existing listing: https://greasyfork.org/en/scripts/591349-perks-reminder-amex-benefit-reader

Update the existing script with `release/perks-reminder-amex-reader.user.js`; preserve its name and namespace.

## Version history

- 1.5.0: faster collection, responsive progress, atomic recovery checkpoints; verified locally in both editions. Published on Greasy Fork. Submitted to Chrome Web Store; pending review with automatic publication after approval enabled.
