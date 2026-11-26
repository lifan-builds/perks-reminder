/** @jest-environment node */
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';
import { createCardForUser } from '@/lib/actions/cardUtils';
import { prisma } from '@/lib/prisma';
import { POST } from '../route';

jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/actions/cardUtils', () => ({ createCardForUser: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), init),
  },
}));

const card = {
  predefinedCardName: 'Travel Card',
  predefinedCardIssuer: 'Test Bank',
  openedDate: '2024-01-01',
};
const event = { eventType: 'NOTE', eventDate: '2024-02-01', description: 'Timeline note' };
const transaction = {
  creditCard: { findFirst: jest.fn(), create: jest.fn() },
  predefinedBenefit: { findMany: jest.fn() },
  benefitTrackingPreference: { findMany: jest.fn() },
  benefitStatus: { createMany: jest.fn() },
};
const transact = prisma.$transaction as jest.Mock;

function uploadFile(json: string) {
  const formData = new FormData();
  formData.set('file', new File([json], 'cards.json', { type: 'application/json' }));
  return POST({ formData: async () => formData } as Request);
}

function importCards(userCards: unknown[], version = '1.1.0') {
  return uploadFile(JSON.stringify({ version, userCards }));
}

describe('POST /api/user-cards/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } });
    (prisma.predefinedCard.findUnique as jest.Mock).mockResolvedValue({
      id: 'template-1', name: 'Travel Card', issuer: 'Test Bank', productKey: 'travel-card', annualFee: 95,
    });
    (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(null);
    transaction.creditCard.findFirst.mockResolvedValue(null);
    transaction.creditCard.create.mockResolvedValue({ id: 'card-1' });
    transaction.predefinedBenefit.findMany.mockResolvedValue([]);
    transaction.benefitTrackingPreference.findMany.mockResolvedValue([]);
    transact.mockImplementation(async (operation) => operation(transaction));
  });

  it.each([
    ['lifecycleStatus', { lifecycleStatus: 'UNKNOWN' }],
    ['closedDate', { lifecycleStatus: 'CLOSED' }],
    ['annualFeeAmount', { annualFeeAmount: -1 }],
    ['annualFeeDueDate', { annualFeeDueDate: '2026-02-30' }],
    ['signupBonusDeadline', { signupBonusDeadline: 20261126 }],
    ['spendDeadline', { spendDeadline: '' }],
    ['productChangedFrom', { productChangedFrom: 42 }],
    ['productChangedTo', { productChangedTo: [] }],
    ['lifecycleNotes', { lifecycleNotes: false }],
    ['events', { events: {} }],
    ['eventType', { events: [event, { ...event, eventType: 'UNKNOWN' }] }],
    ['eventDate', { events: [{ ...event, eventType: 'OPENED', eventDate: '2024-02-30' }] }],
    ['eventDate', { events: [{ ...event, eventDate: null }] }],
    ['event description', { events: [{ ...event, description: '   ' }] }],
  ])('rejects invalid %s before writing a card', async (field, fields) => {
    const response = await importCards([{ ...card, ...fields }]);

    expect(await response.json()).toEqual({
      message: 'Import finished. Imported: 0, Skipped: 0, Errors: 1',
      errors: [expect.stringContaining(field)],
    });
    expect(createCardForUser).not.toHaveBeenCalled();
    expect(transact).not.toHaveBeenCalled();
  });

  it('rejects out-of-range numbers in event metadata before the transaction', async () => {
    const userCards = [{ ...card, events: [{ ...event, metadata: { amounts: ['OVERFLOW'] } }] }];
    const response = await uploadFile(JSON.stringify({ version: '1.1.0', userCards }).replace('"OVERFLOW"', '1e400'));

    expect(await response.json()).toMatchObject({ errors: [expect.stringContaining('event metadata')] });
    expect(transact).not.toHaveBeenCalled();
  });

  it('creates a closed card and its validated timeline in the same write', async () => {
    const response = await importCards([{
      ...card,
      lifecycleStatus: 'CLOSED',
      closedDate: '2024-03-01',
      annualFeeAmount: 0,
      annualFeeDueDate: null,
      signupBonusDeadline: '2024-02-02',
      spendDeadline: '2024-02-03',
      productChangedFrom: '  Old Card ',
      productChangedTo: '  New Card ',
      lifecycleNotes: '  Closed at renewal ',
      events: [
        { eventType: 'OPENED', eventDate: card.openedDate, description: 'Opened Travel Card' },
        { ...event, description: ' Timeline note ', metadata: { sources: ['phone', null] } },
      ],
    }]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: 'Import finished. Imported: 1, Skipped: 0, Errors: 0', errors: [],
    });
    expect(transact).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(transaction.creditCard.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      predefinedCardId: 'template-1',
      productKey: 'travel-card',
      lifecycleStatus: 'CLOSED',
      closedDate: new Date('2024-03-01'),
      annualFeeAmount: 0,
      annualFeeDueDate: null,
      signupBonusDeadline: new Date('2024-02-02'),
      spendDeadline: new Date('2024-02-03'),
      productChangedFrom: 'Old Card',
      productChangedTo: 'New Card',
      lifecycleNotes: 'Closed at renewal',
      events: { createMany: { data: [
        { eventType: 'OPENED', eventDate: new Date(card.openedDate), description: 'Opened Travel Card', userId: 'user-1' },
        { ...event, eventDate: new Date(event.eventDate), metadata: { sources: ['phone', null] }, userId: 'user-1' },
      ] } },
    }) });
  });

  it('imports both physical cards with different last digits and skips repeats with unknown opening dates', async () => {
    const existingDigits = new Set<string>();
    transaction.creditCard.create.mockImplementation(async ({ data }) => {
      existingDigits.add(data.lastFourDigits);
      return { id: `card-${data.lastFourDigits}` };
    });
    transaction.creditCard.findFirst.mockImplementation(async ({ where }) =>
      existingDigits.has(where.lastFourDigits) ? { id: `card-${where.lastFourDigits}` } : null
    );
    const cards = [' 1234 ', '5678'].map(lastFourDigits => ({ ...card, openedDate: null, lastFourDigits }));

    expect(await (await importCards(cards)).json()).toEqual({
      message: 'Import finished. Imported: 2, Skipped: 0, Errors: 0', errors: [],
    });
    expect(await (await importCards(cards)).json()).toEqual({
      message: 'Import finished. Imported: 0, Skipped: 2, Errors: 0', errors: [],
    });
    expect(transaction.creditCard.create).toHaveBeenCalledTimes(2);
    for (const lastFourDigits of ['1234', '5678']) {
      expect(transaction.creditCard.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ openedDate: null, lastFourDigits }) });
      expect(transaction.creditCard.create).toHaveBeenCalledWith({ data: expect.objectContaining({ openedDate: null, lastFourDigits, annualFeeAmount: 95 }) });
    }
  });

  it('rejects the entire card transaction when benefit status creation fails', async () => {
    transaction.predefinedBenefit.findMany.mockResolvedValue([{ id: 'benefit-1', frequency: 'ONE_TIME' }]);
    transaction.benefitStatus.createMany.mockRejectedValueOnce(new Error('Benefit status insert failed'));

    const response = await importCards([{ ...card, events: [event] }]);

    expect(await response.json()).toEqual({
      message: 'Import finished. Imported: 0, Skipped: 0, Errors: 1', errors: ['Benefit status insert failed'],
    });
    await expect(transact.mock.results[0].value).rejects.toThrow('Benefit status insert failed');
    expect(transaction.creditCard.create).toHaveBeenCalledTimes(1);
    expect(prisma.creditCard.create).not.toHaveBeenCalled();
    expect(prisma.creditCardEvent.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('uses the standard creator for v1.0 backups', async () => {
    jest.mocked(createCardForUser).mockResolvedValue({ success: true, cardId: 'card-1' });

    const response = await importCards([{ ...card, openedDate: null, lastFourDigits: ' 1234 ' }], '1.0.0');

    expect(await response.json()).toMatchObject({ message: 'Import finished. Imported: 1, Skipped: 0, Errors: 0' });
    expect(createCardForUser).toHaveBeenCalledWith('user-1', 'template-1', null, '1234', null);
  });
});
