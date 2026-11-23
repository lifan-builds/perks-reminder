// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPasswordResetToken } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';
import { SITE_NAME } from '@/lib/site';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to avoid email enumeration
    const successResponse = NextResponse.json({
      message: 'If an account with that email exists, we sent a password reset link.',
    });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.password) {
      // User doesn't exist or doesn't have a password (OAuth only)
      return successResponse;
    }

    const token = await createPasswordResetToken(normalizedEmail);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: `Reset your ${SITE_NAME} password`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2B3A6E;">Password Reset</h1>
          <p>You requested a password reset for your ${SITE_NAME} account. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #2B3A6E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #5B6478; font-size: 14px;">
            Or copy and paste this link in your browser:<br/>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
          <p style="color: #8A90A0; font-size: 12px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Reset your ${SITE_NAME} password: ${resetUrl}`,
    });

    return successResponse;
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
