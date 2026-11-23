// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { getPublicStaticCards } from '@/lib/static-catalog';
import {
  buildYearEndRescue,
  chargeByDate,
  closesAtYearEnd,
  daysUntil,
  isRescueSeason,
  yearEndDeadline,
  yearEndWindow,
} from '@/lib/year-end-rescue';

const cards = getPublicStaticCards();

describe('year-end rescue', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('charges four days early by default so the post date clears before Jan 1', () => {
    expect(chargeByDate(2026, 4)).toBe('2026-12-27');
    expect(chargeByDate(2026, 7)).toBe('2026-12-24');
    expect(yearEndDeadline(2026).toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('opens the rescue season on Nov 1 UTC and closes it at the deadline', () => {
    expect(isRescueSeason(new Date('2026-10-31T23:59:59.999Z'))).toBe(false);
    expect(isRescueSeason(new Date('2026-11-01T00:00:00.000Z'))).toBe(true);
    expect(isRescueSeason(new Date('2026-12-31T23:59:59.999Z'))).toBe(true);
    expect(isRescueSeason(new Date('2027-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('counts whole UTC days', () => {
    expect(daysUntil(new Date('2026-12-27T23:00:00Z'), '2026-12-27')).toBe(0);
    expect(daysUntil(new Date('2026-11-22T10:00:00Z'), '2026-12-27')).toBe(35);
    expect(daysUntil(new Date('2026-12-28T00:00:00Z'), '2026-12-27')).toBe(-1);
  });

  it.each([
    [{ frequency: 'MONTHLY' }, 'december'],
    [{ frequency: 'QUARTERLY' }, 'q4'],
    [{ frequency: 'QUARTERLY', cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 2, fixedCycleDurationMonths: 3 }, null],
    [{ frequency: 'YEARLY', cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 7, fixedCycleDurationMonths: 6 }, 'h2'],
    [{ frequency: 'YEARLY', cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 1, fixedCycleDurationMonths: 6 }, null],
    [{ frequency: 'YEARLY', cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 10, fixedCycleDurationMonths: 3 }, 'q4'],
    [{ frequency: 'YEARLY', cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 12, fixedCycleDurationMonths: 1 }, 'december'],
    [{ frequency: 'YEARLY', cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 1, fixedCycleDurationMonths: 12 }, 'calendar-year'],
    [{ frequency: 'YEARLY', cycleAlignment: 'CARD_ANNIVERSARY' }, null],
    [{ frequency: 'YEARLY', cycleAlignment: 'CARD_ANNIVERSARY', fixedCycleDurationMonths: 48 }, null],
  ])('classifies %p as %p', (benefit, window) => {
    expect(yearEndWindow(benefit as never)).toBe(window);
  });

  it('agrees with the Benefit Cycle engine: every rescue credit closes exactly at the deadline', () => {
    const rescue = buildYearEndRescue(cards, 2026);
    const benefits = new Map(cards.flatMap((card) => card.benefits.map((benefit) => [benefit.catalogKey, benefit] as const)));
    expect(rescue.credits.length).toBeGreaterThan(40);
    for (const credit of rescue.credits) {
      const benefit = benefits.get(credit.key)!;
      const cycle = calculateBenefitCycle(
        BenefitFrequency[benefit.frequency],
        new Date('2026-12-15T12:00:00Z'),
        new Date('2024-05-10T00:00:00Z'),
        benefit.cycleAlignment ? BenefitCycleAlignment[benefit.cycleAlignment] : null,
        benefit.fixedCycleStartMonth ?? null,
        benefit.fixedCycleDurationMonths ?? null
      );
      expect({ key: credit.key, closes: closesAtYearEnd(cycle.cycleEndDate, 2026) }).toEqual({ key: credit.key, closes: true });
    }
  });

  it('never misses a calendar credit the engine says closes Dec 31', () => {
    const rescueKeys = new Set(buildYearEndRescue(cards, 2026).credits.map((credit) => credit.key));
    for (const card of cards) {
      for (const benefit of card.benefits) {
        if (benefit.frequency === 'ONE_TIME' || benefit.frequency === 'WEEKLY') continue;
        if (benefit.frequency === 'YEARLY' && benefit.cycleAlignment !== 'CALENDAR_FIXED') continue;
        if (benefit.sunsetAfter && benefit.sunsetAfter < '2026-12-31') continue;
        const cycle = calculateBenefitCycle(
          BenefitFrequency[benefit.frequency],
          new Date('2026-12-15T12:00:00Z'),
          null,
          benefit.cycleAlignment ? BenefitCycleAlignment[benefit.cycleAlignment] : null,
          benefit.fixedCycleStartMonth ?? null,
          benefit.fixedCycleDurationMonths ?? null
        );
        if (closesAtYearEnd(cycle.cycleEndDate, 2026)) expect(rescueKeys.has(benefit.catalogKey)).toBe(true);
      }
    }
  });

  it('marks a credit that ends for good and carries a Jan 1 change note', () => {
    const rescue = buildYearEndRescue(cards, 2026);
    expect(rescue.credits.find((credit) => credit.key === 'benefit:csr:250-select-chase-travel-hotel-credit-through-12-31-2026'))
      .toEqual(expect.objectContaining({ endsForGood: true, window: 'calendar-year', amount: 250 }));
    expect(rescue.credits.find((credit) => credit.key === 'benefit:sapphire-reserve-business:500-the-edit-credit')?.changeNote)
      .toContain('$1,000');
  });

  it('drops offers that ended before the year closes and multiplies occurrences', () => {
    const rescue2027 = buildYearEndRescue(cards, 2027);
    expect(rescue2027.credits.some((credit) => credit.key.includes('select-chase-travel-hotel-credit'))).toBe(false);
    const edit = buildYearEndRescue(cards, 2026).credits.find((credit) => credit.key === 'benefit:csr:250-the-edit-credit-up-to-2-prepaid-bookings-annually');
    expect(edit).toBeUndefined();
  });

  it('reports anniversary credits separately because their reset depends on the open date', () => {
    const rescue = buildYearEndRescue(cards, 2026);
    expect(rescue.anniversaryCredits.find((entry) => entry.cardCatalogKey === 'card:venture-x')?.count).toBe(3);
  });
});
