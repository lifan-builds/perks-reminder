// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { PublicStaticBenefit, PublicStaticCard } from './static-catalog';

/** A credit family drawn across one calendar year: each window is [startMonth, endMonth], 1-12 inclusive. */
export interface LedgerRow {
  key: string;
  label: string;
  perWindow: number;
  annual: number;
  windows: Array<{ start: number; end: number }>;
  cadence: string;
}

function familyLabel(description: string): string {
  return description
    .replace(/\s*[-—–]\s*(?:Jan-Jun|Jul-Dec)\b/, '')
    .replace(/(?:Jan-Jun|Jul-Dec);\s*/, '')
    .replace(/\s*\((?:Q[1-4]:\s*)?(?:Jan|Apr|Jul|Oct)-(?:Mar|Jun|Sep|Dec)\)/, '')
    .replace(/\s*\(December\)/, '')
    .trim();
}

function windowsFor(benefit: PublicStaticBenefit): Array<{ start: number; end: number }> | null {
  const fixed = benefit.cycleAlignment === 'CALENDAR_FIXED' && benefit.fixedCycleStartMonth && benefit.fixedCycleDurationMonths
    && benefit.fixedCycleDurationMonths <= 12;
  if (benefit.frequency === 'MONTHLY') return Array.from({ length: 12 }, (_, index) => ({ start: index + 1, end: index + 1 }));
  if (benefit.frequency === 'QUARTERLY') {
    const offset = fixed && benefit.fixedCycleDurationMonths === 3 ? (benefit.fixedCycleStartMonth! - 1) % 3 : 0;
    if (offset !== 0) return null;
    return [1, 4, 7, 10].map((start) => ({ start, end: start + 2 }));
  }
  if (benefit.frequency === 'YEARLY' && fixed) {
    const start = benefit.fixedCycleStartMonth!;
    const end = start + benefit.fixedCycleDurationMonths! - 1;
    return end <= 12 ? [{ start, end }] : null;
  }
  return null;
}

function cadenceFor(windows: Array<{ start: number; end: number }>): string {
  if (windows.length === 12) return 'Monthly';
  if (windows.length === 4 && windows.every((window) => window.end - window.start === 2)) return 'Quarterly';
  if (windows.length === 2 && windows.every((window) => window.end - window.start === 5)) return 'Jan–Jun · Jul–Dec';
  if (windows.length === 1 && windows[0].start === 1 && windows[0].end === 12) return 'Calendar year';
  if (windows.length === 1 && windows[0].start === 12) return 'December';
  return 'Fixed window';
}

/** Calendar-cycle credits of one card, merged into families (H1+H2, Q1-Q4) and ranked by annual value. */
export function buildCycleLedger(card: PublicStaticCard, limit = 6): LedgerRow[] {
  const families = new Map<string, LedgerRow>();
  for (const benefit of card.benefits) {
    const windows = windowsFor(benefit);
    if (!windows || benefit.maxAmount <= 0) continue;
    const label = familyLabel(benefit.description);
    const occurrences = benefit.occurrencesInCycle ?? 1;
    const existing = families.get(label);
    const perWindow = benefit.maxAmount * occurrences;
    if (existing) {
      existing.windows.push(...windows);
      existing.annual += perWindow * windows.length;
    } else {
      families.set(label, { key: benefit.catalogKey, label, perWindow, annual: perWindow * windows.length, windows: [...windows], cadence: '' });
    }
  }
  return Array.from(families.values())
    .map((row) => {
      const windows = row.windows.sort((left, right) => left.start - right.start);
      return { ...row, windows, cadence: cadenceFor(windows) };
    })
    .sort((left, right) => right.annual - left.annual)
    .slice(0, limit);
}

/** Fractional month position (0-12) of an instant inside its UTC year, for the "now" needle. */
export function yearPosition(now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return now.getUTCMonth() + (now.getTime() - start) / (end - start);
}
