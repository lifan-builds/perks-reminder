import { expect, test } from "@playwright/test";
import { expectHealthyPage, watchErrors } from "./guards";

test("primary navigation reaches catalog, Dec 31 rescue, and pricing", async ({ page, isMobile }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const menu = () => (isMobile ? page.locator("#mobile-menu") : page.getByRole("navigation", { name: "Main navigation" }));
  const open = async () => {
    if (isMobile) await page.getByRole("button", { name: "Open main menu" }).click();
  };

  await open();
  await menu().getByText("Dec 31", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/expiring/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("31");

  await open();
  await menu().getByText("Cards", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=%2Fcards$/);

  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: /completely free/i })).toBeVisible();
  await expectHealthyPage(page, errors, testInfo);
});

test("home card lookup opens a card's credit list", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const lookup = page.getByRole("combobox", { name: /look up a card you carry/i });
  await lookup.fill("Sapphire Reserve");
  await expect(page.getByRole("option").first()).toBeVisible();
  await lookup.press("Enter");
  await expect(page).toHaveURL(/\/cards\/browse\/Chase%20Sapphire%20Reserve|\/cards\/browse\/Sapphire%20Reserve/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sapphire Reserve/);
  await expectHealthyPage(page, errors, testInfo);
});

test("validity record shows today's needle on the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/^TODAY · \d{1,2} [A-Z]{3}$/)).toBeVisible();
  await expect(page.getByRole("list", { name: /calendar credits/i }).getByRole("listitem")).toHaveCount(6);
});
