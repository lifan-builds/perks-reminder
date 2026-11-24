// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { LoyaltyAccountsClient } from './LoyaltyAccountsClient';
import { Metadata } from 'next';
import { buildLoyaltySignInRedirect } from '@/lib/loyalty-links';
import PageHeader from '@/components/ui/PageHeader';

/** Build callback URL so users return to loyalty subdomain after sign-in. */
async function getSignInRedirect(): Promise<string> {
  const headerList = await headers();
  return buildLoyaltySignInRedirect(headerList.get('host') || '');
}

export const metadata: Metadata = {
  title: "Loyalty Programs - Track Points & Miles",
  description: "Track your airline miles, hotel points, and loyalty program expiration dates. Never lose points to expiration again.",
  keywords: [
    'loyalty program tracker',
    'airline miles tracker',
    'hotel points tracker',
    'points expiration',
    'miles management'
  ],
  alternates: {
    canonical: '/loyalty',
  },
};

export default async function LoyaltyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(await getSignInRedirect());
  }

  // Fetch user's loyalty accounts and all programs in parallel
  const [userLoyaltyAccounts, allPrograms] = await Promise.all([
    prisma.loyaltyAccount.findMany({
      where: { userId: session.user.id },
      include: {
        certificates: {
          where: { isActive: true },
          orderBy: { expirationDate: 'asc' },
        },
        loyaltyProgram: {
          select: {
            id: true,
            name: true,
            displayName: true,
            type: true,
            company: true,
            expirationMonths: true,
            hasExpiration: true,
            expirationBasis: true,
            description: true,
            qualifyingActivities: true,
            website: true,
          }
        }
      },
      orderBy: [
        { loyaltyProgram: { type: 'asc' } },
        { loyaltyProgram: { company: 'asc' } }
      ]
    }),
    prisma.loyaltyProgram.findMany({
      orderBy: [
        { type: 'asc' },
        { company: 'asc' }
      ]
    }),
  ]);

  const excludeIds = new Set(userLoyaltyAccounts.map(account => account.loyaltyProgramId));
  const availablePrograms = allPrograms.filter(program => !excludeIds.has(program.id));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Loyalty Programs"
        description="Track your loyalty program accounts and prevent points from expiring."
      />

      <LoyaltyAccountsClient 
        userAccounts={userLoyaltyAccounts}
        availablePrograms={availablePrograms}
      />
    </div>
  );
}
