// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BenefitsDisplayClient from '@/components/BenefitsDisplayClient';
import { Metadata } from 'next';
import { loadBenefitDashboard } from '@/lib/benefit-dashboard';

export const metadata: Metadata = {
  title: "Benefits Dashboard - Track All Your Credit Card Benefits",
  description: "Track and manage all your credit card benefits in one place. Monitor upcoming credits, expiring benefits, and maximize your annual fee ROI.",
  keywords: [
    'credit card benefits dashboard',
    'track credit card benefits',
    'benefits tracker',
    'credit card perks',
    'annual fee ROI'
  ],
  alternates: {
    canonical: '/benefits',
  },
};

export default async function BenefitsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits');
  }
  const userId = session.user.id;
  const dashboard = await loadBenefitDashboard(prisma, { userId, now: new Date() });

  return <BenefitsDisplayClient {...dashboard} />;
}
