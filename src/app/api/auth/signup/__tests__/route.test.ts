// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { POST } from '../route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), init),
  },
}));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn() }));
jest.mock('@/lib/tokens', () => ({ createVerificationToken: jest.fn().mockResolvedValue('test-token') }));
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

const email = 'user@example.com';

function signup() {
  return POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'test-password', name: 'Test User' }),
  }));
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['verified passwordless OAuth user', { password: null, emailVerified: new Date() }],
    ['password user', { password: 'existing-hash', emailVerified: null }],
  ])('rejects signup for an existing %s', async (_, user) => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(user);

    const response = await signup();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'An account with this email already exists. Please sign in.',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('creates a new user and sends the verification email', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const response = await signup();

    expect(response.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email, password: 'hashed-password', name: 'Test User' },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: email,
      text: expect.stringContaining('/auth/verify-email?token=test-token'),
    }));
  });
});
