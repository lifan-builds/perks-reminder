// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { isExactHandoffUrl } from "../route-classifier";

describe("Chrome handoff route classifier", () => {
  const location = (url: string): Pick<Location, "origin" | "pathname" | "search"> => {
    const parsed = new URL(url);
    return { origin: parsed.origin, pathname: parsed.pathname, search: parsed.search };
  };

  it.each([
    ["https://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", true],
    ["https://www.perks-reminder.com/integrations/amex-sync", false],
    ["https://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!", false],
    ["https://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&extra=1", false],
    ["https://www.perks-reminder.com/integrations/amex-sync-other?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false],
    ["https://perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false],
    ["http://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false],
  ])("classifies %s as %s", (url, expected) => {
    expect(isExactHandoffUrl(location(url))).toBe(expected);
  });
});
