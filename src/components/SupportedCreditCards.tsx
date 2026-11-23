// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { searchCards } from '@/lib/cardSearchUtils';
import CardImageWell from '@/components/ui/CardImageWell';
import { getPublicStaticCards, type PublicStaticCard } from '@/lib/static-catalog';

export default function SupportedCreditCards() {
  const [cards] = useState(() => getPublicStaticCards());
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fallbackResults = searchCards(cards, searchTerm);
  const filteredCards = fallbackResults.map(result => result.card);

  const displayedCards = showAll ? filteredCards : filteredCards.slice(0, 6);
  const cardCountLabel = `${cards.length} popular credit card${cards.length === 1 ? '' : 's'}`;

  const cardsByIssuer = displayedCards.reduce((acc, card) => {
    if (!acc[card.issuer]) {
      acc[card.issuer] = [];
    }
    acc[card.issuer].push(card);
    return acc;
  }, {} as Record<string, PublicStaticCard[]>);

  return (
    <section id="supported-cards" className="border-b border-border bg-background py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl leading-tight text-foreground sm:text-4xl">
              Supported Credit Cards
            </h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground max-w-2xl">
              Track benefits from {cardCountLabel}. We support cards from major issuers with detailed benefit tracking and automated cycle management.
            </p>
          </div>
          <Link
            href="/cards/browse"
            className="text-sm font-semibold text-foreground underline underline-offset-4 hover:text-primary whitespace-nowrap"
          >
            Browse full catalog →
          </Link>
        </div>

        <div className="max-w-md mb-8 space-y-2">
          <input
            id="card-search"
            name="card-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Filter by card, issuer, or credit (e.g. Amex, Uber, airline)..."
            className="w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          {searchTerm && (
            <div className="text-xs text-muted-foreground">
              Found {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} matching &ldquo;{searchTerm}&rdquo;
            </div>
          )}
        </div>

        <div className="space-y-8">
          {Object.entries(cardsByIssuer).map(([issuer, issuerCards]) => (
            <div key={issuer}>
              <h3 className="text-base font-semibold text-foreground mb-3 border-b border-border pb-2">
                {issuer}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {issuerCards.map((card) => (
                  <div
                    key={card.id}
                    className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent/35"
                  >
                    <CardImageWell
                      imageUrl={card.imageUrl}
                      alt={card.name}
                      issuer={card.issuer}
                      className="h-28 rounded-none border-x-0 border-t-0"
                      sizes="220px"
                      unoptimized
                    />
                    <div className="p-4">
                      <h4 className="mb-1.5 text-base font-semibold leading-snug text-foreground">
                        {card.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        ${card.annualFee} annual fee · {card.benefits?.length || 0} tracked benefits
                      </p>
                      {card.benefits && card.benefits.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          {card.benefits.slice(0, 2).map((benefit, index) => (
                            <div key={index} className="text-xs text-muted-foreground truncate">
                              • {benefit.description}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredCards.length > 6 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground bg-card hover:bg-accent transition-colors"
            >
              {showAll ? (
                <>
                  Show fewer cards
                  <ChevronUpIcon className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Show all {filteredCards.length} cards
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
