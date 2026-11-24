// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { Metadata } from 'next';
import PublicLanding from '@/components/home/PublicLanding';

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  robots: { index: false, follow: true },
};

export default function LandingPage() {
  return <PublicLanding />;
}
