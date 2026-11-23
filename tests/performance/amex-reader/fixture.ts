// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { AmexBenefitScanEngine } from "../../../src/lib/amex-benefit-reader/scan-engine";
import { memberResponseSchema, trackerResponseSchema, catalogResponseSchema } from "../../../src/lib/amex-benefit-reader/amex-api-contract";
import { BrowserResultStore, PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE, V3_SELECTION_COMPATIBILITY_KEY, V3_SELECTION_COMPATIBILITY_VALUE } from "../../../src/userscripts/amex-benefit-reader/storage-port";
import { createEmptyStore, STORE_KEY } from "../../../src/lib/amex-benefit-reader/storage-policy";
import { projectLatestV3SyncEnvelope } from "../../../src/lib/amex-benefit-reader/sync-contract";
import { AmexBenefitReaderPanel } from "../../../src/userscripts/amex-benefit-reader/panel";

const titles = ["Airline Fee Credit", "CLEAR+ Credit", "Equinox Credit", "Resy Credit", "Hotel Credit", "Saks Fifth Avenue Credit", "Walmart+ Credit"];
const trackers = trackerResponseSchema.parse([{ trackers: titles.map((title, i) => ({
  benefitName: title, sorBenefitId: `synthetic-benefit-${i}`, category: "usage", status: "ACTIVE",
  periodStartDate: i < 3 ? "2026-01-01" : i === 3 ? "2026-10-01" : i === 6 ? "2026-11-01" : "2026-07-01", periodEndDate: i === 6 ? "2026-11-30" : "2026-12-31",
  tracker: { spentAmount: "10", targetAmount: "100", remainingAmount: "90", targetUnit: "MONETARY", targetCurrency: "USD", targetCurrencySymbol: "$" },
})) }]);
const catalog = catalogResponseSchema.parse({ benefits: {} });
const member = memberResponseSchema.parse({ accounts: Array.from({ length: 8 }, (_, i) => ({
  account_token: `synthetic-${i}`, relationship: "BASIC", product: { description: "American Express Platinum Card" }, display_account_number: String(10000 + i),
})) });

export async function scan(profile: string) {
  const start = Date.now();
  let active = 0, peak = 0, requests = 0, reads = 0, writes = 0, firstCardMs = 0;
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const values = new Map<string, unknown>([
    [STORE_KEY, createEmptyStore(new Date().toISOString())],
    [PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE],
    [V3_SELECTION_COMPATIBILITY_KEY, V3_SELECTION_COMPATIBILITY_VALUE],
  ]);
  const store = new BrowserResultStore({
    getValue: async (key, fallback) => { reads++; if (profile === "slow-storage") await delay(5); return structuredClone(values.get(key) ?? fallback); },
    setValue: async (key, value) => { writes++; if (profile === "slow-storage") await delay(20); values.set(key, structuredClone(value)); },
    deleteValue: async (key) => { values.delete(key); },
  });
  const read = async <T,>(kind: string, token: string, value: T): Promise<T> => {
    requests++; active++; peak = Math.max(peak, active);
    const index = Number(token.split("-").at(-1));
    const duration = profile === "slow-catalog" ? (kind === "catalog" ? 900 : 100)
      : profile === "straggler" ? (index < 2 && kind === "catalog" ? 900 : 100) : 100;
    await delay(duration); active--; return value;
  };
  const summary = await new AmexBenefitScanEngine({
    discoverAccounts: async () => { requests++; await delay(100); return structuredClone(member); },
    readBenefitTrackers: (token) => read("tracker", token, trackers),
    readBenefitCatalog: (token) => read("catalog", token, catalog),
  }, { capture: () => ({ route: "/card-benefits/view-all", selectedCardDisplayFingerprint: "synthetic" }), verifyUnchanged: () => true }, store, {
    prepareCard: async ({ productName, endingDigits }) => ({ productName, endingDigits, sourceFingerprint: endingDigits.padStart(64, "0") }),
  }, { report: (event) => { if (event.type === "card_committed" && !firstCardMs) firstCardMs = Date.now() - start; } }).scanAllCards();
  const elapsedMs = Date.now() - start;
  const saved = await store.load();
  const projection = projectLatestV3SyncEnvelope(saved);
  return { profile, elapsedMs, firstCardMs, requests, peak, reads, writes, status: summary.status,
    cards: Object.keys(saved.cards).length, benefits: Object.values(saved.cards).reduce((n, c) => n + (c.latest?.benefits.length ?? 0), 0), coverage: projection.coverage, saved };
}

export function panel(saved: Awaited<ReturnType<typeof scan>>["saved"]) {
  document.getElementById("perks-reminder-amex-reader")?.remove();
  const reader = new AmexBenefitReaderPanel(saved, { startScan: async () => undefined, cancelScan: () => undefined, clearData: async () => undefined });
  reader.report({ type: "started" });
  reader.report({ type: "discovered", cardCount: 8, unknownEntryCount: 0 });
  const root = document.getElementById("perks-reminder-amex-reader")!.shadowRoot!;
  const search = root.querySelector<HTMLInputElement>(".search")!;
  search.focus();
  const samples: number[] = [];
  let replacedRows = 0;
  for (let i = 0; i < 100; i++) {
    const row = root.querySelector(".benefit-card");
    const started = performance.now();
    reader.report({ type: "card", cardIndex: 1 + i % 8, cardCount: 8, productName: "American Express Platinum Card", endingDigits: "1000", phase: "trackers" });
    samples.push(performance.now() - started);
    if (row !== root.querySelector(".benefit-card")) replacedRows++;
  }
  const currentSearch = root.querySelector<HTMLInputElement>(".search")!;
  const typingStart = performance.now();
  currentSearch.value = "Hotel";
  currentSearch.dispatchEvent(new Event("input", { bubbles: true }));
  const typingMs = performance.now() - typingStart;
  samples.sort((a, b) => a - b);
  return { medianMs: samples[50], p95Ms: samples[95], totalMs: samples.reduce((a, b) => a + b, 0), replacedRows,
    sameSearch: search === currentSearch, focused: root.activeElement === root.querySelector(".search"), typingMs, filteredRows: root.querySelectorAll(".benefit-card").length };
}
