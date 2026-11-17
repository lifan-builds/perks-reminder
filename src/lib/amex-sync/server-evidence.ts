import {
  evaluateAmexProductScores,
  hasHardAmexProductConflict,
  normalizeAmexSelectionText,
  weightedAmexProductTokenScore,
} from "@/lib/amex-catalog/normalization";
import type { AmexPeriodKey } from "@/lib/amex-catalog/catalog-registry";
import {
  GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS,
  selectMatchingAmexPolicy,
  type AmexSourceCreditEvidence,
  type AmexSourceCreditPolicy,
} from "@/lib/amex-catalog/source-credit-policy";

interface ServerProductDescriptor {
  productKey: string;
  aliases: readonly string[];
}

// Deliberately enumerated separately from the browser projection registry. A
// drift test compares outcomes; browser claims never expand this authority.
export const SERVER_AMEX_PRODUCTS: readonly ServerProductDescriptor[] = [
  { productKey: "american-express-gold-card", aliases: ["American Express Gold Card", "American Express Gold Card®", "Amex Gold Card"] },
  { productKey: "american-express-platinum-card", aliases: ["American Express Platinum Card", "The Platinum Card from American Express", "Platinum Card®", "Morgan Stanley Platinum", "Morgan Stanley Platinum Card®", "The Platinum Card from American Express Exclusively for Morgan Stanley"] },
  { productKey: "american-express-business-platinum-card", aliases: ["American Express Business Platinum Card", "Business Platinum Card from American Express", "Business Platinum Card®"] },
  { productKey: "american-express-business-gold-card", aliases: ["American Express Business Gold Card", "Business Gold Card from American Express", "Amex Business Gold Card"] },
  { productKey: "hilton-honors-american-express-aspire-card", aliases: ["Hilton Honors American Express Aspire Card", "Hilton Honors Aspire Card"] },
  { productKey: "hilton-honors-american-express-surpass-card", aliases: ["Hilton Honors American Express Surpass Card", "Hilton Honors Surpass Card"] },
  { productKey: "hilton-honors-american-express-business-card", aliases: ["Hilton Honors American Express Business Card", "Hilton Honors Business Card"] },
  { productKey: "delta-skymiles-gold-american-express-card", aliases: ["Delta SkyMiles Gold American Express Card", "Delta SkyMiles Gold Amex Card"] },
  { productKey: "delta-skymiles-platinum-american-express-card", aliases: ["Delta SkyMiles Platinum American Express Card", "Delta SkyMiles Platinum Amex Card"] },
  { productKey: "delta-skymiles-reserve-american-express-card", aliases: ["Delta SkyMiles Reserve American Express Card", "Delta SkyMiles Reserve Amex Card"] },
  { productKey: "marriott-bonvoy-brilliant-american-express-card", aliases: ["Marriott Bonvoy Brilliant American Express Card", "Marriott Bonvoy Brilliant Card"] },
  { productKey: "marriott-bonvoy-business-american-express-card", aliases: ["Marriott Bonvoy Business American Express Card", "Marriott Bonvoy Business Card"] },
];

const SERVER_COMPATIBLE_PERIODS: Readonly<Record<string, readonly AmexPeriodKey[]>> = {
  "american-express-business-platinum-card:chatgpt-business": ["calendar-year"],
  "american-express-platinum-card:equinox": ["calendar-year"],
  "american-express-platinum-card:clear-plus": ["calendar-year"],
  "american-express-gold-card:uber-cash": ["calendar-month"],
  "american-express-gold-card:dining": ["calendar-month"],
  "american-express-gold-card:dunkin": ["calendar-month"],
  "american-express-gold-card:resy": ["calendar-half-h1", "calendar-half-h2"],
  "american-express-platinum-card:airline-fee": ["calendar-year"],
  "american-express-platinum-card:uber-cash": ["calendar-month", "calendar-month-december"],
  "american-express-platinum-card:saks": ["calendar-half-h1", "calendar-half-h2"],
  "american-express-platinum-card:resy": ["calendar-quarter-q1", "calendar-quarter-q2", "calendar-quarter-q3", "calendar-quarter-q4"],
  "american-express-platinum-card:lululemon": ["calendar-quarter-q1", "calendar-quarter-q2", "calendar-quarter-q3", "calendar-quarter-q4"],
  "american-express-platinum-card:hotel": ["calendar-half-h1", "calendar-half-h2"],
  "american-express-platinum-card:digital-entertainment": ["calendar-month"],
  "american-express-platinum-card:uber-one": ["calendar-year"],
  "american-express-platinum-card:oura": ["calendar-year"],
  "american-express-platinum-card:walmart-plus": ["calendar-month"],
  "american-express-business-platinum-card:airline-fee": ["calendar-year"],
  "american-express-business-platinum-card:hotel": ["calendar-half-h1", "calendar-half-h2"],
  "american-express-business-platinum-card:dell": ["calendar-year"],
  "american-express-business-platinum-card:hilton": ["card-anniversary-quarter"],
  "american-express-business-platinum-card:indeed": ["calendar-quarter"],
  "american-express-business-platinum-card:wireless": ["calendar-month"],
  "american-express-business-gold-card:flexible-business": ["calendar-month"],
  "american-express-business-gold-card:walmart-plus": ["calendar-month"],
  "hilton-honors-american-express-aspire-card:flight": ["calendar-quarter"],
  "hilton-honors-american-express-aspire-card:hilton-resort": ["calendar-half-h1", "calendar-half-h2"],
  "hilton-honors-american-express-aspire-card:clear-plus": ["calendar-year"],
  "hilton-honors-american-express-surpass-card:hilton": ["calendar-quarter"],
  "hilton-honors-american-express-business-card:hilton": ["card-anniversary-quarter"],
  "delta-skymiles-gold-american-express-card:delta-stays": ["card-anniversary-year"],
  "delta-skymiles-platinum-american-express-card:delta-stays": ["card-anniversary-year"],
  "delta-skymiles-platinum-american-express-card:resy": ["calendar-month"],
  "delta-skymiles-platinum-american-express-card:rideshare": ["calendar-month"],
  "delta-skymiles-reserve-american-express-card:delta-stays": ["card-anniversary-year"],
  "delta-skymiles-reserve-american-express-card:resy": ["calendar-month"],
  "delta-skymiles-reserve-american-express-card:rideshare": ["calendar-month"],
  "marriott-bonvoy-brilliant-american-express-card:dining": ["calendar-month"],
};

const SERVER_FORBIDDEN_TOKEN_OVERRIDES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  "american-express-platinum-card:airline-fee": [["airline", "bonus"]],
  "american-express-platinum-card:uber-cash": [["uber", "one"], ["membership"]],
  "american-express-platinum-card:uber-one": [["uber", "cash"]],
  "american-express-platinum-card:resy": [["global", "dining", "access"]],
  "hilton-honors-american-express-aspire-card:flight": [["spend"], ["bonus"]],
};

interface ServerCreditDescriptor extends AmexSourceCreditPolicy {
  requiredTokens: readonly string[];
  aliases: readonly string[];
}

const credit = (productKey: string, family: string, requiredTokens: readonly string[], aliases: readonly string[] = []): ServerCreditDescriptor => {
  const sourceCreditKey = `${productKey}:${family}`;
  const compatiblePeriodKeys = SERVER_COMPATIBLE_PERIODS[sourceCreditKey];
  if (!compatiblePeriodKeys) throw new Error(`Missing server period policy for ${sourceCreditKey}.`);
  const exactAliases = aliases.length ? aliases : [`${requiredTokens.join(" ")} Credit`];
  return {
    productKey,
    sourceCreditKey,
    creditFamilyKey: sourceCreditKey,
    requiredTokens,
    aliases: exactAliases,
    exactAliases,
    requiredTokenGroups: requiredTokens.map((token) => [token]),
    forbiddenTokenGroups: [
      ...GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS,
      ...(SERVER_FORBIDDEN_TOKEN_OVERRIDES[sourceCreditKey] ?? []),
    ],
    compatiblePeriodKeys,
    amountConstraint: {
      currency: "USD",
      minimumUsd: 0,
      ...(sourceCreditKey === "american-express-platinum-card:uber-cash"
        ? { maximumUsd: 35 }
        : {}),
    },
  };
};

export const SERVER_AMEX_SOURCE_CREDITS: readonly ServerCreditDescriptor[] = [
  credit("american-express-business-platinum-card", "chatgpt-business", ["chatgpt", "business"]),
  credit("american-express-platinum-card", "equinox", ["equinox"]),
  credit("american-express-platinum-card", "clear-plus", ["clear"]),
  credit("american-express-gold-card", "uber-cash", ["uber"]),
  credit("american-express-gold-card", "dining", ["dining"]),
  credit("american-express-gold-card", "dunkin", ["dunkin"]),
  credit("american-express-gold-card", "resy", ["resy"]),
  credit("american-express-platinum-card", "airline-fee", ["airline", "fee"], ["$200 Airline Fee Credit", "Airline Fee Credit"]),
  credit("american-express-platinum-card", "uber-cash", ["uber"], ["Uber Cash"]),
  credit("american-express-platinum-card", "saks", ["saks"]),
  credit("american-express-platinum-card", "resy", ["resy"], ["Resy Credit", "Resy Dining Credit", "$400 Resy Credit"]),
  credit("american-express-platinum-card", "lululemon", ["lululemon"], ["lululemon Credit", "$300 lululemon Credit"]),
  credit("american-express-platinum-card", "hotel", ["hotel"]),
  credit("american-express-platinum-card", "digital-entertainment", ["digital", "entertainment"]),
  credit("american-express-platinum-card", "uber-one", ["uber", "one"], ["Uber One Credit", "Uber One Membership Credit"]),
  credit("american-express-platinum-card", "oura", ["oura"]),
  credit("american-express-platinum-card", "walmart-plus", ["walmart"]),
  credit("american-express-business-platinum-card", "airline-fee", ["airline", "fee"]),
  credit("american-express-business-platinum-card", "hotel", ["hotel"]),
  credit("american-express-business-platinum-card", "dell", ["dell"]),
  credit("american-express-business-platinum-card", "hilton", ["hilton"]),
  credit("american-express-business-platinum-card", "indeed", ["indeed"]),
  credit("american-express-business-platinum-card", "wireless", ["wireless"]),
  credit("american-express-business-gold-card", "flexible-business", ["flexible", "business"]),
  credit("american-express-business-gold-card", "walmart-plus", ["walmart"]),
  credit("hilton-honors-american-express-aspire-card", "flight", ["flight"]),
  credit("hilton-honors-american-express-aspire-card", "hilton-resort", ["hilton", "resort"]),
  credit("hilton-honors-american-express-aspire-card", "clear-plus", ["clear"]),
  credit("hilton-honors-american-express-surpass-card", "hilton", ["hilton"]),
  credit("hilton-honors-american-express-business-card", "hilton", ["hilton"]),
  credit("delta-skymiles-gold-american-express-card", "delta-stays", ["delta", "stays"]),
  credit("delta-skymiles-platinum-american-express-card", "delta-stays", ["delta", "stays"]),
  credit("delta-skymiles-platinum-american-express-card", "resy", ["resy"]),
  credit("delta-skymiles-platinum-american-express-card", "rideshare", ["rideshare"]),
  credit("delta-skymiles-reserve-american-express-card", "delta-stays", ["delta", "stays"]),
  credit("delta-skymiles-reserve-american-express-card", "resy", ["resy"]),
  credit("delta-skymiles-reserve-american-express-card", "rideshare", ["rideshare"]),
  credit("marriott-bonvoy-brilliant-american-express-card", "dining", ["dining"]),
];

export function resolveServerAmexProduct(productName: string): string | null {
  const normalized = normalizeAmexSelectionText(productName);
  const exact = SERVER_AMEX_PRODUCTS.find((product) => product.aliases.some((alias) => normalizeAmexSelectionText(alias) === normalized));
  if (exact) return exact.productKey;
  const candidates = SERVER_AMEX_PRODUCTS.flatMap((product) => {
    const canonical = product.aliases[0];
    return hasHardAmexProductConflict(productName, canonical) ? [] : [{ productKey: product.productKey, score: weightedAmexProductTokenScore(productName, canonical) }];
  }).sort((left, right) => right.score - left.score || left.productKey.localeCompare(right.productKey));
  if (!candidates.length
    || evaluateAmexProductScores(candidates[0].score, candidates[1]?.score ?? 0) !== "accepted") return null;
  return candidates[0].productKey;
}

export function resolveServerAmexCredit(
  productKey: string,
  providerTitle: string,
  evidence: AmexSourceCreditEvidence = {},
): ServerCreditDescriptor | null {
  return selectMatchingAmexPolicy(
    SERVER_AMEX_SOURCE_CREDITS.filter((descriptor) => descriptor.productKey === productKey),
    providerTitle,
    evidence,
  );
}
