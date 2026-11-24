// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
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
import DashboardBenefitRow from '@/components/DashboardBenefitRow';
import PublicLanding from '@/components/home/PublicLanding';

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

  if (!session?.user?.id) {
    return <PublicLanding />;
  }

  const userId = session.user.id;

  try {
    const [{ loadHomeDashboardSummaryForUser }, { loadAmexReaderSuggestion }, { default: AmexReaderSuggestion }] = await Promise.all([
      import('@/lib/benefit-dashboard'),
      import('@/lib/amex-reader-suggestion.server'),
      import('@/components/AmexReaderSuggestion'),
    ]);
    const [{
      cardCount,
      totalAnnualFees,
      totalClaimedValue,
      expiringSoonBenefits,
      upcomingBenefits,
    }, amexReaderSuggestion] = await Promise.all([
      loadHomeDashboardSummaryForUser(userId),
      loadAmexReaderSuggestion(userId),
    ]);

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

        {amexReaderSuggestion && (
          <div className="mt-6">
            <AmexReaderSuggestion {...amexReaderSuggestion} />
          </div>
        )}

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
