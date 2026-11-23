// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

function requestFor(url: string): NextRequest {
  return new NextRequest(url, {
    headers: {
      host: new URL(url).host,
    },
  });
}

describe('proxy', () => {
  it.each(['/cards', '/cards/new'])('sends anonymous visitors on %s to sign-in instead of a 401 fetch', (path) => {
    const response = proxy(requestFor(`https://www.perks-reminder.com${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://www.perks-reminder.com/auth/signin?callbackUrl=${encodeURIComponent(path)}`
    );
  });

  it('keeps the public catalog paths open', () => {
    for (const path of ['/cards/browse', '/cards/browse/Chase%20Sapphire%20Reserve']) {
      expect(proxy(requestFor(`https://www.perks-reminder.com${path}`)).headers.get('location') ?? null).toBeNull();
    }
  });

  it('redirects loyalty auth pages to the canonical www auth host', () => {
    const response = proxy(
      requestFor('https://loyalty.perks-reminder.com/auth/signin')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://www.perks-reminder.com/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
    );
  });

  it('preserves an explicit loyalty callback URL on auth redirects', () => {
    const response = proxy(
      requestFor(
        'https://loyalty.perks-reminder.com/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://www.perks-reminder.com/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
    );
  });

  it('keeps local loyalty auth redirects on localhost', () => {
    const response = proxy(
      requestFor('http://loyalty.localhost:3000/auth/signin')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/signin?callbackUrl=http%3A%2F%2Floyalty.localhost%3A3000%2Floyalty'
    );
  });
});
