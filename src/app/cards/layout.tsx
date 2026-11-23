// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "My Cards - Manage Your Credit Cards",
  description: "Manage your credit card portfolio. Add, edit, and track all your credit cards and their benefits in one place.",
  keywords: [
    'credit card management',
    'track credit cards',
    'credit card portfolio',
    'card benefits',
    'manage cards'
  ],
  alternates: {
    canonical: '/cards',
  },
};

export default function CardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
