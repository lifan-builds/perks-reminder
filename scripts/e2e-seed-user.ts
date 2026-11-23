#!/usr/bin/env tsx
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
/**
 * Seeds the Playwright E2E account on the development database only:
 *
 *   node scripts/with-dev-db.js npx tsx scripts/e2e-seed-user.ts
 *
 * Idempotent. Creates a verified credentials user with every email
 * notification off and two physical cards through the normal card-creation
 * path. Refuses to run unless DATABASE_URL is DATABASE_URL_DEV.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { createCardForUser } from "../src/lib/actions/cardUtils";

export const E2E_EMAIL = "e2e-playwright@perks-reminder.test";
export const E2E_PASSWORD = "perks-e2e-local-only";
const CARDS = [
  { catalogKey: "card:american-express-platinum-card", openedDate: "2024-02-29" },
  { catalogKey: "card:csr", openedDate: "2023-07-31" },
];

async function main() {
  if (!process.env.DATABASE_URL_DEV || process.env.DATABASE_URL !== process.env.DATABASE_URL_DEV) {
    throw new Error("Refusing to seed: run through scripts/with-dev-db.js so DATABASE_URL is the development database.");
  }

  const user = await prisma.user.upsert({
    where: { email: E2E_EMAIL },
    update: {},
    create: {
      email: E2E_EMAIL,
      name: "E2E Playwright",
      password: await bcrypt.hash(E2E_PASSWORD, 12),
      emailVerified: new Date("2026-01-01T00:00:00Z"),
      notifyNewBenefit: false,
      notifyBenefitExpiration: false,
      notifyPointsExpiration: false,
    },
  });

  const existing = await prisma.creditCard.count({ where: { userId: user.id } });
  if (existing === 0) {
    for (const card of CARDS) {
      const product = await prisma.predefinedCard.findFirst({ where: { catalogKey: card.catalogKey }, select: { id: true } });
      if (!product) throw new Error(`Development catalog is missing ${card.catalogKey}; run the guarded catalog sync on dev first.`);
      const result = await createCardForUser(user.id, product.id, new Date(`${card.openedDate}T00:00:00Z`));
      if (!result.success) throw new Error(result.message ?? `Could not create ${card.catalogKey}.`);
    }
  }

  const statuses = await prisma.benefitStatus.count({ where: { userId: user.id } });
  console.log(`E2E user ready: ${E2E_EMAIL} (${await prisma.creditCard.count({ where: { userId: user.id } })} cards, ${statuses} statuses).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
