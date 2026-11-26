// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { NextRequest } from 'next/server';
import { config as proxyConfig, proxy } from '../proxy';

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

  it('rewrites anonymous / to the static /landing route while passing signed-in / through', () => {
    const anonymous = proxy(requestFor('https://www.perks-reminder.com/'));
    expect(anonymous.headers.get('x-middleware-rewrite')).toBe('https://www.perks-reminder.com/landing');
    expect(anonymous.cookies.get('pr_has_session')).toBeUndefined();

    const signedIn = proxy(new NextRequest('https://www.perks-reminder.com/', {
      headers: {
        host: 'www.perks-reminder.com',
        cookie: 'next-auth.session-token=fake-token',
      },
    }));
    expect(signedIn.headers.get('x-middleware-rewrite') ?? null).toBeNull();
    expect(signedIn.cookies.get('pr_has_session')?.value).toBe('1');
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

  it('scopes proxy matcher rules with host or cookie predicates to avoid running on public traffic', () => {
    expect(proxyConfig.matcher.length).toBeGreaterThan(0);
    for (const rule of proxyConfig.matcher) {
      expect(typeof rule).toBe('object');
      expect((rule.has?.length ?? 0) + (rule.missing?.length ?? 0)).toBeGreaterThan(0);
    }
  });
});
