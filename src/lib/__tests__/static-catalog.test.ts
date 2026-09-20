import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { americanExpressCardCatalog } from '../american-express-card-catalog';
import { AMEX_CATALOG_IDENTITY_REGISTRY, AMEX_WRITABLE_DESTINATIONS } from '../amex-catalog/catalog-registry';
import {
  benefitUsageWays,
  calculateAnnualBenefitValue,
  getPublicStaticCardByName,
  getPublicStaticCards,
  getStaticSearchSuggestions,
  predefinedCardsData,
} from '../static-catalog';

describe('static catalog', () => {
  it('projects predefined cards with stable public ids and usage-guide links', () => {
    const cards = getPublicStaticCards();

    expect(cards.length).toBe(predefinedCardsData.length);
    expect(cards[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      benefits: expect.any(Array),
    }));
    expect(cards.flatMap((card) => card.benefits).every((benefit) => benefit.id.length > 0)).toBe(true);
    expect(cards.flatMap((card) => card.benefits).every((benefit) => benefit.usageWay?.slug)).toBe(true);
  });

  it('reuses every shared Amex card without changing its website catalog data', () => {
    expect(predefinedCardsData.filter((card) => card.issuer === 'American Express')).toEqual(
      Object.values(americanExpressCardCatalog),
    );
  });

  it('keys and classifies all 12 Amex cards and 56 benefits without duplicate destination tuples', () => {
    const cards = Object.values(americanExpressCardCatalog);
    const benefits = cards.flatMap((card) => card.benefits);
    expect(cards).toHaveLength(12);
    expect(benefits).toHaveLength(56);
    expect(Object.keys(AMEX_CATALOG_IDENTITY_REGISTRY)).toHaveLength(12);
    expect(cards.every((card) => Boolean(card.productKey))).toBe(true);
    expect(benefits.every((benefit) => Boolean(
      benefit.productKey && benefit.creditFamilyKey && benefit.periodKey && benefit.sourceSemantics,
    ))).toBe(true);
    const tuples = benefits.map((benefit) => `${benefit.productKey}|${benefit.creditFamilyKey}|${benefit.periodKey}`);
    expect(new Set(tuples).size).toBe(tuples.length);
    expect(benefits.filter((benefit) => benefit.sourceSemantics !== 'usage').every((benefit) => benefit.sourceCreditKey === null)).toBe(true);
    expect(AMEX_WRITABLE_DESTINATIONS).toHaveLength(benefits.filter((benefit) => benefit.sourceSemantics === 'usage').length);
  });

  it('finds cards by public route name', () => {
    expect(getPublicStaticCardByName('American Express Gold Card')).toEqual(expect.objectContaining({
      issuer: 'American Express',
    }));
  });

  it.each([
    ['card:southwest-performance-business', 'Southwest Rapid Rewards Performance Business Card', 'Chase', 299],
    ['card:sapphire-reserve-business', 'Sapphire Reserve for Business', 'Chase', 795],
    ['card:citi-aadvantage-mileup', 'American Airlines AAdvantage MileUp Card', 'Citi', 0],
    ['card:citi-aadvantage-platinum-select', 'Citi / AAdvantage Platinum Select World Elite Mastercard', 'Citi', 99],
    ['card:citi-aadvantage-executive', 'Citi / AAdvantage Executive World Elite Mastercard', 'Citi', 595],
    ['card:citi-aadvantage-business', 'Citi / AAdvantage Business World Elite Mastercard', 'Citi', 99],
    ['card:citi-aadvantage-globe', 'Citi / AAdvantage Globe Mastercard', 'Citi', 350],
  ])('exposes requested product %s through the public catalog', (catalogKey, name, issuer, annualFee) => {
    const card = getPublicStaticCardByName(name as string);
    expect(card).toEqual(expect.objectContaining({ id: catalogKey, catalogKey, name, issuer, annualFee }));
    expect(card!.benefits.every((benefit) => benefit.parentCatalogKey === catalogKey)).toBe(true);
  });

  it('ships local card art for every newly added product', () => {
    const names = [
      'Southwest Rapid Rewards Performance Business Card',
      'Sapphire Reserve for Business',
      'American Airlines AAdvantage MileUp Card',
      'Citi / AAdvantage Platinum Select World Elite Mastercard',
      'Citi / AAdvantage Executive World Elite Mastercard',
      'Citi / AAdvantage Business World Elite Mastercard',
      'Citi / AAdvantage Globe Mastercard',
    ];

    for (const name of names) {
      const card = getPublicStaticCardByName(name);
      expect(card?.imageUrl).toMatch(/^\/images\/cards\/.+/);
      expect(existsSync(resolve(process.cwd(), 'public', card!.imageUrl!.slice(1)))).toBe(true);
    }
  });

  it('retains four-year renewal periods for the new security screening credits', () => {
    const cards = getPublicStaticCards().filter((card) => [
      'card:southwest-performance-business',
      'card:sapphire-reserve-business',
      'card:citi-aadvantage-executive',
      'card:citi-aadvantage-globe',
    ].includes(card.catalogKey));
    for (const card of cards) {
      expect(card.benefits.find((benefit) => benefit.description.includes('Global Entry'))).toEqual(
        expect.objectContaining({
          maxAmount: 120,
          cycleAlignment: 'CARD_ANNIVERSARY',
          fixedCycleDurationMonths: 48,
          usageWay: expect.objectContaining({ slug: 'security-screening-credits' }),
        }),
      );
    }
  });

  it('keeps annual value and suggestions available without a database', () => {
    expect(calculateAnnualBenefitValue(10, 'MONTHLY')).toBe(120);
    expect(calculateAnnualBenefitValue(120, 'YEARLY', 48)).toBe(30);
    expect(calculateAnnualBenefitValue(120, 'YEARLY', 54)).toBeCloseTo(26.67, 2);
    expect(calculateAnnualBenefitValue(200, 'YEARLY', 6)).toBe(200);
    expect(getStaticSearchSuggestions()).toEqual(expect.arrayContaining(['American Express', 'Dining', 'amex']));
    expect(benefitUsageWays.length).toBeGreaterThan(0);
  });
});
