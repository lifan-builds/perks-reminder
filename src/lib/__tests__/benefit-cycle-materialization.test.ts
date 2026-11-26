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
