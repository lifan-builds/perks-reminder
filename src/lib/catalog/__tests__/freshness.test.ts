import { getPublicStaticCards, predefinedCardsData, type StaticPredefinedCard } from '../../static-catalog';
import {
  auditCatalogFreshness,
  diffIssuerPage,
  extractDollarAmounts,
  timedOfferEndFromDescription,
} from '../freshness';
import { assertCatalogLifecycle, catalogLifecycleState, isCatalogIsoDate } from '../lifecycle';
import { validateStaticCatalog } from '../validation';

const publicCards = getPublicStaticCards();
const copy = () => JSON.parse(JSON.stringify(predefinedCardsData)) as StaticPredefinedCard[];
const codesFor = (today: string, cards: readonly StaticPredefinedCard[] = predefinedCardsData) =>
  auditCatalogFreshness(cards, publicCards, { today }).findings.map((finding) => `${finding.severity}:${finding.code}:${finding.benefitCatalogKey ?? finding.cardCatalogKey}`);

describe('catalog lifecycle metadata', () => {
  it('accepts only real calendar dates', () => {
    expect(isCatalogIsoDate('2028-02-29')).toBe(true);
    expect(isCatalogIsoDate('2027-02-29')).toBe(false);
    expect(isCatalogIsoDate('2026-12-31T00:00:00Z')).toBe(false);
  });

  it('treats sunsetAfter as inclusive and effectiveFrom as the first active day', () => {
    const metadata = { effectiveFrom: '2026-08-23', sunsetAfter: '2026-12-31' };
    expect(catalogLifecycleState(metadata, '2026-08-22')).toBe('scheduled');
    expect(catalogLifecycleState(metadata, '2026-08-23')).toBe('active');
    expect(catalogLifecycleState(metadata, '2026-12-31')).toBe('active');
    expect(catalogLifecycleState(metadata, '2027-01-01')).toBe('expired');
  });

  it.each([
    [{ lastVerifiedAt: '11/22/2026' }, 'lastVerifiedAt'],
    [{ issuerSourceUrl: 'http://issuer.example' }, 'https'],
    [{ effectiveFrom: '2027-01-01', sunsetAfter: '2026-12-31' }, 'precedes'],
    [{ upcomingChanges: [{ effectiveOn: '2027-13-01', summary: 'x' }] }, 'upcoming change'],
  ])('rejects malformed metadata %p', (metadata, message) => {
    expect(() => assertCatalogLifecycle('card:test', metadata)).toThrow(message);
  });

  it('is enforced by catalog validation', () => {
    const cards = copy();
    (cards[0].benefits[0] as { sunsetAfter?: string }).sunsetAfter = '2026-02-30';
    expect(() => validateStaticCatalog(cards)).toThrow('sunsetAfter');
  });

  it('keeps every timed description in sync with sunsetAfter', () => {
    for (const card of predefinedCardsData) {
      for (const benefit of card.benefits) {
        const end = timedOfferEndFromDescription(benefit.description);
        if (end) expect({ key: benefit.catalogKey, sunsetAfter: benefit.sunsetAfter }).toEqual({ key: benefit.catalogKey, sunsetAfter: end });
      }
    }
  });
});

describe('auditCatalogFreshness', () => {
  it('reports no errors for the checked-in catalog today', () => {
    const report = auditCatalogFreshness(predefinedCardsData, publicCards, { today: '2026-11-22' });
    expect(report.counts.error).toBe(0);
    expect(report.cards).toBe(predefinedCardsData.length);
  });

  it('warns ahead of the Dec 31 sunsets and the Jan 1 Edit increase, then errors once they pass', () => {
    const before = codesFor('2026-11-22');
    expect(before).toEqual(expect.arrayContaining([
      'warning:sunset-soon:benefit:csr:250-select-chase-travel-hotel-credit-through-12-31-2026',
      'warning:scheduled-change-soon:benefit:sapphire-reserve-business:500-the-edit-credit',
      'warning:open-drift:benefit:csr:250-the-edit-credit-up-to-2-prepaid-bookings-annually',
    ]));

    const after = codesFor('2027-01-01');
    expect(after).toEqual(expect.arrayContaining([
      'error:expired-offer:benefit:csr:250-select-chase-travel-hotel-credit-through-12-31-2026',
      'error:expired-offer:benefit:sapphire-reserve-business:250-select-chase-travel-hotel-credit-through-2026-12-31',
      'error:scheduled-change-due:benefit:sapphire-reserve-business:500-the-edit-credit',
    ]));
    expect(codesFor('2026-12-31').filter((code) => code.startsWith('error:'))).toEqual([]);
  });

  it('flags a dated description that lacks sunsetAfter', () => {
    const cards = copy();
    const benefit = cards.flatMap((card) => card.benefits)
      .find((candidate) => candidate.catalogKey === 'benefit:csr:250-select-chase-travel-hotel-credit-through-12-31-2026')!;
    delete (benefit as { sunsetAfter?: string }).sunsetAfter;
    expect(codesFor('2026-06-01', cards)).toContain(
      'error:undated-timed-offer:benefit:csr:250-select-chase-travel-hotel-credit-through-12-31-2026',
    );
  });

  it('flags stale verification and premium cards without provenance', () => {
    const cards = copy();
    const csr = cards.find((card) => card.catalogKey === 'card:csr')!;
    csr.lastVerifiedAt = '2026-01-01';
    const premium = cards.find((card) => card.annualFee >= 395 && !card.lastVerifiedAt);
    const codes = codesFor('2026-11-22', cards);
    expect(codes).toContain('warning:stale-verification:card:csr');
    if (premium) expect(codes).toContain(`warning:unverified-premium-card:${premium.catalogKey}`);
  });

  it('lists material credits without a usage guide as info', () => {
    const report = auditCatalogFreshness(predefinedCardsData, publicCards, { today: '2026-11-22' });
    const missing = report.findings.filter((finding) => finding.code === 'missing-usage-guide');
    expect(missing.every((finding) => finding.severity === 'info')).toBe(true);
  });
});

describe('issuer page diff', () => {
  const card = predefinedCardsData.find((candidate) => candidate.catalogKey === 'card:csp')!;

  it('extracts dollar figures from page text, ignoring scripts', () => {
    expect(extractDollarAmounts('<p>$95 annual fee</p><script>var x = "$999"</script><b>$1,000</b> and $20.83'))
      .toEqual([20.83, 95, 1000]);
  });

  it('reports credits and fees that the issuer page no longer states', () => {
    const page = '<h2>$95 annual fee</h2><p>$100 Chase Travel hotel credit</p>';
    const observation = diffIssuerPage(card, 'https://issuer.example', 200, page);
    expect(observation.annualFeeMentioned).toBe(true);
    expect(observation.missingBenefitAmounts.map((missing) => missing.maxAmount)).toEqual([10, 120]);
  });

  it('does not invent drift from an unreadable page', () => {
    expect(diffIssuerPage(card, 'https://issuer.example', 'error', '').missingBenefitAmounts).toEqual([]);
    expect(diffIssuerPage(card, 'https://issuer.example', 200, '<div id="app"></div>').missingBenefitAmounts).toEqual([]);
  });
});
