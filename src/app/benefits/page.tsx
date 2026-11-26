// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BenefitsDisplayClient from '@/components/BenefitsDisplayClient';
import { Metadata } from 'next';
import { loadBenefitDashboard } from '@/lib/benefit-dashboard';
import AmexReaderSuggestion from '@/components/AmexReaderSuggestion';
import { AMEX_READER_SUGGESTION_PARAM } from '@/lib/amex-reader-suggestion';
import { loadAmexReaderSuggestion } from '@/lib/amex-reader-suggestion.server';

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

export default async function BenefitsDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits');
  }
  const userId = session.user.id;
  const params = await searchParams;
  const cardAdded = params[AMEX_READER_SUGGESTION_PARAM] === '1';
  const initialRescueOnly = params.rescue === '1';
  const now = new Date();
  const [dashboard, amexReaderSuggestion] = await Promise.all([
    loadBenefitDashboard(prisma, { userId, now }),
    cardAdded ? loadAmexReaderSuggestion(userId) : null,
  ]);

  return (
    <>
      {amexReaderSuggestion && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <AmexReaderSuggestion {...amexReaderSuggestion} />
        </div>
      )}
      <BenefitsDisplayClient
        {...dashboard}
        nowIso={now.toISOString()}
        initialRescueOnly={initialRescueOnly}
      />
    </>
  );
}
