import { z } from "zod";
import {
  OBSERVATION_CONTRACT_VERSION_V3,
  PARSER_VERSION,
  amexProductKeySchema,
  assertNoForbiddenFieldNames,
  creditFamilyKeySchema,
  quantitySchema,
  sourcePeriodV2Schema,
  type NormalizedBenefitObservationV3,
  type StoreEnvelopeV1,
} from "./contract";
import { createAmexBrowserCreditMatcher } from "./supported-card-credits";

const AMEX_SYNC_ENVELOPE_VERSION = "amex-sync-envelope/3" as const;
export const AMEX_SYNC_MAX_BYTES = 256 * 1024;
const AMEX_SYNC_MAX_CARDS = 50;
export const AMEX_SYNC_MAX_ROWS = 300;
const AMEX_SYNC_MAX_SCAN_AGE_MS = 30 * 60 * 1000;

const transportQuantitySchema = quantitySchema.refine(
  (quantity) => quantity.value.length <= 32,
  "Quantity value is too long.",
);

const syncExclusionReasonSchema = z.enum([
  "v1_only",
  "older_scan",
  "stale",
  "partial",
  "failed",
  "not_attempted_successfully",
  "no_structured_period",
  "prerequisite_only",
  "status_unavailable",
  "source_mapping_ambiguous",
  "source_last_five_required",
]);
export type SyncExclusionReason = z.infer<typeof syncExclusionReasonSchema>;

const amexSyncRowSchema = z.object({
  providerTitle: z.string().trim().min(1).max(200),
  providerCategory: z.literal("usage"),
  sourceCreditKey: creditFamilyKeySchema,
  creditFamilyKey: creditFamilyKeySchema,
  sourcePeriod: sourcePeriodV2Schema.nullable(),
  enrollmentState: z.enum(["enrolled", "required", "linking_required", "not_required"]).nullable(),
  completionState: z.enum(["complete", "incomplete"]).nullable(),
  earnedOrUsed: transportQuantitySchema.nullable(),
  targetOrLimit: transportQuantitySchema.nullable(),
}).strict();
export type AmexSyncRow = z.infer<typeof amexSyncRowSchema>;

const amexSyncCardSchema = z.object({
  sourceLocalCardId: z.string().uuid(),
  providerProductName: z.string().trim().min(1).max(200),
  productKey: amexProductKeySchema,
  endingDigits: z.string().regex(/^\d{5}$/),
  observedAt: z.string().datetime({ offset: true }),
  parserVersion: z.literal(PARSER_VERSION),
  rows: z.array(amexSyncRowSchema).max(AMEX_SYNC_MAX_ROWS),
}).strict();
export type AmexSyncCard = z.infer<typeof amexSyncCardSchema>;

export const amexSyncEnvelopeSchema = z.object({
  envelopeVersion: z.literal(AMEX_SYNC_ENVELOPE_VERSION),
  observationContractVersion: z.literal(OBSERVATION_CONTRACT_VERSION_V3),
  scanId: z.string().uuid(),
  scanFinishedAt: z.string().datetime({ offset: true }),
  cards: z.array(amexSyncCardSchema).min(1).max(AMEX_SYNC_MAX_CARDS),
  exclusions: z.array(z.object({
    reason: syncExclusionReasonSchema,
    count: z.number().int().positive().max(AMEX_SYNC_MAX_ROWS),
  }).strict()).max(syncExclusionReasonSchema.options.length),
}).strict().superRefine((envelope, context) => {
  const rowCount = envelope.cards.reduce((count, card) => count + card.rows.length, 0);
  if (rowCount > AMEX_SYNC_MAX_ROWS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["cards"], message: "The sync envelope has too many rows." });
  }
  const cardIds = new Set<string>();
  const scanFinishedAt = Date.parse(envelope.scanFinishedAt);
  envelope.cards.forEach((card, index) => {
    if (cardIds.has(card.sourceLocalCardId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["cards", index, "sourceLocalCardId"], message: "Source cards must be unique." });
    }
    cardIds.add(card.sourceLocalCardId);
    if (Date.parse(card.observedAt) > scanFinishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cards", index, "observedAt"],
        message: "A card observation cannot be newer than its completed scan.",
      });
    }
  });
});
export type AmexSyncEnvelope = z.infer<typeof amexSyncEnvelopeSchema>;

const SYNC_FORBIDDEN_FIELD_PATTERN = /(?:sourcefingerprint|identitysecret|fullcard|cardnumber|accountnumber|accounttoken|opaquetoken|tokenvalue|password|passcode|mfa|cookie|authorization|requestheaders|requestbody|rawrequest|rawresponse|userid|email)/i;

function assertNoSyncForbiddenFieldNames(value: unknown): void {
  assertNoForbiddenFieldNames(value);
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) return candidate.forEach(visit);
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(candidate)) {
      if (SYNC_FORBIDDEN_FIELD_PATTERN.test(key.replace(/[^a-z]/gi, ""))) {
        throw new Error("Sync input contains a forbidden field name.");
      }
      visit(child);
    }
  };
  visit(value);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function parseAmexSyncEnvelope(value: unknown): AmexSyncEnvelope {
  assertNoSyncForbiddenFieldNames(value);
  const envelope = amexSyncEnvelopeSchema.parse(value);
  if (new TextEncoder().encode(canonicalJson(envelope)).byteLength > AMEX_SYNC_MAX_BYTES) {
    throw new Error("Sync input exceeds the byte limit.");
  }
  return envelope;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function digestAmexSyncEnvelope(envelope: AmexSyncEnvelope): Promise<string> {
  return sha256Hex(canonicalJson(parseAmexSyncEnvelope(envelope)));
}

function observedValue<T>(field: { state: string; value?: T }): T | null {
  return field.state === "observed" && field.value !== undefined ? field.value : null;
}

function projectRow(
  benefit: NormalizedBenefitObservationV3,
  match: { creditFamilyKey: string; sourceCreditKey: string },
): AmexSyncRow {
  return {
    providerTitle: benefit.title,
    providerCategory: "usage",
    sourceCreditKey: match.sourceCreditKey,
    creditFamilyKey: match.creditFamilyKey,
    sourcePeriod: observedValue(benefit.sourcePeriod),
    enrollmentState: observedValue(benefit.enrollmentState),
    completionState: observedValue(benefit.completionState),
    earnedOrUsed: observedValue(benefit.earnedOrUsed),
    targetOrLimit: observedValue(benefit.targetOrLimit),
  };
}

export type SyncCoverageReason = SyncExclusionReason | "not_usage" | "unmapped";
export interface SyncCoverage {
  totalBenefits: number;
  readyBenefits: number;
  excludedBenefits: number;
  canceledCards: number;
  unavailableCards: number;
  issues: Array<{ cardLabel: string; benefitTitle: string; reason: SyncCoverageReason }>;
}

export const SYNC_COVERAGE_LABELS: Record<SyncCoverageReason, string> = {
  v1_only: "Refresh this card",
  older_scan: "Not in the latest refresh",
  stale: "Refresh failed; showing an older result",
  partial: "Refresh did not finish for this card",
  failed: "Couldn’t read this card",
  not_attempted_successfully: "Refresh this card",
  no_structured_period: "Amex did not provide the benefit dates",
  prerequisite_only: "Enrollment or linking needed",
  status_unavailable: "Amex did not provide usage",
  source_mapping_ambiguous: "Multiple benefits match the same credit",
  source_last_five_required: "Card ending is missing",
  not_usage: "Not a usage tracker",
  unmapped: "No matching credit in Perks Reminder",
};

export interface SyncEnvelopeProjection {
  coverage: SyncCoverage;
  envelope: AmexSyncEnvelope | null;
  reason: "ready" | "fresh_v3_scan_required" | "no_complete_cards";
}

export function projectLatestV3SyncEnvelope(store: StoreEnvelopeV1): SyncEnvelopeProjection {
  const summary = store.lastScan;
  const coverage: SyncCoverage = {
    totalBenefits: 0, readyBenefits: 0, excludedBenefits: 0,
    canceledCards: 0, unavailableCards: 0, issues: [],
  };
  const needsRefresh = !summary?.scanId || summary.status === "interrupted" || summary.status === "failed";
  const successfulCardIds = new Set((summary?.cards ?? [])
    .filter((card) => card.result === "complete" && card.localCardId)
    .map((card) => card.localCardId as string));
  const exclusions = new Map<SyncExclusionReason, number>();
  const exclude = (reason: SyncExclusionReason, count = 1): void => {
    if (!count) return;
    exclusions.set(reason, Math.min(AMEX_SYNC_MAX_ROWS, (exclusions.get(reason) ?? 0) + count));
  };

  const cards: AmexSyncCard[] = [];
  for (const record of Object.values(store.cards)) {
    if (record.error?.code === "account_canceled") {
      coverage.canceledCards++;
      continue;
    }
    const latest = record.latest;
    if (!latest) {
      coverage.unavailableCards++;
      continue;
    }
    coverage.totalBenefits += latest.benefits.length;
    const report = (reason: SyncCoverageReason, benefits = latest.benefits): void => {
      coverage.excludedBenefits += benefits.length;
      for (const benefit of benefits) coverage.issues.push({
        cardLabel: `${record.identity.productName} ••••• ${record.identity.endingDigits}`,
        benefitTitle: benefit.title,
        reason,
      });
      // Keep the v3 wire contract compatible with installed servers.
      if (reason === "unmapped") exclude("source_mapping_ambiguous", benefits.length);
      else if (reason === "not_usage") exclude("status_unavailable", benefits.length);
      else exclude(reason, benefits.length);
    };
    if (needsRefresh) {
      report("not_attempted_successfully");
      coverage.unavailableCards++;
      continue;
    }
    if (latest.contractVersion !== OBSERVATION_CONTRACT_VERSION_V3 || latest.parserVersion !== PARSER_VERSION) {
      report("v1_only");
      coverage.unavailableCards++;
      continue;
    }
    if (latest.scanId !== summary?.scanId) {
      report("older_scan");
      coverage.unavailableCards++;
      continue;
    }
    if (record.freshness !== "current") {
      report(record.freshness === "stale_error" ? "stale" : "failed");
      coverage.unavailableCards++;
      continue;
    }
    if (record.completeness !== "complete" || latest.completeness !== "complete") {
      report("partial");
      coverage.unavailableCards++;
      continue;
    }
    if (!successfulCardIds.has(record.localCardId)) {
      report("not_attempted_successfully");
      coverage.unavailableCards++;
      continue;
    }

    if (!/^\d{5}$/.test(latest.endingDigits)) {
      report("source_last_five_required");
      continue;
    }
    const matchCredit = createAmexBrowserCreditMatcher(latest.productName);
    const mapped = latest.benefits.flatMap((benefit) => {
      if (benefit.category.state !== "observed" || benefit.category.value !== "usage") {
        report("not_usage", [benefit]);
        return [];
      }
      const match = matchCredit(benefit.title, {
        sourcePeriod: benefit.sourcePeriod.state === "observed" ? benefit.sourcePeriod.value : null,
        earnedOrUsed: benefit.earnedOrUsed.state === "observed" ? benefit.earnedOrUsed.value : null,
      });
      if (!match) report("unmapped", [benefit]);
      return match ? [{ benefit, match }] : [];
    });
    const sourceMappingKey = ({
      benefit,
      match,
    }: typeof mapped[number]): string => {
      const period = benefit.sourcePeriod.state === "observed"
        ? `${benefit.sourcePeriod.value.startDate}|${benefit.sourcePeriod.value.endDate}`
        : "unstructured";
      return `${match.sourceCreditKey}|${period}`;
    };
    const sourceCounts = new Map<string, number>();
    mapped.forEach((candidate) => {
      const key = sourceMappingKey(candidate);
      sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
    });
    const unambiguous = mapped.filter((candidate) => sourceCounts.get(sourceMappingKey(candidate)) === 1);
    const ambiguous = mapped.filter((candidate) => sourceCounts.get(sourceMappingKey(candidate)) !== 1);
    if (ambiguous.length) report("source_mapping_ambiguous", ambiguous.map(({ benefit }) => benefit));
    coverage.readyBenefits += unambiguous.length;
    if (!unambiguous.length) continue;

    cards.push({
      sourceLocalCardId: latest.localCardId,
      providerProductName: latest.productName,
      productKey: amexProductKeySchema.parse(unambiguous[0].match.productKey),
      endingDigits: latest.endingDigits,
      observedAt: latest.observedAt,
      parserVersion: latest.parserVersion,
      rows: unambiguous.map(({ benefit, match }) => projectRow(benefit, match)),
    });
  }

  if (needsRefresh || !summary?.scanId) return { envelope: null, reason: "fresh_v3_scan_required", coverage };
  if (!cards.length) return { envelope: null, reason: "no_complete_cards", coverage };
  return {
    reason: "ready",
    coverage,
    envelope: parseAmexSyncEnvelope({
      envelopeVersion: AMEX_SYNC_ENVELOPE_VERSION,
      observationContractVersion: OBSERVATION_CONTRACT_VERSION_V3,
      scanId: summary.scanId,
      scanFinishedAt: summary.finishedAt,
      cards,
      exclusions: Array.from(exclusions, ([reason, count]) => ({ reason, count })),
    }),
  };
}

export function isSyncEnvelopeFresh(envelope: AmexSyncEnvelope, now: Date): boolean {
  const finishedAt = Date.parse(envelope.scanFinishedAt);
  const current = now.getTime();
  return Number.isFinite(finishedAt)
    && finishedAt <= current + 60_000
    && current - finishedAt <= AMEX_SYNC_MAX_SCAN_AGE_MS;
}
