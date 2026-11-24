// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
export const AMEX_READER_SUGGESTION_DISMISSED_COOKIE = 'pr_amex_reader_suggestion_dismissed';
export const AMEX_READER_SUGGESTION_PARAM = 'amexReader';
export const AMEX_READER_SUGGESTION_MIN_CARDS = 2;
export const AMEX_CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/idpcieaeladegdoelljadhcggjndclpk';

export interface AmexReaderSuggestionState {
  amexCardCount: number;
  hasSynced: boolean;
  dismissed: boolean;
}

export function isAmexReaderSuggestionEligible({ amexCardCount, hasSynced, dismissed }: AmexReaderSuggestionState): boolean {
  return amexCardCount >= AMEX_READER_SUGGESTION_MIN_CARDS && !hasSynced && !dismissed;
}
