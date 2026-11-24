// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { cookies, headers } from 'next/headers';
import {
  AMEX_READER_SUGGESTION_DISMISSED_COOKIE,
  isAmexReaderSuggestionEligible,
} from '../amex-reader-suggestion';
import { loadAmexReaderSuggestion } from '../amex-reader-suggestion.server';

jest.mock('next/headers', () => ({ cookies: jest.fn(), headers: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));

const DESKTOP_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function request({ dismissed = false, userAgent = DESKTOP_CHROME } = {}) {
  (cookies as jest.Mock).mockResolvedValue({ has: (name: string) => dismissed && name === AMEX_READER_SUGGESTION_DISMISSED_COOKIE });
  (headers as jest.Mock).mockResolvedValue(new Headers({ 'user-agent': userAgent }));
}

function client({ amexCards = 2, attempt = false, provenance = false } = {}) {
  return {
    creditCard: { count: jest.fn().mockResolvedValue(amexCards) },
    amexSyncAttempt: { findFirst: jest.fn().mockResolvedValue(attempt ? { id: 'attempt' } : null) },
    benefitStatusSourceProvenance: { findFirst: jest.fn().mockResolvedValue(provenance ? { id: 'provenance' } : null) },
  };
}

type LoaderClient = Parameters<typeof loadAmexReaderSuggestion>[1];

describe('isAmexReaderSuggestionEligible', () => {
  it.each([
    [{ amexCardCount: 2, hasSynced: false, dismissed: false }, true],
    [{ amexCardCount: 5, hasSynced: false, dismissed: false }, true],
    [{ amexCardCount: 1, hasSynced: false, dismissed: false }, false],
    [{ amexCardCount: 0, hasSynced: false, dismissed: false }, false],
    [{ amexCardCount: 3, hasSynced: true, dismissed: false }, false],
    [{ amexCardCount: 3, hasSynced: false, dismissed: true }, false],
  ])('%o -> %s', (state, expected) => {
    expect(isAmexReaderSuggestionEligible(state)).toBe(expected);
  });
});

describe('loadAmexReaderSuggestion', () => {
  it('suggests the extension to an unsynced user with two active Amex cards on desktop', async () => {
    request();
    const db = client();
    await expect(loadAmexReaderSuggestion('user-1', db as unknown as LoaderClient)).resolves.toEqual({ amexCardCount: 2, isMobile: false });
    expect(db.creditCard.count).toHaveBeenCalledWith({ where: { userId: 'user-1', issuer: 'American Express', lifecycleStatus: 'ACTIVE' } });
    expect(db.amexSyncAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', completedAt: { not: null } } }));
  });

  it('marks phones as mobile so no install button is offered', async () => {
    request({ userAgent: IPHONE });
    await expect(loadAmexReaderSuggestion('user-1', client() as unknown as LoaderClient)).resolves.toEqual({ amexCardCount: 2, isMobile: true });
  });

  it('skips the sync lookups for users with fewer than two Amex cards', async () => {
    request();
    const db = client({ amexCards: 1 });
    await expect(loadAmexReaderSuggestion('user-1', db as unknown as LoaderClient)).resolves.toBeNull();
    expect(db.amexSyncAttempt.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['a finished sync attempt', { attempt: true }],
    ['a benefit updated by Amex sync', { provenance: true }],
  ])('hides the suggestion after %s', async (_label, synced) => {
    request();
    await expect(loadAmexReaderSuggestion('user-1', client(synced) as unknown as LoaderClient)).resolves.toBeNull();
  });

  it('stays hidden after dismissal without querying cards', async () => {
    request({ dismissed: true });
    const db = client();
    await expect(loadAmexReaderSuggestion('user-1', db as unknown as LoaderClient)).resolves.toBeNull();
    expect(db.creditCard.count).not.toHaveBeenCalled();
  });
});
