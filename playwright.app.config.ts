import { defineConfig, devices } from "@playwright/test";

/**
 * Holistic app E2E against a production build on the development database.
 *
 *   npm run build && npm run test:e2e:app
 *
 * The web server starts `next start` through scripts/with-dev-db.js with
 * RESEND_API_KEY cleared, so no path in the suite can send email or reach the
 * production database. Set E2E_BASE_URL to reuse an already running server.
 */
const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

const desktop = { viewport: { width: 1440, height: 900 } };
const mobile = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, browserName: "chromium" as const, defaultBrowserType: "chromium" as const };

export default defineConfig({
  testDir: "./tests/e2e/app",
  // Serial on purpose: under 4 parallel browser contexts the production build throws an
  // intermittent React #418 hydration error on /settings and /cards/calendar. It reproduces
  // identically on e5632c3 (before this suite), so it is tracked separately rather than
  // relaxed in the zero-console-error guard.
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "test-results/app",
  globalSetup: "./tests/e2e/app/global-setup.ts",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop-light", use: { ...desktop, colorScheme: "light" } },
    { name: "desktop-dark", use: { ...desktop, colorScheme: "dark" } },
    { name: "mobile-light", use: { ...mobile, colorScheme: "light" } },
    { name: "mobile-dark", use: { ...mobile, colorScheme: "dark" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node scripts/with-dev-db.js npx next start -p ${port}`,
        url: `${baseURL}/pricing`,
        timeout: 120_000,
        reuseExistingServer: true,
        env: {
          RESEND_API_KEY: "",
          NEXTAUTH_URL: baseURL,
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
