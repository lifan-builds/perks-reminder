#!/usr/bin/env tsx
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
/**
 * Catalog freshness and issuer-drift audit.
 *
 *   npm run catalog:freshness                      # deterministic source audit
 *   npm run catalog:freshness -- --today 2027-01-02
 *   npm run catalog:freshness -- --fetch           # also diff live issuer pages
 *   npm run catalog:freshness -- --json --out build/catalog-freshness
 *
 * Reads only checked-in source (and, with --fetch, public issuer pages). It
 * writes a review report and card-template patch proposals; it never touches
 * the database. Exits 1 when an error-severity finding exists.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPublicStaticCards, predefinedCardsData, type StaticPredefinedCard } from "../src/lib/static-catalog";
import {
  auditCatalogFreshness,
  diffIssuerPage,
  type FreshnessFinding,
  type FreshnessReport,
  type IssuerPageObservation,
} from "../src/lib/catalog/freshness";
import { catalogDay, isCatalogIsoDate } from "../src/lib/catalog/lifecycle";

interface Arguments {
  today: string;
  horizonDays: number;
  fetch: boolean;
  json: boolean;
  out: string | null;
}

function parseArguments(argv: string[]): Arguments {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const today = value("--today") ?? catalogDay(new Date());
  if (!isCatalogIsoDate(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}.`);
  const horizonDays = Number(value("--horizon-days") ?? 45);
  if (!Number.isInteger(horizonDays) || horizonDays < 0) throw new Error("--horizon-days must be a non-negative integer.");
  return {
    today,
    horizonDays,
    fetch: argv.includes("--fetch"),
    json: argv.includes("--json"),
    out: value("--out") ?? (argv.includes("--fetch") ? "build/catalog-freshness" : null),
  };
}

async function observeIssuerPages(cards: readonly StaticPredefinedCard[]): Promise<IssuerPageObservation[]> {
  const observations: IssuerPageObservation[] = [];
  for (const card of cards) {
    if (!card.issuerSourceUrl) continue;
    try {
      const response = await fetch(card.issuerSourceUrl, {
        headers: { "user-agent": "PerksReminderCatalogFreshness/1.0 (+https://www.perks-reminder.com)" },
        signal: AbortSignal.timeout(20_000),
      });
      observations.push(diffIssuerPage(card, card.issuerSourceUrl, response.status, response.ok ? await response.text() : ""));
    } catch {
      observations.push(diffIssuerPage(card, card.issuerSourceUrl, "error", ""));
    }
  }
  return observations;
}

function patchProposals(
  cards: readonly StaticPredefinedCard[],
  findings: readonly FreshnessFinding[],
  observations: readonly IssuerPageObservation[],
  today: string,
) {
  const flagged = new Set([
    ...findings.filter((finding) => finding.severity !== "info").map((finding) => finding.cardCatalogKey),
    ...observations
      .filter((observation) => observation.missingBenefitAmounts.length > 0 || !observation.annualFeeMentioned)
      .map((observation) => observation.cardCatalogKey),
  ]);
  return cards.filter((card) => flagged.has(card.catalogKey)).map((card) => {
    const cardFindings = findings.filter((finding) => finding.cardCatalogKey === card.catalogKey);
    const observation = observations.find((candidate) => candidate.cardCatalogKey === card.catalogKey);
    const retire = new Set(cardFindings.filter((finding) => finding.code === "expired-offer").map((finding) => finding.benefitCatalogKey));
    return {
      catalogKey: card.catalogKey,
      template: {
        $schema: "../schema.json",
        name: card.name,
        issuer: card.issuer,
        annualFee: card.upcomingChanges?.find((change) => change.effectiveOn <= today && change.annualFee !== undefined)?.annualFee ?? card.annualFee,
        imageUrl: card.imageUrl ?? `/images/cards/${card.catalogKey.slice("card:".length)}.png`,
        sources: [
          ...(card.issuerSourceUrl ? [{ label: `${card.issuer} product page`, url: card.issuerSourceUrl, accessed: today }] : []),
          ...card.benefits.flatMap((benefit) => (benefit.upcomingChanges ?? []).flatMap((change) =>
            change.sourceUrl ? [{ label: change.summary, url: change.sourceUrl, accessed: today }] : [])),
        ],
        benefits: card.benefits
          .filter((benefit) => !retire.has(benefit.catalogKey))
          .map((benefit) => {
            const due = benefit.upcomingChanges?.filter((change) => change.effectiveOn <= today) ?? [];
            const maxAmount = due.reduce((amount, change) => change.maxAmount ?? amount, benefit.maxAmount);
            return {
              catalogKey: benefit.catalogKey,
              description: benefit.description,
              category: benefit.category,
              maxAmount,
              frequency: benefit.frequency,
              ...(benefit.cycleAlignment ? { cycleAlignment: benefit.cycleAlignment } : {}),
              ...(benefit.fixedCycleStartMonth ? { fixedCycleStartMonth: benefit.fixedCycleStartMonth } : {}),
              ...(benefit.fixedCycleDurationMonths ? { fixedCycleDurationMonths: benefit.fixedCycleDurationMonths } : {}),
              ...(benefit.occurrencesInCycle ? { occurrencesInCycle: benefit.occurrencesInCycle } : {}),
            };
          }),
        reviewNotes: [
          ...cardFindings.map((finding) => `[${finding.code}] ${finding.subject}: ${finding.message} ${finding.action}`),
          ...(observation && !observation.annualFeeMentioned ? [`Issuer page did not mention the $${card.annualFee} annual fee.`] : []),
          ...(observation?.missingBenefitAmounts ?? []).map((missing) =>
            `Issuer page did not mention $${missing.maxAmount} for "${missing.description}".`),
          "Proposal only: keep catalogKey values immutable, apply through static-catalog.ts, and run the guarded sync dry run.",
        ].join("\n"),
      },
    };
  });
}

function renderMarkdown(report: FreshnessReport, observations: readonly IssuerPageObservation[]): string {
  const lines = [
    `# Catalog freshness — ${report.generatedFor}`,
    "",
    `${report.cards} cards, ${report.benefits} benefits, horizon ${report.horizonDays} days: ` +
      `${report.counts.error} errors, ${report.counts.warning} warnings, ${report.counts.info} info.`,
    "",
    "| Severity | Code | Card | Subject | Date | Finding | Action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.findings.map((finding) =>
      `| ${finding.severity} | ${finding.code} | ${finding.cardName} | ${finding.subject.replace(/\|/g, "/")} | ${finding.date ?? ""} | ${finding.message.replace(/\|/g, "/")} | ${finding.action} |`),
  ];
  if (observations.length > 0) {
    lines.push("", "## Issuer page diff", "", "| Card | Status | Fee seen | Credits not seen on page |", "| --- | --- | --- | --- |");
    for (const observation of observations) {
      lines.push(`| ${observation.cardCatalogKey} | ${observation.status} | ${observation.annualFeeMentioned ? "yes" : "no"} | ${
        observation.missingBenefitAmounts.map((missing) => `$${missing.maxAmount} ${missing.description}`).join("; ") || "—"} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function printSummary(report: FreshnessReport, observations: readonly IssuerPageObservation[]) {
  console.log(`Catalog freshness for ${report.generatedFor}: ${report.counts.error} errors, ${report.counts.warning} warnings, ${report.counts.info} info (${report.cards} cards, ${report.benefits} benefits).`);
  for (const finding of report.findings.filter((candidate) => candidate.severity !== "info")) {
    console.log(`  ${finding.severity.toUpperCase().padEnd(7)} ${finding.code.padEnd(22)} ${finding.cardName} — ${finding.subject}: ${finding.message}`);
  }
  const info = report.findings.filter((finding) => finding.severity === "info");
  if (info.length > 0) {
    const byCode = info.reduce<Record<string, number>>((counts, finding) => ({ ...counts, [finding.code]: (counts[finding.code] ?? 0) + 1 }), {});
    console.log(`  INFO    ${Object.entries(byCode).map(([code, count]) => `${code}: ${count}`).join(", ")}`);
  }
  for (const observation of observations) {
    if (observation.status !== 200 || observation.missingBenefitAmounts.length > 0 || !observation.annualFeeMentioned) {
      console.log(`  DRIFT?  ${observation.cardCatalogKey} [${observation.status}] fee seen: ${observation.annualFeeMentioned}; unseen credits: ${observation.missingBenefitAmounts.length}`);
    }
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const report = auditCatalogFreshness(predefinedCardsData, getPublicStaticCards(), {
    today: args.today,
    horizonDays: args.horizonDays,
  });
  const observations = args.fetch ? await observeIssuerPages(predefinedCardsData) : [];

  if (args.json) console.log(JSON.stringify({ ...report, observations }, null, 2));
  else printSummary(report, observations);

  if (args.out) {
    const directory = resolve(process.cwd(), args.out);
    await mkdir(resolve(directory, "proposals"), { recursive: true });
    await writeFile(resolve(directory, "report.json"), `${JSON.stringify({ ...report, observations }, null, 2)}\n`);
    await writeFile(resolve(directory, "report.md"), renderMarkdown(report, observations));
    const proposals = patchProposals(predefinedCardsData, report.findings, observations, args.today)
      .filter((proposal) => proposal.template.sources.length > 0);
    for (const proposal of proposals) {
      const file = `${proposal.catalogKey.slice("card:".length)}.json`;
      await writeFile(resolve(directory, "proposals", file), `${JSON.stringify(proposal.template, null, 2)}\n`);
    }
    if (!args.json) console.log(`Wrote ${args.out}/report.{json,md} and card-template proposals.`);
  }

  if (report.counts.error > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
