// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { getPrismaClient } from './prisma-client-provider';

// Existing application imports retain the same process-wide singleton behavior.
// Injection-aware operator modules import getPrismaClient directly so importing
// them cannot construct an environment-selected client before target validation.
export const prisma = getPrismaClient();
