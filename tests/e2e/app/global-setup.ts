// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { execFileSync } from "node:child_process";

/** Seeds the dev-database E2E account (idempotent) before any authenticated spec runs. */
export default function globalSetup() {
  execFileSync("node", ["scripts/with-dev-db.js", "npx", "tsx", "scripts/e2e-seed-user.ts"], {
    stdio: "inherit",
    env: { ...process.env, RESEND_API_KEY: "" },
  });
}
