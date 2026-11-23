// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { getCanonicalAuthUrl, SUPPORT_EMAIL } from '../site';

describe('site helpers', () => {
  it('uses the branded support email address', () => {
    expect(SUPPORT_EMAIL).toBe('support@perks-reminder.com');
  });

  it('canonicalizes apex production auth URLs to www', () => {
    expect(getCanonicalAuthUrl('https://perks-reminder.com')).toBe(
      'https://www.perks-reminder.com'
    );
    expect(getCanonicalAuthUrl('https://perks-reminder.com/')).toBe(
      'https://www.perks-reminder.com'
    );
  });

  it('keeps canonical and local auth URLs unchanged', () => {
    expect(getCanonicalAuthUrl('https://www.perks-reminder.com')).toBe(
      'https://www.perks-reminder.com'
    );
    expect(getCanonicalAuthUrl('http://localhost:3000')).toBe(
      'http://localhost:3000'
    );
  });
});
