import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  BanknotesIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import SupportedCreditCards from '@/components/SupportedCreditCards';
import GuillocheRosette from '@/components/art/GuillocheRosette';
import InkStamp from '@/components/art/InkStamp';
import CardLookup from '@/components/home/CardLookup';
import CycleLedger from '@/components/home/CycleLedger';
import { buildYearEndRescue, chargeByDate, DEFAULT_POSTING_BUFFER_DAYS, isRescueSeason } from '@/lib/year-end-rescue';
import DashboardBenefitRow from '@/components/DashboardBenefitRow';
import FAQ from '@/components/FAQ';
import { PRIMARY_SITE_URL, SITE_NAME } from '@/lib/site';
import { buildFaqJsonLd } from '@/lib/faq-data';
import { getPublicStaticCards } from '@/lib/static-catalog';

function DashboardMetric({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      {content}
    </Link>
  );
}

export default async function Home() {
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import('next-auth'),
    import('@/lib/auth'),
  ]);
  const session = await getServerSession(authOptions);
  const publicCards = getPublicStaticCards();
  const publicBenefitCount = publicCards.reduce((total, card) => total + (card.benefits?.length ?? 0), 0);
  const now = new Date();
  const ledgerCard = publicCards.find((card) => card.catalogKey === 'card:american-express-platinum-card');
  const lookupCards = publicCards.map((card) => ({ name: card.name, issuer: card.issuer, credits: card.benefits.length }));
  const rescueSummary = isRescueSeason(now)
    ? {
        year: now.getUTCFullYear(),
        count: buildYearEndRescue(publicCards, now.getUTCFullYear()).credits.length,
        chargeBy: chargeByDate(now.getUTCFullYear(), DEFAULT_POSTING_BUFFER_DAYS),
      }
    : null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": SITE_NAME,
    "description": "Credit card benefit tracker. Track recurring credits, reset windows, loyalty expirations, and annual fee ROI without connecting bank accounts.",
    "url": PRIMARY_SITE_URL,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Person",
      "name": "FantasyChen",
      "url": "https://github.com/FantasyChen"
    },
    "featureList": [
      "Spreadsheet replacement for credit card benefits",
      "Recurring credit reset tracking",
      "Benefit usage guides",
      "Annual fee ROI analysis",
      "Loyalty expiration tracking",
      "Data import/export",
      "Open-source manual tracking"
    ],
    "screenshot": `${PRIMARY_SITE_URL}/hero-image.jpg`
  };

  if (!session?.user?.id) {
    return (
      <div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
        />

        <section className="security-paper relative -mx-4 -mt-8 overflow-hidden border-b border-border">
          <GuillocheRosette className="absolute -right-48 -top-40 h-[52rem] w-[52rem] text-primary/20 dark:text-foil/15 max-sm:-right-72" seed={1.3} />
          <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
            <div className="flex items-start justify-between gap-8">
              <h1 className="font-display max-w-[16ch] text-5xl leading-[1.02] text-foreground sm:text-6xl lg:text-[5.25rem]">
                Every credit you pay for, used before it resets.
              </h1>
              <InkStamp rim="ISSUED FREE" center="$0" caption="NO BANK LOGIN" tone="visa" rotate={9} className="mt-2 hidden h-32 w-32 md:block" />
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Perks Reminder replaces the benefits spreadsheet. It knows every monthly, quarterly, half-year,
                anniversary, and four-year window on {publicCards.length} cards, reminds you before each one closes,
                and shows how to trigger the credit. No Plaid, no bank credentials.
              </p>
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:flex sm:flex-wrap">
                  <Link
                    href="/auth/signup?callbackUrl=%2Fcards%2Fnew"
                    className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/10 transition-colors hover:bg-primary/90"
                  >
                    Start tracking free
                    <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/expiring"
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    What expires Dec 31
                  </Link>
                </div>
                <CardLookup cards={lookupCards} />
              </div>
            </div>

            {ledgerCard && (
              <div className="document-frame mt-12 rounded-xl px-5 pb-10 pt-5 sm:px-7 sm:pt-6">
                <CycleLedger card={ledgerCard} now={now} />
              </div>
            )}

            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span>{publicCards.length} cards</span>
              <span>{publicBenefitCount} tracked credits</span>
              <span>Open source</span>
              <Link href="/pricing" className="underline hover:text-foreground">$0 forever</Link>
            </p>
          </div>
        </section>

        {rescueSummary && (
          <section className="-mx-4 bg-ink text-paper dark:bg-card dark:text-foreground">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
              <div className="flex items-center gap-5">
                <InkStamp rim="CHARGE BY" center={rescueSummary.chargeBy.slice(8)} caption={`DEC ${rescueSummary.year}`} className="hidden h-24 w-24 text-stamp sm:block" />
                <div>
                  <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                    {rescueSummary.count} catalog credits close on Dec 31.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 opacity-80">
                    Charge by Dec {rescueSummary.chargeBy.slice(8)} so the statement post date clears before Jan 1. Pick your cards and see exactly what is left.
                  </p>
                </div>
              </div>
              <Link
                href="/expiring"
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-stamp px-5 text-sm font-semibold text-stamp-foreground transition-colors hover:bg-stamp/90"
              >
                Open Year-End Rescue
                <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        <section className="border-b border-border py-16">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:px-8">
            <div>
              <h2 className="font-display text-4xl leading-tight text-foreground">Built for a stack of premium cards</h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                The privacy of a spreadsheet, with the reset math, reminders, and how-to notes done for you.
              </p>
              <div className="mt-5 flex flex-col gap-2 text-sm font-semibold">
                <Link href="/benefits/how-to-use" className="text-primary underline-offset-4 hover:underline">Read the usage guides →</Link>
                <Link href="/integrations/amex-sync/setup" className="text-primary underline-offset-4 hover:underline">Local Amex reader →</Link>
              </div>
            </div>
            <dl className="divide-y divide-border border-y border-border">
              {[
                ['Exact Benefit Cycles', 'Calendar months, quarters, Jan–Jun and Jul–Dec halves, card anniversaries, and four- or five-year credits each reset on their own date, in UTC, the way issuers count them.'],
                ['How to use, not just how much', 'Every credit links to a usage guide: what qualifies, enrollment, posting timing, and the ways people get denied.'],
                ['No bank connection', 'Never asks for bank credentials, Plaid links, card numbers, or transaction feeds. You record what you used.'],
                ['Every physical card', 'Two copies of the same product stay separate, with their own open dates, labels, ROI, and full JSON/CSV export.'],
              ].map(([term, detail]) => (
                <div key={term} className="grid gap-2 py-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-8">
                  <dt className="font-semibold text-foreground">{term}</dt>
                  <dd className="text-sm leading-6 text-muted-foreground">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <SupportedCreditCards />
        <FAQ />
      </div>
    );
  }

  const userId = session.user.id;

  try {
    const { loadHomeDashboardSummaryForUser } = await import('@/lib/benefit-dashboard');
    const {
      cardCount,
      totalAnnualFees,
      totalClaimedValue,
      expiringSoonBenefits,
      upcomingBenefits,
    } = await loadHomeDashboardSummaryForUser(userId);

    const netRoi = totalClaimedValue - totalAnnualFees;

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl leading-tight text-foreground sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review tracked cards, claimed value, annual fees, and benefits that need attention.
            </p>
          </div>
          <Link
            href="/cards/new"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
          >
            <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Add card
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric
            href="/cards"
            icon={<CreditCardIcon className="h-5 w-5" aria-hidden="true" />}
            label="Cards tracked"
            value={String(cardCount)}
            detail="Cards with benefits in your account."
          />
          <DashboardMetric
            href="/benefits"
            icon={<CheckCircleIcon className="h-5 w-5" aria-hidden="true" />}
            label="Claimed value"
            value={`$${totalClaimedValue.toFixed(2)}`}
            detail="Value recorded from benefits you marked as used."
          />
          <DashboardMetric
            icon={<BanknotesIcon className="h-5 w-5" aria-hidden="true" />}
            label="Net annual fee position"
            value={`$${netRoi.toFixed(2)}`}
            detail={`$${totalAnnualFees.toFixed(2)} in annual fees tracked.`}
          />
          <DashboardMetric
            href="/benefits"
            icon={<ClockIcon className="h-5 w-5" aria-hidden="true" />}
            label="Due soon"
            value={String(expiringSoonBenefits.length)}
            detail="Benefits expiring in the next 7 days."
          />
        </div>

        {expiringSoonBenefits.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <BellAlertIcon className="h-4 w-4" aria-hidden="true" />
                  Action needed
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Expiring in 7 days</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use these benefits before they reset.
                </p>
              </div>
              <Link
                href="/benefits"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
              >
                View all
                <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-amber-200 bg-card shadow-sm shadow-black/[0.03] dark:border-amber-900/60">
              <ul role="list" className="divide-y divide-border">
                {expiringSoonBenefits.map((status) => (
                  <DashboardBenefitRow
                    key={status.id}
                    status={status}
                    isExpiringSoon
                  />
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Upcoming benefits</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The next benefit cycles that need your attention.
              </p>
            </div>
            <Link
              href="/benefits"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
            >
              View benefits
              <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {upcomingBenefits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm shadow-black/[0.03]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <CalendarDaysIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No upcoming benefits</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Add cards with benefits or check back later for upcoming cycles.
              </p>
              <Link
                href="/cards/new"
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
              >
                <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Add first card
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/[0.03]">
              <ul role="list" className="divide-y divide-border">
                {upcomingBenefits.map((status) => (
                  <DashboardBenefitRow key={status.id} status={status} />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    );
  } catch (error) {
    console.error('Failed to load homepage dashboard:', error);
    return <DashboardUnavailable />;
  }
}

function DashboardUnavailable() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm shadow-black/[0.03] dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
        <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl text-foreground">
        Dashboard temporarily unavailable
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        We cannot load your card and benefit data right now because the database is unavailable. Your account data is not deleted. Try again after the database connection is restored.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
        >
          Try again
        </Link>
        <Link
          href="/pricing"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
        >
          View public site
        </Link>
      </div>
    </div>
  );
}
