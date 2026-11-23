// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { prisma } from '@/lib/prisma';
import type { PlannedBenefitStatusInsert } from '@/lib/global-benefit-materialization';
import { applyTrackingModesToPlannedRows } from '@/lib/benefit-tracking-preferences';

export const INSERT_BATCH_SIZE = 2_000;

export interface BenefitStatusInsertResult {
  inserted: number;
  discrepancies: string[];
}

/**
 * Insert-only by design: existing cycle boundaries and user state are immutable.
 * A planned row that overlaps a stored occurrence with different boundaries is
 * reported and skipped, never inserted or rewritten, so one inconsistent
 * definition cannot block materialization for every other user.
 */
export async function insertMissingBenefitStatuses(
  rows: PlannedBenefitStatusInsert[],
  now: Date = new Date()
): Promise<BenefitStatusInsertResult> {
  const discrepancies: string[] = [];
  if (rows.length === 0) return { inserted: 0, discrepancies };
  if (rows.length > INSERT_BATCH_SIZE) {
    throw new Error(`Benefit status insert batch exceeds ${INSERT_BATCH_SIZE} rows.`);
  }

  const overlapping = await prisma.benefitStatus.findMany({
    where: {
      OR: rows.map((row) => ({
        userId: row.userId,
        occurrenceIndex: row.occurrenceIndex,
        cycleEndDate: { gte: row.cycleStartDate },
        ...(row.benefitId
          ? { benefitId: row.benefitId }
          : {
              creditCardId: row.creditCardId,
              predefinedBenefitId: row.predefinedBenefitId,
            }),
      })),
    },
    select: {
      id: true,
      benefitId: true,
      creditCardId: true,
      predefinedBenefitId: true,
      userId: true,
      cycleStartDate: true,
      cycleEndDate: true,
      occurrenceIndex: true,
    },
  } as never) as unknown as Array<PlannedBenefitStatusInsert & { id: string }>;

  const rowsToInsert = rows.filter((row) => {
    const existing = overlapping.filter((candidate) => sameOccurrenceSource(candidate, row));
    if (existing.length === 0) return true;
    const exact = existing.some((candidate) =>
      candidate.cycleStartDate.getTime() === row.cycleStartDate.getTime() &&
      candidate.cycleEndDate.getTime() === row.cycleEndDate.getTime()
    );
    if (!exact) {
      discrepancies.push(
        `Benefit status cycle discrepancy detected for ${row.predefinedBenefitId ?? row.benefitId} ` +
        `(user ${row.userId}, occurrence ${row.occurrenceIndex}, planned ${row.cycleStartDate.toISOString()}).`
      );
    }
    return false;
  });

  if (rowsToInsert.length === 0) return { inserted: 0, discrepancies };

  // Centralized: AUTO_CLAIM rows open already claimed, resolved per owner.
  const defaults = await applyTrackingModesToPlannedRows(prisma, rowsToInsert, now);

  // Prisma emits parameterized INSERT ... ON CONFLICT DO NOTHING for
  // skipDuplicates. Keeping Date values on the normal Prisma boundary avoids
  // session-time-zone conversion from hand-written timestamptz casts.
  const result = await prisma.benefitStatus.createMany({
    data: rowsToInsert.map((row, index) => ({
      ...row,
      ...defaults[index],
      isNotUsable: false,
      orderIndex: null,
    })),
    skipDuplicates: true,
  } as never);
  return { inserted: result.count, discrepancies };
}

function sameOccurrenceSource(
  left: PlannedBenefitStatusInsert,
  right: PlannedBenefitStatusInsert
): boolean {
  return (
    left.userId === right.userId &&
    left.benefitId === right.benefitId &&
    left.creditCardId === right.creditCardId &&
    left.predefinedBenefitId === right.predefinedBenefitId &&
    left.occurrenceIndex === right.occurrenceIndex
  );
}
