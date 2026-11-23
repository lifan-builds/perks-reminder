# Card Image Sources

Every image in `public/images/cards/` is self-owned studio art rendered by
`scripts/generate-card-art.mjs` (`npm run card-art:generate`). No issuer
artwork, logo, wordmark, network mark, or scraped pixel ships in this
directory, and `src/lib/__tests__/card-art.test.ts` fails if a manifest entry
has any other source.

Each card is ISO/IEC 7810 ID-1 (85.60 x 53.98 mm, 1.586:1) at 1012x638 px with
transparent corners. The art is deterministic: a material family per card
(brushed platinum, obsidian carbon, cobalt sapphire, rose-brass, emerald
fluting, titanium guilloche), a per-card hue and pattern seed derived from the
immutable `catalogKey`, a geometric EMV chip, a generic contactless glyph, and
a generic tier word such as RESERVE or GOLD. `npm run card-art:generate -- --check`
confirms the committed files match a fresh render on the same toolchain.

## Adding a card

1. Add the card to `src/lib/static-catalog.ts` with
   `imageUrl: '/images/cards/<catalogKey slug>.png'` (`.png`, `.webp`, or `.avif`
   so the corners stay transparent).
2. Map its `catalogKey` to a family in `FAMILY_BY_CARD` in the generator.
3. Run `npm run card-art:generate`, then
   `node scripts/download-card-image.js --validate all`.

## Legacy aliases

Seven cards previously pointed at `.jpg` paths. Their catalog `imageUrl` now uses
`.png`; the old `.jpg` paths (`scripts/card-art-legacy-aliases.json`) are
regenerated with the same studio art, flattened onto a neutral ground, so
database rows that still hold the old path render self-owned art until the
guarded catalog sync updates them. Remove an alias once production no longer
references it.

The previously ingested third-party art and its source receipts were retired on
2026-11-22; git history keeps the old provenance tables.
