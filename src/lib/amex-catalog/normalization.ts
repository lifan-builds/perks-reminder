export function normalizeAmexSelectionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/\bamex\b/gi, " american express ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

export const AMEX_PRODUCT_MATCH_MIN_SCORE = 0.88;
export const AMEX_PRODUCT_MATCH_MIN_MARGIN = 0.10;

export function evaluateAmexProductScores(
  bestScore: number,
  runnerUpScore: number,
): "accepted" | "low_confidence" | "ambiguous" {
  if (bestScore < AMEX_PRODUCT_MATCH_MIN_SCORE) return "low_confidence";
  if (bestScore - runnerUpScore + Number.EPSILON < AMEX_PRODUCT_MATCH_MIN_MARGIN) return "ambiguous";
  return "accepted";
}

const PRODUCT_NOISE = new Set(["american", "express", "card", "the", "from"]);
const COBRANDS = ["hilton", "delta", "marriott"] as const;
const TIERS = ["gold", "platinum", "reserve", "aspire", "surpass", "brilliant"] as const;

function productTokenSet(value: string, noise: ReadonlySet<string> = PRODUCT_NOISE): Set<string> {
  return new Set(normalizeAmexSelectionText(value).split(" ").filter((token) => token && !noise.has(token)));
}

export function weightedAmexProductTokenScore(left: string, right: string): number {
  const a = productTokenSet(left);
  const b = productTokenSet(right);
  const union = new Set([...Array.from(a), ...Array.from(b)]);
  if (!union.size) return 0;
  let shared = 0;
  union.forEach((token) => { if (a.has(token) && b.has(token)) shared += 1; });
  return shared / union.size;
}

export function hasHardAmexProductConflict(source: string, candidate: string): boolean {
  const sourceTokens = productTokenSet(source, new Set());
  const candidateTokens = productTokenSet(candidate, new Set());
  if (sourceTokens.has("business") !== candidateTokens.has("business")) return true;
  const sourceCobrand = COBRANDS.find((token) => sourceTokens.has(token));
  const candidateCobrand = COBRANDS.find((token) => candidateTokens.has(token));
  if (sourceCobrand !== candidateCobrand) return true;
  const sourceTier = TIERS.find((token) => sourceTokens.has(token));
  const candidateTier = TIERS.find((token) => candidateTokens.has(token));
  return Boolean(sourceTier && candidateTier && sourceTier !== candidateTier);
}
