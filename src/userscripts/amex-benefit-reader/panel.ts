import artworkAsset from "../../../extension/assets/benefits-orbit.webp";
import type {
  NormalizedBenefitObservation,
  ObservedField,
  QuantityV1,
  ScanSummaryV1,
  StoreEnvelopeV1,
  StoredCardRecordV1,
} from "@/lib/amex-benefit-reader/contract";
import type { ScanProgress, ScanReporter } from "@/lib/amex-benefit-reader/scan-engine";
import {
  formatAmexBenefitTitle,
  formatAmexSourcePeriod,
} from "@/lib/amex-benefit-reader/presentation";

import { projectLatestV3SyncEnvelope, SYNC_COVERAGE_LABELS, type SyncEnvelopeProjection } from "@/lib/amex-benefit-reader/sync-contract";

export { formatAmexSourcePeriod } from "@/lib/amex-benefit-reader/presentation";

// esbuild embeds a data URL; Next types static image imports as metadata.
const benefitsArtwork = typeof artworkAsset === "string" ? artworkAsset : artworkAsset.src;

export const AMEX_READER_HOST_ID = "perks-reminder-amex-reader";
const PERKS_REMINDER_MARK_SVG = `<svg viewBox="0 0 40 40" role="img" aria-label="Perks Reminder" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#172033"/><path d="M11 20a9 9 0 0 1 15.2-6.5M29 20a9 9 0 0 1-15.2 6.5" fill="none" stroke="#8fe3c1" stroke-width="3" stroke-linecap="round"/><path d="m25 10 2 4-4 1M15 30l-2-4 4-1" fill="none" stroke="#ffcf70" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export interface PanelActions {
  startScan(): Promise<void>;
  cancelScan(): void;
  syncReviewed?(): Promise<void>;
  clearData(): Promise<void>;
}

export interface PanelOptions {
  initiallyCollapsed?: boolean;
  requiresReloadAfterClear?: boolean;
}

type BenefitFilter = "remaining" | "used";
type BenefitTone = "amber" | "blue" | "green" | "muted";

export type BenefitUsageLabel =
  | "Not used"
  | "Partially used"
  | "Used"
  | "Enrollment required"
  | "Link required"
  | "Status unavailable";

export interface BenefitUsagePresentation {
  label: BenefitUsageLabel;
  tone: BenefitTone;
  filter: BenefitFilter;
}

interface BenefitPresentation extends BenefitUsagePresentation {
  amount: string | null;
  period: string | null;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (text != null) result.textContent = text;
  return result;
}

function quantityText(quantity: QuantityV1): string {
  if (quantity.unit === "USD") return `$${quantity.value.replace(/\.00$/, "")}`;
  if (quantity.unit === "percent") return `${quantity.value}%`;
  if (quantity.unit === "points") return `${quantity.value} points`;
  if (quantity.unit === "count") return quantity.value;
  return quantity.value;
}

function observedValue<T>(field: ObservedField<T>): T | null {
  return field.state === "observed" ? field.value : null;
}

function quantitiesAreCompatible(left: QuantityV1, right: QuantityV1): boolean {
  return left.unit !== "unknown"
    && right.unit !== "unknown"
    && left.unit === right.unit
    && left.currency === right.currency;
}

interface DecimalParts {
  integer: string;
  fraction: string;
}

function nonnegativeDecimalParts(value: string): DecimalParts | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  return {
    integer: match[1].replace(/^0+(?=\d)/, ""),
    fraction: (match[2] ?? "").replace(/0+$/, ""),
  };
}

function compareNonnegativeDecimals(left: string, right: string): -1 | 0 | 1 | null {
  const leftParts = nonnegativeDecimalParts(left);
  const rightParts = nonnegativeDecimalParts(right);
  if (!leftParts || !rightParts) return null;
  if (leftParts.integer.length !== rightParts.integer.length) {
    return leftParts.integer.length < rightParts.integer.length ? -1 : 1;
  }
  if (leftParts.integer !== rightParts.integer) return leftParts.integer < rightParts.integer ? -1 : 1;
  const fractionLength = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftFraction = leftParts.fraction.padEnd(fractionLength, "0");
  const rightFraction = rightParts.fraction.padEnd(fractionLength, "0");
  if (leftFraction === rightFraction) return 0;
  return leftFraction < rightFraction ? -1 : 1;
}

function compareUsageToPositiveTarget(current: QuantityV1 | null, target: QuantityV1 | null): -1 | 0 | 1 | null {
  if (!current || !target || !quantitiesAreCompatible(current, target)) return null;
  const targetVsZero = compareNonnegativeDecimals(target.value, "0");
  if (targetVsZero !== 1) return null;
  return compareNonnegativeDecimals(current.value, target.value);
}

function isObservedZero(quantity: QuantityV1 | null): boolean {
  return quantity !== null && compareNonnegativeDecimals(quantity.value, "0") === 0;
}

export function deriveBenefitUsageState(benefit: NormalizedBenefitObservation): BenefitUsagePresentation {
  const completion = observedValue(benefit.completionState);
  const tracker = observedValue(benefit.trackerState);
  const enrollment = observedValue(benefit.enrollmentState);
  const current = observedValue(benefit.earnedOrUsed);
  const target = observedValue(benefit.targetOrLimit);
  const quantityComparison = compareUsageToPositiveTarget(current, target);

  if (enrollment === "required") return { label: "Enrollment required", tone: "amber", filter: "remaining" };
  if (enrollment === "linking_required") return { label: "Link required", tone: "amber", filter: "remaining" };
  if (
    completion === "complete"
    || tracker === "earned"
    || tracker === "completed"
    || benefit.activityKind === "credit_earned"
    || benefit.activityKind === "completed"
    || quantityComparison === 0
    || quantityComparison === 1
  ) {
    return { label: "Used", tone: "green", filter: "used" };
  }
  if (quantityComparison === -1 && isObservedZero(current)) {
    return { label: "Not used", tone: "amber", filter: "remaining" };
  }
  if (tracker === "in_progress" || quantityComparison === -1) {
    return { label: "Partially used", tone: "blue", filter: "remaining" };
  }
  if (tracker === "not_started") {
    return { label: "Not used", tone: "amber", filter: "remaining" };
  }
  return { label: "Status unavailable", tone: "muted", filter: "remaining" };
}

function benefitPeriodText(benefit: NormalizedBenefitObservation): string | null {
  if ("sourcePeriod" in benefit) {
    const sourcePeriod = observedValue(benefit.sourcePeriod);
    if (sourcePeriod) return formatAmexSourcePeriod(sourcePeriod);
  }
  return observedValue(benefit.period);
}

function benefitPresentation(benefit: NormalizedBenefitObservation): BenefitPresentation {
  const state = deriveBenefitUsageState(benefit);
  const current = observedValue(benefit.earnedOrUsed);
  const target = observedValue(benefit.targetOrLimit);
  let amount: string | null = null;

  if (current && target && quantitiesAreCompatible(current, target)) {
    amount = `${quantityText(current)} of ${quantityText(target)} used`;
  } else if (current && !target && current.unit !== "unknown") {
    amount = `Used ${quantityText(current)}`;
  } else if (!current && target && target.unit !== "unknown") {
    amount = `Total ${quantityText(target)}`;
  }

  return {
    ...state,
    amount,
    period: benefitPeriodText(benefit),
  };
}

function sortedCards(store: StoreEnvelopeV1): StoredCardRecordV1[] {
  return Object.values(store.cards).sort((left, right) =>
    left.identity.productName.localeCompare(right.identity.productName)
    || left.identity.endingDigits.localeCompare(right.identity.endingDigits));
}

export type CardCoverageKind =
  | "canceled"
  | "benefit_bearing"
  | "confirmed_empty"
  | "latest_scan_unresolved"
  | "older_retained";

export interface CardCoverageEntry {
  record: StoredCardRecordV1;
  kind: CardCoverageKind;
}

function isConfirmedEmptyInLatestScan(
  record: StoredCardRecordV1,
  summary: ScanSummaryV1,
  dispositions: NonNullable<ScanSummaryV1["cards"]>,
): boolean {
  const cardDispositions = dispositions.filter((card) => card.localCardId === record.localCardId);
  if (cardDispositions.length !== 1 || cardDispositions[0].result !== "complete") return false;
  if (
    !record.latest
    || record.latest.benefits.length !== 0
    || record.freshness !== "current"
    || record.completeness !== "complete"
    || record.latest.completeness !== "complete"
  ) return false;
  return record.latest.contractVersion === "amex-benefits/1"
    || summary.scanId === undefined
    || record.latest.scanId === summary.scanId;
}

function projectCardCoverage(store: StoreEnvelopeV1): CardCoverageEntry[] {
  const cards = sortedCards(store);
  const summary = store.lastScan;
  const latestCardIds = new Set(summary?.cards.flatMap((card) => card.localCardId ? [card.localCardId] : []) ?? []);
  return cards.map((record) => {
    if (record.error?.code === "account_canceled") return { record, kind: "canceled" };
    if (!summary || !latestCardIds.has(record.localCardId)) return { record, kind: "older_retained" };
    if ((record.latest?.benefits.length ?? 0) > 0) return { record, kind: "benefit_bearing" };
    if (isConfirmedEmptyInLatestScan(record, summary, summary.cards)) return { record, kind: "confirmed_empty" };
    return { record, kind: "latest_scan_unresolved" };
  });
}

function filterLabel(filter: BenefitFilter): string {
  return filter === "remaining" ? "Remaining" : "Used";
}

export class AmexBenefitReaderPanel implements ScanReporter {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private store: StoreEnvelopeV1;
  private mode: "idle" | "scanning" | "cancelling" | "syncing" | "error" = "idle";
  private progress = "Ready to scan.";
  private progressCardCount: number | null = null;
  private progressCardIndex = 0;
  private errorMessage: string | null = null;
  private benefitFilter: BenefitFilter = "remaining";
  private searchQuery = "";
  private syncMessage: string | null = null;
  private syncProjectionCache: { store: StoreEnvelopeV1; projection: SyncEnvelopeProjection } | null = null;
  private collapsed: boolean;
  private readonly requiresReloadAfterClear: boolean;

  constructor(
    initialStore: StoreEnvelopeV1,
    private readonly actions: PanelActions,
    options: PanelOptions = {},
  ) {
    this.store = initialStore;
    this.collapsed = options.initiallyCollapsed ?? false;
    this.requiresReloadAfterClear = options.requiresReloadAfterClear ?? false;
    this.host = document.createElement("div");
    this.host.id = AMEX_READER_HOST_ID;
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key !== "Escape" || this.collapsed) return;
      event.preventDefault();
      this.collapsed = true;
      this.render();
      this.root.querySelector<HTMLButtonElement>(".launcher")?.focus();
    });
    document.documentElement.append(this.host);
    this.render();
  }

  static mountError(
    message: string,
    clearData: () => Promise<void>,
    options: PanelOptions = {},
  ): AmexBenefitReaderPanel | null {
    const now = new Date().toISOString();
    const empty: StoreEnvelopeV1 = { schemaVersion: 1, revision: 0, updatedAt: now, cards: {}, lastScan: null };
    const panel = new AmexBenefitReaderPanel(empty, {
      startScan: async () => undefined,
      cancelScan: () => undefined,
      syncReviewed: async () => undefined,
      clearData,
    }, { ...options, requiresReloadAfterClear: true });
    panel.mode = "error";
    panel.errorMessage = message;
    panel.render();
    return panel;
  }

  report(progress: ScanProgress): void {
    if (progress.type === "started") {
      this.mode = "scanning";
      this.progressCardCount = null;
      this.progressCardIndex = 0;
      this.progress = "Finding your cards…";
    } else if (progress.type === "discovered") {
      this.progressCardCount = progress.cardCount;
      this.progressCardIndex = 0;
      this.progress = progress.cardCount === 0
        ? "No cards found. Finishing up…"
        : `Checking ${progress.cardCount} card${progress.cardCount === 1 ? "" : "s"}…`;
    } else if (progress.type === "card") {
      this.progressCardCount = progress.cardCount;
      this.progress = `Refreshing · ${this.progressCardIndex} of ${progress.cardCount} cards checked`;
    } else if (progress.type === "card_committed") {
      this.progressCardIndex += 1;
      this.progress = `Refreshing · ${this.progressCardIndex} of ${this.progressCardCount ?? this.progressCardIndex} cards checked`;
      this.store = { ...this.store, cards: { ...this.store.cards, [progress.record.localCardId]: progress.record } };
    } else if (progress.type === "verifying_context") {
      if (this.progressCardCount !== null) this.progressCardIndex = this.progressCardCount;
      this.progress = "Finishing up…";
    } else {
      this.mode = "idle";
      this.progressCardCount = null;
      this.progressCardIndex = 0;
      this.store = { ...this.store, lastScan: progress.summary };
      this.progress = "Ready to scan.";
    }
    if (progress.type === "discovered" || progress.type === "card" || progress.type === "verifying_context"
      || (this.collapsed && progress.type === "card_committed")) {
      this.updateProgress();
      return;
    }
    this.render();
  }

  private updateProgress(): void {
    const launcher = this.root.querySelector<HTMLButtonElement>(".launcher");
    if (launcher) launcher.title = this.progress;
    const status = this.root.querySelector<HTMLElement>(".scan-status");
    if (status && status.textContent !== this.progress) status.textContent = this.progress;
    const progress = this.root.querySelector<HTMLProgressElement>(".scan-progress");
    if (!progress) return;
    if (this.progressCardCount !== null && this.progressCardCount > 0) {
      progress.max = this.progressCardCount;
      progress.value = Math.min(this.progressCardIndex, this.progressCardCount);
      progress.setAttribute("aria-valuetext", `${this.progressCardIndex} of ${this.progressCardCount} cards checked`);
    } else {
      progress.removeAttribute("value");
      progress.removeAttribute("aria-valuetext");
    }
  }

  get isBusy(): boolean { return this.mode !== "idle"; }

  async start(options: { reveal?: boolean } = {}): Promise<void> {
    if (this.mode !== "idle") return;
    if (options.reveal !== false) this.collapsed = false;
    this.mode = "scanning";
    this.progressCardCount = null;
    this.progressCardIndex = 0;
    this.progress = "Finding your cards…";
    this.errorMessage = null;
    this.syncMessage = null;
    this.render();
    try {
      // Only the terminal event enables syncing. Saved benefits and completed
      // card reads remain browsable while the rest of the scan is running.
      await this.actions.startScan();
    } catch {
      this.mode = "idle";
      this.errorMessage = "Couldn’t refresh. Try again.";
      this.render();
    }
  }

  private cancel(): void {
    if (this.mode !== "scanning") return;
    this.mode = "cancelling";
    this.progress = "Stopping refresh…";
    this.actions.cancelScan();
    this.render();
  }

  private async syncReviewed(): Promise<void> {
    if (this.mode !== "idle" || !this.store.lastScan || !this.actions.syncReviewed) return;
    this.mode = "syncing";
    this.errorMessage = null;
    this.syncMessage = "Opening Perks Reminder…";
    this.render();
    try {
      await this.actions.syncReviewed();
      this.syncMessage = "Continue in the Perks Reminder tab to choose what to add.";
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Couldn’t open Perks Reminder. Try again.";
      this.syncMessage = null;
    } finally {
      this.mode = "idle";
      this.render();
    }
  }

  private async clear(): Promise<void> {
    if (this.mode !== "idle" && this.mode !== "error") return;
    if (!window.confirm("Delete saved benefits from this browser? You can refresh to load them again.")) return;
    try {
      await this.actions.clearData();
      this.store = { schemaVersion: 1, revision: 0, updatedAt: new Date().toISOString(), cards: {}, lastScan: null };
      this.benefitFilter = "remaining";
      this.searchQuery = "";
      this.mode = this.requiresReloadAfterClear ? "error" : "idle";
      this.errorMessage = this.requiresReloadAfterClear ? "Saved benefits cleared. Reload this page to start again." : null;
      this.progress = this.requiresReloadAfterClear
        ? "Local data cleared. Reload required."
        : "Local data cleared. Nothing is scanned until you start.";
    } catch {
      this.mode = this.requiresReloadAfterClear ? "error" : "idle";
      this.errorMessage = "Couldn’t clear saved benefits. Try again.";
    }
    this.render();
  }

  private renderBenefit(benefit: NormalizedBenefitObservation): HTMLElement {
    const presentation = benefitPresentation(benefit);
    const item = element("li");
    item.className = `benefit-card tone-${presentation.tone}`;
    item.dataset.filter = presentation.filter;

    const top = element("div");
    top.className = "benefit-top";
    const heading = element("h4", formatAmexBenefitTitle(benefit.title));
    const badge = element("span", presentation.label);
    badge.className = `status-pill tone-${presentation.tone}`;
    top.append(heading, badge);
    item.append(top);

    const essentials = element("div");
    essentials.className = "benefit-essentials";
    if (presentation.amount) {
      const amount = element("span", presentation.amount);
      amount.className = "amount";
      essentials.append(amount);
    }
    if (presentation.period) {
      const period = element("span", presentation.period);
      period.className = "period";
      essentials.append(period);
    }
    if (essentials.childElementCount) item.append(essentials);

    return item;
  }

  private matchesSearch(record: StoredCardRecordV1, benefit: NormalizedBenefitObservation): boolean {
    const terms = this.searchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const label = `${record.identity.productName} ${record.identity.endingDigits} ${formatAmexBenefitTitle(benefit.title)}`.toLocaleLowerCase();
    return terms.every((term) => label.includes(term));
  }

  private renderCardGroup(record: StoredCardRecordV1, historical = false): HTMLElement {
    const section = element("section");
    const headingId = `pr-card-${record.localCardId}`;
    const benefits = record.latest?.benefits ?? [];
    const filtered = historical ? benefits : benefits.filter((benefit) =>
      benefitPresentation(benefit).filter === this.benefitFilter && this.matchesSearch(record, benefit));
    section.className = "card-group";
    section.dataset.amexReaderCardGroup = "true";
    section.dataset.cardProduct = record.identity.productName;
    section.dataset.cardEnding = record.identity.endingDigits;

    const headingRow = element("div");
    headingRow.className = "card-heading";
    const headingCopy = element("div");
    const heading = element("h3", `${record.identity.productName} •••• ${record.identity.endingDigits}`);
    heading.id = headingId;
    headingCopy.append(heading);
    const visibleLabel = filterLabel(this.benefitFilter).toLowerCase();
    const summaryId = `${headingId}-summary`;
    const summary = element(
      "p",
      historical ? "Saved benefits" : `${filtered.length} ${visibleLabel} benefit${filtered.length === 1 ? "" : "s"}`,
    );
    summary.id = summaryId;
    summary.className = "card-summary";
    headingCopy.append(summary);
    section.setAttribute("aria-labelledby", `${headingId} ${summaryId}`);
    const cardMark = element("span", "◇");
    cardMark.className = "card-mark";
    cardMark.setAttribute("aria-hidden", "true");
    headingRow.append(cardMark, headingCopy);
    section.append(headingRow);

    const list = element("ul");
    list.className = "benefit-list";
    filtered.forEach((benefit) => list.append(this.renderBenefit(benefit)));
    section.append(list);

    return section;
  }

  private render(): void {
    const active = this.root.activeElement as HTMLElement | null;
    const focusKey = active?.dataset.focusKey;
    const selection = active instanceof HTMLInputElement ? active.selectionStart : null;
    const scroll = this.root.querySelector<HTMLElement>(".content")?.scrollTop ?? 0;
    this.renderContents();
    const content = this.root.querySelector<HTMLElement>(".content");
    if (content) content.scrollTop = scroll;
    if (focusKey) {
      const next = this.root.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`);
      next?.focus({ preventScroll: true });
      if (next instanceof HTMLInputElement && selection !== null) next.setSelectionRange(selection, selection);
    }
  }

  private renderContents(): void {
    this.root.replaceChildren();
    const style = element("style");
    style.textContent = `
      :host { all:initial; --pr-text:#172033; --pr-muted:#667085; --pr-paper:#f6f8fa; --pr-white:#fff; --pr-rule:#dfe5eb; --pr-accent:#166b56; --pr-soft:#e9f6f0; --pr-warning:#875416; }
      * { box-sizing:border-box; } h2,h3,h4,p { margin:0; } ul { margin:0; }
      .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      button,input { font:inherit; } button { min-height:40px; border:1px solid var(--pr-rule); border-radius:10px; background:var(--pr-white); color:var(--pr-text); font-weight:600; padding:8px 12px; cursor:pointer; }
      button:hover { background:var(--pr-paper); } button:disabled { opacity:.5; cursor:default; }
      button:focus-visible,input:focus-visible,summary:focus-visible { outline:3px solid #2ca380; outline-offset:2px; }
      button.primary { color:#fff; background:var(--pr-accent); border-color:var(--pr-accent); } button.primary:hover { filter:brightness(1.1); }
      .launcher { position:fixed; z-index:2147483647; top:16px; right:16px; display:flex; align-items:center; gap:8px; padding:7px 13px 7px 7px; background:#172033; color:#fff; border:1px solid #354157; border-radius:16px; box-shadow:0 8px 28px #17203330; font:600 13px/1.4 system-ui,sans-serif; }
      .launcher:hover { background:#26334c; } .launcher svg { width:34px; height:34px; } .launcher-busy { width:8px; height:8px; border-radius:50%; background:#8fe3c1; }
      .panel { position:fixed; z-index:2147483647; top:16px; right:16px; display:flex; flex-direction:column; width:min(440px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:hidden; border:1px solid var(--pr-rule); border-radius:18px; background:var(--pr-paper); color:var(--pr-text); box-shadow:0 18px 60px #17203326; font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .top { flex-shrink:0; padding:16px 18px 12px; background:var(--pr-white); border-bottom:1px solid var(--pr-rule); }
      .brand-row,.scan-heading { display:flex; align-items:center; gap:10px; } .brand-mark { width:32px; height:32px; flex-shrink:0; } .brand-mark svg { width:32px; height:32px; }
      h2 { font-size:18px; line-height:1.3; letter-spacing:-.02em; } .eyebrow { color:var(--pr-muted); font-size:11px; }
      .collapse-button { margin-left:auto; min-width:40px; padding:6px; border:0; font-size:20px; color:var(--pr-muted); background:transparent; }
      .controls { display:flex; gap:8px; margin-top:12px; } .controls .primary { flex:1; } .controls button { font-size:12px; }
      .top > .scan-status { margin-top: 10px; }
      .sync-coverage { margin: 8px 0; font-size: 12px; color: var(--pr-muted); }
.sync-coverage summary { cursor: pointer; font-weight: 600; }
.sync-coverage[open] { max-height: 220px; overflow-y: auto; }
.sync-coverage p { margin: 8px 0; }
.sync-coverage ul { padding-left: 18px; }
.sync-coverage li { margin: 8px 0; }
.sync-coverage li span { display: block; font-size: 11px; }
.refresh-status { margin-top:9px; color:var(--pr-muted); font-size:11px; } .refresh-warning { color:var(--pr-warning); }
      .notice { margin-top:10px; color:var(--pr-muted); font-size:12px; } .notice-warning { color:var(--pr-warning); }
      .content { min-height:0; overflow:auto; overscroll-behavior:contain; padding:0 18px 16px; scrollbar-width:thin; }
      .browse-tools { position:sticky; top:0; z-index:1; background:var(--pr-paper); padding:14px 0 12px; }
      .search-row { display:flex; align-items:center; gap:6px; margin-bottom:10px; }
      .search { width:100%; min-width:0; height:40px; padding:9px 12px; border:1px solid var(--pr-rule); border-radius:10px; background:var(--pr-white); color:var(--pr-text); font-size:13px; } .search::placeholder { color:var(--pr-muted); }
      .clear-search { padding:4px 8px; font-size:12px; }
      .filters { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border:1px solid var(--pr-rule); border-radius:12px; background:var(--pr-white); }
      .filter-button { min-height:36px; border:0; padding:7px 10px; font-size:12px; color:var(--pr-muted); }
      .filter-button[aria-pressed="true"] { color:var(--pr-accent); background:var(--pr-soft); }
      .card-groups { display:grid; gap:22px; padding-top:6px; } .card-group { min-width:0; }
      .card-heading { display:flex; align-items:center; gap:9px; padding:0 0 10px; } h3 { font-size:13px; line-height:1.4; } .card-summary { margin-top:2px; color:var(--pr-muted); font-size:11px; }
      .card-mark { display:grid; flex-shrink:0; place-items:center; width:31px; height:24px; border:1px solid var(--pr-rule); border-radius:6px; color:var(--pr-accent); background:var(--pr-soft); }
      .benefit-list { display:grid; gap:8px; list-style:none; padding:0; }
      .benefit-card { padding:12px; border:1px solid var(--pr-rule); border-radius:12px; background:var(--pr-white); }
      .benefit-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; } h4 { font-size:13px; line-height:1.45; font-weight:600; overflow-wrap:anywhere; }
      .status-pill { display:inline-block; flex-shrink:0; padding:3px 7px; border-radius:6px; white-space:nowrap; font-size:10px; font-weight:600; background:var(--pr-paper); color:var(--pr-muted); }
      .status-pill.tone-green { color:var(--pr-accent); background:var(--pr-soft); } .status-pill.tone-blue { color:#2459a6; background:#edf4ff; } .status-pill.tone-amber { color:var(--pr-warning); background:#fff5df; }
      .benefit-essentials { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 10px; margin-top:8px; font-variant-numeric:tabular-nums; }
      .amount { font-size:12px; font-weight:600; } .period { color:var(--pr-muted); font-size:11px; }
      .empty-state { padding:24px 8px; color:var(--pr-muted); text-align:center; font-size:13px; } .empty-art { display:block; width:180px; height:105px; object-fit:cover; border-radius:14px; margin:16px auto 0; } .empty-state strong { display:block; color:var(--pr-text); font-size:16px; margin-bottom:6px; }
      details { border-top:1px solid var(--pr-rule); margin-top:16px; } summary { display:list-item; min-height:40px; padding:10px 0; color:var(--pr-muted); font-size:12px; cursor:pointer; } details p { color:var(--pr-muted); font-size:12px; margin:4px 0 12px; } .canceled-cards .card-group { margin:12px 0; }
      .footer { flex-shrink:0; padding:0 18px; background:var(--pr-white); border-top:1px solid var(--pr-rule); } .footer details { margin:0; border:0; } .clear-button { width:100%; margin-bottom:12px; color:#a33831; }
      .scan-workspace { padding:18px; display:grid; gap:18px; } .scan-workspace > p { margin-top:8px; font-size:17px; font-weight:600; } .scan-status { color:var(--pr-muted); font-size:13px; } .scan-progress { width:100%; height:8px; accent-color:var(--pr-accent); } .scan-cancel { justify-self:start; }
      @media (prefers-color-scheme:dark) { :host { --pr-text:#f1f5f9; --pr-muted:#a7b3c4; --pr-paper:#111827; --pr-white:#1b2535; --pr-rule:#344154; --pr-accent:#8fe3c1; --pr-soft:#173e35; --pr-warning:#efd09c; } button.primary { color:#122b24; } .status-pill.tone-blue { background:#1c3555; color:#b8d3ff; } .status-pill.tone-amber { background:#3b3021; } .clear-button { color:#ffb4ab; } }
      @media (max-width:520px) { .panel { top:8px; right:8px; width:calc(100vw - 16px); max-height:calc(100dvh - 16px); border-radius:15px; } .top { padding:12px 14px; } .content { padding:0 14px 14px; } .footer { padding:0 14px; } .benefit-top { flex-wrap:wrap; } .controls { flex-wrap:wrap; } .controls button { flex:1 1 auto; } }
      @media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; transition:none!important; } }
    `;

    if (this.collapsed) {
      const launcher = element("button");
      launcher.type = "button";
      launcher.dataset.focusKey = "visibility";
      launcher.className = "launcher";
      launcher.setAttribute("aria-label", "Open Perks Reminder Amex benefit reader");
      launcher.setAttribute("aria-expanded", "false");
      launcher.setAttribute("aria-controls", "pr-reader-panel");
      launcher.title = this.mode === "scanning" ? this.progress : "Your Amex benefits";
      launcher.innerHTML = PERKS_REMINDER_MARK_SVG;
      launcher.append(element("span", "Benefits"));
      if (this.mode === "scanning" || this.mode === "cancelling") {
        const dot = element("span");
        dot.className = "launcher-busy";
        dot.setAttribute("aria-hidden", "true");
        launcher.append(dot);
      }
      launcher.addEventListener("click", () => {
        this.collapsed = false;
        this.render();
      });
      this.root.append(style, launcher);
      return;
    }

    const panel = element("section");
    panel.id = "pr-reader-panel";
    panel.className = "panel";
    panel.setAttribute("aria-labelledby", "pr-reader-title");

    const refreshing = this.mode === "scanning" || this.mode === "cancelling";
    const hasBenefits = Object.values(this.store.cards).some((record) => (record.latest?.benefits.length ?? 0) > 0);
    if (refreshing && !hasBenefits) {
      const workspace = element("section");
      workspace.className = "scan-workspace";
      const title = element("h2", "Amex benefits");
      title.id = "pr-reader-title";
      const scanHeading = element("div");
      scanHeading.className = "scan-heading";
      const collapse = element("button", "−");
      collapse.className = "collapse-button";
      collapse.type = "button";
      collapse.dataset.focusKey = "visibility";
      collapse.setAttribute("aria-label", "Collapse Perks Reminder Amex benefit reader");
      collapse.addEventListener("click", () => { this.collapsed = true; this.render(); });
      scanHeading.append(title, collapse);
      workspace.append(scanHeading);
      workspace.append(element("p", "Refreshing your benefits"));
      const status = element("p", this.progress);
      status.className = "scan-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      workspace.append(status);
      const progress = element("progress");
      progress.className = "scan-progress";
      progress.setAttribute("aria-label", "Scan progress");
      if (this.progressCardCount !== null && this.progressCardCount > 0) {
        progress.max = this.progressCardCount;
        progress.value = Math.min(this.progressCardIndex, this.progressCardCount);
        progress.setAttribute("aria-valuetext", `${this.progressCardIndex} of ${this.progressCardCount} cards checked`);
      }
      workspace.append(progress);
      const cancel = element("button", this.mode === "cancelling" ? "Cancelling…" : "Cancel");
      cancel.type = "button";
      cancel.dataset.focusKey = "refresh";
      cancel.className = "scan-cancel";
      cancel.disabled = this.mode === "cancelling";
      cancel.addEventListener("click", () => this.cancel());
      workspace.append(cancel);
      panel.append(workspace);
      this.root.append(style, panel);
      return;
    }

    const top = element("div");
    top.className = "top";
    const brand = element("div");
    brand.className = "brand-row";
    const brandMark = element("div");
    brandMark.className = "brand-mark";
    brandMark.setAttribute("aria-hidden", "true");
    brandMark.innerHTML = PERKS_REMINDER_MARK_SVG;
    brand.append(brandMark);
    const brandText = element("div");
    const title = element("h2", "Amex benefits");
    title.id = "pr-reader-title";
    brandText.append(title, element("p", "Perks Reminder"));
    brandText.lastElementChild!.className = "eyebrow";
    brand.append(brandText);
    if (this.mode === "idle" || this.mode === "syncing" || this.mode === "error" || refreshing) {
      const collapse = element("button", "−");
      collapse.type = "button";
      collapse.dataset.focusKey = "visibility";
      collapse.className = "collapse-button";
      collapse.setAttribute("aria-label", "Collapse Perks Reminder Amex benefit reader");
      collapse.setAttribute("aria-expanded", "true");
      collapse.setAttribute("aria-controls", "pr-reader-panel");
      collapse.addEventListener("click", () => {
        this.collapsed = true;
        this.render();
      });
      brand.append(collapse);
    }
    top.append(brand);

    const controls = element("div");
    controls.className = "controls";
    const scan = element("button", refreshing ? (this.mode === "cancelling" ? "Stopping…" : "Cancel") : "Refresh");
    scan.type = "button";
    scan.className = "primary";
    scan.dataset.focusKey = "refresh";
    scan.disabled = this.mode !== "idle" && this.mode !== "scanning";
    scan.addEventListener("click", () => refreshing ? this.cancel() : void this.start());
    controls.append(scan);
    if (this.store.lastScan && this.actions.syncReviewed) {
      const sync = element("button", this.mode === "syncing" ? "Opening…" : "Sync to Perks Reminder");
      sync.type = "button";
      sync.dataset.amexSyncAction = "true";
      sync.dataset.focusKey = "sync";
      sync.title = "Choose benefits to add in a new tab";
      sync.disabled = this.mode !== "idle";
      sync.addEventListener("click", () => void this.syncReviewed());
      controls.append(sync);
    }
    top.append(controls);
    if (refreshing) {
      const status = element("p", this.progress);
      status.className = "scan-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      const progress = element("progress");
      progress.className = "scan-progress";
      progress.setAttribute("aria-label", "Scan progress");
      if (this.progressCardCount !== null && this.progressCardCount > 0) {
        progress.max = this.progressCardCount;
        progress.value = Math.min(this.progressCardIndex, this.progressCardCount);
        progress.setAttribute("aria-valuetext", `${this.progressCardIndex} of ${this.progressCardCount} cards checked`);
      }
      top.append(status, progress);
    }
    if (this.store.lastScan) {
      const lastScan = this.store.lastScan;
      const stamp = new Date(lastScan.finishedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const status = element("p", lastScan.status === "complete"
        ? `Updated ${stamp} · ${lastScan.attemptedCardCount} card${lastScan.attemptedCardCount === 1 ? "" : "s"}`
        : lastScan.status === "interrupted" ? "Refresh stopped. Showing saved benefits."
          : lastScan.status === "failed" ? "Couldn’t refresh. Sign in to Amex, then try again."
            : "Some benefits couldn’t update. Refresh to try again.");
      status.className = `refresh-status ${lastScan.status === "complete" ? "" : "refresh-warning"}`;
      top.append(status);
    }

    if (!refreshing && this.store.lastScan && this.actions.syncReviewed) {
      if (this.syncProjectionCache?.store !== this.store) {
        this.syncProjectionCache = { store: this.store, projection: projectLatestV3SyncEnvelope(this.store) };
      }
      const { coverage } = this.syncProjectionCache.projection;
      const details = element("details");
      details.className = "sync-coverage";
      const summary = element("summary", `${coverage.readyBenefits} of ${coverage.totalBenefits} benefits included for sync`);
      details.append(summary);
      const copy = element("p", "Perks Reminder checks these benefits and shows what was updated, already current, or skipped.");
      details.append(copy);
      if (coverage.unavailableCards) details.append(element("p", `${coverage.unavailableCards} card${coverage.unavailableCards === 1 ? " needs" : "s need"} another refresh.`));
      if (coverage.canceledCards) details.append(element("p", `${coverage.canceledCards} canceled card${coverage.canceledCards === 1 ? " is" : "s are"} kept in history.`));
      if (coverage.issues.length) {
        const list = element("ul");
        for (const issue of coverage.issues) {
          const item = element("li");
          item.append(element("strong", formatAmexBenefitTitle(issue.benefitTitle)),
            element("span", `${issue.cardLabel} · ${SYNC_COVERAGE_LABELS[issue.reason]}`));
          list.append(item);
        }
        details.append(list);
      }
      top.append(details);
    }

    if (this.syncMessage) {
      const message = element("p", this.syncMessage);
      message.className = "notice sync-message";
      message.setAttribute("aria-live", "polite");
      top.append(message);
    }

    if (this.errorMessage) {
      const error = element("p", this.errorMessage);
      error.className = "notice notice-warning";
      error.setAttribute("role", "alert");
      top.append(error);
    }
    panel.append(top);

    const coverage = projectCardCoverage(this.store);
    const canceledCards = coverage.filter(({ kind }) => kind === "canceled");
    const activeCoverage = coverage.filter(({ kind }) => kind !== "canceled");
    const cards = activeCoverage.map(({ record }) => record);
    const benefitCards = cards.filter((record) => (record.latest?.benefits.length ?? 0) > 0);
    const confirmedEmptyCards = coverage.filter(({ kind }) => kind === "confirmed_empty");
    const reviewEntries = activeCoverage.filter(({ kind }) => kind !== "confirmed_empty");
    const filterCounts: Record<BenefitFilter, number> = { remaining: 0, used: 0 };
    benefitCards.forEach((record) => {
      record.latest?.benefits.forEach((benefit) => {
        if (this.matchesSearch(record, benefit)) filterCounts[benefitPresentation(benefit).filter] += 1;
      });
    });
    const renderedEntries = reviewEntries.filter(({ record }) =>
      record.latest?.benefits.some((benefit) =>
        benefitPresentation(benefit).filter === this.benefitFilter && this.matchesSearch(record, benefit)));
    const content = element("div");
    content.className = "content";
    if (cards.length) {
      const totalBenefits = filterCounts.remaining + filterCounts.used;

      if (benefitCards.length) {
        const tools = element("div");
        tools.className = "browse-tools";
        const searchRow = element("div");
        searchRow.className = "search-row";
        const search = element("input");
        search.type = "text";
        search.className = "search";
        search.placeholder = "Find a card or benefit";
        search.setAttribute("aria-label", "Find a card or benefit");
        search.dataset.focusKey = "search";
        search.value = this.searchQuery;
        search.addEventListener("input", () => { this.searchQuery = search.value; this.render(); });
        searchRow.append(search);
        if (this.searchQuery) {
          const clearSearch = element("button", "Clear");
          clearSearch.className = "clear-search";
          clearSearch.setAttribute("aria-label", "Clear search");
          clearSearch.addEventListener("click", () => {
            this.searchQuery = "";
            this.render();
            this.root.querySelector<HTMLInputElement>(".search")?.focus();
          });
          searchRow.append(clearSearch);
        }
        tools.append(searchRow);
        const filters = element("div");
        filters.className = "filters";
        filters.setAttribute("role", "group");
        filters.setAttribute("aria-label", "Filter account benefits");
        (["remaining", "used"] as BenefitFilter[]).forEach((filter) => {
          const control = element("button", `${filterLabel(filter)} ${filterCounts[filter]}`);
          control.type = "button";
          control.className = "filter-button";
          control.dataset.filter = filter;
          control.dataset.focusKey = filter;
          control.setAttribute("aria-pressed", String(this.benefitFilter === filter));
          control.addEventListener("click", () => {
            this.benefitFilter = filter;
            this.render();
          });
          filters.append(control);
        });
        tools.append(filters);
        content.append(tools);
      }

      if (renderedEntries.length) {
        const groups = element("div");
        groups.className = "card-groups";
        renderedEntries.forEach(({ record }) => groups.append(this.renderCardGroup(record)));
        content.append(groups);
      } else {
        let message: string;
        const allCardsConclusivelyEmpty = totalBenefits === 0
          && confirmedEmptyCards.length === cards.length
          && this.store.lastScan?.status === "complete";
        if (this.searchQuery.trim() && totalBenefits === 0) {
          message = "No matches. Try a benefit name, card name, or the last digits of your card.";
        } else if (allCardsConclusivelyEmpty) {
          message = "No benefits to track on these cards.";
        } else if (totalBenefits === 0) {
          message = "No benefits loaded yet. Try refreshing.";
        } else {
          const otherFilter: BenefitFilter = this.benefitFilter === "remaining" ? "used" : "remaining";
          const otherCount = filterCounts[otherFilter];
          message = `No ${filterLabel(this.benefitFilter).toLowerCase()} benefits${this.searchQuery.trim() ? " match your search" : ""}. `
            + `See ${otherFilter === "used" ? "Used" : "Remaining"} for ${otherCount} ${otherCount === 1 ? "benefit" : "benefits"}.`;
        }
        const empty = element("p", message);
        empty.className = "empty-state account-empty-state";
        content.append(empty);
      }
    } else {
      const art = element("img");
      art.src = benefitsArtwork;
      art.alt = "";
      art.className = "empty-art";
      content.append(art);
      const empty = element("div");
      empty.append(element("strong", canceledCards.length ? "No active cards" : "Your benefits will appear here"));
      empty.append(element("p", canceledCards.length
        ? "You can find your canceled cards below."
        : "Sign in to Amex. Your cards update automatically, or you can choose Refresh."));
      empty.className = "empty-state";
      content.append(empty);
    }
    if (canceledCards.length) {
      const history = element("details");
      history.className = "secondary-panel canceled-cards";
      history.append(element("summary", `Canceled cards (${canceledCards.length})`));
      history.append(element("p", "These cards no longer update. Any previous benefits are saved here."));
      canceledCards.forEach(({ record }) => {
        if (record.latest?.benefits.length) history.append(this.renderCardGroup(record, true));
        else history.append(element("p", `${record.identity.productName} •••• ${record.identity.endingDigits}`));
      });
      content.append(history);
    }
    panel.append(content);

    const footer = element("div");
    footer.className = "footer";
    const privacy = element("details");
    privacy.className = "secondary-panel privacy-details";
    privacy.append(element("summary", "Settings"));
    const clear = element("button", "Clear saved benefits");
    clear.type = "button";
    clear.className = "clear-button";
    clear.disabled = this.mode !== "idle" && this.mode !== "error";
    clear.addEventListener("click", () => void this.clear());
    privacy.append(clear);
    footer.append(privacy);
    panel.append(footer);

    this.root.append(style, panel);
  }
}
