import type { Metadata } from 'next';
import { getPublicStaticCards } from '@/lib/static-catalog';
import { buildYearEndRescue, rescueYear } from '@/lib/year-end-rescue';
import YearEndRescueClient from './YearEndRescueClient';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Dec 31 Expiring Credits — Year-End Rescue',
  description:
    'Every credit card credit that resets on December 31, the last safe day to charge it so the statement post date clears before January 1, and how to trigger each one.',
  alternates: { canonical: '/expiring' },
};

export default function ExpiringPage() {
  const now = new Date();
  const cards = getPublicStaticCards();
  const rescue = buildYearEndRescue(cards, rescueYear(now));
  const pickerCards = cards
    .filter((card) => rescue.credits.some((credit) => credit.cardCatalogKey === card.catalogKey)
      || rescue.anniversaryCredits.some((entry) => entry.cardCatalogKey === card.catalogKey))
    .map((card) => ({ catalogKey: card.catalogKey, name: card.name, issuer: card.issuer, imageUrl: card.imageUrl }));

  return <YearEndRescueClient rescue={rescue} cards={pickerCards} nowIso={now.toISOString()} />;
}
