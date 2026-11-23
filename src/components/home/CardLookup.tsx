// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface CardLookupProps {
  cards: Array<{ name: string; issuer: string; credits: number }>;
}

/** Find a card in the public catalog and open its credit list. */
export default function CardLookup({ cards }: CardLookupProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return cards.filter((card) => `${card.name} ${card.issuer}`.toLowerCase().includes(needle)).slice(0, 5);
  }, [cards, query]);

  const open = (name: string) => router.push(`/cards/browse/${encodeURIComponent(name)}`);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (matches[active]) open(matches[active].name);
        else router.push('/cards/browse');
      }}
      className="relative"
    >
      <label htmlFor="home-card-lookup" className="field-label">Look up a card you carry</label>
      <div className="relative mt-2">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="home-card-lookup"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
          }}
          placeholder="Amex Platinum, Sapphire Reserve, Venture X…"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="home-card-lookup-results"
          aria-activedescendant={matches[active] ? `home-card-option-${active}` : undefined}
          className="h-12 w-full rounded-lg border border-input bg-card pl-11 pr-24 text-base text-foreground shadow-sm shadow-black/[0.03] placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-md bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-accent"
        >
          Look up
        </button>
      </div>
      {matches.length > 0 && (
        <ul id="home-card-lookup-results" role="listbox" className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg shadow-black/10">
          {matches.map((card, index) => (
            <li
              key={card.name}
              id={`home-card-option-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                open(card.name);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm ${index === active ? 'bg-accent' : ''}`}
            >
              <span className="truncate font-medium text-foreground">{card.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{card.credits} credits</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
