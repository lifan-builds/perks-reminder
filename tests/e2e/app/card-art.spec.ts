import { expect, test } from "@playwright/test";
import { predefinedCardsData } from "../../../src/lib/static-catalog";
import { settle, watchErrors } from "./guards";

test("every catalog card renders self-owned studio art", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/cards/browse");
  await settle(page);
  const images = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("main img"))
      .map((image) => ({ src: decodeURIComponent(image.currentSrc || image.src), width: image.naturalWidth, height: image.naturalHeight })));
  const cardArt = images.filter((image) => image.src.includes("/images/cards/"));
  const expected = new Set(predefinedCardsData.map((card) => card.imageUrl));
  const seen = new Set(cardArt.map((image) => image.src.match(/\/images\/cards\/[^&?]+/)?.[0]));
  for (const path of expected) expect(seen.has(path!), `card art ${path}`).toBe(true);
  for (const image of cardArt) {
    expect(image.width, image.src).toBeGreaterThan(0);
    expect(Math.abs(image.width / image.height - 1.586)).toBeLessThan(0.02);
  }
  expect(images.filter((image) => /https?:\/\/(?!localhost)/.test(image.src.replace(/^https?:\/\/localhost[^/]*/, ""))))
    .toEqual([]);
  expect(errors).toEqual([]);
});
