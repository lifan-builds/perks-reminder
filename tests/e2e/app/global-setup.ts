import { execFileSync } from "node:child_process";

/** Seeds the dev-database E2E account (idempotent) before any authenticated spec runs. */
export default function globalSetup() {
  execFileSync("node", ["scripts/with-dev-db.js", "npx", "tsx", "scripts/e2e-seed-user.ts"], {
    stdio: "inherit",
    env: { ...process.env, RESEND_API_KEY: "" },
  });
}
