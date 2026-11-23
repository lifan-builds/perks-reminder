import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { calculateBenefitCycle, calculateOneTimeBenefitLifetime } from '@/lib/benefit-cycle';
import { normalizeCycleDate } from '@/lib/dateUtils';
import { validateBenefitCycle } from '@/lib/benefit-validation';

export interface BenefitCycleMaterializationInput {
  id: string;
  userId: string;
  frequency: BenefitFrequency;
  startDate?: Date | null;
  description?: string;
  cycleAlignment?: BenefitCycleAlignment | null;
  fixedCycleStartMonth?: number | null;
  fixedCycleDurationMonths?: number | null;
  occurrencesInCycle?: number | null;
}

export interface BenefitStatusMaterializationOptions {
  referenceDate?: Date;
  cardOpenedDate?: Date | null;
  validateCycles?: boolean;
}

export interface BenefitCycleCoordinates {
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
}

export interface MaterializedBenefitStatusRow extends BenefitCycleCoordinates {
  benefitId: string;
  userId: string;
}

export interface MaterializedStandardBenefitStatusRow extends BenefitCycleCoordinates {
  creditCardId: string;
  predefinedBenefitId: string;
  userId: string;
}

export interface BenefitStatusMaterializationResult {
  rows: MaterializedBenefitStatusRow[];
  warnings: string[];
}

export interface StandardBenefitStatusMaterializationResult {
  rows: MaterializedStandardBenefitStatusRow[];
  warnings: string[];
}

const MAX_OCCURRENCES_IN_CYCLE = 12;

function deriveBenefitCycleCoordinates(
  benefit: Omit<BenefitCycleMaterializationInput, 'userId'>,
  options: BenefitStatusMaterializationOptions = {}
): { rows: BenefitCycleCoordinates[]; warnings: string[] } {
  const referenceDate = options.referenceDate ?? new Date();
  const occurrences = benefit.occurrencesInCycle ?? 1;
  const warnings: string[] = [];

  if (
    !Number.isInteger(occurrences) ||
    occurrences < 1 ||
    occurrences > MAX_OCCURRENCES_IN_CYCLE
  ) {
    throw new Error(
      `Benefit ${benefit.id} has invalid occurrencesInCycle; expected an integer from 1 to ${MAX_OCCURRENCES_IN_CYCLE}.`
    );
  }

  if (
    benefit.frequency === BenefitFrequency.YEARLY &&
    benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED &&
    !options.cardOpenedDate &&
    !benefit.startDate
  ) {
    warnings.push(`Skipping yearly anniversary benefit ${benefit.id}: no card opened date or start date.`);
    return { rows: [], warnings };
  }

  const cycleInfo = calculateMaterializedCycle(benefit, referenceDate, options.cardOpenedDate ?? null);

  if (options.validateCycles && benefit.frequency !== BenefitFrequency.ONE_TIME) {
    const validation = validateBenefitCycle(
      {
        description: benefit.description ?? `Benefit ${benefit.id}`,
        fixedCycleStartMonth: benefit.fixedCycleStartMonth,
        fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
      },
      cycleInfo
    );

    if (!validation.isValid) {
      warnings.push(validation.error ?? `Benefit ${benefit.id} failed cycle validation.`);
    }
  }

  return {
    rows: Array.from({ length: occurrences }, (_, occurrenceIndex) => ({
      cycleStartDate: cycleInfo.cycleStartDate,
      cycleEndDate: cycleInfo.cycleEndDate,
      occurrenceIndex,
    })),
    warnings,
  };
}

export function materializeBenefitStatusRows(
  benefit: BenefitCycleMaterializationInput,
  options: BenefitStatusMaterializationOptions = {}
): BenefitStatusMaterializationResult {
  const materialized = deriveBenefitCycleCoordinates(benefit, options);
  return {
    rows: materialized.rows.map((row) => ({
      ...row,
      benefitId: benefit.id,
      userId: benefit.userId,
    })),
    warnings: materialized.warnings,
  };
}

export function materializeStandardBenefitStatusRows(
  benefit: Omit<BenefitCycleMaterializationInput, 'userId'>,
  owner: { userId: string; creditCardId: string },
  options: BenefitStatusMaterializationOptions = {}
): StandardBenefitStatusMaterializationResult {
  const materialized = deriveBenefitCycleCoordinates(benefit, options);
  return {
    rows: materialized.rows.map((row) => ({
      ...row,
      predefinedBenefitId: benefit.id,
      creditCardId: owner.creditCardId,
      userId: owner.userId,
    })),
    warnings: materialized.warnings,
  };
}

function calculateMaterializedCycle(
  benefit: Omit<BenefitCycleMaterializationInput, 'userId'>,
  referenceDate: Date,
  cardOpenedDate: Date | null
): { cycleStartDate: Date; cycleEndDate: Date } {
  let cycle: { cycleStartDate: Date; cycleEndDate: Date };
  if (benefit.frequency === BenefitFrequency.ONE_TIME) {
    cycle = calculateOneTimeBenefitLifetime(benefit.startDate ?? referenceDate);
  } else if (!cardOpenedDate && benefit.startDate) {
    cycle = calculateStandaloneBenefitCycle(benefit.frequency, referenceDate, benefit.startDate);
  } else {
    cycle = calculateBenefitCycle(
      benefit.frequency,
      referenceDate,
      cardOpenedDate,
      benefit.cycleAlignment,
      benefit.fixedCycleStartMonth,
      benefit.fixedCycleDurationMonths
    );
  }

  return {
    cycleStartDate: normalizeCycleDate(cycle.cycleStartDate),
    cycleEndDate: cycle.cycleEndDate,
  };
}

export function calculateStandaloneBenefitCycle(
  frequency: BenefitFrequency,
  referenceDate: Date,
  startDate: Date
): { cycleStartDate: Date; cycleEndDate: Date } {
  if (frequency === BenefitFrequency.ONE_TIME) {
    return calculateOneTimeBenefitLifetime(startDate);
  }

  // Cycles are indexed from the anchor (UTC midnight of the start date), so a
  // time-of-day start never leaves an end that overlaps the next normalized
  // start, a 29th-31st anchor clamps to each month's last day without drifting
  // (Jan 31 -> Feb 28 -> Mar 31), and every cycle ends 1ms before the next.
  const anchor = normalizeCycleDate(startDate);

  if (frequency === BenefitFrequency.WEEKLY) {
    const durationMs = 7 * 24 * 60 * 60 * 1000;
    const cyclesPassed = Math.max(0, Math.floor((referenceDate.getTime() - anchor.getTime()) / durationMs));
    const cycleStartDate = new Date(anchor.getTime() + cyclesPassed * durationMs);
    const cycleEndDate = new Date(cycleStartDate.getTime() + durationMs - 1);
    return { cycleStartDate, cycleEndDate };
  }

  const monthsPerCycle = monthsForFrequency(frequency);
  const cycleStartAt = (index: number) => addClampedUtcMonths(anchor, index * monthsPerCycle);
  const monthDelta =
    (referenceDate.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (referenceDate.getUTCMonth() - anchor.getUTCMonth());
  let index = Math.max(0, Math.floor(monthDelta / monthsPerCycle));
  while (index > 0 && cycleStartAt(index) > referenceDate) index -= 1;
  while (cycleStartAt(index + 1) <= referenceDate) index += 1;

  const cycleStartDate = cycleStartAt(index);
  const cycleEndDate = new Date(cycleStartAt(index + 1).getTime() - 1);
  return { cycleStartDate, cycleEndDate };
}

function monthsForFrequency(frequency: BenefitFrequency): number {
  switch (frequency) {
    case BenefitFrequency.MONTHLY:
      return 1;
    case BenefitFrequency.QUARTERLY:
      return 3;
    case BenefitFrequency.YEARLY:
      return 12;
    default:
      throw new Error(`Unsupported standalone benefit frequency: ${frequency}`);
  }
}

function addClampedUtcMonths(anchor: Date, months: number): Date {
  const monthIndex = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay)));
}
