// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { expect, test } from "@playwright/test";
import { expectHealthyPage, signIn, watchErrors } from "./guards";

test.describe("signed-in surfaces", () => {
  test("sign-in rejects a wrong password without leaving the page", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.locator('input[type="email"]').fill("e2e-playwright@perks-reminder.test");
    await page.locator('input[type="password"]').fill("not-the-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("alert").or(page.getByText(/invalid|incorrect|failed/i)).first()).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("dashboard, cards, calendar, loyalty, and settings render after sign-in", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await signIn(page);
    for (const [path, heading] of [
      ["/", /dashboard/i],
      ["/benefits", /benefits dashboard/i],
      ["/cards", /my cards/i],
      ["/cards/calendar", /card calendar/i],
      ["/cards/new", /select a card to add/i],
      ["/loyalty", /loyalty programs/i],
      ["/settings", /settings/i],
      ["/settings/notifications", /notification settings/i],
      ["/settings/benefit-tracking", /tracking/i],
      ["/settings/data", /data/i],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectHealthyPage(page, errors, testInfo);
    }
  });

  test("card edit page loads for an owned physical card", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto("/cards");
    const edit = page.locator('a[href^="/cards/"][href$="/edit"]').first();
    await edit.click();
    await expect(page.getByRole("heading", { level: 1, name: /^Edit / })).toBeVisible();
    await expectHealthyPage(page, errors, testInfo);
  });

  test("rescue view narrows the dashboard to credits closing Dec 31", async ({ page }) => {
    const now = new Date();
    test.skip(now.getUTCMonth() < 10, "The rescue banner only shows Nov 1 - Dec 31.");
    await signIn(page);
    await page.goto("/benefits");
    const banner = page.getByRole("region", { name: "Year-end rescue" });
    await expect(banner.getByRole("heading", { name: /closes on Dec 31/ })).toBeVisible();
    await banner.getByRole("button", { name: "Show only these" }).click();
    await expect(banner.getByRole("button", { name: "Show all benefits", pressed: true })).toBeVisible();
    await page.goto("/benefits?rescue=1");
    await expect(page.getByRole("region", { name: "Year-end rescue" }).getByRole("button", { pressed: true })).toBeVisible();
  });

  test("Amex sync handoff explains a missing handoff instead of failing", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await signIn(page);
    await page.goto("/integrations/amex-sync");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/handoff link is missing or invalid/i)).toBeVisible();
    await expectHealthyPage(page, errors, testInfo);
  });
});
