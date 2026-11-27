// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

/**
 * Calculates the start and end dates for a specific benefit cycle.
 * Uses UTC for all calculations.
 *
 * @param frequency How often the benefit resets.
 * @param referenceDate The date for which to determine the cycle.
 * @param cardOpenedDate Optional: Card opened date for YEARLY anniversary calculations.
 * @param cycleAlignment Optional: How the cycle aligns (CARD_ANNIVERSARY or CALENDAR_FIXED).
 * @param fixedCycleStartMonth Optional: 1-12, month the fixed cycle starts, if CALENDAR_FIXED.
 * @param fixedCycleDurationMonths Optional: Duration in months for CALENDAR_FIXED cycles.
 * @returns An object with cycleStartDate and cycleEndDate (UTC).
 */
export function calculateBenefitCycle(
  frequency: BenefitFrequency,
  referenceDate: Date,
  cardOpenedDate: Date | null,
  cycleAlignment?: BenefitCycleAlignment | null,
  fixedCycleStartMonth?: number | null,
  fixedCycleDurationMonths?: number | null
): { cycleStartDate: Date; cycleEndDate: Date } {
  if (frequency === BenefitFrequency.ONE_TIME) {
    console.error("calculateBenefitCycle called with unsupported frequency for recurring benefits:", frequency);
    throw new Error(`Unsupported frequency for recurring benefit cycle calculation: ${frequency}`);
  }

  if (
    Number.isNaN(referenceDate.getTime()) ||
    (cardOpenedDate !== null && Number.isNaN(cardOpenedDate.getTime()))
  ) {
    console.error("Calculated invalid date for benefit cycle", { frequency, referenceDate, cardOpenedDate, cycleAlignment, fixedCycleStartMonth, fixedCycleDurationMonths });
    throw new Error("Could not calculate valid benefit cycle dates.");
  }

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth(); // 0-indexed

  // Initialize variables to satisfy TypeScript flow analysis
  let cycleStartDate: Date = new Date();
  let cycleEndDate: Date = new Date();

  if (
    cycleAlignment === BenefitCycleAlignment.CALENDAR_FIXED &&
    fixedCycleStartMonth &&
    fixedCycleDurationMonths &&
    fixedCycleStartMonth >= 1 && fixedCycleStartMonth <= 12 &&
    fixedCycleDurationMonths > 0 &&
    fixedCycleDurationMonths <= 12
  ) {
    // --- CALENDAR_FIXED Logic (UTC) ---
    // Multi-year windows have no calendar anchor, so they use the card-anniversary branch below.
    if (frequency === BenefitFrequency.QUARTERLY && fixedCycleDurationMonths === 3) {
      // Quarterly fixed cycles recur throughout the year from the configured start month.
      // For example, a January-start Aspire flight credit should materialize Jan-Mar,
      // Apr-Jun, Jul-Sep, and Oct-Dec cycles instead of jumping from Q1 to next Q1.
      const startMonthIndex = fixedCycleStartMonth - 1;
      const referenceMonthIndex = refYear * 12 + refMonth;
      const anchorMonthIndex = refYear * 12 + startMonthIndex;
      const cyclesSinceAnchor = Math.floor((referenceMonthIndex - anchorMonthIndex) / fixedCycleDurationMonths);
      const cycleStartMonthIndex = anchorMonthIndex + cyclesSinceAnchor * fixedCycleDurationMonths;
      const cycleStartYear = Math.floor(cycleStartMonthIndex / 12);
      const cycleStartMonth = cycleStartMonthIndex % 12;

      cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
      cycleEndDate = new Date(cycleStartDate.getTime());
      cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
      cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    } else {
      // One window per year (annual, Jan-Jun / Jul-Dec halves, single quarters,
      // December-only). Each benefit represents only its own window: the window
      // containing the reference date wins, otherwise the next upcoming one.
      // The previous year's window is considered so year-wrapping windows
      // (e.g. Nov-Jan) and non-January annual windows (e.g. Jul-Jun) resolve
      // to the window that is actually open.
      const windows = [refYear - 1, refYear, refYear + 1].map((year) => {
        const start = new Date(Date.UTC(year, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
        const end = new Date(start.getTime());
        end.setUTCMonth(end.getUTCMonth() + fixedCycleDurationMonths);
        end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
        return { start, end };
      });
      const chosen =
        windows.find((window) => referenceDate >= window.start && referenceDate <= window.end) ??
        windows.find((window) => window.start > referenceDate)!;
      cycleStartDate = chosen.start;
      cycleEndDate = chosen.end;
    }
  } else {
    // --- CARD_ANNIVERSARY or Default Logic (existing logic) ---
    let cycleStartYear = 0;
    let cycleStartMonth = 0; // 0-indexed
    let cycleEndYear = 0;
    let cycleEndMonth = 0; // 0-indexed
    let assignedCycleDates = false;

    switch (frequency) {
      case BenefitFrequency.WEEKLY: {
        // WEEKLY: 7-day cycles
        // Calculate the most recent cycle start based on the reference date
        // Each week starts on the same day of week as the benefit start date (or Sunday if no card date)
        const refTime = referenceDate.getTime();
        const dayOfWeek = referenceDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
        
        // Find the most recent Sunday (start of week) or use benefit-specific start day
        const daysFromWeekStart = dayOfWeek;
        const weekStartTime = refTime - (daysFromWeekStart * 24 * 60 * 60 * 1000);
        const weekStart = new Date(weekStartTime);
        
        // Normalize to midnight UTC
        cycleStartDate = new Date(Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate(),
          0, 0, 0, 0
        ));
        
        // End date is 7 days later minus 1ms
        cycleEndDate = new Date(cycleStartDate.getTime() + (7 * 24 * 60 * 60 * 1000) - 1);
        
        return { cycleStartDate, cycleEndDate };
      }

      case BenefitFrequency.MONTHLY:
        cycleStartYear = refYear;
        cycleStartMonth = refMonth;
        cycleEndYear = refYear;
        cycleEndMonth = refMonth;
        break;

      case BenefitFrequency.QUARTERLY:
        const currentQuarter = Math.floor(refMonth / 3);
        cycleStartYear = refYear;
        cycleStartMonth = currentQuarter * 3;
        cycleEndYear = refYear;
        cycleEndMonth = cycleStartMonth + 2;
        break;

      case BenefitFrequency.YEARLY:
        if (cardOpenedDate) {
          const openedMonth = cardOpenedDate.getUTCMonth();
          if (fixedCycleDurationMonths && fixedCycleDurationMonths > 12) {
            const openedYear = cardOpenedDate.getUTCFullYear();
            const monthDiff = ((refYear - openedYear) * 12) + (refMonth - openedMonth);
            const cycleIndex = Math.max(0, Math.floor(monthDiff / fixedCycleDurationMonths));
            const cycleStartMonthIndex = (openedYear * 12) + openedMonth + (cycleIndex * fixedCycleDurationMonths);
            const cycleStartYear = Math.floor(cycleStartMonthIndex / 12);
            const cycleStartMonth = cycleStartMonthIndex % 12;

            cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
            cycleEndDate = new Date(cycleStartDate.getTime());
            cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
            cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
            assignedCycleDates = true;
            break;
          }

          if (refMonth >= openedMonth) {
            cycleStartYear = refYear;
          } else {
            cycleStartYear = refYear - 1;
          }
          cycleStartMonth = openedMonth;
          cycleEndYear = cycleStartYear + 1;
          cycleEndMonth = cycleStartMonth; 
        } else {
          cycleStartYear = refYear;
          cycleStartMonth = 0; // January
          cycleEndYear = refYear;
          cycleEndMonth = 11; // December
        }
        break;

      default:
        console.error("calculateBenefitCycle called with unsupported frequency for recurring benefits:", frequency);
        throw new Error(`Unsupported frequency for recurring benefit cycle calculation: ${frequency}`);
    }

    // Assign the calculated cycle dates
    if (assignedCycleDates) {
      // Multi-year card-anniversary cycles are already assigned above.
    } else if (frequency === BenefitFrequency.YEARLY && cardOpenedDate) {
        cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
        cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth, 1, 0, 0, 0, 0));
        cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    } else {
       cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
       cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth + 1, 1, 0, 0, 0, 0));
       cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    }
  }

  // Validation (common for both branches)
  if (isNaN(cycleStartDate.getTime()) || isNaN(cycleEndDate.getTime())) {
    console.error("Calculated invalid date for benefit cycle", { frequency, referenceDate, cardOpenedDate, cycleAlignment, fixedCycleStartMonth, fixedCycleDurationMonths, cycleStartDate, cycleEndDate });
    throw new Error("Could not calculate valid benefit cycle dates.");
  }
  if (cycleEndDate <= cycleStartDate) {
    console.error("Calculated cycle end date is not after cycle start date", { frequency, referenceDate, cardOpenedDate, cycleAlignment, fixedCycleStartMonth, fixedCycleDurationMonths, cycleStartDate, cycleEndDate });
    throw new Error("Calculated cycle end date is not after cycle start date.");
  }

  // Log cycle calculation in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('calculateBenefitCycle:', {
      frequency,
      cycleStartDate: cycleStartDate.toISOString(),
      cycleEndDate: cycleEndDate.toISOString()
    });
  }

  return { cycleStartDate, cycleEndDate };
}

/**
 * Calculates the start and end dates for the *initial* cycle of a ONE_TIME benefit.
 * This is separate because ONE_TIME benefits don't have recurring cycles.
 *
 * @param benefitStartDate The date the benefit becomes active.
 * @returns An object with cycleStartDate and cycleEndDate (UTC).
 */
export function calculateOneTimeBenefitLifetime(
    benefitStartDate: Date
): { cycleStartDate: Date; cycleEndDate: Date } {
    if (Number.isNaN(benefitStartDate.getTime())) {
        console.error("Calculated invalid date for one-time benefit lifetime", { benefitStartDate });
        throw new Error("Could not calculate valid one-time benefit lifetime dates.");
    }

    const cycleStartDate = new Date(benefitStartDate.getTime()); // Use the provided start date
    // Set an arbitrary long lifetime (10 years), clamping leap-day starts (e.g. Feb 29 -> Feb 28)
    const endYear = benefitStartDate.getUTCFullYear() + 10;
    const endMonth = benefitStartDate.getUTCMonth();
    const lastDayOfEndMonth = new Date(Date.UTC(endYear, endMonth + 1, 0)).getUTCDate();
    const cycleEndDate = new Date(Date.UTC(
        endYear,
        endMonth,
        Math.min(benefitStartDate.getUTCDate(), lastDayOfEndMonth),
        23, 59, 59, 999
    ));

    return { cycleStartDate, cycleEndDate };
}
