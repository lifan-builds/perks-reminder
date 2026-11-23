'use client';

import Link from 'next/link';
import InkStamp from '@/components/art/InkStamp';
import { cn } from '@/lib/utils';
import type { DisplayBenefitStatus } from '@/lib/benefit-dashboard-client';
import {
  chargeByDate,
  closesAtYearEnd,
  daysUntil,
  DEFAULT_POSTING_BUFFER_DAYS,
  isRescueSeason,
} from '@/lib/year-end-rescue';

export interface YearEndRescueSummary {
  year: number;
  count: number;
  unclaimed: number;
  chargeBy: string;
  daysToChargeBy: number;
}

/** Unclaimed value in open statuses whose Benefit Cycle closes at this year's Dec 31 deadline. */
export function summarizeYearEndRescue(statuses: readonly DisplayBenefitStatus[], now: Date): YearEndRescueSummary | null {
  if (!isRescueSeason(now)) return null;
  const year = now.getUTCFullYear();
  const closing = statuses.filter((status) =>
    !status.isCompleted && !status.isNotUsable && closesAtYearEnd(status.cycleEndDate, year));
  if (closing.length === 0) return null;
  const unclaimed = closing.reduce(
    (sum, status) => sum + Math.max(0, (status.benefit.maxAmount ?? 0) - Math.max(0, status.usedAmount ?? 0)),
    0
  );
  const chargeBy = chargeByDate(year, DEFAULT_POSTING_BUFFER_DAYS);
  return { year, count: closing.length, unclaimed, chargeBy, daysToChargeBy: daysUntil(now, chargeBy) };
}

interface YearEndRescueBannerProps {
  summary: YearEndRescueSummary;
  rescueOnly: boolean;
  onToggle: () => void;
}

export default function YearEndRescueBanner({ summary, rescueOnly, onToggle }: YearEndRescueBannerProps) {
  const chargeByLabel = new Date(`${summary.chargeBy}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const amount = summary.unclaimed.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const timing = summary.daysToChargeBy > 0
    ? `${summary.daysToChargeBy} day${summary.daysToChargeBy === 1 ? '' : 's'} to the safe charge date`
    : summary.daysToChargeBy === 0
      ? 'Today is the last safe charge date'
      : 'Past the safe charge date; charge today';

  return (
    <section
      aria-label="Year-end rescue"
      className="document-frame mb-6 flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
    >
      <InkStamp rim="CHARGE BY" center={summary.chargeBy.slice(8)} caption={`DEC ${summary.year}`} className="hidden h-20 w-20 sm:block" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl leading-tight text-foreground">
          {amount} closes on Dec 31
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {summary.count} unclaimed credit{summary.count === 1 ? '' : 's'} reset at year end. Charge by{' '}
          <time dateTime={summary.chargeBy} className="font-semibold text-stamp">{chargeByLabel}</time> so the post date clears before Jan 1.{' '}
          <span className={cn(summary.daysToChargeBy <= 7 && 'font-semibold text-stamp')}>{timing}.</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={rescueOnly}
          onClick={onToggle}
          className={cn(
            'inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors',
            rescueOnly
              ? 'bg-stamp text-stamp-foreground hover:bg-stamp/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {rescueOnly ? 'Show all benefits' : 'Show only these'}
        </button>
        <Link
          href="/expiring"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Rescue guide
        </Link>
      </div>
    </section>
  );
}
