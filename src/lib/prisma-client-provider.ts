// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let moduleClient: PrismaClient | undefined;

/**
 * Lazy process singleton. Importing a module that supports explicit client
 * injection must not construct an environment-selected Prisma client.
 */
export function getPrismaClient(): PrismaClient {
  if (moduleClient) return moduleClient;
  moduleClient = globalForPrisma.prisma ?? new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 5000,
      timeout: 10000,
    },
  });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = moduleClient;
  return moduleClient;
}
