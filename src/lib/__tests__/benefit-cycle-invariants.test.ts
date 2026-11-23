import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import {
  calculateStandaloneBenefitCycle,
  materializeBenefitStatusRows,
  materializeStandardBenefitStatusRows,
} from '@/lib/benefit-cycle-materialization';
import { validateStaticCatalog } from '@/lib/catalog/validation';
import { predefinedCardsData, type StaticPredefinedCard } from '@/lib/static-catalog';

const utc = (iso: string) => new Date(iso);
const day = (year: number, month: number, date: number) => new Date(Date.UTC(year, month - 1, date));
const lastMs = (iso: string) => new Date(new Date(iso).getTime() - 1);

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInstant(random: () => number, fromYear = 2020, toYear = 2032): Date {
  const from = Date.UTC(fromYear, 0, 1);
  const to = Date.UTC(toYear, 11, 31, 23, 59, 59, 999);
  return new Date(from + Math.floor(random() * (to - from)));
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('calendar boundaries (UTC)', () => {
  it.each([
    ['2026-01-31T23:59:59.999Z', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'],
    ['2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'],
    ['2026-02-28T23:59:59.999Z', '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'],
    ['2028-02-29T12:00:00.000Z', '2028-02-01T00:00:00.000Z', '2028-03-01T00:00:00.000Z'],
    ['2026-12-31T23:59:59.999Z', '2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'],
  ])('monthly cycle containing %s ends on the true last day of the month', (reference, start, nextStart) => {
    const cycle = calculateBenefitCycle(BenefitFrequency.MONTHLY, utc(reference), null);
    expect(cycle.cycleStartDate).toEqual(utc(start));
    expect(cycle.cycleEndDate).toEqual(lastMs(nextStart));
  });

  it.each([
    ['2026-03-31T23:59:59.999Z', '2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'],
    ['2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    ['2026-09-30T23:59:59.999Z', '2026-07-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'],
    ['2026-12-31T23:59:59.999Z', '2026-10-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'],
  ])('calendar quarter containing %s', (reference, start, nextStart) => {
    const cycle = calculateBenefitCycle(BenefitFrequency.QUARTERLY, utc(reference), null);
    expect(cycle.cycleStartDate).toEqual(utc(start));
    expect(cycle.cycleEndDate).toEqual(lastMs(nextStart));
  });

  it('assigns a late-evening Pacific Dec 31 instant to the January UTC cycle', () => {
    // 2026-12-31 23:30 in Los Angeles is 2027-01-01 07:30 UTC; cycles are UTC by contract.
    const pacificEvening = utc('2026-12-31T23:30:00-08:00');
    expect(calculateBenefitCycle(BenefitFrequency.MONTHLY, pacificEvening, null).cycleStartDate)
      .toEqual(utc('2027-01-01T00:00:00.000Z'));
    const tokyoMorning = utc('2027-01-01T08:00:00+09:00');
    expect(calculateBenefitCycle(BenefitFrequency.MONTHLY, tokyoMorning, null).cycleStartDate)
      .toEqual(utc('2026-12-01T00:00:00.000Z'));
  });
});

describe('CALENDAR_FIXED windows', () => {
  const fixed = (reference: Date, startMonth: number, duration: number, frequency: BenefitFrequency = BenefitFrequency.YEARLY) =>
    calculateBenefitCycle(frequency, reference, null, BenefitCycleAlignment.CALENDAR_FIXED, startMonth, duration);

  it('switches H1 to the next year exactly at Jul 1 00:00 UTC', () => {
    expect(fixed(utc('2026-06-30T23:59:59.999Z'), 1, 6)).toEqual({
      cycleStartDate: day(2026, 1, 1),
      cycleEndDate: utc('2026-06-30T23:59:59.999Z'),
    });
    expect(fixed(utc('2026-07-01T00:00:00.000Z'), 1, 6)).toEqual({
      cycleStartDate: day(2027, 1, 1),
      cycleEndDate: utc('2027-06-30T23:59:59.999Z'),
    });
  });

  it('keeps H2 open through Dec 31 23:59:59.999 and pre-materializes the next H2 on Jan 1', () => {
    expect(fixed(utc('2026-12-31T23:59:59.999Z'), 7, 6)).toEqual({
      cycleStartDate: day(2026, 7, 1),
      cycleEndDate: utc('2026-12-31T23:59:59.999Z'),
    });
    expect(fixed(utc('2027-01-01T00:00:00.000Z'), 7, 6)).toEqual({
      cycleStartDate: day(2027, 7, 1),
      cycleEndDate: utc('2027-12-31T23:59:59.999Z'),
    });
  });

  it('resolves a year-wrapping Nov-Jan window to the window that is open', () => {
    expect(fixed(day(2027, 1, 15), 11, 3)).toEqual({
      cycleStartDate: day(2026, 11, 1),
      cycleEndDate: utc('2027-01-31T23:59:59.999Z'),
    });
    expect(fixed(day(2027, 2, 1), 11, 3).cycleStartDate).toEqual(day(2027, 11, 1));
  });

  it('keeps a Jul-Jun annual window open in the spring', () => {
    expect(fixed(day(2027, 3, 10), 7, 12)).toEqual({
      cycleStartDate: day(2026, 7, 1),
      cycleEndDate: utc('2027-06-30T23:59:59.999Z'),
    });
  });

  it('covers a December-only window and pre-materializes next December afterward', () => {
    expect(fixed(day(2026, 12, 31), 12, 1)).toEqual({
      cycleStartDate: day(2026, 12, 1),
      cycleEndDate: utc('2026-12-31T23:59:59.999Z'),
    });
    expect(fixed(day(2027, 1, 1), 12, 1).cycleStartDate).toEqual(day(2027, 12, 1));
    expect(fixed(day(2026, 6, 1), 12, 1).cycleStartDate).toEqual(day(2026, 12, 1));
  });

  it.each([1, 2, 4, 7, 10, 12])('recurs quarterly from start month %i without gaps', (startMonth) => {
    let reference = day(2026, 1, 1);
    let previousEnd: Date | null = null;
    for (let step = 0; step < 8; step += 1) {
      const cycle = fixed(reference, startMonth, 3, BenefitFrequency.QUARTERLY);
      expect(cycle.cycleStartDate <= reference && reference <= cycle.cycleEndDate).toBe(true);
      if (previousEnd) expect(cycle.cycleStartDate.getTime()).toBe(previousEnd.getTime() + 1);
      previousEnd = cycle.cycleEndDate;
      reference = new Date(cycle.cycleEndDate.getTime() + 1);
    }
  });

  it('routes an unanchored multi-year CALENDAR_FIXED window through card anniversary', () => {
    const opened = day(2024, 2, 29);
    const cycle = calculateBenefitCycle(
      BenefitFrequency.YEARLY, day(2026, 11, 22), opened, BenefitCycleAlignment.CALENDAR_FIXED, 1, 48
    );
    expect(cycle).toEqual({
      cycleStartDate: day(2024, 2, 1),
      cycleEndDate: utc('2028-01-31T23:59:59.999Z'),
    });
  });
});

describe('CARD_ANNIVERSARY alignment', () => {
  const anniversary = (reference: Date, opened: Date | null, duration?: number) =>
    calculateBenefitCycle(
      BenefitFrequency.YEARLY, reference, opened, BenefitCycleAlignment.CARD_ANNIVERSARY, null, duration ?? null
    );

  it.each([
    [day(2024, 2, 29), utc('2025-01-31T23:59:59.999Z'), day(2024, 2, 1), '2025-01-31T23:59:59.999Z'],
    [day(2024, 2, 29), day(2025, 3, 1), day(2025, 2, 1), '2026-01-31T23:59:59.999Z'],
    [day(2024, 2, 29), day(2025, 2, 1), day(2025, 2, 1), '2026-01-31T23:59:59.999Z'],
    [day(2023, 1, 31), day(2026, 1, 31), day(2026, 1, 1), '2026-12-31T23:59:59.999Z'],
    [day(2023, 10, 31), day(2026, 9, 30), day(2025, 10, 1), '2026-09-30T23:59:59.999Z'],
    [day(2023, 12, 31), day(2026, 12, 31), day(2026, 12, 1), '2027-11-30T23:59:59.999Z'],
  ])('opened %p, reference %p: month-granular anniversary year', (opened, reference, start, end) => {
    expect(anniversary(reference, opened)).toEqual({ cycleStartDate: start, cycleEndDate: utc(end) });
  });

  it('falls back to the calendar year when the opened date is unknown', () => {
    expect(anniversary(day(2026, 12, 31), null)).toEqual({
      cycleStartDate: day(2026, 1, 1),
      cycleEndDate: utc('2026-12-31T23:59:59.999Z'),
    });
  });

  it.each([
    [48, day(2024, 2, 29), day(2028, 1, 31), day(2024, 2, 1), '2028-01-31T23:59:59.999Z'],
    [48, day(2024, 2, 29), day(2028, 2, 1), day(2028, 2, 1), '2032-01-31T23:59:59.999Z'],
    [54, day(2022, 7, 31), day(2026, 12, 31), day(2022, 7, 1), '2026-12-31T23:59:59.999Z'],
    [54, day(2022, 7, 31), day(2027, 1, 1), day(2027, 1, 1), '2031-06-30T23:59:59.999Z'],
    [60, day(2021, 5, 15), day(2026, 5, 1), day(2026, 5, 1), '2031-04-30T23:59:59.999Z'],
  ])('%i-month credit opened %s resolves at %s', (duration, opened, reference, start, end) => {
    expect(anniversary(reference, opened, duration)).toEqual({ cycleStartDate: start, cycleEndDate: utc(end) });
  });
});

describe('standalone custom benefit cycles', () => {
  it.each([
    ['2026-01-31', '2026-02-15', '2026-01-31', '2026-02-28'],
    ['2026-01-31', '2026-02-28', '2026-02-28', '2026-03-31'],
    ['2026-01-31', '2026-04-03', '2026-03-31', '2026-04-30'],
    ['2026-01-31', '2026-05-01', '2026-04-30', '2026-05-31'],
    ['2028-01-29', '2028-02-29', '2028-02-29', '2028-03-29'],
    ['2027-01-29', '2027-03-01', '2027-02-28', '2027-03-29'],
  ])('monthly from %s at %s clamps month ends without drifting', (start, reference, cycleStart, nextStart) => {
    const cycle = calculateStandaloneBenefitCycle(
      BenefitFrequency.MONTHLY, utc(`${reference}T12:00:00.000Z`), utc(`${start}T00:00:00.000Z`)
    );
    expect(cycle.cycleStartDate).toEqual(utc(`${cycleStart}T00:00:00.000Z`));
    expect(cycle.cycleEndDate).toEqual(lastMs(`${nextStart}T00:00:00.000Z`));
  });

  it('anchors a Feb 29 yearly custom benefit to Feb 28 in common years and Feb 29 in leap years', () => {
    const start = day(2024, 2, 29);
    expect(calculateStandaloneBenefitCycle(BenefitFrequency.YEARLY, day(2025, 3, 1), start).cycleStartDate)
      .toEqual(day(2025, 2, 28));
    expect(calculateStandaloneBenefitCycle(BenefitFrequency.YEARLY, day(2028, 3, 1), start).cycleStartDate)
      .toEqual(day(2028, 2, 29));
  });

  it('normalizes a time-of-day start so cycles stay contiguous', () => {
    const start = utc('2026-01-15T14:23:00.000Z');
    const first = calculateStandaloneBenefitCycle(BenefitFrequency.MONTHLY, utc('2026-01-20T00:00:00.000Z'), start);
    const second = calculateStandaloneBenefitCycle(BenefitFrequency.MONTHLY, utc('2026-02-15T14:23:00.000Z'), start);
    expect(first).toEqual({ cycleStartDate: day(2026, 1, 15), cycleEndDate: utc('2026-02-14T23:59:59.999Z') });
    expect(second.cycleStartDate.getTime()).toBe(first.cycleEndDate.getTime() + 1);

    const weekly = calculateStandaloneBenefitCycle(BenefitFrequency.WEEKLY, utc('2026-01-22T15:00:00.000Z'), start);
    expect(weekly).toEqual({ cycleStartDate: day(2026, 1, 22), cycleEndDate: utc('2026-01-28T23:59:59.999Z') });
  });

  it('returns the first cycle when the reference precedes the start date', () => {
    expect(calculateStandaloneBenefitCycle(BenefitFrequency.QUARTERLY, day(2025, 12, 1), day(2026, 1, 31))).toEqual({
      cycleStartDate: day(2026, 1, 31),
      cycleEndDate: utc('2026-04-29T23:59:59.999Z'),
    });
  });
});

describe('property: cycles tile time', () => {
  const random = mulberry32(0x5eed);

  const recurringConfigs: Array<{
    label: string;
    cycle: (reference: Date) => { cycleStartDate: Date; cycleEndDate: Date };
  }> = [
    { label: 'calendar month', cycle: (reference) => calculateBenefitCycle(BenefitFrequency.MONTHLY, reference, null) },
    { label: 'calendar quarter', cycle: (reference) => calculateBenefitCycle(BenefitFrequency.QUARTERLY, reference, null) },
    { label: 'calendar year', cycle: (reference) => calculateBenefitCycle(BenefitFrequency.YEARLY, reference, null) },
    {
      label: 'anniversary year (opened Feb 29)',
      cycle: (reference) => calculateBenefitCycle(BenefitFrequency.YEARLY, reference, day(2016, 2, 29)),
    },
    {
      label: '48-month anniversary',
      cycle: (reference) => calculateBenefitCycle(
        BenefitFrequency.YEARLY, reference, day(2016, 8, 31), BenefitCycleAlignment.CARD_ANNIVERSARY, null, 48
      ),
    },
    {
      label: 'quarterly CALENDAR_FIXED from February',
      cycle: (reference) => calculateBenefitCycle(
        BenefitFrequency.QUARTERLY, reference, null, BenefitCycleAlignment.CALENDAR_FIXED, 2, 3
      ),
    },
    {
      label: 'standalone monthly from the 31st',
      cycle: (reference) => calculateStandaloneBenefitCycle(BenefitFrequency.MONTHLY, reference, day(2016, 1, 31)),
    },
    {
      label: 'standalone quarterly from the 30th',
      cycle: (reference) => calculateStandaloneBenefitCycle(BenefitFrequency.QUARTERLY, reference, day(2016, 11, 30)),
    },
    {
      label: 'standalone yearly from Feb 29',
      cycle: (reference) => calculateStandaloneBenefitCycle(BenefitFrequency.YEARLY, reference, day(2016, 2, 29)),
    },
  ];

  it.each(recurringConfigs.map((config) => [config.label, config] as const))(
    '%s: the cycle contains the reference, starts at UTC midnight, and abuts its successor',
    (_label, config) => {
      for (let sample = 0; sample < 400; sample += 1) {
        const reference = randomInstant(random);
        const cycle = config.cycle(reference);
        expect(cycle.cycleStartDate <= reference && reference <= cycle.cycleEndDate).toBe(true);
        expect(cycle.cycleStartDate.getUTCHours() + cycle.cycleStartDate.getUTCMinutes()).toBe(0);
        expect(cycle.cycleStartDate.getUTCSeconds() + cycle.cycleStartDate.getUTCMilliseconds()).toBe(0);
        expect(config.cycle(reference)).toEqual(cycle);
        const next = config.cycle(new Date(cycle.cycleEndDate.getTime() + 1));
        expect(next.cycleStartDate.getTime()).toBe(cycle.cycleEndDate.getTime() + 1);
        expect(config.cycle(cycle.cycleStartDate)).toEqual(cycle);
        expect(config.cycle(cycle.cycleEndDate)).toEqual(cycle);
      }
    }
  );

  it.each([
    [1, 6], [7, 6], [1, 3], [4, 3], [7, 3], [10, 3], [12, 1], [11, 3], [7, 12], [1, 12],
  ])('one-window-per-year CALENDAR_FIXED %i/%i: the open or next window, never a stale one', (startMonth, duration) => {
    for (let sample = 0; sample < 300; sample += 1) {
      const reference = randomInstant(random);
      const cycle = calculateBenefitCycle(
        BenefitFrequency.YEARLY, reference, null, BenefitCycleAlignment.CALENDAR_FIXED, startMonth, duration
      );
      expect(cycle.cycleEndDate >= reference).toBe(true);
      expect(cycle.cycleStartDate.getUTCMonth()).toBe(startMonth - 1);
      expect(cycle.cycleStartDate.getUTCDate()).toBe(1);
      const span = (cycle.cycleEndDate.getUTCFullYear() - cycle.cycleStartDate.getUTCFullYear()) * 12 +
        cycle.cycleEndDate.getUTCMonth() - cycle.cycleStartDate.getUTCMonth() + 1;
      expect(span).toBe(duration);
      if (cycle.cycleStartDate > reference) {
        const previousEnd = new Date(Date.UTC(cycle.cycleStartDate.getUTCFullYear() - 1, startMonth - 1 + duration, 1) - 1);
        expect(previousEnd < reference).toBe(true);
      }
    }
  });
});

describe('materialization coordinates', () => {
  it('materializes one row per occurrence with shared coordinates', () => {
    const result = materializeStandardBenefitStatusRows(
      {
        id: 'pb-uber',
        frequency: BenefitFrequency.MONTHLY,
        startDate: day(2025, 3, 31),
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        occurrencesInCycle: 2,
      },
      { userId: 'user-1', creditCardId: 'card-1' },
      { referenceDate: utc('2026-12-31T23:59:59.999Z'), cardOpenedDate: day(2025, 3, 31) }
    );
    expect(result.rows.map((row) => row.occurrenceIndex)).toEqual([0, 1]);
    expect(new Set(result.rows.map((row) => row.cycleStartDate.toISOString()))).toEqual(new Set(['2026-12-01T00:00:00.000Z']));
    expect(new Set(result.rows.map((row) => row.cycleEndDate.toISOString()))).toEqual(new Set(['2026-12-31T23:59:59.999Z']));
  });

  it.each([0, 13, 1.5])('rejects occurrencesInCycle %p', (occurrencesInCycle) => {
    expect(() => materializeBenefitStatusRows(
      { id: 'b', userId: 'u', frequency: BenefitFrequency.MONTHLY, occurrencesInCycle },
      { referenceDate: day(2026, 1, 1) }
    )).toThrow('invalid occurrencesInCycle');
  });

  it('skips a yearly anniversary credit (including multi-year) when the opened date is unknown', () => {
    for (const fixedCycleDurationMonths of [null, 48]) {
      const result = materializeStandardBenefitStatusRows(
        { id: 'pb-ge', frequency: BenefitFrequency.YEARLY, cycleAlignment: null, fixedCycleDurationMonths },
        { userId: 'user-1', creditCardId: 'card-1' },
        { referenceDate: day(2026, 6, 1), cardOpenedDate: null }
      );
      expect(result.rows).toEqual([]);
      expect(result.warnings).toEqual([expect.stringContaining('no card opened date')]);
    }
  });

  it('materializes a calendar-fixed annual credit even without an opened date', () => {
    const result = materializeStandardBenefitStatusRows(
      {
        id: 'pb-airline',
        frequency: BenefitFrequency.YEARLY,
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        fixedCycleStartMonth: 1,
        fixedCycleDurationMonths: 12,
      },
      { userId: 'user-1', creditCardId: 'card-1' },
      { referenceDate: day(2026, 12, 31), cardOpenedDate: null }
    );
    expect(result.rows).toEqual([expect.objectContaining({
      cycleStartDate: day(2026, 1, 1),
      cycleEndDate: utc('2026-12-31T23:59:59.999Z'),
    })]);
  });

  it('materializes every catalog benefit at every month boundary of 2028 without error', () => {
    const references = Array.from({ length: 12 }, (_, month) => [
      new Date(Date.UTC(2028, month, 1)),
      new Date(Date.UTC(2028, month + 1, 1) - 1),
    ]).flat();
    for (const card of predefinedCardsData) {
      for (const benefit of card.benefits) {
        for (const referenceDate of references) {
          for (const cardOpenedDate of [day(2024, 2, 29), day(2023, 8, 31)]) {
            const { rows } = materializeStandardBenefitStatusRows(
              { ...benefit, id: benefit.catalogKey, startDate: cardOpenedDate } as never,
              { userId: 'u', creditCardId: 'c' },
              { referenceDate, cardOpenedDate, validateCycles: true }
            );
            expect(rows).toHaveLength((benefit as { occurrencesInCycle?: number }).occurrencesInCycle ?? 1);
            for (const row of rows) {
              expect(row.cycleEndDate > row.cycleStartDate).toBe(true);
              if (benefit.frequency !== 'ONE_TIME') expect(row.cycleEndDate >= referenceDate).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe('catalog cycle definitions', () => {
  const copy = () => JSON.parse(JSON.stringify(predefinedCardsData)) as StaticPredefinedCard[];
  const nonAmexBenefit = (cards: StaticPredefinedCard[]) =>
    cards.find((card) => card.issuer !== 'American Express')!.benefits[0] as unknown as Record<string, unknown>;

  it('rejects an unanchored multi-year CALENDAR_FIXED window', () => {
    const cards = copy();
    Object.assign(nonAmexBenefit(cards), { cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth: 1, fixedCycleDurationMonths: 48 });
    expect(() => validateStaticCatalog(cards)).toThrow('CALENDAR_FIXED');
  });

  it.each([0, 13])('rejects fixedCycleStartMonth %i', (fixedCycleStartMonth) => {
    const cards = copy();
    Object.assign(nonAmexBenefit(cards), { cycleAlignment: 'CALENDAR_FIXED', fixedCycleStartMonth, fixedCycleDurationMonths: 6 });
    expect(() => validateStaticCatalog(cards)).toThrow('fixedCycleStartMonth');
  });
});
