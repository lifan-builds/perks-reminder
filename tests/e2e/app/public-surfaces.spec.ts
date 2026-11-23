import { expect, test } from "@playwright/test";
import { expectHealthyPage, watchErrors } from "./guards";

const PUBLIC_ROUTES: Array<{ path: string; heading: RegExp }> = [
  { path: "/", heading: /every credit you pay for/i },
  { path: "/expiring", heading: /what expires on 31\s+december/i },
  { path: "/pricing", heading: /completely free/i },
  { path: "/guide", heading: /maximizing credit card benefits/i },
  { path: "/cards/browse", heading: /browse credit cards/i },
  { path: `/cards/browse/${encodeURIComponent("American Express Platinum Card")}`, heading: /american express platinum card/i },
  { path: "/benefits/how-to-use", heading: /how to use your credit card benefits/i },
  { path: "/benefits/how-to-use/amex-fhr-thc-hotel-credit", heading: /fhr/i },
  { path: "/referrals", heading: /referral/i },
  { path: "/loyalty-landing", heading: /points|miles/i },
  { path: "/integrations/amex-sync/setup", heading: /amex benefit reader/i },
  { path: "/auth/signin", heading: /sign in/i },
  { path: "/auth/signup", heading: /create|sign up/i },
];

for (const route of PUBLIC_ROUTES) {
  test(`${route.path} renders cleanly`, async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    await expectHealthyPage(page, errors, testInfo);
  });
}
