import {
  decodeNumericCharacterReferences,
  formatAmexBenefitTitle,
  formatAmexSourcePeriod,
} from "../presentation";

describe("AMEX client-safe presentation", () => {
  it("formats inert provider titles without interpreting markup", () => {
    expect(formatAmexBenefitTitle("Resy&#174;<sup>‡</sup> Statement Credit"))
      .toBe("Resy® Statement Credit");
    expect(formatAmexBenefitTitle("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
  });

  it("decodes decimal and hexadecimal numeric character references once and leaves malformed or non-scalar values literal", () => {
    expect(decodeNumericCharacterReferences("&#36;12 &#x52;esy &#X43;redit")).toBe("$12 Resy Credit");
    expect(decodeNumericCharacterReferences("&#38;#36;12 Resy Credit")).toBe("&#36;12 Resy Credit");
    expect(decodeNumericCharacterReferences("&amp;#36;12 Resy Credit")).toBe("&amp;#36;12 Resy Credit");
    const literal = "&amp; &#; &#x; &#36 &#xZZ; &#0; &#xD800; &#1114112; &#x110000;";
    expect(decodeNumericCharacterReferences(literal)).toBe(literal);
  });

  it("removes recognized terminal or Statement Credit Amex superscript footnote adornments while preserving mid-title text", () => {
    expect(formatAmexBenefitTitle("Literal Credit <sup>‡</sup>   ")).toBe("Literal Credit");
    expect(formatAmexBenefitTitle("Encoded Markup Credit &#x3C;sup&#x3E;&#8225;&#x3C;/sup&#x3E; "))
      .toBe("Encoded Markup Credit");
    expect(formatAmexBenefitTitle("Registered Credit <sup>®</sup>   ")).toBe("Registered Credit");
    expect(formatAmexBenefitTitle("Standalone Credit ‡  ")).toBe("Standalone Credit");
    expect(formatAmexBenefitTitle("Standalone Registered ®  ")).toBe("Standalone Registered ®");
    expect(formatAmexBenefitTitle("Literal Merchant <sup>‡</sup> Statement Credit"))
      .toBe("Literal Merchant Statement Credit");
    expect(formatAmexBenefitTitle("Registered Merchant <sup>®</sup> Statement Credit"))
      .toBe("Registered Merchant Statement Credit");
    expect(formatAmexBenefitTitle("Arbitrary <sup>‡</sup> mid-title prose"))
      .toBe("Arbitrary <sup>‡</sup> mid-title prose");
    expect(formatAmexBenefitTitle("‡  ")).toBe("‡");
    expect(formatAmexBenefitTitle("<sup>&#8225;</sup>  ")).toBe("<sup>‡</sup>");
  });

  it("formats structured UTC periods deterministically", () => {
    expect(formatAmexSourcePeriod({
      kind: "calendar_date_range",
      startDate: "2026-12-01",
      endDate: "2026-12-31",
      timeZone: "UTC",
    })).toBe("Dec 2026");
    expect(formatAmexSourcePeriod({
      kind: "calendar_date_range",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      timeZone: "UTC",
    })).toBe("Jul–Sep 2026");
  });
});
