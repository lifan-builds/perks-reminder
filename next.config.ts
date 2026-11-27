// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Lock workspace root so Vercel/Next doesn't pick a parent lockfile (avoids deploy failures)
  outputFileTracingRoot: appDir,
  output: 'standalone',
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
  // SEO and Performance optimizations
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  generateEtags: true,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'graph.facebook.com',
      },
    ],
  },
  
  // Headers for better SEO
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      // Keep this after the catch-all so the stricter referrer policy wins.
      {
        source: '/integrations/amex-sync',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  
  // Redirects for SEO and zero-CPU anonymous route gating
  async redirects() {
    const anonymousSessionMissing = [
      { type: 'cookie' as const, key: 'next-auth.session-token' },
      { type: 'cookie' as const, key: '__Secure-next-auth.session-token' },
    ];
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/cards',
        missing: anonymousSessionMissing,
        destination: '/auth/signin?callbackUrl=%2Fcards',
        permanent: false,
      },
      {
        source: '/cards/new',
        missing: anonymousSessionMissing,
        destination: '/auth/signin?callbackUrl=%2Fcards%2Fnew',
        permanent: false,
      },
    ];
  },

  // Zero-CPU anonymous root rewrite to static /landing
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          missing: [
            { type: 'cookie', key: 'next-auth.session-token' },
            { type: 'cookie', key: '__Secure-next-auth.session-token' },
            { type: 'host', value: 'loyalty\\..*' },
          ],
          destination: '/landing',
        },
      ],
    };
  },
};

export default nextConfig;
