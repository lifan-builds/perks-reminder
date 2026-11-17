# Amex Reader Local Development

These commands build isolated development artifacts without modifying store release packages (`release/`) or launching a new browser (`webExt.disabled: true`).

## Chrome extension (WXT)

```sh
npm ci --prefix extension/development --ignore-scripts --no-audit --no-fund
npm run prepare:reader-dev
npm run dev:reader-chrome
```

- Output: `build/reader-development/wxt/chrome-mv3-dev`
- Dev server: `127.0.0.1:8731` (strict port)
- The dev manifest adds `tabs`/`scripting` permissions and the loopback host for WXT's reload worker; never ship this directory to the Chrome Web Store.

## Tampermonkey local-file edition

```sh
npm run dev:reader-tampermonkey
```

- Stable loader: `build/reader-development/tampermonkey/reader-dev.user.js` (requires Tampermonkey local-file access)
- Runtime bundle: `build/reader-development/tampermonkey/reader.js` (revision and SHA-256 recorded in `build.json`)
- Uses a separate `@name` / `@namespace` so any installed release script keeps its own GM storage.

## Notes

- Refresh the Amex tab after rebuilding either edition (`prepare:reader-dev` restages popup/icon assets).
- Enable only one reader edition at a time so panels do not duplicate.
- Offline collector + panel benchmark: `node scripts/benchmark-amex-reader.mjs <label>` (uses `tests/performance/amex-reader/fixture.ts`).
