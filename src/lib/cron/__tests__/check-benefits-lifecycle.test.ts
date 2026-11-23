// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { insertMissingBenefitStatuses } from '@/lib/cron/check-benefits';
import { claimWindowEntryAutoClaims } from '@/lib/benefit-tracking-preferences';
import {
  planBenefitStatusMaterialization,
  type StandardMaterializationDefinition,
} from '@/lib/global-benefit-materialization';

interface StoredStatus {
  id: string;
  userId: string;
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  isCompleted: boolean;
  completedAt: Date | null;
  usedAmount: number;
  claimSource: string | null;
  isNotUsable: boolean;
  notes: string | null;
  orderIndex: number | null;
}

interface Preference {
  userId: string;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  benefitId: string | null;
  mode: 'TRACK' | 'IGNORE' | 'AUTO_CLAIM';
}

const store: { statuses: StoredStatus[]; preferences: Preference[]; maxAmounts: Map<string, number> } = {
  statuses: [],
  preferences: [],
  maxAmounts: new Map(),
};

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'OR') return (condition as Where[]).some((branch) => matches(row, branch));
    const value = row[field];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const operators = condition as Record<string, unknown>;
      if ('gte' in operators && !((value as Date) >= (operators.gte as Date))) return false;
      if ('lte' in operators && !((value as Date) <= (operators.lte as Date))) return false;
      if ('in' in operators && !(operators.in as unknown[]).includes(value)) return false;
      if ('not' in operators && value === operators.not) return false;
      return true;
    }
    return condition instanceof Date ? (value as Date).getTime() === condition.getTime() : value === condition;
  });
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    benefitStatus: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        store.statuses.filter((row) => matches(row as never, where)).map((row) => ({ ...row }))),
      createMany: jest.fn(async ({ data }: { data: Omit<StoredStatus, 'id' | 'notes'>[] }) => {
        let count = 0;
        for (const row of data) {
          const duplicate = store.statuses.some((existing) =>
            existing.userId === row.userId &&
            existing.benefitId === row.benefitId &&
            existing.creditCardId === row.creditCardId &&
            existing.predefinedBenefitId === row.predefinedBenefitId &&
            existing.occurrenceIndex === row.occurrenceIndex &&
            existing.cycleStartDate.getTime() === row.cycleStartDate.getTime());
          if (duplicate) continue;
          store.statuses.push({ ...row, id: `status-${store.statuses.length + 1}`, notes: null });
          count += 1;
        }
        return { count };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<StoredStatus> }) => {
        const targets = store.statuses.filter((row) => matches(row as never, where));
        targets.forEach((row) => Object.assign(row, data));
        return { count: targets.length };
      }),
    },
    benefitTrackingPreference: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        store.preferences.filter((row) => matches(row as never, where))),
    },
    predefinedBenefit: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, maxAmount: store.maxAmounts.get(id) ?? null }))),
    },
    benefit: { findMany: jest.fn(async () => []) },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require('@/lib/prisma');

const definitions: StandardMaterializationDefinition[] = [
  {
    id: 'pb-monthly-uber',
    userId: 'user-1',
    creditCardId: 'card-1',
    cardOpenedDate: new Date('2024-02-29T00:00:00.000Z'),
    description: '$15 Monthly Uber Cash',
    frequency: BenefitFrequency.MONTHLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
  },
  {
    id: 'pb-saks-h2',
    userId: 'user-1',
    creditCardId: 'card-1',
    cardOpenedDate: new Date('2024-02-29T00:00:00.000Z'),
    description: '$50 Saks Credit (Jul-Dec)',
    frequency: BenefitFrequency.YEARLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: 7,
    fixedCycleDurationMonths: 6,
    occurrencesInCycle: 1,
  },
  {
    id: 'pb-twice-monthly',
    userId: 'user-1',
    creditCardId: 'card-1',
    cardOpenedDate: new Date('2024-02-29T00:00:00.000Z'),
    description: 'Two $5 credits per month',
    frequency: BenefitFrequency.MONTHLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 2,
  },
  {
    id: 'pb-global-entry',
    userId: 'user-1',
    creditCardId: 'card-1',
    cardOpenedDate: new Date('2024-02-29T00:00:00.000Z'),
    description: 'Global Entry (every 4 years)',
    frequency: BenefitFrequency.YEARLY,
    cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: 48,
    occurrencesInCycle: 1,
  },
];

/** Mirrors the cron's candidate query: a source is due when an occurrence has no row ending at or after now. */
function dueDefinitions(now: Date) {
  return definitions.filter((definition) =>
    Array.from({ length: definition.occurrencesInCycle ?? 1 }, (_, index) => index).some((occurrenceIndex) =>
      !store.statuses.some((row) =>
        row.predefinedBenefitId === definition.id &&
        row.creditCardId === definition.creditCardId &&
        row.occurrenceIndex === occurrenceIndex &&
        row.cycleEndDate >= now)));
}

async function runCron(now: Date) {
  const plan = planBenefitStatusMaterialization(dueDefinitions(now), [], now);
  const result = await insertMissingBenefitStatuses(plan.rows, now);
  const claimed = await claimWindowEntryAutoClaims(prisma, now);
  return { ...result, claimed, planned: plan.rows.length };
}

const snapshot = () => JSON.stringify(store.statuses);

beforeEach(() => {
  store.statuses = [];
  store.preferences = [];
  store.maxAmounts = new Map([['pb-monthly-uber', 15], ['pb-saks-h2', 50], ['pb-twice-monthly', 5], ['pb-global-entry', 120]]);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('check-benefits lifecycle', () => {
  it('is idempotent: a second run on the same instant writes nothing', async () => {
    const now = new Date('2026-12-15T05:00:00.000Z');
    const first = await runCron(now);
    expect(first.inserted).toBe(5);
    const afterFirst = snapshot();

    const second = await runCron(now);
    expect(second).toEqual({ inserted: 0, discrepancies: [], claimed: 0, planned: 0 });
    expect(snapshot()).toBe(afterFirst);
  });

  it('runs every day of a year with no discrepancies, contiguous monthly cycles, and one row per occurrence', async () => {
    for (let dayIndex = 0; dayIndex < 366; dayIndex += 1) {
      const result = await runCron(new Date(Date.UTC(2027, 0, 1 + dayIndex, 5)));
      expect(result.discrepancies).toEqual([]);
    }
    const uber = store.statuses
      .filter((row) => row.predefinedBenefitId === 'pb-monthly-uber')
      .sort((left, right) => left.cycleStartDate.getTime() - right.cycleStartDate.getTime());
    expect(uber).toHaveLength(13);
    uber.slice(1).forEach((row, index) => {
      expect(row.cycleStartDate.getTime()).toBe(uber[index].cycleEndDate.getTime() + 1);
    });
    const twice = store.statuses.filter((row) => row.predefinedBenefitId === 'pb-twice-monthly');
    expect(twice.filter((row) => row.occurrenceIndex === 0)).toHaveLength(13);
    expect(twice.filter((row) => row.occurrenceIndex === 1)).toHaveLength(13);
    expect(store.statuses.filter((row) => row.predefinedBenefitId === 'pb-global-entry')).toHaveLength(1);
  });

  it('catches up after missed days by materializing the cycle that is open now', async () => {
    await runCron(new Date('2026-10-03T05:00:00.000Z'));
    const result = await runCron(new Date('2026-12-09T05:00:00.000Z'));
    expect(result.discrepancies).toEqual([]);
    const december = store.statuses.find((row) =>
      row.predefinedBenefitId === 'pb-monthly-uber' && row.cycleStartDate.toISOString() === '2026-12-01T00:00:00.000Z');
    expect(december?.cycleEndDate.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('preserves historical usage state on every later refresh', async () => {
    await runCron(new Date('2026-11-10T05:00:00.000Z'));
    const november = store.statuses.find((row) => row.predefinedBenefitId === 'pb-monthly-uber')!;
    Object.assign(november, {
      usedAmount: 9.5,
      isCompleted: false,
      notes: 'Used $9.50 on Uber Eats',
      claimSource: 'USER',
    });
    const notUsable = store.statuses.find((row) => row.predefinedBenefitId === 'pb-saks-h2')!;
    Object.assign(notUsable, { isNotUsable: true, claimSource: 'USER' });
    const completed = store.statuses.find((row) => row.predefinedBenefitId === 'pb-twice-monthly')!;
    const completedAt = new Date('2026-11-12T18:00:00.000Z');
    Object.assign(completed, { isCompleted: true, completedAt, usedAmount: 5, claimSource: 'USER' });
    const frozen = JSON.stringify([november, notUsable, completed]);

    for (const iso of ['2026-11-30T23:59:59.999Z', '2026-12-01T05:00:00.000Z', '2027-01-01T05:00:00.000Z', '2027-07-01T05:00:00.000Z']) {
      await runCron(new Date(iso));
    }
    expect(JSON.stringify([november, notUsable, completed])).toBe(frozen);
  });

  it('auto-claims an open cycle once and defers a pre-materialized future window until it opens', async () => {
    store.preferences = [{
      userId: 'user-1', creditCardId: 'card-1', predefinedBenefitId: 'pb-saks-h2', benefitId: null, mode: 'AUTO_CLAIM',
    }];

    await runCron(new Date('2027-01-05T05:00:00.000Z'));
    const futureH2 = store.statuses.find((row) => row.predefinedBenefitId === 'pb-saks-h2')!;
    expect(futureH2.cycleStartDate.toISOString()).toBe('2027-07-01T00:00:00.000Z');
    expect(futureH2).toMatchObject({ isCompleted: false, usedAmount: 0, claimSource: null });

    const opening = new Date('2027-07-01T05:00:00.000Z');
    expect((await runCron(opening)).claimed).toBe(1);
    expect(futureH2).toMatchObject({ isCompleted: true, usedAmount: 50, claimSource: 'AUTO', completedAt: opening });

    const afterClaim = snapshot();
    expect((await runCron(new Date('2027-07-02T05:00:00.000Z'))).claimed).toBe(0);
    expect(snapshot()).toBe(afterClaim);
  });

  it('never re-claims a cycle the user reopened', async () => {
    store.preferences = [{
      userId: 'user-1', creditCardId: 'card-1', predefinedBenefitId: 'pb-monthly-uber', benefitId: null, mode: 'AUTO_CLAIM',
    }];
    await runCron(new Date('2026-12-02T05:00:00.000Z'));
    const december = store.statuses.find((row) => row.predefinedBenefitId === 'pb-monthly-uber')!;
    expect(december).toMatchObject({ isCompleted: true, usedAmount: 15, claimSource: 'AUTO' });

    Object.assign(december, { isCompleted: false, completedAt: null, usedAmount: 0, claimSource: 'USER' });
    await runCron(new Date('2026-12-03T05:00:00.000Z'));
    expect(december).toMatchObject({ isCompleted: false, usedAmount: 0, claimSource: 'USER' });
  });
});
