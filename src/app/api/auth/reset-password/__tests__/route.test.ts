// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { POST } from '../route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), init),
  },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    passwordResetToken: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn() }));

const token = 'reset-token';
const email = 'user@example.com';
const userId = 'user-1';
const now = new Date('2026-01-01T00:00:00.000Z');
const expires = new Date('2026-01-01T01:00:00.000Z');
const deleteMany = jest.fn();
const update = jest.fn();
const deleteSessions = jest.fn();

function resetPassword() {
  return POST(new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password: 'test-password' }),
  }));
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({ email, expires });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    update.mockResolvedValue({ id: userId });
    deleteSessions.mockResolvedValue({ count: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (operation) => operation({
      passwordResetToken: { deleteMany },
      user: { update },
      session: { deleteMany: deleteSessions },
    }));
  });

  afterEach(() => jest.useRealTimers());

  it('updates the password and revokes sessions once when two requests try to claim the same token', async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const [accepted, rejected] = await Promise.all([resetPassword(), resetPassword()]);

    expect(accepted.status).toBe(200);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toEqual({ error: 'Invalid or expired reset link' });
    expect(deleteMany).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { token, expires: { gt: now } } });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { email },
      data: { password: 'hashed-password', emailVerified: now },
      select: { id: true },
    });
    expect(deleteSessions).toHaveBeenCalledTimes(1);
    expect(deleteSessions).toHaveBeenCalledWith({ where: { userId } });
    expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(deleteSessions.mock.invocationCallOrder[0]);
  });

  it('checks expiration again after hashing', async () => {
    (bcrypt.hash as jest.Mock).mockImplementationOnce(async () => {
      jest.setSystemTime(expires);
      return 'hashed-password';
    });
    deleteMany.mockResolvedValueOnce({ count: 0 });

    const response = await resetPassword();

    expect(response.status).toBe(400);
    expect(deleteMany).toHaveBeenCalledWith({ where: { token, expires: { gt: expires } } });
    expect(update).not.toHaveBeenCalled();
    expect(deleteSessions).not.toHaveBeenCalled();
  });

  it('leaves the password untouched when claiming the token fails', async () => {
    deleteMany.mockRejectedValueOnce(new Error('Token claim failed'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await resetPassword()).status).toBe(500);
      expect(update).not.toHaveBeenCalled();
      expect(deleteSessions).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('rejects an already expired token before hashing', async () => {
    jest.setSystemTime(expires);

    const response = await resetPassword();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Reset link has expired. Please request a new one.' });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
