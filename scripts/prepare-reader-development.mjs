import { cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, context } from 'esbuild';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'build/reader-development');
const manifest = JSON.parse(await readFile(resolve(root, 'extension/manifest.template.json'), 'utf8'));
const watch = process.argv.includes('--watch');
if (process.argv.slice(2).some(arg => arg !== '--watch')) throw new Error('Usage: node scripts/prepare-reader-development.mjs [--watch]');

await mkdir(resolve(output, 'public/icons'), { recursive: true });
await mkdir(resolve(output, 'public/assets'), { recursive: true });
for (const file of ['popup.html', 'popup.css', 'LICENSE', 'assets/benefits-orbit.webp']) {
  await cp(resolve(root, 'extension', file), resolve(output, 'public', file));
}
for (const size of [16, 32, 48, 128]) {
  await sharp(resolve(root, 'extension/icon.svg')).resize(size, size).png()
    .toFile(resolve(output, `public/icons/icon-${size}.png`));
}

const runtime = resolve(output, 'tampermonkey/reader.js');
await mkdir(dirname(runtime), { recursive: true });
// This is a separate development installation. Stable name/namespace/require
// preserve its own GM storage across builds; the release script is untouched.
await writeFile(resolve(output, 'tampermonkey/reader-dev.user.js'), `// ==UserScript==
// @name         Perks Reminder — Amex Benefit Reader (Development)
// @namespace    https://perks-reminder.com/reader-development/
// @version      ${manifest.version}
// @description  Local development reader; enable only one reader edition.
// @match        https://global.americanexpress.com/*
// @include      https://www.perks-reminder.com/integrations/amex-sync?transfer=*
// @run-at       document-idle
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @require      ${pathToFileURL(runtime).href}
// ==/UserScript==
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
`, 'utf8');

const options = {
  entryPoints: [resolve(root, 'src/userscripts/amex-benefit-reader.user.ts')],
  outfile: runtime,
  bundle: true,
  write: false,
  loader: { '.webp': 'dataurl' },
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  charset: 'utf8',
  legalComments: 'none',
  tsconfig: resolve(root, 'tsconfig.json'),
  define: {
    __AMEX_READER_VERSION__: JSON.stringify('__READER_DEV_REVISION__'),
    __AMEX_SYNC_HANDOFF_TARGET__: JSON.stringify('production'),
  },
  plugins: [{
    name: 'atomic-development-output',
    setup(builder) {
      builder.onEnd(async result => {
        if (result.errors.length) return;
        const code = result.outputFiles[0].text;
        const revision = createHash('sha256').update(code).digest('hex').slice(0, 12);
        const version = `${manifest.version}-dev.${revision}`;
        const runtimeCode = code.replaceAll('__READER_DEV_REVISION__', version);
        await writeFile(`${runtime}.tmp`, runtimeCode, 'utf8');
        await rename(`${runtime}.tmp`, runtime);
        await writeFile(resolve(output, 'tampermonkey/build.json'), JSON.stringify({ version, sha256: createHash('sha256').update(runtimeCode).digest('hex') }, null, 2) + '\n');
        console.log(`Tampermonkey development build ready: ${version}`);
      });
    },
  }],
};

if (watch) {
  const builder = await context(options);
  await builder.watch();
  console.log('Watching reader source. Refresh the existing Amex tab after a successful build.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await builder.dispose();
    process.exit(0);
  });
} else {
  await build(options);
}
