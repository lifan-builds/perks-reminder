import type { PublicStaticBenefit, PublicStaticCard } from './static-catalog';

/**
 * Year-End Rescue: which credits close on Dec 31, and the last safe day to
 * charge them. DB-free so the public /expiring route and the signed-in
 * dashboard share one rule.
 *
 * Statement credits are matched against the transaction's *post* date, which
 * usually trails the purchase by one to three business days (longer across a
 * holiday weekend). Charging by Dec 31 minus a posting buffer keeps the post
 * date inside the window that closes at Dec 31 23:59:59.999 UTC.
 */

export const DEFAULT_POSTING_BUFFER_DAYS = 4;
export const POSTING_BUFFER_OPTIONS = [2, 4, 7] as const;
/** The dashboard shows the rescue banner from this day (UTC) through Dec 31. */
export const RESCUE_SEASON_START = { month: 11, day: 1 } as const;

export type RescueWindow = 'december' | 'q4' | 'h2' | 'calendar-year';

export const RESCUE_WINDOW_LABEL: Record<RescueWindow, string> = {
  december: 'December',
  q4: 'Oct–Dec quarter',
  h2: 'Jul–Dec half',
  'calendar-year': 'Calendar year',
};

export interface RescueCredit {
  key: string;
  cardCatalogKey: string;
  cardName: string;
  issuer: string;
  imageUrl: string | null;
  description: string;
  category: string;
  /** Dollar value still claimable in the closing window (0 for certificates and passes). */
  amount: number;
  window: RescueWindow;
  /** The credit does not come back on Jan 1 (sunsetAfter is Dec 31). */
  endsForGood: boolean;
  /** A scheduled Jan 1 change worth knowing before spending. */
  changeNote: string | null;
  usageGuide: { slug: string; title: string } | null;
}

export interface RescueAnniversarySummary {
  cardCatalogKey: string;
  count: number;
}

export interface YearEndRescue {
  year: number;
  deadline: string;
  credits: RescueCredit[];
  /** Anniversary-cycle credits whose reset depends on each card's open date. */
  anniversaryCredits: RescueAnniversarySummary[];
}

export function rescueYear(now: Date): number {
  return now.getUTCFullYear();
}

export function yearEndDeadline(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1) - 1);
}

/** Last day (YYYY-MM-DD) to make a purchase so it posts before the window closes. */
export function chargeByDate(year: number, bufferDays: number): string {
  return new Date(Date.UTC(year, 11, 31 - bufferDays)).toISOString().slice(0, 10);
}

export function isRescueSeason(now: Date): boolean {
  const seasonStart = Date.UTC(now.getUTCFullYear(), RESCUE_SEASON_START.month - 1, RESCUE_SEASON_START.day);
  return now.getTime() >= seasonStart && now.getTime() <= yearEndDeadline(now.getUTCFullYear()).getTime();
}

/** Whole UTC days from `now` until `isoDay` (0 on the day itself, negative once past). */
export function daysUntil(now: Date, isoDay: string): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${isoDay}T00:00:00Z`) - today) / 86_400_000);
}

/** The Dec-31-closing window a definition has, if any. */
export function yearEndWindow(benefit: Pick<
  PublicStaticBenefit,
  'frequency' | 'cycleAlignment' | 'fixedCycleStartMonth' | 'fixedCycleDurationMonths'
>): RescueWindow | null {
  const fixed = benefit.cycleAlignment === 'CALENDAR_FIXED'
    && benefit.fixedCycleStartMonth !== undefined
    && benefit.fixedCycleDurationMonths !== undefined
    && benefit.fixedCycleDurationMonths <= 12;

  switch (benefit.frequency) {
    case 'MONTHLY':
      return 'december';
    case 'QUARTERLY':
      if (fixed && benefit.fixedCycleDurationMonths === 3) {
        return (benefit.fixedCycleStartMonth! - 1) % 3 === 0 ? 'q4' : null;
      }
      return 'q4';
    case 'YEARLY': {
      if (!fixed) return null;
      const endMonth = benefit.fixedCycleStartMonth! + benefit.fixedCycleDurationMonths! - 1;
      if (endMonth !== 12) return null;
      switch (benefit.fixedCycleDurationMonths) {
        case 12: return 'calendar-year';
        case 6: return 'h2';
        case 3: return 'q4';
        case 1: return 'december';
        default: return 'calendar-year';
      }
    }
    default:
      return null;
  }
}

function isAnniversaryCredit(benefit: PublicStaticBenefit): boolean {
  return benefit.frequency === 'YEARLY' && benefit.cycleAlignment !== 'CALENDAR_FIXED';
}

export function buildYearEndRescue(cards: readonly PublicStaticCard[], year: number): YearEndRescue {
  const lastDay = `${year}-12-31`;
  const nextYear = `${year + 1}-01-01`;
  const credits: RescueCredit[] = [];
  const anniversaryCredits: RescueAnniversarySummary[] = [];

  for (const card of cards) {
    let anniversaryCount = 0;
    for (const benefit of card.benefits) {
      if (benefit.effectiveFrom && benefit.effectiveFrom > lastDay) continue;
      if (benefit.sunsetAfter && benefit.sunsetAfter < lastDay) continue;
      if (isAnniversaryCredit(benefit)) {
        anniversaryCount += 1;
        continue;
      }
      const window = yearEndWindow(benefit);
      if (!window) continue;
      const change = benefit.upcomingChanges?.find((candidate) => candidate.effectiveOn === nextYear);
      credits.push({
        key: benefit.catalogKey,
        cardCatalogKey: card.catalogKey,
        cardName: card.name,
        issuer: card.issuer,
        imageUrl: card.imageUrl,
        description: benefit.description,
        category: benefit.category,
        amount: Math.round(benefit.maxAmount * (benefit.occurrencesInCycle ?? 1) * 100) / 100,
        window,
        endsForGood: benefit.sunsetAfter === lastDay,
        changeNote: change ? change.summary : null,
        usageGuide: benefit.usageWay,
      });
    }
    if (anniversaryCount > 0) anniversaryCredits.push({ cardCatalogKey: card.catalogKey, count: anniversaryCount });
  }

  credits.sort((left, right) => right.amount - left.amount || left.cardName.localeCompare(right.cardName));
  return { year, deadline: yearEndDeadline(year).toISOString(), credits, anniversaryCredits };
}

/** True when a stored Benefit Cycle closes exactly at the year-end deadline. */
export function closesAtYearEnd(cycleEndDate: Date | string, year: number): boolean {
  return new Date(cycleEndDate).getTime() === yearEndDeadline(year).getTime();
}
