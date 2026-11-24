// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { cookies, headers } from 'next/headers';
import { userAgent } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AMEX_READER_SUGGESTION_DISMISSED_COOKIE,
  AMEX_READER_SUGGESTION_MIN_CARDS,
  isAmexReaderSuggestionEligible,
} from '@/lib/amex-reader-suggestion';

export interface AmexReaderSuggestion {
  amexCardCount: number;
  isMobile: boolean;
}

type SuggestionClient = Pick<typeof prisma, 'creditCard' | 'amexSyncAttempt' | 'benefitStatusSourceProvenance'>;

async function hasAmexSync(client: SuggestionClient, userId: string): Promise<boolean> {
  const [attempt, provenance] = await Promise.all([
    client.amexSyncAttempt.findFirst({ where: { userId, completedAt: { not: null } }, select: { id: true } }),
    client.benefitStatusSourceProvenance.findFirst({ where: { source: 'AMEX', benefitStatus: { userId } }, select: { id: true } }),
  ]);
  return Boolean(attempt || provenance);
}

export async function loadAmexReaderSuggestion(
  userId: string,
  client: SuggestionClient = prisma,
): Promise<AmexReaderSuggestion | null> {
  const dismissed = (await cookies()).has(AMEX_READER_SUGGESTION_DISMISSED_COOKIE);
  const amexCardCount = dismissed
    ? 0
    : await client.creditCard.count({ where: { userId, issuer: 'American Express', lifecycleStatus: 'ACTIVE' } });
  const hasSynced = amexCardCount >= AMEX_READER_SUGGESTION_MIN_CARDS && await hasAmexSync(client, userId);
  if (!isAmexReaderSuggestionEligible({ amexCardCount, hasSynced, dismissed })) return null;
  const deviceType = userAgent({ headers: await headers() }).device.type;
  return { amexCardCount, isMobile: deviceType === 'mobile' || deviceType === 'tablet' };
}
