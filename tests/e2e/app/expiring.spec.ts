// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { expect, test } from "@playwright/test";
import { expectHealthyPage, watchErrors } from "./guards";

test.describe("Dec 31 Year-End Rescue", () => {
  test("filters by card, window, and posting buffer, and keeps state in the URL", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto("/expiring");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const chargeBy = page.getByRole("complementary", { name: "Charge-by date" });
    await expect(chargeBy.getByText("Dec 27", { exact: true })).toBeVisible();

    const search = page.getByLabel("Your cards");
    await search.fill("Platinum Card");
    await page.getByRole("option", { name: /American Express Platinum Card/ }).click();
    await expect(page.getByRole("button", { name: /Amex Platinum Card/, pressed: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your Dec 31 credits" })).toBeVisible();

    const rows = page.getByRole("list").filter({ has: page.getByRole("link", { name: "How to use" }) }).first().getByRole("listitem");
    const platinumCount = await rows.count();
    expect(platinumCount).toBeGreaterThan(5);
    for (const text of await rows.allInnerTexts()) expect(text).toContain("American Express Platinum Card");

    await page.getByRole("group", { name: "Filter by window" }).getByRole("button", { name: /Jul–Dec half/ }).click();
    await expect(rows).not.toHaveCount(platinumCount);
    for (const text of await rows.allInnerTexts()) expect(text).toMatch(/Jul–Dec half/i);

    await chargeBy.getByText("7 days").click();
    await expect(chargeBy.getByText("Dec 24", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/cards=american-express-platinum-card/);
    await expect(page).toHaveURL(/buffer=7/);
    await expect(page).toHaveURL(/window=h2/);

    await page.reload();
    await expect(chargeBy.getByText("Dec 24", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amex Platinum Card/, pressed: true })).toBeVisible();
    await expectHealthyPage(page, errors, testInfo);
  });

  test("each credit links to its Benefit Usage Guide", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto("/expiring?cards=american-express-platinum-card");
    await expect(page.getByRole("heading", { level: 2, name: "Your Dec 31 credits" })).toBeVisible();
    const guide = page.getByRole("link", { name: "How to use" }).first();
    const href = await guide.getAttribute("href");
    expect(href).toMatch(/^\/benefits\/how-to-use\/[a-z0-9-]+$/);
    await guide.click();
    await expect(page).toHaveURL(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectHealthyPage(page, errors, testInfo);
  });

  test("a card with only anniversary credits gets an honest empty state", async ({ page }) => {
    await page.goto("/expiring?cards=venture-x");
    await expect(page.getByText("Nothing on these cards closes on Dec 31.")).toBeVisible();
    await expect(page.getByText(/anniversary credit/)).toBeVisible();
  });
});
