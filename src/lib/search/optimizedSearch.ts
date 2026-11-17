import { prisma } from '@/lib/prisma';
import { searchCards } from '@/lib/cardSearchUtils';
import type { PredefinedCard, PredefinedBenefit } from '@/generated/prisma';

export type CardWithBenefits = PredefinedCard & {
  benefits: PredefinedBenefit[];
};

export interface SearchResult {
  card: CardWithBenefits;
  score: number;
  matchedFields: string[];
}

export interface SearchOptions {
  limit?: number;
  includeBenefits?: boolean;
  sortBy?: 'relevance' | 'name' | 'issuer' | 'annualFee';
  minScore?: number;
}

export async function searchCardsOptimized(
  searchTerm: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 50,
    includeBenefits = true,
    sortBy = 'relevance',
    minScore = 10,
  } = options;

  const orderBy =
    sortBy === 'name'
      ? [{ name: 'asc' as const }]
      : sortBy === 'annualFee'
        ? [{ annualFee: 'asc' as const }, { name: 'asc' as const }]
        : [{ issuer: 'asc' as const }, { name: 'asc' as const }];

  if (!searchTerm.trim()) {
    const cards = await prisma.predefinedCard.findMany({
      include: includeBenefits ? { benefits: { orderBy: { maxAmount: 'desc' } } } : undefined,
      orderBy,
      take: limit,
    });
    return cards.map((card) => ({
      card: card as CardWithBenefits,
      score: 0,
      matchedFields: [],
    }));
  }

  const normalizedSearch = searchTerm.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const digits = normalizedSearch.replace(/\D/g, '');
  const numericFee = digits && /^\d+$/.test(digits) ? parseInt(digits, 10) : undefined;

  const cards = await prisma.predefinedCard.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' as const } },
        { issuer: { contains: searchTerm, mode: 'insensitive' as const } },
        ...(numericFee !== undefined ? [{ annualFee: { equals: numericFee } }] : []),
        ...(normalizedSearch.includes('no annual fee') || normalizedSearch.includes('no fee')
          ? [{ annualFee: 0 }]
          : []),
        ...(includeBenefits
          ? [{
              benefits: {
                some: {
                  OR: [
                    { category: { contains: searchTerm, mode: 'insensitive' as const } },
                    { description: { contains: searchTerm, mode: 'insensitive' as const } },
                  ],
                },
              },
            }]
          : []),
      ],
    },
    include: includeBenefits ? { benefits: { orderBy: { maxAmount: 'desc' } } } : undefined,
    orderBy,
    take: limit * 2,
  });

  return searchCards(cards as CardWithBenefits[], searchTerm)
    .filter((result) => result.score >= minScore)
    .slice(0, limit);
}

export async function getSearchSuggestionsOptimized(): Promise<string[]> {
  const [issuers, categories] = await Promise.all([
    prisma.predefinedCard.findMany({
      select: { issuer: true },
      distinct: ['issuer'],
      orderBy: { issuer: 'asc' },
    }),
    prisma.predefinedBenefit.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }),
  ]);

  const suggestions = new Set<string>([
    'travel', 'dining', 'business', 'uber', 'entertainment', 'credit',
    'no annual fee', 'cashback', 'hotels', 'airlines', 'restaurants',
  ]);
  for (const { issuer } of issuers) {
    suggestions.add(issuer);
    const lower = issuer.toLowerCase();
    if (lower.includes('american express')) suggestions.add('amex');
    if (lower.includes('chase')) suggestions.add('chase');
    if (lower.includes('capital one')) suggestions.add('capital one');
  }
  for (const { category } of categories) {
    suggestions.add(category);
  }

  return Array.from(suggestions).sort();
}
