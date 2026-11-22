"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";

const AMEX_HANDOFF_PATH = "/integrations/amex-sync";

export default function PathAwareTelemetry() {
  const pathname = usePathname();
  if (pathname === AMEX_HANDOFF_PATH) return null;

  return (
    <>
      <Script
        id="clifan-telemetry"
        strategy="afterInteractive"
        src="https://clifan-umami.vercel.app/script.js"
        data-site="perks-reminder.com"
        data-endpoint="https://clifan-umami.vercel.app/api/event"
      />
      <Analytics />
    </>
  );
}
