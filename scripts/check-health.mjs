#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
/**
 * Repeatable latency and health budget check for a running Perks Reminder deployment.
 *
 * Usage:
 *   npm run health
 *   npm run health -- --base-url http://localhost:3211
 *   npm run health -- --require-cache-hit --json
 *
 * Never triggers /api/cron/* or notification routes.
 */

const DEFAULT_BASE_URL = 'https://perks-reminder.com';

const CHECKS = [
  { path: '/api/monitoring/health', kind: 'health', budgetMs: 1000, cacheable: false },
  { path: '/', kind: 'html', budgetMs: 400, cacheable: true },
  { path: '/expiring', kind: 'html', budgetMs: 400, cacheable: true },
  { path: '/cards/browse', kind: 'html', budgetMs: 400, cacheable: true },
  { path: '/cards/browse/American%20Express%20Platinum%20Card', kind: 'html', budgetMs: 400, cacheable: true },
  { path: '/benefits/how-to-use', kind: 'html', budgetMs: 400, cacheable: true },
  { path: '/api/predefined-cards', kind: 'json', budgetMs: 400, cacheable: true },
  { path: '/api/search?q=amex', kind: 'json', budgetMs: 400, cacheable: true },
];

function parseArgs(argv) {
  let baseUrl = process.env.HEALTH_BASE_URL || DEFAULT_BASE_URL;
  let requireCacheHit = false;
  let json = false;
  let budgetMultiplier = 1;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run health -- [--base-url <url>] [--require-cache-hit] [--budget-multiplier <n>] [--json]');
      process.exit(0);
    } else if (arg === '--base-url' && argv[i + 1]) {
      baseUrl = argv[++i];
    } else if (arg.startsWith('--base-url=')) {
      baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--require-cache-hit') {
      requireCacheHit = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--budget-multiplier' && argv[i + 1]) {
      budgetMultiplier = Number(argv[++i]);
    } else if (arg.startsWith('--budget-multiplier=')) {
      budgetMultiplier = Number(arg.slice('--budget-multiplier='.length));
    } else if (/^https?:\/\//.test(arg)) {
      baseUrl = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(budgetMultiplier) || budgetMultiplier <= 0) {
    throw new Error('budget-multiplier must be a positive number.');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    requireCacheHit,
    json,
    budgetMultiplier,
  };
}

async function probe(url) {
  const started = performance.now();
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'perks-reminder-health-check/1.0' },
  });
  const ttfbMs = Math.round(performance.now() - started);
  const body = await response.text();
  const totalMs = Math.round(performance.now() - started);

  return {
    status: response.status,
    ttfbMs,
    totalMs,
    bytes: Buffer.byteLength(body),
    vercelCache: response.headers.get('x-vercel-cache') || '-',
    cacheControl: response.headers.get('cache-control') || '-',
    vercelId: response.headers.get('x-vercel-id') || '-',
    responseTime: response.headers.get('x-response-time') || '-',
    body,
  };
}

function validateHealthPayload(bodyText, isLocal) {
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return { ok: false, reason: 'invalid JSON from /api/monitoring/health', dbMs: null };
  }

  const dbStatus = payload?.checks?.database?.status;
  const memStatus = payload?.checks?.memory?.status;
  const dbMs = typeof payload?.checks?.database?.responseTime === 'number'
    ? payload.checks.database.responseTime
    : null;

  if (dbStatus !== 'pass') {
    return { ok: false, reason: `database check status=${dbStatus ?? 'missing'}`, dbMs };
  }
  if (memStatus === 'fail') {
    return { ok: false, reason: 'memory check failed', dbMs };
  }
  if (!isLocal && payload?.status !== 'healthy') {
    return { ok: false, reason: `health status=${payload?.status ?? 'missing'}`, dbMs };
  }
  if (isLocal && payload?.status === 'unhealthy') {
    return { ok: false, reason: 'health status=unhealthy', dbMs };
  }

  return { ok: true, reason: null, dbMs };
}

async function main() {
  const { baseUrl, requireCacheHit, json, budgetMultiplier } = parseArgs(process.argv.slice(2));
  const parsedBase = new URL(baseUrl);
  const isLocal = parsedBase.hostname === 'localhost' || parsedBase.hostname === '127.0.0.1';
  const results = [];
  let dbMs = null;

  for (const check of CHECKS) {
    const targetUrl = `${baseUrl}${check.path}`;
    const cold = await probe(targetUrl);
    const warm = await probe(targetUrl);
    const budgetMs = Math.round(check.budgetMs * budgetMultiplier);
    const reasons = [];

    if (warm.status !== 200) {
      reasons.push(`HTTP ${warm.status}`);
    }
    if (warm.bytes === 0) {
      reasons.push('empty response body');
    }
    if (warm.ttfbMs > budgetMs) {
      reasons.push(`warm TTFB ${warm.ttfbMs}ms > ${budgetMs}ms`);
    }
    if (check.kind === 'health') {
      const health = validateHealthPayload(warm.body, isLocal);
      dbMs = health.dbMs;
      if (!health.ok && health.reason) reasons.push(health.reason);
    } else if (check.kind === 'json') {
      try {
        JSON.parse(warm.body);
      } catch {
        reasons.push('invalid JSON');
      }
    }
    if (requireCacheHit && check.cacheable && !isLocal && warm.vercelCache !== 'HIT' && warm.vercelCache !== 'PRERENDER') {
      reasons.push(`expected edge cache HIT, got ${warm.vercelCache}`);
    }

    results.push({
      path: check.path,
      status: warm.status,
      coldTtfbMs: cold.ttfbMs,
      warmTtfbMs: warm.ttfbMs,
      budgetMs,
      vercelCache: warm.vercelCache,
      vercelId: warm.vercelId,
      sizeKB: Math.round((warm.bytes / 1024) * 10) / 10,
      passed: reasons.length === 0,
      reasons,
    });
  }

  const allPassed = results.every((row) => row.passed);

  if (json) {
    console.log(JSON.stringify({ baseUrl, dbMs, passed: allPassed, results }, null, 2));
  } else {
    console.log(`Health & latency check for ${baseUrl}${dbMs !== null ? ` (DB check: ${dbMs}ms)` : ''}`);
    console.log('');
    const header = [
      'Route'.padEnd(48),
      'Status'.padEnd(7),
      'Cold'.padStart(7),
      'Warm'.padStart(7),
      'Budget'.padStart(8),
      'Cache'.padEnd(9),
      'Size'.padStart(8),
      'Result',
    ].join('  ');
    console.log(header);
    console.log('-'.repeat(header.length + 6));
    for (const row of results) {
      const statusText = row.passed ? 'PASS' : `FAIL (${row.reasons.join('; ')})`;
      console.log([
        row.path.padEnd(48),
        String(row.status).padEnd(7),
        `${row.coldTtfbMs}ms`.padStart(7),
        `${row.warmTtfbMs}ms`.padStart(7),
        `${row.budgetMs}ms`.padStart(8),
        row.vercelCache.padEnd(9),
        `${row.sizeKB}KB`.padStart(8),
        statusText,
      ].join('  '));
    }
  }

  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
