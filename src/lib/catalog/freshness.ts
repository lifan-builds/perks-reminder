// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { PublicStaticCard, StaticPredefinedBenefit, StaticPredefinedCard } from '../static-catalog';
import { catalogLifecycleState, type CatalogIsoDate, type CatalogLifecycleMetadata } from './lifecycle';

export type FreshnessSeverity = 'error' | 'warning' | 'info';

export type FreshnessCode =
  | 'expired-offer'
  | 'sunset-soon'
  | 'scheduled-change-due'
  | 'scheduled-change-soon'
  | 'scheduled-definition'
  | 'undated-timed-offer'
  | 'stale-verification'
  | 'unverified-premium-card'
  | 'open-drift'
  | 'missing-usage-guide';

export interface FreshnessFinding {
  severity: FreshnessSeverity;
  code: FreshnessCode;
  cardCatalogKey: string;
  cardName: string;
  benefitCatalogKey?: string;
  subject: string;
  message: string;
  date?: CatalogIsoDate;
  action: string;
}

export interface FreshnessOptions {
  today: CatalogIsoDate;
  horizonDays?: number;
  staleAfterDays?: number;
  premiumAnnualFee?: number;
}

export interface FreshnessReport {
  generatedFor: CatalogIsoDate;
  horizonDays: number;
  cards: number;
  benefits: number;
  counts: Record<FreshnessSeverity, number>;
  findings: FreshnessFinding[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMED_OFFER_PATTERN = /\bthrough (\d{1,2})\/(\d{1,2})\/(\d{4})\b/i;

function daysBetween(from: CatalogIsoDate, to: CatalogIsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** "through 12/31/2026" in a description, as an ISO date. */
export function timedOfferEndFromDescription(description: string): CatalogIsoDate | null {
  const match = TIMED_OFFER_PATTERN.exec(description);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Deterministic freshness audit over the checked-in Catalog. Reads only
 * source data; it never touches the database.
 */
export function auditCatalogFreshness(
  cards: readonly StaticPredefinedCard[],
  publicCards: readonly PublicStaticCard[],
  options: FreshnessOptions,
): FreshnessReport {
  const horizonDays = options.horizonDays ?? 45;
  const staleAfterDays = options.staleAfterDays ?? 120;
  const premiumAnnualFee = options.premiumAnnualFee ?? 395;
  const { today } = options;
  const findings: FreshnessFinding[] = [];
  const guideByBenefit = new Map(
    publicCards.flatMap((card) => card.benefits.map((benefit) => [benefit.catalogKey, benefit.usageWay] as const)),
  );

  const lifecycleFindings = (
    card: StaticPredefinedCard,
    metadata: CatalogLifecycleMetadata,
    subject: string,
    benefit?: StaticPredefinedBenefit,
  ) => {
    const base = { cardCatalogKey: card.catalogKey, cardName: card.name, benefitCatalogKey: benefit?.catalogKey, subject };
    const state = catalogLifecycleState(metadata, today);
    if (state === 'expired') {
      findings.push({
        ...base,
        severity: 'error',
        code: 'expired-offer',
        date: metadata.sunsetAfter,
        message: `Ended ${metadata.sunsetAfter}; still in the Catalog.`,
        action: 'Remove the definition from static-catalog.ts so the guarded sync retires it (linked history is preserved).',
      });
    } else if (metadata.sunsetAfter && daysBetween(today, metadata.sunsetAfter) <= horizonDays) {
      findings.push({
        ...base,
        severity: 'warning',
        code: 'sunset-soon',
        date: metadata.sunsetAfter,
        message: `Ends ${metadata.sunsetAfter} (${daysBetween(today, metadata.sunsetAfter)} days).`,
        action: 'Confirm with the issuer whether it is extended; otherwise schedule retirement after the end date.',
      });
    }
    if (state === 'scheduled') {
      findings.push({
        ...base,
        severity: 'info',
        code: 'scheduled-definition',
        date: metadata.effectiveFrom,
        message: `Takes effect ${metadata.effectiveFrom}.`,
        action: 'No action; it becomes active on its effective date.',
      });
    }
    for (const change of metadata.upcomingChanges ?? []) {
      const days = daysBetween(today, change.effectiveOn);
      if (days > horizonDays) continue;
      findings.push({
        ...base,
        severity: days <= 0 ? 'error' : 'warning',
        code: days <= 0 ? 'scheduled-change-due' : 'scheduled-change-soon',
        date: change.effectiveOn,
        message: days <= 0
          ? `Scheduled change took effect ${change.effectiveOn}: ${change.summary}`
          : `Scheduled change in ${days} days (${change.effectiveOn}): ${change.summary}`,
        action: days <= 0
          ? 'Apply the change to the canonical fields, drop the upcomingChanges entry, and run the guarded sync dry run.'
          : 'Prepare the definition patch; apply on or after the effective date, not early.',
      });
    }
    if (metadata.openDrift) {
      findings.push({
        ...base,
        severity: 'warning',
        code: 'open-drift',
        message: metadata.openDrift,
        action: 'Plan a reviewed status migration before changing the definition in place.',
      });
    }
  };

  let benefitCount = 0;
  for (const card of cards) {
    lifecycleFindings(card, card, card.name);

    if (card.lastVerifiedAt) {
      const age = daysBetween(card.lastVerifiedAt, today);
      if (age > staleAfterDays) {
        findings.push({
          severity: 'warning',
          code: 'stale-verification',
          cardCatalogKey: card.catalogKey,
          cardName: card.name,
          subject: card.name,
          date: card.lastVerifiedAt,
          message: `Last verified ${card.lastVerifiedAt} (${age} days ago).`,
          action: 'Re-check fees and credits against issuerSourceUrl and bump lastVerifiedAt.',
        });
      }
    } else if (card.annualFee >= premiumAnnualFee) {
      findings.push({
        severity: 'warning',
        code: 'unverified-premium-card',
        cardCatalogKey: card.catalogKey,
        cardName: card.name,
        subject: card.name,
        message: `$${card.annualFee} annual-fee card has no lastVerifiedAt/issuerSourceUrl provenance.`,
        action: 'Record the issuer source and verification date.',
      });
    }

    for (const benefit of card.benefits) {
      benefitCount += 1;
      lifecycleFindings(card, benefit, benefit.description, benefit);

      const describedEnd = timedOfferEndFromDescription(benefit.description);
      if (describedEnd && benefit.sunsetAfter !== describedEnd) {
        findings.push({
          severity: 'error',
          code: 'undated-timed-offer',
          cardCatalogKey: card.catalogKey,
          cardName: card.name,
          benefitCatalogKey: benefit.catalogKey,
          subject: benefit.description,
          date: describedEnd,
          message: benefit.sunsetAfter
            ? `Description says it ends ${describedEnd} but sunsetAfter is ${benefit.sunsetAfter}.`
            : `Description says it ends ${describedEnd} but no sunsetAfter is recorded.`,
          action: `Set sunsetAfter: '${describedEnd}' so expiry is enforced instead of remembered.`,
        });
      }

      if (benefit.maxAmount > 0 && benefit.frequency !== 'ONE_TIME' && !guideByBenefit.get(benefit.catalogKey)) {
        findings.push({
          severity: 'info',
          code: 'missing-usage-guide',
          cardCatalogKey: card.catalogKey,
          cardName: card.name,
          benefitCatalogKey: benefit.catalogKey,
          subject: benefit.description,
          message: 'Material recurring credit has no Benefit Usage Guide.',
          action: 'Add or map a usage guide (npm run usage-guides:audit).',
        });
      }
    }
  }

  const order: Record<FreshnessSeverity, number> = { error: 0, warning: 1, info: 2 };
  findings.sort((left, right) =>
    order[left.severity] - order[right.severity]
    || (left.date ?? '9999').localeCompare(right.date ?? '9999')
    || left.cardName.localeCompare(right.cardName)
    || left.subject.localeCompare(right.subject));

  return {
    generatedFor: today,
    horizonDays,
    cards: cards.length,
    benefits: benefitCount,
    counts: {
      error: findings.filter((finding) => finding.severity === 'error').length,
      warning: findings.filter((finding) => finding.severity === 'warning').length,
      info: findings.filter((finding) => finding.severity === 'info').length,
    },
    findings,
  };
}

export interface IssuerPageObservation {
  cardCatalogKey: string;
  url: string;
  status: number | 'error';
  amounts: number[];
  annualFeeMentioned: boolean;
  missingBenefitAmounts: Array<{ benefitCatalogKey: string; description: string; maxAmount: number }>;
}

const MONEY_PATTERN = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;

/** Dollar figures stated on an issuer page, after stripping markup. */
export function extractDollarAmounts(html: string): number[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ');
  return Array.from(
    new Set(Array.from(text.matchAll(MONEY_PATTERN), (match) => Number(match[1].replace(/,/g, '')))),
  ).sort((left, right) => left - right);
}

/**
 * Compares the Catalog against an issuer page: every credit's stated dollar
 * figure and the annual fee should appear somewhere on the page. Absence is a
 * review signal, not proof of a change.
 */
export function diffIssuerPage(
  card: StaticPredefinedCard,
  url: string,
  status: number | 'error',
  html: string,
): IssuerPageObservation {
  const amounts = extractDollarAmounts(html);
  const present = new Set(amounts);
  const statedAmount = (benefit: StaticPredefinedBenefit) => {
    const match = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/.exec(benefit.description);
    return match ? Number(match[1].replace(/,/g, '')) : benefit.maxAmount;
  };
  return {
    cardCatalogKey: card.catalogKey,
    url,
    status,
    amounts,
    annualFeeMentioned: card.annualFee === 0 || present.has(card.annualFee),
    missingBenefitAmounts: status === 'error' || amounts.length === 0
      ? []
      : card.benefits
        .filter((benefit) => benefit.maxAmount > 0 && !present.has(statedAmount(benefit)) && !present.has(benefit.maxAmount))
        .map((benefit) => ({ benefitCatalogKey: benefit.catalogKey, description: benefit.description, maxAmount: benefit.maxAmount })),
  };
}
