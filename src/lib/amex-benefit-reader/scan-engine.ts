// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { CatalogResponse, MemberResponse, TrackerResponse } from "./amex-api-contract";
import { AmexApiError } from "./amex-api-client";
import {
  parseAccountDiscovery,
  normalizeBenefits,
  type AccountDiscovery,
  type BenefitIdentityConflictDiagnostic,
  type BenefitIdentityConflictDetailSet,
} from "./amex-response-adapter";
import {
  OBSERVATION_CONTRACT_VERSION_V3,
  PARSER_VERSION,
  type IssueCode,
  type NormalizedCardObservation,
  type ScanSummaryV1,
  type StoreEnvelopeV1,
  type StoredCardRecordV1,
} from "./contract";
import { reconcileCardIdentity } from "./identity";
import type { CardAttemptResult, CardIdentityMetadata } from "./storage-policy";

export interface VisiblePageContext {
  route: string;
  selectedCardDisplayFingerprint: string | null;
}

export interface VisibleContextGuard {
  capture(): VisiblePageContext;
  verifyUnchanged(context: VisiblePageContext): boolean;
}

export interface AmexReadClient {
  discoverAccounts(signal: AbortSignal): Promise<MemberResponse>;
  readBenefitTrackers(rawAccountToken: string, signal: AbortSignal): Promise<TrackerResponse>;
  readBenefitCatalog(rawAccountToken: string, signal: AbortSignal): Promise<CatalogResponse>;
}

export interface ResultStore {
  load(): Promise<StoreEnvelopeV1>;
  commitCard(result: CardAttemptResult, checkpoint?: ScanSummaryV1): Promise<StoredCardRecordV1>;
  recordScanSummary(summary: ScanSummaryV1): Promise<void>;
  clear(): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export type CardReadPhase = "trackers" | "catalog" | "normalizing";

export type ScanProgress =
  | { type: "started" }
  | { type: "discovered"; cardCount: number; unknownEntryCount: number }
  | { type: "card"; cardIndex: number; cardCount: number; productName: string; endingDigits: string; phase: CardReadPhase }
  | {
      type: "card_committed";
      record: StoredCardRecordV1;
      conflictDiagnostics: BenefitIdentityConflictDiagnostic[];
      conflictDetails: BenefitIdentityConflictDetailSet;
    }
  | { type: "verifying_context" }
  | { type: "finished"; summary: ScanSummaryV1 };

export interface ScanReporter {
  report(progress: ScanProgress): void;
}

export interface PreparedCardIdentity {
  sourceFingerprint: string;
  productName: string;
  endingDigits: string;
}

export interface CardIdentityService {
  prepareCard(input: { rawAccountToken: string; productName: string; endingDigits: string }): Promise<PreparedCardIdentity>;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AmexApiError("scan_cancelled");
}

function issueFromError(error: unknown): IssueCode {
  if (error instanceof AmexApiError) return error.issueCode;
  return "response_schema_invalid";
}

function createScanId(): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random scan identity is unavailable.");
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const CATALOG_PARTIAL_ISSUES = new Set<IssueCode>([
  "response_schema_invalid",
  "request_timeout",
  "network_error",
  "http_error",
  "content_type_invalid",
  "redirect_rejected",
]);

export class AmexBenefitScanEngine {
  private activeController: AbortController | null = null;

  constructor(
    private readonly client: AmexReadClient,
    private readonly visibleContext: VisibleContextGuard,
    private readonly store: ResultStore,
    private readonly identity: CardIdentityService,
    private readonly reporter: ScanReporter,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  get isScanning(): boolean {
    return this.activeController !== null;
  }

  cancel(): void {
    this.activeController?.abort();
  }

  async scanAllCards(): Promise<ScanSummaryV1> {
    if (this.activeController) throw new Error("A scan is already active in this tab.");
    const controller = new AbortController();
    this.activeController = controller;
    const signal = controller.signal;
    const startedAt = this.clock.now().toISOString();
    const scanId = createScanId();
    const dispositions: ScanSummaryV1["cards"] = [];
    let capturedContext: VisiblePageContext | null = null;
    let discovery: AccountDiscovery | null = null;
    let attemptedCardCount = 0;
    let discoveredCardCount = 0;
    let unknownAccountVariantCount = 0;
    let interrupted = false;
    let discoveryFailed = false;
    let processingFailed = false;
    let retainedUnseenCard = false;
    let visibleContextResult: ScanSummaryV1["visibleContext"] = "unavailable";

    this.reporter.report({ type: "started" });
    try {
      try {
        capturedContext = this.visibleContext.capture();
      } catch {
        capturedContext = null;
      }
      throwIfAborted(signal);
      const initialStore = await this.store.load();
      await this.store.recordScanSummary({
        scanId,
        startedAt,
        finishedAt: this.clock.now().toISOString(),
        status: "interrupted",
        discoveredCardCount: 0,
        attemptedCardCount: 0,
        unknownAccountVariantCount: 0,
        cards: [],
        visibleContext: "unavailable",
      });

      let memberResponse: MemberResponse | null = await this.client.discoverAccounts(signal);
      try {
        discovery = parseAccountDiscovery(memberResponse);
      } finally {
        memberResponse = null;
      }
      discoveredCardCount = discovery.cards.length;
      unknownAccountVariantCount = discovery.unknownVariantCount;
      this.reporter.report({
        type: "discovered",
        cardCount: discoveredCardCount,
        unknownEntryCount: unknownAccountVariantCount,
      });
      const claimed = new Set<string>();

      await this.recordInterruptionCheckpoint(scanId, startedAt, discovery, attemptedCardCount, dispositions);

      const discovered = discovery;
      // Refill each network slot independently of a card's slower sibling read
      // or storage commit. Queued work checks cancellation before sending.
      let activeReads = 0;
      const waitingReads: Array<() => void> = [];
      const read = async <T,>(operation: () => Promise<T>): Promise<T> => {
        if (activeReads >= 4) await new Promise<void>((resolve) => waitingReads.push(resolve));
        else activeReads += 1;
        try {
          throwIfAborted(signal);
          return await operation();
        } finally {
          const next = waitingReads.shift();
          if (next) next(); // Transfer this slot without opening a fifth one.
          else activeReads -= 1;
        }
      };
      // Storage read/merge/write cycles still run one at a time.
      let writeTail = Promise.resolve();
      const persist = <T,>(operation: () => Promise<T>): Promise<T> => {
        const pending = writeTail.then(operation);
        writeTail = pending.then(() => undefined, () => undefined);
        return pending;
      };
      const commitCard = (result: CardAttemptResult) => persist(async () => {
        throwIfAborted(signal);
        const disposition: ScanSummaryV1["cards"][number] = {
          localCardId: result.identity.localCardId,
          result: result.disposition === "failed" && result.errorCode === "account_canceled" ? "skipped" : result.disposition,
          issueCode: result.disposition === "failed" ? result.errorCode : result.observation.issueCodes[0] ?? null,
        };
        const record = await this.store.commitCard(result, {
          scanId, startedAt, finishedAt: this.clock.now().toISOString(), status: "interrupted",
          discoveredCardCount: discovered.cards.length, attemptedCardCount,
          unknownAccountVariantCount: discovered.unknownVariantCount,
          cards: [...dispositions, disposition], visibleContext: "unavailable",
        });
        dispositions.push(disposition);
        return record;
      });
      const checkpoint = () => {
        return persist(() => this.recordInterruptionCheckpoint(scanId, startedAt, discovered, attemptedCardCount, dispositions));
      };
      const processCard = async (index: number): Promise<void> => {
        throwIfAborted(signal);
        const transientCard = discovered.cards[index];
        let rawAccountToken = transientCard.rawAccountToken;
        // Remove the token from the scan-wide discovery collection immediately;
        // only this card attempt retains a reference from this point onward.
        transientCard.rawAccountToken = "";
        if (!transientCard.canceled) attemptedCardCount += 1;
        let prepared: PreparedCardIdentity;
        try {
          prepared = await this.identity.prepareCard({
            rawAccountToken,
            productName: transientCard.productName,
            endingDigits: transientCard.endingDigits,
          });
        } catch {
          rawAccountToken = "";
          dispositions.push({ localCardId: null, result: "failed", issueCode: "identity_unavailable" });
          await checkpoint();
          return;
        }

        const resolution = reconcileCardIdentity({
          sourceFingerprint: prepared.sourceFingerprint,
          productName: prepared.productName,
          endingDigits: prepared.endingDigits,
          records: initialStore.cards,
          claimedLocalCardIds: claimed,
        });
        if (resolution.kind === "ambiguous" || resolution.kind === "conflict") {
          rawAccountToken = "";
          dispositions.push({
            localCardId: null,
            result: "failed",
            issueCode: resolution.kind === "ambiguous" ? "identity_ambiguous" : "identity_conflict",
          });
          await checkpoint();
          return;
        }

        const localCardId = resolution.localCardId;
        claimed.add(localCardId);
        const identity: CardIdentityMetadata = {
          localCardId,
          sourceFingerprint: prepared.sourceFingerprint,
          productName: prepared.productName,
          endingDigits: prepared.endingDigits,
        };
        if (transientCard.canceled) {
          // Member status is authoritative. Keep the identity and any saved
          // observation, but never request benefits for a canceled account.
          rawAccountToken = "";
          const record = await commitCard({
            disposition: "failed",
            identity,
            attemptedAt: this.clock.now().toISOString(),
            errorCode: "account_canceled",
          });
          this.reporter.report({ type: "card_committed", record, conflictDiagnostics: [], conflictDetails: { details: [], totalCount: 0, truncated: false } });
          return;
        }
        let trackerResponse: TrackerResponse | null = null;
        let catalogResponse: CatalogResponse | null = null;
        let catalogIssueCode: IssueCode | null = null;
        try {
          this.reporter.report({
            type: "card",
            cardIndex: index + 1,
            cardCount: discovered.cards.length,
            productName: prepared.productName,
            endingDigits: prepared.endingDigits,
            phase: "trackers",
          });
          // Independent reads for this card share the scan's four-request budget.
          const reads = await Promise.allSettled([
            read(() => this.client.readBenefitTrackers(rawAccountToken, signal)),
            read(() => this.client.readBenefitCatalog(rawAccountToken, signal)),
          ]);
          throwIfAborted(signal);
          if (reads[0].status === "rejected") throw reads[0].reason;
          trackerResponse = reads[0].value;
          if (reads[1].status === "fulfilled") {
            catalogResponse = reads[1].value;
          } else {
            const code = issueFromError(reads[1].reason);
            if (!CATALOG_PARTIAL_ISSUES.has(code)) throw reads[1].reason;
            catalogIssueCode = code;
            catalogResponse = { benefits: {} };
          }
          throwIfAborted(signal);
          this.reporter.report({
            type: "card",
            cardIndex: index + 1,
            cardCount: discovered.cards.length,
            productName: prepared.productName,
            endingDigits: prepared.endingDigits,
            phase: "normalizing",
          });
          const normalized = normalizeBenefits({
            productName: prepared.productName,
            trackerResponse,
            catalogResponse,
          });
          const issueCodes = Array.from(new Set<IssueCode>([
            ...normalized.issueCodes,
            ...(catalogIssueCode ? [catalogIssueCode] : []),
            ...(resolution.kind === "reconciled" ? ["display_reconciled" as const] : []),
          ]));
          const disposition = issueCodes.length ? "partial" as const : "complete" as const;
          const observedAt = this.clock.now().toISOString();
          const observation: NormalizedCardObservation = {
            contractVersion: OBSERVATION_CONTRACT_VERSION_V3,
            issuer: "american_express_us",
            localCardId,
            productName: prepared.productName,
            endingDigits: prepared.endingDigits,
            observedAt,
            parserVersion: PARSER_VERSION,
            scanId,
            completeness: disposition,
            issueCodes,
            benefits: normalized.benefits,
          };
          const record = await commitCard({
            disposition,
            identity,
            attemptedAt: observedAt,
            observation,
          });
          this.reporter.report({
            type: "card_committed",
            record,
            conflictDiagnostics: normalized.conflictDiagnostics,
            conflictDetails: normalized.conflictDetails,
          });
        } catch (error) {
          const code = issueFromError(error);
          if (code === "scan_cancelled") {
            interrupted = true;
            controller.abort();
            throw error;
          }
          const attemptedAt = this.clock.now().toISOString();
          const record = await commitCard({
            disposition: "failed",
            identity,
            attemptedAt,
            errorCode: code,
          });
          this.reporter.report({ type: "card_committed", record, conflictDiagnostics: [], conflictDetails: { details: [], totalCount: 0, truncated: false } });
        } finally {
          trackerResponse = null;
          catalogResponse = null;
          rawAccountToken = "";
        }
      };
      // Drain active and queued reads before another scan can start.
      const workers = await Promise.allSettled(discovered.cards.map((_, index) => processCard(index)));
      const rejected = workers.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (rejected) throw rejected.reason;

      for (const record of Object.values(initialStore.cards)) {
        if (claimed.has(record.localCardId)) continue;
        // Amex can later omit closed accounts entirely. Keep their explicit
        // canceled history until a future discovery identifies them as active.
        if (record.error?.code === "account_canceled") continue;
        retainedUnseenCard = true;
        const attemptedAt = this.clock.now().toISOString();
        const staleRecord = await this.store.commitCard({
          disposition: "failed",
          identity: {
            localCardId: record.localCardId,
            sourceFingerprint: record.identity.sourceFingerprint,
            productName: record.identity.productName,
            endingDigits: record.identity.endingDigits,
          },
          attemptedAt,
          errorCode: "identity_ambiguous",
        });
        this.reporter.report({ type: "card_committed", record: staleRecord, conflictDiagnostics: [], conflictDetails: { details: [], totalCount: 0, truncated: false } });
      }
    } catch (error) {
      const code = issueFromError(error);
      if (code === "scan_cancelled") interrupted = true;
      else {
        discoveryFailed = discovery === null;
        processingFailed = discovery !== null;
        if (discoveryFailed) dispositions.push({ localCardId: null, result: "failed", issueCode: code });
      }
    } finally {
      discovery?.cards.forEach((card) => {
        card.rawAccountToken = "";
      });
      discovery = null;
      this.reporter.report({ type: "verifying_context" });
      if (capturedContext) {
        try {
          visibleContextResult = this.visibleContext.verifyUnchanged(capturedContext) ? "unchanged" : "changed";
        } catch {
          visibleContextResult = "unavailable";
        }
      }
    }

    const hasFailure = dispositions.some((item) => item.result === "failed");
    const hasPartial = dispositions.some((item) => item.result === "partial");
    const noSuccessfulCards = discoveredCardCount > 0
      && !dispositions.some((item) => item.result === "complete" || item.result === "partial" || item.result === "skipped");
    const status: ScanSummaryV1["status"] = interrupted
      ? "interrupted"
      : discoveryFailed || discoveredCardCount === 0 || noSuccessfulCards
        ? "failed"
        : processingFailed || hasFailure || hasPartial || retainedUnseenCard || unknownAccountVariantCount > 0 || visibleContextResult !== "unchanged"
          ? "partial"
          : "complete";
    const summary: ScanSummaryV1 = {
      scanId,
      startedAt,
      finishedAt: this.clock.now().toISOString(),
      status,
      discoveredCardCount,
      attemptedCardCount,
      unknownAccountVariantCount: unknownAccountVariantCount,
      cards: dispositions,
      visibleContext: visibleContextResult,
    };
    try {
      await this.store.recordScanSummary(summary);
      this.reporter.report({ type: "finished", summary });
      return summary;
    } finally {
      this.activeController = null;
    }
  }

  private async recordInterruptionCheckpoint(
    scanId: string,
    startedAt: string,
    discovery: AccountDiscovery,
    attemptedCardCount: number,
    cards: ScanSummaryV1["cards"],
  ): Promise<void> {
    await this.store.recordScanSummary({
      scanId,
      startedAt,
      finishedAt: this.clock.now().toISOString(),
      status: "interrupted",
      discoveredCardCount: discovery.cards.length,
      attemptedCardCount,
      unknownAccountVariantCount: discovery.unknownVariantCount,
      cards: [...cards],
      visibleContext: "unavailable",
    });
  }
}
