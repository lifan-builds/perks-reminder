// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowRightIcon, CheckIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import GuillocheRosette from '@/components/art/GuillocheRosette';
import InkStamp from '@/components/art/InkStamp';
import { cn } from '@/lib/utils';
import {
  chargeByDate,
  daysUntil,
  DEFAULT_POSTING_BUFFER_DAYS,
  POSTING_BUFFER_OPTIONS,
  RESCUE_WINDOW_LABEL,
  type RescueWindow,
  type YearEndRescue,
} from '@/lib/year-end-rescue';

interface PickerCard {
  catalogKey: string;
  name: string;
  issuer: string;
  imageUrl: string | null;
}

interface YearEndRescueClientProps {
  rescue: YearEndRescue;
  cards: PickerCard[];
  nowIso: string;
}

const QUICK_PICKS = [
  'card:american-express-platinum-card',
  'card:csr',
  'card:american-express-gold-card',
  'card:american-express-business-platinum-card',
  'card:hilton-honors-american-express-aspire-card',
  'card:citi-strata-elite',
];

const WINDOW_ORDER: RescueWindow[] = ['december', 'q4', 'h2', 'calendar-year'];
const STORAGE_KEY = 'perks-reminder:year-end-rescue';
const emptySubscribe = () => () => {};

const money = (amount: number) =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: amount % 1 ? 2 : 0 });

function shortDay(isoDay: string) {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const slugOf = (catalogKey: string) => catalogKey.slice('card:'.length);

function readInitialRescueState(
  cards: PickerCard[],
  hydrated: boolean,
  nowIso: string,
): {
  now: Date;
  selected: string[];
  buffer: number;
  windowFilter: RescueWindow | 'all';
} {
  if (!hydrated) {
    return {
      now: new Date(nowIso),
      selected: [],
      buffer: DEFAULT_POSTING_BUFFER_DAYS,
      windowFilter: 'all',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('cards')?.split(',').filter(Boolean).map((slug) => `card:${slug}`);
  let fromStorage: { cards?: string[]; buffer?: number } = {};
  try {
    fromStorage = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    fromStorage = {};
  }
  const known = new Set(cards.map((card) => card.catalogKey));
  const selected = (fromUrl ?? fromStorage.cards ?? []).filter((key) => known.has(key));
  const urlBuffer = Number(params.get('buffer'));
  const nextBuffer = POSTING_BUFFER_OPTIONS.find((option) => option === (urlBuffer || fromStorage.buffer));
  const urlWindow = params.get('window') as RescueWindow | null;
  return {
    now: new Date(),
    selected,
    buffer: nextBuffer ?? DEFAULT_POSTING_BUFFER_DAYS,
    windowFilter: urlWindow && WINDOW_ORDER.includes(urlWindow) ? urlWindow : 'all',
  };
}

export default function YearEndRescueClient(props: YearEndRescueClientProps) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  return <YearEndRescueContent key={hydrated ? 'client' : 'ssr'} {...props} hydrated={hydrated} />;
}

function YearEndRescueContent({
  rescue,
  cards,
  nowIso,
  hydrated,
}: YearEndRescueClientProps & { hydrated: boolean }) {
  const [initialState] = useState(() => readInitialRescueState(cards, hydrated, nowIso));
  const now = initialState.now;
  const [selected, setSelected] = useState<string[]>(initialState.selected);
  const [buffer, setBuffer] = useState<number>(initialState.buffer);
  const [windowFilter, setWindowFilter] = useState<RescueWindow | 'all'>(initialState.windowFilter);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    if (selected.length) params.set('cards', selected.map(slugOf).join(','));
    if (buffer !== DEFAULT_POSTING_BUFFER_DAYS) params.set('buffer', String(buffer));
    if (windowFilter !== 'all') params.set('window', windowFilter);
    const search = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards: selected, buffer }));
  }, [hydrated, selected, buffer, windowFilter]);

  const chargeBy = chargeByDate(rescue.year, buffer);
  const daysToChargeBy = daysUntil(now, chargeBy);
  const daysToDeadline = daysUntil(now, `${rescue.year}-12-31`);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const cardByKey = useMemo(() => new Map(cards.map((card) => [card.catalogKey, card])), [cards]);

  const scoped = useMemo(
    () => rescue.credits.filter((credit) => selectedSet.size === 0 || selectedSet.has(credit.cardCatalogKey)),
    [rescue.credits, selectedSet]
  );
  const visible = useMemo(
    () => scoped.filter((credit) => windowFilter === 'all' || credit.window === windowFilter),
    [scoped, windowFilter]
  );
  const total = scoped.reduce((sum, credit) => sum + credit.amount, 0);
  const cardCount = new Set(scoped.map((credit) => credit.cardCatalogKey)).size;
  const anniversaryCount = rescue.anniversaryCredits
    .filter((entry) => selectedSet.has(entry.cardCatalogKey))
    .reduce((sum, entry) => sum + entry.count, 0);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return cards
      .filter((card) => !selectedSet.has(card.catalogKey))
      .filter((card) => `${card.name} ${card.issuer}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [cards, query, selectedSet]);

  const toggle = (catalogKey: string) =>
    setSelected((current) => current.includes(catalogKey)
      ? current.filter((key) => key !== catalogKey)
      : [...current, catalogKey]);

  const urgent = daysToChargeBy <= 7;
  const pastChargeBy = daysToChargeBy < 0;

  return (
    <div className="-mx-4 -my-8">
      <section className="security-paper relative overflow-hidden border-b border-border">
        <GuillocheRosette
          className="absolute -right-40 -top-24 h-[44rem] w-[44rem] text-primary/25 dark:text-foil/20 max-sm:-right-64 max-sm:-top-40"
          seed={0.7}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:px-8 lg:pb-16 lg:pt-14">
          <div>
            <h1 className="font-display max-w-[14ch] text-5xl leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              What expires on 31&nbsp;December {rescue.year}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Pick your cards. Every credit below resets at the end of Dec 31, and a purchase only counts once it
              <em className="not-italic font-semibold text-foreground"> posts</em>, so charge a few days early and let the
              post date land before Jan 1.
            </p>

            <div className="mt-8 max-w-xl">
              <label htmlFor="rescue-card-search" className="field-label">Your cards</label>
              <div className="relative mt-2">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="rescue-card-search"
                  type="search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && matches[0]) {
                      event.preventDefault();
                      toggle(matches[0].catalogKey);
                      setQuery('');
                    }
                  }}
                  placeholder="Search Platinum, Sapphire Reserve, Aspire…"
                  aria-controls="rescue-card-matches"
                  className="h-12 w-full rounded-lg border border-input bg-card pl-11 pr-4 text-base text-foreground shadow-sm shadow-black/[0.03] placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
                />
                {matches.length > 0 && (
                  <ul id="rescue-card-matches" role="listbox" aria-label="Matching cards" className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg shadow-black/10">
                    {matches.map((card) => (
                      <li key={card.catalogKey} role="option" aria-selected={false}>
                        <button
                          type="button"
                          onClick={() => {
                            toggle(card.catalogKey);
                            setQuery('');
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent"
                        >
                          {card.imageUrl && (
                            <Image src={card.imageUrl} alt="" width={44} height={28} className="h-7 w-11 rounded-[3px] object-cover" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{card.name}</span>
                          <span className="text-xs text-muted-foreground">{card.issuer}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2" aria-label={selected.length ? 'Selected cards' : 'Popular cards'}>
                {(selected.length ? selected : QUICK_PICKS.filter((key) => cardByKey.has(key))).map((key) => {
                  const card = cardByKey.get(key);
                  if (!card) return null;
                  const isSelected = selectedSet.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(key)}
                      className={cn(
                        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent'
                      )}
                    >
                      {isSelected ? <XMarkIcon className="h-4 w-4" aria-hidden="true" /> : <CheckIcon className="h-4 w-4 opacity-40" aria-hidden="true" />}
                      {card.name.replace(/^American Express /, 'Amex ')}
                    </button>
                  );
                })}
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])} className="min-h-9 px-2 text-sm font-medium text-muted-foreground underline hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside aria-label="Charge-by date" className="document-frame relative self-start rounded-xl p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="field-label">Charge by</p>
                <p className="font-display mt-2 text-6xl leading-none text-foreground sm:text-7xl">
                  <time dateTime={chargeBy}>{shortDay(chargeBy)}</time>
                </p>
                <p className={cn('mt-3 text-sm font-semibold', urgent ? 'text-stamp' : 'text-muted-foreground')} aria-live="polite">
                  {pastChargeBy
                    ? daysToDeadline >= 0
                      ? `Past the safe date — ${daysToDeadline === 0 ? 'the window closes tonight' : `${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} until the window closes`}. Charge today and keep the receipt.`
                      : 'This window has closed.'
                    : daysToChargeBy === 0
                      ? 'Today is the last safe day.'
                      : `${daysToChargeBy} day${daysToChargeBy === 1 ? '' : 's'} left · window closes Dec 31`}
                </p>
              </div>
              <InkStamp rim="CHARGE BY" center={chargeBy.slice(8)} caption={`DEC ${rescue.year}`} className="h-24 w-24 sm:h-28 sm:w-28" />
            </div>

            <fieldset className="mt-6">
              <legend className="field-label">Posting buffer</legend>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
                {POSTING_BUFFER_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      'flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      buffer === option ? 'bg-card text-foreground shadow-sm shadow-black/10' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <input
                      type="radio"
                      name="posting-buffer"
                      value={option}
                      checked={buffer === option}
                      onChange={() => setBuffer(option)}
                      className="sr-only"
                    />
                    {option} days
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Most purchases post in 1–3 business days; holiday weekends stretch that. Four days early (Dec 27) covers the usual case; seven is for merchants that post slowly.
              </p>
            </fieldset>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">
              <div>
                <dt className="field-label">{selected.length ? 'At stake on your cards' : 'Across the catalog'}</dt>
                <dd className="font-display mt-1 text-3xl text-foreground tabular">{money(total)}</dd>
              </div>
              <div>
                <dt className="field-label">Credits</dt>
                <dd className="font-display mt-1 text-3xl text-foreground tabular">
                  {scoped.length}
                  <span className="ml-1.5 font-sans text-sm font-medium text-muted-foreground">on {cardCount} card{cardCount === 1 ? '' : 's'}</span>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section aria-labelledby="rescue-list-heading" className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="rescue-list-heading" className="font-display text-3xl text-foreground sm:text-4xl">
              {selected.length ? 'Your Dec 31 credits' : 'Every Dec 31 credit in the catalog'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {selected.length
                ? 'Biggest first. Each one links to the usage guide that explains what qualifies.'
                : 'Pick your cards above to narrow this to what you actually hold.'}
            </p>
          </div>
          <div role="group" aria-label="Filter by window" className="flex flex-wrap gap-1.5">
            {(['all', ...WINDOW_ORDER] as const).map((value) => {
              const count = value === 'all' ? scoped.length : scoped.filter((credit) => credit.window === value).length;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={windowFilter === value}
                  disabled={count === 0 && value !== 'all'}
                  onClick={() => setWindowFilter(value)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    windowFilter === value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-foreground hover:bg-accent'
                  )}
                >
                  {value === 'all' ? 'All' : RESCUE_WINDOW_LABEL[value]}
                  <span className="ml-1.5 tabular opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="document-frame mt-8 rounded-xl p-8 text-center">
            <p className="font-display text-2xl text-foreground">Nothing on these cards closes on Dec 31.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Their credits reset on the card anniversary or in another month. Sign in to track each card&apos;s exact dates.
            </p>
          </div>
        ) : (
          <ol className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {visible.map((credit) => (
              <li key={credit.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5">
                {credit.imageUrl ? (
                  <Image src={credit.imageUrl} alt="" width={76} height={48} className="h-12 w-[76px] rounded-[5px] object-cover shadow-sm shadow-black/20" />
                ) : (
                  <span className="h-12 w-[76px] rounded-[5px] bg-muted" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{credit.cardName}</p>
                  <p className="mt-0.5 font-semibold leading-snug text-foreground">{credit.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    <span className="field-label !text-[0.625rem]">{RESCUE_WINDOW_LABEL[credit.window]}</span>
                    <span className="text-muted-foreground">
                      Valid until <time dateTime={`${rescue.year}-12-31`}>Dec 31</time>
                    </span>
                    <span className={cn('font-semibold', urgent ? 'text-stamp' : 'text-foreground')}>
                      Charge by <time dateTime={chargeBy}>{shortDay(chargeBy)}</time>
                    </span>
                    {credit.endsForGood && (
                      <span className="rounded-full border border-stamp/40 bg-stamp-wash px-2 py-0.5 font-semibold text-stamp">
                        Last time — not renewed in {rescue.year + 1}
                      </span>
                    )}
                  </div>
                  {credit.changeNote && <p className="mt-2 text-xs leading-5 text-muted-foreground">From Jan 1: {credit.changeNote}</p>}
                </div>
                <div className="col-span-2 flex items-center justify-between gap-4 border-t border-border pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <p className="font-display text-2xl leading-none text-foreground tabular">
                    {credit.amount > 0 ? money(credit.amount) : 'Certificate'}
                  </p>
                  {credit.usageGuide && (
                    <Link
                      href={`/benefits/how-to-use/${credit.usageGuide.slug}`}
                      className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      How to use
                      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10 grid gap-6 border-t border-border pt-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <h2 className="font-display text-2xl text-foreground">Already used some of these?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {anniversaryCount > 0
                ? `Your cards also carry ${anniversaryCount} anniversary credit${anniversaryCount === 1 ? '' : 's'} that reset on each card's open date, not Dec 31. `
                : ''}
              Track your cards to see only what is still unclaimed, with the exact reset date for every credit and an email before each window closes. Free, no bank connection.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/signup?callbackUrl=%2Fbenefits%3Frescue%3D1"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/10 transition-colors hover:bg-primary/90"
            >
              Track my cards free
            </Link>
            <Link
              href="/benefits?rescue=1"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              I have an account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
