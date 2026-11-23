// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { expect, type Page, type TestInfo } from "@playwright/test";

export const E2E_EMAIL = "e2e-playwright@perks-reminder.test";
export const E2E_PASSWORD = "perks-e2e-local-only";

/** Collects console errors and uncaught page errors for the whole test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Scrolls the full page so lazy images load, then returns to the top. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.8, 400);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in px").toBe(0);
}

export async function expectNoBrokenImages(page: Page) {
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.loading !== "lazy" || image.getBoundingClientRect().top < document.documentElement.scrollHeight)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src));
  expect(broken, "broken images").toEqual([]);
}

/** The full page-quality contract every route must meet. */
export async function expectHealthyPage(page: Page, errors: string[], testInfo: TestInfo) {
  await settle(page);
  await expectNoHorizontalOverflow(page);
  await expectNoBrokenImages(page);
  expect(errors, `console/page errors on ${page.url()} [${testInfo.project.name}]`).toEqual([]);
}

export async function signIn(page: Page) {
  await page.goto("/auth/signin");
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000, waitUntil: "load" });
  await page.waitForLoadState("networkidle");
}
