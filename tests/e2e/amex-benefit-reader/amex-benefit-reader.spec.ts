// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { expect, test } from "@playwright/test";
import { digestAmexSyncEnvelope, parseAmexSyncEnvelope } from "../../../src/lib/amex-benefit-reader/sync-contract";
import {
  IDENTITY_SECRET_KEY,
  LEGACY_SYNC_MAILBOX_KEY,
  PRIMARY_ONLY_COMPATIBILITY_KEY,
  PRIMARY_ONLY_COMPATIBILITY_VALUE,
  STORE_KEY,
  SYNC_MAILBOX_KEY,
  V3_SELECTION_COMPATIBILITY_KEY,
  V3_SELECTION_COMPATIBILITY_VALUE,
  SYNTHETIC_AMEX_NON_BENEFITS_URL,
  SYNTHETIC_HANDOFF_TRANSFER_ID,
  SYNTHETIC_HANDOFF_NO_QUERY_URL,
  SYNTHETIC_HANDOFF_EXTRA_QUERY_URL,
  SYNTHETIC_HANDOFF_INVALID_TRANSFER_URL,
  SYNTHETIC_HANDOFF_SIBLING_PATH_URL,
  SYNTHETIC_HANDOFF_ALTERNATE_ORIGIN_URL,
  SYNTHETIC_HANDOFF_ALTERNATE_SCHEME_URL,
  SYNTHETIC_HANDOFF_ALTERNATE_PORT_URL,
  SYNTHETIC_LOCAL_HANDOFF_URL,
  SyntheticAmexHarness,
} from "./harness";

interface PersistedCardRecord {
  localCardId: string;
  identity: { productName: string; endingDigits: string; sourceFingerprint: string };
  freshness: string;
  completeness: string;
  observedAt: string | null;
  lastAttemptAt: string;
  error: null | { code: string; message: string };
  latest: null | {
    contractVersion: string;
    productName: string;
    endingDigits: string;
    parserVersion: string;
    scanId: string;
    completeness: string;
    benefits: Array<{
      title: string;
      category: { state: string; value?: string };
      earnedOrUsed: { state: string; value?: { value: string } };
    }>;
  };
}

interface PersistedEnvelope {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  cards: Record<string, PersistedCardRecord>;
  lastScan: null | {
    scanId?: string;
    startedAt: string;
    finishedAt: string;
    status: string;
    discoveredCardCount: number;
    attemptedCardCount: number;
    unknownAccountVariantCount: number;
    visibleContext: string;
    cards: Array<{ localCardId: string | null; result: string; issueCode: string | null }>;
  };
}

function persistedEnvelope(harness: SyntheticAmexHarness): PersistedEnvelope {
  const value = harness.storage.get(STORE_KEY);
  expect(value).toBeTruthy();
  return value as PersistedEnvelope;
}

function legacyRoleUnverifiedStore(): PersistedEnvelope {
  const localCardId = "11111111-1111-4111-8111-111111111111";
  return {
    schemaVersion: 1,
    revision: 4,
    updatedAt: "2026-07-15T12:00:00.000Z",
    cards: {
      [localCardId]: {
        localCardId,
        identity: {
          productName: "American Express Gold Card",
          endingDigits: "1234",
          sourceFingerprint: "a".repeat(64),
        },
        freshness: "error_no_data",
        completeness: "failed",
        observedAt: null,
        lastAttemptAt: "2026-07-15T12:00:00.000Z",
        error: {
          code: "network_error",
          message: "The first-party Amex read request did not complete.",
        },
        latest: null,
      },
    },
    lastScan: {
      scanId: "22222222-2222-4222-8222-222222222222",
      startedAt: "2026-07-15T11:59:00.000Z",
      finishedAt: "2026-07-15T12:00:00.000Z",
      status: "failed",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      visibleContext: "unchanged",
      cards: [{ localCardId, result: "failed", issueCode: "network_error" }],
    },
  };
}

function expectNoRawSyntheticIdentity(harness: SyntheticAmexHarness): void {
  const serialized = JSON.stringify(harness.storageSnapshot());
  expect(serialized).not.toContain("invented-e2e-primary-token");
  expect(serialized).not.toContain("invented-e2e-secondary-primary-token");
  expect(serialized).not.toContain("invented-e2e-excluded-supplementary-token");
  expect(serialized).not.toContain("invented-e2e-empty-benefits-token");
  expect(serialized).not.toContain("invented-e2e-scale-token");
  expect(serialized).not.toContain("invented-scale-");
  expect(serialized).not.toContain("accountToken");
  expect(serialized).not.toContain("sorBenefitId");
}

async function waitForFinalReader(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByRole("status")).toHaveCount(0);
}

async function createSyntheticHandoffMailbox() {
  const now = new Date();
  const handoffEnvelope = parseAmexSyncEnvelope({
    envelopeVersion: "amex-sync-envelope/3",
    observationContractVersion: "amex-benefits/3",
    scanId: "22222222-2222-4222-8222-222222222222",
    scanFinishedAt: now.toISOString(),
    cards: [{
      sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
      providerProductName: "American Express Platinum Card",
      productKey: "american-express-platinum-card",
      endingDigits: "12345",
      observedAt: now.toISOString(),
      parserVersion: "amex-api-us/3.0.0",
      rows: [{
        providerTitle: "Resy Credit",
        providerCategory: "usage",
        sourceCreditKey: "american-express-platinum-card:resy",
        creditFamilyKey: "american-express-platinum-card:resy",
        sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" },
        enrollmentState: "enrolled",
        completionState: "incomplete",
        earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" },
        targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
      }],
    }],
    exclusions: [],
  });
  return {
    mailboxVersion: "amex-sync-mailbox/2" as const,
    transferId: SYNTHETIC_HANDOFF_TRANSFER_ID,
    nonce: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    digest: await digestAmexSyncEnvelope(handoffEnvelope),
    envelope: handoffEnvelope,
  };
}

test("invalidates one role-unverified snapshot and mailbox without reading Amex", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  const identitySecret = "f".repeat(64);
  harness.storage.set(STORE_KEY, legacyRoleUnverifiedStore());
  harness.storage.set(IDENTITY_SECRET_KEY, identitySecret);
  harness.storage.set(LEGACY_SYNC_MAILBOX_KEY, { syntheticLegacyMailbox: true });
  harness.storage.set(SYNC_MAILBOX_KEY, { syntheticPendingMailbox: true });

  await harness.installBeforeNavigation();
  await harness.openAndInject(SYNTHETIC_AMEX_NON_BENEFITS_URL);
  await page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" }).click();

  expect(persistedEnvelope(harness)).toMatchObject({ revision: 5, cards: {}, lastScan: null });
  expect(harness.storage.get(IDENTITY_SECRET_KEY)).toBe(identitySecret);
  expect(harness.storage.has(LEGACY_SYNC_MAILBOX_KEY)).toBe(false);
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(false);
  expect(harness.storage.get(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(PRIMARY_ONLY_COMPATIBILITY_VALUE);
  expect(harness.storage.get(V3_SELECTION_COMPATIBILITY_KEY)).toBe(V3_SELECTION_COMPATIBILITY_VALUE);
  expect(harness.apiRequests()).toHaveLength(0);
  await expect(page.getByText("Your benefits will appear here")).toBeVisible();
  harness.assertNetworkStayedSynthetic();
});

test("shows only real scan progress until the built reader reaches a terminal result", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  const readerHost = page.locator("#perks-reminder-amex-reader");
  await expect(readerHost).toHaveAttribute("data-reader-version", "1.5.0");
  // The signed-in account UI starts the first scan without a click.

  const progress = page.getByRole("progressbar", { name: "Scan progress" });
  await expect(progress).toHaveAttribute("max", "2");
  await expect(progress).toHaveAttribute("value", "0");
  await expect(page.getByRole("status")).toContainText("0 of 2 cards checked");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.locator(".card-group")).toHaveCount(0);
  await expect(page.locator(".filters")).toHaveCount(0);
  await expect(page.getByText("Settings", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync to Perks Reminder" })).toHaveCount(0);

  await waitForFinalReader(page);
  await expect(page.getByRole("heading", { name: "American Express Gold Card •••• 1234" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
  await expect(page.getByText("Jul 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("CalenderYear", { exact: true })).toHaveCount(0);
  await expect(page.locator(".quality-pill")).toHaveCount(0);
  await expect(page.locator(".data-quality")).toHaveCount(0);
  await expect(page.getByText("Scan notes", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Observed", { exact: true })).toHaveCount(0);

  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({ status: "complete", discoveredCardCount: 2, attemptedCardCount: 2, visibleContext: "unchanged" });
  expect(Object.values(stored.cards)).toHaveLength(2);
  expectNoRawSyntheticIdentity(harness);

  const requestCount = harness.apiRequests().length;
  await harness.reloadAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Find a card or benefit" })).toBeVisible();
  await expect(page.locator(".card-group")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Sync to Perks Reminder" })).toBeDisabled();
  await waitForFinalReader(page);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".card-group")).toHaveCount(1);
  expect(harness.apiRequests()).toHaveLength(requestCount * 2);
  await harness.proveUnexpectedNetworkIsBlocked();
  harness.assertNetworkStayedSynthetic();
});

test("keeps primary-only discovery and reviewed exclusions in the generated bundle", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "reviewed_exclusions");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await waitForFinalReader(page);

  await expect(page.locator(".card-group")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Dell Technologies Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "$200 Airline Fee Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resy Credit", exact: true })).toBeVisible();
  await expect(page.getByText("35% Airline Bonus", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Link Your Resy Profile", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-amex-conflict]")).toHaveCount(0);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("keeps genuine V3 identity conflicts fail closed and internal", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "conflict_diagnostics");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await waitForFinalReader(page);

  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({
    status: "partial",
    discoveredCardCount: 1,
    attemptedCardCount: 1,
  });
  expect(Object.values(stored.cards)[0]).toMatchObject({
    freshness: "current",
    completeness: "partial",
    latest: { contractVersion: "amex-benefits/3", completeness: "partial" },
  });
  const serialized = JSON.stringify(stored);
  expect(serialized).toContain("benefit_identity_conflict");
  expect(serialized).not.toMatch(/tracker_state_collision|ambiguous_catalog_join|conflictDetails|candidateIndex|sourceRole/);
  expect(serialized).not.toMatch(/invented-(?:adobe-state|key-mismatch|ambiguous-wireless|indeed-)/);
  await expect(page.locator("[data-amex-conflict]")).toHaveCount(0);
  await expect(page.getByText(/tracker state collision|ambiguous catalog join/i)).toHaveCount(0);
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("persists approved Morgan, empty Hilton, and Delta-Stays-only V3 outcomes", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "approved_v3_products");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await waitForFinalReader(page);

  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({
    status: "complete",
    discoveredCardCount: 3,
    attemptedCardCount: 3,
  });
  const records = Object.values(stored.cards);
  const morgan = records.find((record) => record.identity.productName === "Morgan Stanley Platinum");
  const hilton = records.find((record) => record.identity.productName === "Hilton Honors Card");
  const delta = records.find((record) => record.identity.productName === "Delta SkyMiles Gold Business Card");
  expect(morgan?.latest).toMatchObject({
    contractVersion: "amex-benefits/3",
    parserVersion: "amex-api-us/3.0.0",
    completeness: "complete",
  });
  expect(morgan?.latest?.benefits).toHaveLength(10);
  expect(morgan?.latest?.benefits.map((benefit) => benefit.title)).toEqual(expect.arrayContaining([
    "$219 CLEAR+ Credit",
    "$300 Equinox Credit",
  ]));
  expect(hilton?.latest).toMatchObject({
    contractVersion: "amex-benefits/3",
    completeness: "complete",
    benefits: [],
  });
  expect(delta?.latest?.benefits.map((benefit) => benefit.title)).toEqual(["$150 Delta Stays Credit"]);
  expect(records.every((record) => record.latest?.benefits.every((benefit) =>
    benefit.category.state === "observed" && benefit.category.value === "usage"))).toBe(true);
  const serialized = JSON.stringify(stored);
  expect(serialized).not.toMatch(/productKey|creditFamilyKey|sorBenefitId|Delta Flight|Rideshare/);
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(false);
  await expect(page.getByRole("heading", { name: "$219 CLEAR+ Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "$300 Equinox Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "$150 Delta Stays Credit" })).toBeVisible();
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("keeps partial observations internal while rendering their safely retained benefits", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "catalog_failure");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await waitForFinalReader(page);

  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
  await expect(page.getByText("$4 of $10 used")).toBeVisible();
  await expect(page.getByText("Partial data", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Data quality and timestamps", { exact: true })).toHaveCount(0);
  await expect(page.getByText("The benefit catalog was unavailable", { exact: false })).toHaveCount(0);
  const record = Object.values(persistedEnvelope(harness).cards)[0];
  expect(record).toMatchObject({ freshness: "current", completeness: "partial", latest: { completeness: "partial" } });
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  harness.assertNetworkStayedSynthetic();
});

test("cancels a later physical-card read while keeping the completed card browsable", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "cancellation");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await harness.waitForCancellationRequest();

  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toHaveAttribute("value", "1");
  await expect(page.getByRole("status")).toContainText("1 of 2 cards checked");
  await expect(page.locator(".card-group")).toHaveCount(1);
  await page.screenshot({ path: "build/reader-verification/startup-refreshing-1.4.0.png" });
  await expect(page.getByText("Settings", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await harness.releaseCancellationRequest();
  await waitForFinalReader(page);

  expect(harness.apiRequestSequence()).toEqual([
    "member:scan-1",
    "tracker:primary:scan-1",
    "catalog:primary:scan-1",
    "tracker:secondary:scan-1",
    "catalog:secondary:scan-1",
  ]);
  expect(persistedEnvelope(harness).lastScan).toMatchObject({ status: "interrupted", attemptedCardCount: 2 });
  await expect(page.getByRole("heading", { name: "American Express Gold Card •••• 1234" })).toBeVisible();
  harness.assertNetworkStayedSynthetic();
});

test("keeps a high-scale account filter-aware without summary or data-quality UI", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "high_scale");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await waitForFinalReader(page);

  await expect(page.getByRole("button", { name: "Remaining 130" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".card-group")).toHaveCount(16);
  await expect(page.locator(".benefit-card")).toHaveCount(130);
  await expect(page.locator(".account-summary")).toHaveCount(0);
  await expect(page.getByText("Data notes", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Used 0" }).click();
  await expect(page.locator(".card-group")).toHaveCount(0);
  await expect(page.locator(".account-empty-state")).toContainText("See Remaining for 130 benefits");
  expect(harness.apiRequests("tracker")).toHaveLength(16);
  expect(harness.apiRequests("catalog")).toHaveLength(16);
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("renders the compact reader at desktop and narrow widths @visual", async ({ context, page }, testInfo) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toBeVisible();
  await waitForFinalReader(page);

  const reader = page.locator("#perks-reminder-amex-reader");
  await expect(reader.getByRole("button", { name: "Remaining 1" })).toHaveAttribute("aria-pressed", "true");
  await expect(reader.getByRole("heading", { name: /American Express Gold Card/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("quiet-ledger-desktop.png") });

  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width <= 414 ? 812 : 1000 });
    const bounds = await reader.getByRole("region", { name: "Amex benefits" }).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await reader.locator(".content").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: testInfo.outputPath("quiet-ledger-mobile.png") });

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const transitionDuration = await reader.locator("button").first().evaluate((control) =>
    getComputedStyle(control).transitionDuration);
  expect(transitionDuration).toBe("0s");
  await page.screenshot({ path: testInfo.outputPath("quiet-ledger-mobile-dark.png") });
  harness.assertNetworkStayedSynthetic();
});

test("supports search, keyboard filtering, and Escape without losing the query", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await waitForFinalReader(page);
  const search = page.getByRole("textbox", { name: "Find a card or benefit" });
  await search.pressSequentially("dining");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("dining");
  await expect(page.locator(".benefit-card")).toHaveCount(1);
  await search.fill("no-such-benefit");
  await expect(page.locator(".account-empty-state")).toContainText("No matches");
  await search.press("Escape");
  const launcher = page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" });
  await expect(launcher).toBeFocused();
  await launcher.press("Enter");
  await expect(search).toHaveValue("no-such-benefit");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toBeFocused();
  await expect(page.locator(".benefit-card")).toHaveCount(1);
  harness.assertNetworkStayedSynthetic();
});

test("mounts once and scans manually from a selector-free non-benefits route", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInjectConcurrentCopies(SYNTHETIC_AMEX_NON_BENEFITS_URL);

  await expect(page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" })).toBeVisible();
  expect(harness.apiRequests()).toHaveLength(0);
  await page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" }).click();
  await page.getByRole("button", { name: "Refresh" }).click();
  await waitForFinalReader(page);
  expect(page.url()).toBe(SYNTHETIC_AMEX_NON_BENEFITS_URL);
  expect(persistedEnvelope(harness).lastScan).toMatchObject({ visibleContext: "unchanged", attemptedCardCount: 2 });
  harness.assertNetworkStayedSynthetic();
});

test("bridges one strict storage-only mailbox on the exact production handoff branch", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();

  await harness.openHandoffAndInject(await createSyntheticHandoffMailbox(), "production", "production", {
    respectMetadata: true,
  });
  await expect(page.locator("body")).toHaveAttribute("data-handoff-state", "accepted");
  await expect(page.locator("body")).not.toHaveAttribute("data-premature-payload", "true");
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(false);
  await expect(page.locator("#perks-reminder-amex-reader")).toHaveCount(0);
  expect(harness.apiRequests()).toHaveLength(0);
  harness.assertNetworkStayedSynthetic();
});

test("does not activate the production artifact outside the exact transfer handoff URL", async ({ context, page }) => {
  const excludedUrls = [
    SYNTHETIC_HANDOFF_NO_QUERY_URL,
    SYNTHETIC_HANDOFF_EXTRA_QUERY_URL,
    SYNTHETIC_HANDOFF_INVALID_TRANSFER_URL,
    SYNTHETIC_HANDOFF_SIBLING_PATH_URL,
    SYNTHETIC_HANDOFF_ALTERNATE_ORIGIN_URL,
    SYNTHETIC_HANDOFF_ALTERNATE_SCHEME_URL,
    SYNTHETIC_HANDOFF_ALTERNATE_PORT_URL,
    SYNTHETIC_LOCAL_HANDOFF_URL,
  ] as const;

  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  for (const excludedUrl of excludedUrls) {
    await harness.openHandoffAndInject(await createSyntheticHandoffMailbox(), "production", "production", {
      respectMetadata: true,
      documentUrl: excludedUrl,
    });
    await expect(page.locator("body")).toHaveAttribute("data-ready-announced", "true");
    await expect(page.locator("body")).toHaveAttribute("data-handoff-state", "waiting");
    await expect(page.locator("#perks-reminder-amex-reader")).toHaveCount(0);
    expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(true);
    expect(harness.apiRequests()).toHaveLength(0);
    harness.assertNetworkStayedSynthetic();
  }
});

test("bridges the local artifact only on the exact localhost handoff branch", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();

  await harness.openHandoffAndInject(await createSyntheticHandoffMailbox(), "local");
  await expect(page.locator("body")).toHaveAttribute("data-handoff-state", "accepted");
  await expect(page.locator("body")).not.toHaveAttribute("data-premature-payload", "true");
  expect(new URL(page.url()).origin).toBe("http://localhost:3000");
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(false);
  await expect(page.locator("#perks-reminder-amex-reader")).toHaveCount(0);
  expect(harness.apiRequests()).toHaveLength(0);
  harness.assertNetworkStayedSynthetic();
});

test("does not activate the local artifact on the production handoff origin", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();

  await harness.openHandoffAndInject(await createSyntheticHandoffMailbox(), "local", "production");
  await expect(page.locator("body")).toHaveAttribute("data-ready-announced", "true");
  await expect(page.locator("body")).toHaveAttribute("data-handoff-state", "waiting");
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(true);
  expect(harness.apiRequests()).toHaveLength(0);
  harness.assertNetworkStayedSynthetic();
});

test("does not activate the production artifact on the local handoff origin", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();

  await harness.openHandoffAndInject(await createSyntheticHandoffMailbox(), "production", "local");
  await expect(page.locator("body")).toHaveAttribute("data-ready-announced", "true");
  await expect(page.locator("body")).toHaveAttribute("data-handoff-state", "waiting");
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(true);
  expect(harness.apiRequests()).toHaveLength(0);
  harness.assertNetworkStayedSynthetic();
});
