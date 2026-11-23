// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import manifest from '../manifest.template.json';

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // A user loads this development build into their existing Chrome once.
  // Never launch a replacement browser or touch a Chrome profile directory.
  webExt: { disabled: true },
  // WXT 0.21.5 still mounts unimport when imports:false; disable its injector
  // explicitly so shared code's storage parameters are never rewritten.
  imports: { autoImport: false, dirs: [] },
  srcDir: fromHere('../../src'),
  entrypointsDir: fromHere('./entrypoints'),
  outDir: fromHere('../../build/reader-development/wxt'),
  publicDir: fromHere('../../build/reader-development/public'),
  manifest: {
    name: `${manifest.name} (Development)`,
    version: manifest.version,
    description: manifest.description,
    permissions: manifest.permissions,
    action: manifest.action,
    icons: manifest.icons,
  },
  dev: { server: { host: '127.0.0.1', origin: 'http://127.0.0.1:8731', port: 8731, strictPort: true } },
  vite: () => ({
    // This sidecar must not load the application's environment files.
    envDir: false,
    server: { host: '127.0.0.1', strictPort: true },
    define: { __AMEX_EXTENSION_VERSION__: JSON.stringify(`${manifest.version}-dev`) },
  }),
});
