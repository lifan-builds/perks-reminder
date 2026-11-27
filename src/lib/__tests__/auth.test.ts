// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions, computeSessionVersion } from '@/lib/auth';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockFindUnique = prisma.user.findUnique as jest.Mock;
const jwtCallback = authOptions.callbacks!.jwt!;
const sessionCallback = authOptions.callbacks!.session!;

describe('authOptions JWT session revocation', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-auth-secret';
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it('stamps sessionVersion on sign-in and accepts subsequent requests while password is unchanged', async () => {
    const oldHash = '$2a$12$oldhashedpasswordvalue0000000000000000000000000000000';
    mockFindUnique.mockResolvedValue({ password: oldHash });

    const signedInToken = await jwtCallback({
      token: {} as JWT,
      user: { id: 'user-1', email: 'user@example.com' } as never,
      account: null,
    });

    expect(signedInToken.id).toBe('user-1');
    expect(signedInToken.sessionVersion).toBe(computeSessionVersion(oldHash));
    expect(signedInToken.sessionVersion).not.toContain(oldHash);

    const refreshedToken = await jwtCallback({
      token: signedInToken,
      user: undefined as never,
      account: null,
    });

    expect(refreshedToken).toEqual(signedInToken);

    const session = (await sessionCallback({
      session: { user: { id: '' }, expires: '2026-12-31T00:00:00.000Z' } as Session,
      token: refreshedToken,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    })) as Session;

    expect(session.user.id).toBe('user-1');
  });

  it('revokes previously issued JWTs immediately after password reset rotates the password hash', async () => {
    const oldHash = '$2a$12$oldhashedpasswordvalue0000000000000000000000000000000';
    const newHash = '$2a$12$newhashedpasswordvalue1111111111111111111111111111111';
    mockFindUnique.mockResolvedValueOnce({ password: oldHash });

    const preResetToken = await jwtCallback({
      token: {} as JWT,
      user: { id: 'user-1', email: 'user@example.com' } as never,
      account: null,
    });

    // Simulate password reset rotating User.password in the database.
    mockFindUnique.mockResolvedValueOnce({ password: newHash });

    await expect(
      jwtCallback({
        token: preResetToken,
        user: undefined as never,
        account: null,
      })
    ).rejects.toThrow('SESSION_REVOKED');

    // Signing in again with the new password issues a fresh valid sessionVersion.
    mockFindUnique.mockResolvedValueOnce({ password: newHash });
    const postResetToken = await jwtCallback({
      token: {} as JWT,
      user: { id: 'user-1', email: 'user@example.com' } as never,
      account: null,
    });

    expect(postResetToken.sessionVersion).toBe(computeSessionVersion(newHash));
    expect(postResetToken.sessionVersion).not.toBe(preResetToken.sessionVersion);
  });

  it('rejects legacy JWTs that lack sessionVersion and JWTs for deleted users', async () => {
    mockFindUnique.mockResolvedValueOnce({ password: '$2a$12$somehash' });
    await expect(
      jwtCallback({
        token: { id: 'user-1' } as JWT,
        user: undefined as never,
        account: null,
      })
    ).rejects.toThrow('SESSION_REVOKED');

    mockFindUnique.mockResolvedValueOnce(null);
    await expect(
      jwtCallback({
        token: { id: 'user-1', sessionVersion: 'stale' } as JWT,
        user: undefined as never,
        account: null,
      })
    ).rejects.toThrow('SESSION_REVOKED');
  });

  it('does not return a session when token lacks id or sessionVersion', async () => {
    const session = await sessionCallback({
      session: { user: { id: '' }, expires: '2026-12-31T00:00:00.000Z' } as Session,
      token: { id: 'user-1' } as JWT,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    });

    expect(session).toBeNull();
  });
});
