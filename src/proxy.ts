// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasSessionCookie, SESSION_HINT_COOKIE } from '@/lib/session-cookie';

const LOYALTY_SUBDOMAINS = ['loyalty'];
/** Client-rendered card pages that only fetch the signed-in user's data. */
const SIGNED_IN_CARD_PATHS = new Set(['/cards', '/cards/new']);

function splitHostAndPort(hostname: string): { host: string; port: string } {
  const [host, port = ''] = hostname.split(':');
  return { host, port };
}

function getSubdomain(hostname: string): string | null {
  const { host } = splitHostAndPort(hostname);
  const parts = host.split('.');
  // localhost:3000 → no subdomain
  if (parts.length <= 2 && !host.includes('localhost')) return null;
  // loyalty.perks-reminder.com → "loyalty"
  if (parts.length >= 3) return parts[0];
  // loyalty.localhost → "loyalty" (dev)
  if (host.includes('localhost') && parts.length >= 2 && parts[0] !== 'localhost') {
    return parts[0];
  }
  return null;
}

function getMainAuthHost(hostname: string, subdomain: string): { host: string; port: string } {
  const { host, port } = splitHostAndPort(hostname);
  const rootHost = host.replace(new RegExp(`^${subdomain}\\.`), '');

  if (rootHost.includes('localhost')) {
    return { host: rootHost, port };
  }

  return {
    host: rootHost.startsWith('www.') ? rootHost : `www.${rootHost}`,
    port: '',
  };
}

function redirectToSignin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/auth/signin';
  url.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

function withSessionHintCookie(request: NextRequest, response: NextResponse): NextResponse {
  const signedIn = hasSessionCookie(request);
  const currentHint = request.cookies.get(SESSION_HINT_COOKIE)?.value;
  if (signedIn && currentHint !== '1') {
    response.cookies.set(SESSION_HINT_COOKIE, '1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
  } else if (!signedIn && currentHint !== undefined) {
    response.cookies.delete(SESSION_HINT_COOKIE);
  }
  return response;
}

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = getSubdomain(hostname);
  const { pathname } = request.nextUrl;

  if (SIGNED_IN_CARD_PATHS.has(pathname) && !hasSessionCookie(request)) {
    return withSessionHintCookie(request, redirectToSignin(request));
  }

  if (subdomain && LOYALTY_SUBDOMAINS.includes(subdomain)) {
    // Redirect auth pages to main domain so OAuth uses registered callback URLs
    if (pathname.startsWith('/auth/')) {
      const mainAuthHost = getMainAuthHost(hostname, subdomain);
      const protocol = hostname.includes('localhost') ? 'http' : 'https';
      const url = request.nextUrl.clone();
      url.hostname = mainAuthHost.host;
      url.port = mainAuthHost.port;
      url.protocol = protocol;
      if (!url.searchParams.has('callbackUrl')) {
        url.searchParams.set('callbackUrl', `${protocol}://${hostname}/loyalty`);
      }
      return withSessionHintCookie(request, NextResponse.redirect(url));
    }

    // On loyalty subdomain, rewrite root to the loyalty landing page
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/loyalty-landing';
      return withSessionHintCookie(request, NextResponse.rewrite(url));
    }
    // Set a header so pages can detect loyalty context
    const response = NextResponse.next();
    response.headers.set('x-subdomain', 'loyalty');
    return withSessionHintCookie(request, response);
  }

  if (pathname === '/' && !hasSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    return withSessionHintCookie(request, NextResponse.rewrite(url));
  }

  return withSessionHintCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    // Match all paths except static files, api routes, and Next.js internals
    '/((?!_next/static|_next/image|favicon\\.png|manifest\\.json|images/|api/).*)',
  ],
};
