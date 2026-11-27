// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import {
  calculateStandaloneBenefitCycle,
  materializeBenefitStatusRows,
  materializeStandardBenefitStatusRows,
} from '../benefit-cycle-materialization';

const utc = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('calculateStandaloneBenefitCycle', () => {
  it('uses calendar month boundaries from the custom benefit start date', () => {
    const cycle = calculateStandaloneBenefitCycle(
      BenefitFrequency.MONTHLY,
      utc('2026-03-20'),
      utc('2026-01-15')
    );

    expect(cycle.cycleStartDate).toEqual(utc('2026-03-15'));
    expect(cycle.cycleEndDate).toEqual(new Date('2026-04-14T23:59:59.999Z'));
  });

  it('returns the first scheduled cycle when the reference date is before the start date', () => {
    const cycle = calculateStandaloneBenefitCycle(
      BenefitFrequency.QUARTERLY,
      utc('2026-01-01'),
      utc('2026-02-10')
    );

    expect(cycle.cycleStartDate).toEqual(utc('2026-02-10'));
    expect(cycle.cycleEndDate).toEqual(new Date('2026-05-09T23:59:59.999Z'));
  });
});

describe('materializeBenefitStatusRows', () => {
  it('normalizes cycle starts and expands occurrences for card benefits', () => {
    const result = materializeBenefitStatusRows(
      {
        id: 'benefit-1',
        userId: 'user-1',
        description: 'Q2: Apr-Jun Credit',
        frequency: BenefitFrequency.QUARTERLY,
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        fixedCycleStartMonth: 4,
        fixedCycleDurationMonths: 3,
        occurrencesInCycle: 2,
      },
      {
        referenceDate: utc('2026-04-15'),
        cardOpenedDate: utc('2025-01-15'),
        validateCycles: true,
      }
    );

    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      benefitId: 'benefit-1',
      userId: 'user-1',
      cycleStartDate: utc('2026-04-01'),
      cycleEndDate: new Date('2026-06-30T23:59:59.999Z'),
      occurrenceIndex: 0,
    });
    expect(result.rows[1].occurrenceIndex).toBe(1);
  });

  it.each([
    ['card-linked', 'card-1', '2026-04-01', '2026-04-30'],
    ['standalone', null, '2026-04-15', '2026-05-14'],
  ])('materializes a %s monthly benefit without a card opened date', (_, creditCardId, start, end) => {
    const result = materializeBenefitStatusRows(
      {
        id: 'benefit-1',
        userId: 'user-1',
        creditCardId,
        frequency: BenefitFrequency.MONTHLY,
        startDate: utc('2026-01-15'),
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      },
      { referenceDate: utc('2026-04-20'), cardOpenedDate: null }
    );

    expect(result.rows).toEqual([expect.objectContaining({
      cycleStartDate: utc(start),
      cycleEndDate: new Date(`${end}T23:59:59.999Z`),
    })]);
  });

  it('skips an undated ONE_TIME benefit cleanly so daily runs never shift coordinates', () => {
    const dec31 = materializeBenefitStatusRows(
      { id: 'benefit-1', userId: 'user-1', frequency: BenefitFrequency.ONE_TIME },
      { referenceDate: utc('2026-12-31') }
    );
    const jan1 = materializeBenefitStatusRows(
      { id: 'benefit-1', userId: 'user-1', frequency: BenefitFrequency.ONE_TIME },
      { referenceDate: utc('2027-01-01') }
    );

    expect(dec31.rows).toEqual([]);
    expect(jan1.rows).toEqual([]);
    expect(dec31.warnings).toEqual([expect.stringContaining('no start date or card opened date')]);
    expect(jan1.warnings).toEqual(dec31.warnings);
  });

  it('anchors a ONE_TIME benefit without startDate to durable cardOpenedDate and clamps Feb 29 expiry', () => {
    const dec31 = materializeBenefitStatusRows(
      { id: 'benefit-1', userId: 'user-1', creditCardId: 'card-1', frequency: BenefitFrequency.ONE_TIME },
      { cardOpenedDate: utc('2024-02-29'), referenceDate: utc('2026-12-31') }
    );
    const jan1 = materializeBenefitStatusRows(
      { id: 'benefit-1', userId: 'user-1', creditCardId: 'card-1', frequency: BenefitFrequency.ONE_TIME },
      { cardOpenedDate: utc('2024-02-29'), referenceDate: utc('2027-01-01') }
    );

    expect(jan1.rows).toEqual(dec31.rows);
    expect(dec31.rows).toEqual([expect.objectContaining({
      cycleStartDate: utc('2024-02-29'),
      cycleEndDate: new Date('2034-02-28T23:59:59.999Z'),
    })]);
  });

  it.each([
    [BenefitFrequency.YEARLY, 7, 6, '2026-07-01', '2026-12-31T23:59:59.999Z'],
    [BenefitFrequency.QUARTERLY, 1, 3, '2026-07-01', '2026-09-30T23:59:59.999Z'],
    [BenefitFrequency.QUARTERLY, 11, 3, '2026-05-01', '2026-07-31T23:59:59.999Z'],
  ] as const)(
    'honors explicit standalone CALENDAR_FIXED window (%s start=%i dur=%i) without creditCardId or cardOpenedDate',
    (frequency, fixedCycleStartMonth, fixedCycleDurationMonths, expectedStart, expectedEnd) => {
      const result = materializeBenefitStatusRows(
        {
          id: 'benefit-1',
          userId: 'user-1',
          frequency,
          startDate: utc('2026-02-15'),
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth,
          fixedCycleDurationMonths,
        },
        { referenceDate: utc('2026-07-01') }
      );

      expect(result.rows).toEqual([expect.objectContaining({
        cycleStartDate: utc(expectedStart),
        cycleEndDate: new Date(expectedEnd),
      })]);
    }
  );

  it.each([
    [48, '2024-05-01', '2026-07-01', '2024-05-01', '2028-04-30T23:59:59.999Z'],
    [54, '2022-07-01', '2026-07-01', '2022-07-01', '2026-12-31T23:59:59.999Z'],
    [54, '2022-07-01', '2027-01-01', '2027-01-01', '2031-06-30T23:59:59.999Z'],
    [48, '2024-02-29', '2026-07-01', '2024-02-29', '2028-02-28T23:59:59.999Z'],
    [54, '2024-02-29', '2026-07-01', '2024-02-29', '2028-08-28T23:59:59.999Z'],
  ] as const)(
    'preserves %i-month CARD_ANNIVERSARY duration when falling back to startDate %s at %s',
    (fixedCycleDurationMonths, startDate, referenceDate, expectedStart, expectedEnd) => {
      const result = materializeBenefitStatusRows(
        {
          id: 'benefit-1',
          userId: 'user-1',
          creditCardId: 'card-1',
          frequency: BenefitFrequency.YEARLY,
          startDate: utc(startDate),
          cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
          fixedCycleDurationMonths,
        },
        { cardOpenedDate: null, referenceDate: utc(referenceDate) }
      );

      expect(result.rows).toEqual([expect.objectContaining({
        cycleStartDate: utc(expectedStart),
        cycleEndDate: new Date(expectedEnd),
      })]);
    }
  );
});

describe('materializeStandardBenefitStatusRows', () => {
  it('uses the configured calendar window without a card opened date', () => {
    const result = materializeStandardBenefitStatusRows(
      {
        id: 'benefit-1',
        frequency: BenefitFrequency.QUARTERLY,
        startDate: utc('2026-01-15'),
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        fixedCycleStartMonth: 2,
        fixedCycleDurationMonths: 3,
      },
      { userId: 'user-1', creditCardId: 'card-1' },
      { referenceDate: utc('2026-06-20'), cardOpenedDate: null }
    );

    expect(result.rows).toEqual([expect.objectContaining({
      cycleStartDate: utc('2026-05-01'),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
    })]);
  });
});
