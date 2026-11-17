import type { NextRequest } from 'next/server';

export function hasSessionCookie(request: Pick<NextRequest, 'cookies'>): boolean {
  return (
    request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token')
  );
}
