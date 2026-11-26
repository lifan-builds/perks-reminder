// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { planBenefitStatusMaterialization } from '@/lib/global-benefit-materialization';
import { applyTrackingModesToPlannedRows } from '@/lib/benefit-tracking-preferences';
import { createCardForUser } from '@/lib/actions/cardUtils';
import { validateCardDigits } from '@/lib/cardDisplayUtils';
import { parseIsoDateOnly } from '@/lib/card-lifecycle';
import { revalidatePath } from 'next/cache';

interface ImportCardEntry {
  predefinedCardName: string;
  predefinedCardIssuer: string;
  openedDate: string | null;
  lastFourDigits?: string | null;
  nickname?: string | null;
  lifecycleStatus?: 'ACTIVE' | 'CLOSED' | 'PRODUCT_CHANGED';
  closedDate?: string | null;
  annualFeeAmount?: number | null;
  annualFeeDueDate?: string | null;
  signupBonusDeadline?: string | null;
  spendDeadline?: string | null;
  productChangedFrom?: string | null;
  productChangedTo?: string | null;
  lifecycleNotes?: string | null;
  events?: Array<{
    eventType: 'OPENED' | 'ANNUAL_FEE' | 'RETENTION' | 'PRODUCT_CHANGE' | 'CLOSED' | 'SIGNUP_BONUS' | 'SPEND_DEADLINE' | 'NOTE';
    eventDate: string;
    description: string;
    metadata?: Prisma.InputJsonValue | null;
  }>;
}

interface ImportData {
  version: string;
  userCards: ImportCardEntry[];
}

const allowedLifecycleStatuses = new Set(['ACTIVE', 'CLOSED', 'PRODUCT_CHANGED']);
const allowedCardEventTypes = new Set(['OPENED', 'ANNUAL_FEE', 'RETENTION', 'PRODUCT_CHANGE', 'CLOSED', 'SIGNUP_BONUS', 'SPEND_DEADLINE', 'NOTE']);

function parseImportDate(dateValue: unknown, fieldName: string, cardName: string): Date | null {
  if (dateValue == null) return null;
  const parsedDate = typeof dateValue === 'string' && parseIsoDateOnly(dateValue);
  if (!parsedDate) {
    throw new Error(`Invalid ${fieldName} for card "${cardName}": Expected a real YYYY-MM-DD date`);
  }

  return parsedDate;
}

function parseImportText(value: unknown, fieldName: string, cardName: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName} for card "${cardName}": Expected a string`);
  }

  return value.trim() || null;
}

function parseLifecycleStatus(status: unknown, cardName: string): NonNullable<ImportCardEntry['lifecycleStatus']> {
  if (status == null) return 'ACTIVE';
  if (typeof status !== 'string' || !allowedLifecycleStatuses.has(status)) {
    throw new Error(`Invalid lifecycleStatus for card "${cardName}"`);
  }

  return status as NonNullable<ImportCardEntry['lifecycleStatus']>;
}

function parseAnnualFeeAmount(value: unknown, cardName: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid annualFeeAmount for card "${cardName}": Expected a non-negative number`);
  }

  return value;
}

function hasFiniteJsonNumbers(value: Prisma.InputJsonValue | null | undefined): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value !== null && typeof value === 'object') return Object.values(value).every(hasFiniteJsonNumbers);
  return true;
}

function parseLifecycle(card: ImportCardEntry) {
  const name = card.predefinedCardName;
  const lifecycleStatus = parseLifecycleStatus(card.lifecycleStatus, name);
  const closedDate = parseImportDate(card.closedDate, 'closedDate', name);
  if (lifecycleStatus === 'CLOSED' && !closedDate) {
    throw new Error(`Closed card "${name}" requires closedDate`);
  }

  const events = card.events === undefined ? [] : card.events;
  if (!Array.isArray(events)) {
    throw new Error(`Invalid events for card "${name}": Expected an array`);
  }
  const parsedEvents = events.map(event => {
    if (!allowedCardEventTypes.has(event?.eventType)) {
      throw new Error(`Invalid eventType for card "${name}"`);
    }
    const eventDate = parseImportDate(event.eventDate, 'eventDate', name);
    if (!eventDate) throw new Error(`Missing eventDate for card "${name}"`);
    const description = parseImportText(event.description, 'event description', name);
    if (!description) {
      throw new Error(`Invalid event description for card "${name}"`);
    }
    if (!hasFiniteJsonNumbers(event.metadata)) {
      throw new Error(`Invalid event metadata for card "${name}": Expected finite numbers`);
    }
    return {
      eventType: event.eventType,
      eventDate,
      description,
      metadata: event.metadata ?? undefined,
    };
  });

  return {
    data: {
      lifecycleStatus,
      closedDate: lifecycleStatus === 'CLOSED' ? closedDate : null,
      annualFeeAmount: parseAnnualFeeAmount(card.annualFeeAmount, name),
      annualFeeDueDate: parseImportDate(card.annualFeeDueDate, 'annualFeeDueDate', name),
      signupBonusDeadline: parseImportDate(card.signupBonusDeadline, 'signupBonusDeadline', name),
      spendDeadline: parseImportDate(card.spendDeadline, 'spendDeadline', name),
      productChangedFrom: parseImportText(card.productChangedFrom, 'productChangedFrom', name),
      productChangedTo: parseImportText(card.productChangedTo, 'productChangedTo', name),
      lifecycleNotes: parseImportText(card.lifecycleNotes, 'lifecycleNotes', name),
    },
    events: parsedEvents.filter(event => event.eventType !== 'OPENED'),
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/json') {
      return NextResponse.json({ message: 'Invalid file type. Please upload a JSON file.' }, { status: 400 });
    }

    const text = await file.text();
    let importData: ImportData;

    try {
      importData = JSON.parse(text);
      // Basic validation
      if (!importData || !['1.0.0', '1.1.0'].includes(importData.version) || !Array.isArray(importData.userCards)) {
        throw new Error('Invalid JSON structure or version');
      }
    } catch (parseError) {
      console.error('Import parse error:', parseError);
      return NextResponse.json({ message: 'Invalid JSON file format' }, { status: 400 });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const cardEntry of importData.userCards) {
      try {
        const { predefinedCardName, predefinedCardIssuer, openedDate, lastFourDigits, nickname } = cardEntry;

        const parsedOpenedDate = parseImportDate(openedDate, 'openedDate', predefinedCardName);
        const lifecycle = importData.version === '1.1.0' ? parseLifecycle(cardEntry) : null;
        const digits = parseImportText(lastFourDigits, 'lastFourDigits', predefinedCardName);
        const parsedNickname = parseImportText(nickname, 'nickname', predefinedCardName);
        const predefinedCard = await prisma.predefinedCard.findUnique({
          where: { name: predefinedCardName, retiredAt: null },
        });
        if (!predefinedCard) {
          throw new Error(`Predefined card "${predefinedCardName}" (Issuer: ${predefinedCardIssuer}) not found in database.`);
        }

        if (digits) {
          const validation = validateCardDigits(digits, predefinedCard.issuer);
          if (!validation.valid) {
            throw new Error(`Invalid last digits for card "${predefinedCardName}": ${validation.error}`);
          }
        }

        const identity = {
          userId,
          name: predefinedCard.name,
          issuer: predefinedCard.issuer,
          openedDate: parsedOpenedDate,
          lastFourDigits: digits,
          nickname: parsedNickname,
        };

        let created = false;
        if (lifecycle) {
          const referenceDate = new Date();
          const openingEventDate = parsedOpenedDate ?? new Date(Date.UTC(referenceDate.getUTCFullYear(), 0, 1));
          created = await prisma.$transaction(async tx => {
            if (await tx.creditCard.findFirst({ where: identity })) return false;

            const card = await tx.creditCard.create({
              data: {
                ...identity,
                predefinedCardId: predefinedCard.id,
                productKey: predefinedCard.productKey,
                ...lifecycle.data,
                annualFeeAmount: lifecycle.data.annualFeeAmount ?? predefinedCard.annualFee,
                events: {
                  createMany: {
                    data: [
                      { userId, eventType: 'OPENED', eventDate: openingEventDate, description: `Opened ${predefinedCard.name}` },
                      ...lifecycle.events.map(event => ({ ...event, userId })),
                    ],
                  },
                },
              },
            });
            const benefits = await tx.predefinedBenefit.findMany({
              where: { predefinedCardId: predefinedCard.id, retiredAt: null },
            });
            const { rows, warnings } = planBenefitStatusMaterialization(
              benefits.map(benefit => ({ ...benefit, userId, creditCardId: card.id, cardOpenedDate: parsedOpenedDate })),
              [],
              referenceDate
            );
            for (const warning of warnings) console.warn(warning);
            if (rows.length) {
              const defaults = await applyTrackingModesToPlannedRows(tx, rows);
              await tx.benefitStatus.createMany({ data: rows.map((row, i) => ({ ...row, ...defaults[i] })) });
            }
            return true;
          }, { isolationLevel: 'Serializable' });
        } else if (!(await prisma.creditCard.findFirst({ where: identity }))) {
          const result = await createCardForUser(userId, predefinedCard.id, parsedOpenedDate, digits, identity.nickname);
          if (!result.success) throw new Error(result.message);
          created = true;
        }

        if (created) importedCount++;
        else skippedCount++;
      } catch (cardError: unknown) {
        console.error('Error processing card entry:', cardError);
        errorCount++;
        // Type check for error message access
        const message = cardError instanceof Error ? cardError.message : `Unknown error processing card: ${cardEntry.predefinedCardName}`;
        errors.push(message);
      }
    }

    // Revalidate paths if any cards were successfully imported
    if (importedCount > 0) {
        console.log('Import successful, revalidating paths...')
        revalidatePath('/');
        revalidatePath('/cards');
        revalidatePath('/cards/calendar');
        revalidatePath('/benefits');
    }

    return NextResponse.json({
      message: `Import finished. Imported: ${importedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
      errors: errors,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Import endpoint error:', error);
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'Error importing data';
    return NextResponse.json({ message }, { status: 500 });
  }
}
