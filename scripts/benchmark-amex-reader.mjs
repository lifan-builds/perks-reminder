// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
// Offline only: bundles the actual engine/panel; no account or .env access.
import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import FakeTimers from "@sinonjs/fake-timers";
import { chromium } from "@playwright/test";

const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error("Supply a benchmark label (letters, digits, hyphens).");
const directory = resolve("build/reader-verification/benchmarks", label);
await mkdir(directory, { recursive: true });
const common = { entryPoints: ["tests/performance/amex-reader/fixture.ts"], bundle: true, loader: { ".webp": "dataurl" }, logLevel: "silent" };
await build({ ...common, platform: "node", format: "esm", outfile: `${directory}/fixture.mjs` });
await build({ ...common, platform: "browser", format: "iife", globalName: "readerBench", outfile: `${directory}/fixture.js` });
const fixture = await import(pathToFileURL(`${directory}/fixture.mjs`).href);
const scans = [];
let saved;
for (const profile of ["balanced", "slow-catalog", "straggler", "slow-storage"]) {
  const clock = FakeTimers.install({ now: Date.parse("2026-11-02T12:00:00Z"), toFake: ["setTimeout", "clearTimeout", "Date"] });
  try {
    const promise = fixture.scan(profile);
    await clock.runAllAsync();
    const { saved: store, ...result } = await promise;
    assert.equal(result.status, "complete"); assert.equal(result.cards, 8); assert.equal(result.benefits, 56);
    assert.equal(result.requests, 17); assert.ok(result.peak <= 4);
    assert.equal(result.coverage.readyBenefits, 56);
    saved = store; scans.push(result);
  } finally { clock.uninstall(); }
}
const browser = await chromium.launch({ headless: true });
const panels = [];
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  await page.setContent("<!doctype html><title>Synthetic reader benchmark</title>");
  await page.addScriptTag({ content: await readFile(`${directory}/fixture.js`, "utf8") });
  await page.evaluate((store) => globalThis.readerBench.panel(store), saved); // warm-up
  for (let i = 0; i < 7; i++) panels.push(await page.evaluate((store) => globalThis.readerBench.panel(store), saved));
  for (const result of panels) { assert.equal(result.filteredRows, 8); assert.equal(result.focused, true); }
} finally { await browser.close(); }
const result = { label, node: process.version, timing: "Engine: virtual delays through actual source. Panel: real headless Chromium CPU, 7 runs after warm-up; 100 progress events per run.", scans, panels };
await writeFile(`${directory}/results.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ label, scans: scans.map(({ coverage, ...row }) => ({ ...row, readyBenefits: coverage.readyBenefits })), panelMedianTotalMs: panels.map((p) => p.totalMs).sort((a,b) => a-b)[3], panelRowsReplaced: panels[0].replacedRows }, null, 2));
