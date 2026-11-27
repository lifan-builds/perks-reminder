// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const AMEX_HANDOFF_PATH = "/integrations/amex-sync";
const TELEMETRY_ORIGIN = "https://stats.clifan.com";

export default function PathAwareTelemetry() {
  const pathname = usePathname();
  // Only production deployments on the public site should count visits;
  // local, preview, and E2E runs load nothing, and the Amex handoff stays telemetry-free.
  const isProd =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_SITE_URL === "https://www.perks-reminder.com");
  if (!isProd || pathname === AMEX_HANDOFF_PATH) return null;

  return (
    <Script
      id="clifan-telemetry"
      strategy="afterInteractive"
      src={`${TELEMETRY_ORIGIN}/script.js`}
      data-site="perks-reminder.com"
      data-endpoint={`${TELEMETRY_ORIGIN}/api/event`}
    />
  );
}
