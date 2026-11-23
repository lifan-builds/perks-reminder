// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { PRIMARY_SITE_URL } from './site';

export function buildLoyaltyCallbackUrl(host: string): string | null {
  if (!host.includes('loyalty.') && !host.includes('loyalty.localhost')) {
    return null;
  }

  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/loyalty`;
}

export function buildLoyaltySignInRedirect(host: string): string {
  const callbackUrl = buildLoyaltyCallbackUrl(host);

  if (!callbackUrl) {
    return '/api/auth/signin?callbackUrl=/loyalty';
  }

  const authBaseUrl = host.includes('localhost')
    ? `http://${host.replace(/^loyalty\./, '')}`
    : PRIMARY_SITE_URL;

  return `${authBaseUrl}/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
