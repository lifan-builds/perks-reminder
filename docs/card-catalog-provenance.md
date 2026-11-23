# Added card catalog provenance

Reviewed 2026-09-20 for the public static catalog. Issuer pages are the authority for fees, eligibility, redemption restrictions, and expiration; the catalog models only recurring or certificate-style benefits that users can track. Earning rates, welcome offers, lounge membership, insurance, and elite status are intentionally omitted.

| Catalog card | Issuer source | Catalog scope |
| --- | --- | --- |
| Southwest Rapid Rewards Performance Business Card | https://creditcards.chase.com/southwest/performance-business-credit-card | Anniversary points, qualifying points, and the four-year security-screening credit |
| Sapphire Reserve for Business | https://creditcards.chase.com/business-credit-cards/sapphire/reserve | Travel, hotel, security-screening, business-service, rideshare, delivery, and gift-card credits with their stated windows |
| American Airlines AAdvantage cards | https://www.citi.com/credit-cards/credit-card-miles/which-aadvantage-credit-card-should-you-get | Citi MileUp, Platinum Select, Executive, Business, and Globe products; recurring credits and certificates only where listed |

Card art for these additions is stored locally with issuer-hosted source receipts:

| Card | Local asset | Image source |
| --- | --- | --- |
| Southwest Rapid Rewards Performance Business Card | `/images/cards/southwest-rapid-rewards-performance-business-card.png` | https://creditcards.chase.com/content/dam/jpmc-ecm/cccswa/2026/a600-0059/cards/business.png |
| Sapphire Reserve for Business | `/images/cards/sapphire-reserve-for-business.png` | https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/sapphire_reserve_biz_card.png |
| American Airlines AAdvantage MileUp Card | `/images/cards/american-airlines-aadvantage-mileup-card.webp` | https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/aadvantage-mile-up-credit-card/aadvantage-mile-up-credit-card_306x192.webp |
| Citi / AAdvantage Platinum Select World Elite Mastercard | `/images/cards/citi-aadvantage-platinum-select-world-elite-mastercard.webp` | https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-platinum-elite-credit-card/citi-aadvantage-platinum-elite-credit-card_306x192.webp |
| Citi / AAdvantage Executive World Elite Mastercard | `/images/cards/citi-aadvantage-executive-world-elite-mastercard.webp` | https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-executive-world-legend-mastercard/citi-aadvantage-executive-world-legend-mastercard_306x192.webp |
| Citi / AAdvantage Business World Elite Mastercard | `/images/cards/citi-aadvantage-business-world-elite-mastercard.webp` | https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-business-credit-card/AA-Business.webp |
| Citi / AAdvantage Globe Mastercard | `/images/cards/citi-aadvantage-globe-mastercard.webp` | https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-aadvantage-globe-mastercard/citi-aadvantage-globe-mastercard_306x192.webp |

The manifest records dimensions, byte sizes, and SHA-256 hashes for each asset. Existing artwork is not reused for a different product.

The checked-in source is not a database rollout. The guarded global-catalog workflow must produce and review a non-destructive plan before any separately authorized synchronization; existing user cards and benefit statuses require their own propagation review.

## Operational disposition

- These are seven new product definitions. No existing key is renamed, removed, or intentionally retired. Stop the production apply if the dry run reports conflicts or unrelated updates/retirements; review drift before proceeding.
- New physical cards use the existing `createCardForUser` global-definition/status materialization flow. Because these products were absent, there are no pre-existing linked physical cards that need a backfill. Existing statuses and custom benefits are preserved.
- Benefits reuse existing inferred usage guides. Point/certificate/pass entries have zero preset cash value; users record their own realized value.
- Timed partner offers retain end dates in their descriptions. The schema does not automatically expire definitions: retire the 2026 hotel offer after December 31, 2026 and review the 2027 partner offers when they end, and retire the curated gift-card offer after October 31, 2028. Gift-card purchases must be made directly at giftcards.com/reservebusiness. Chase currently advertises The Edit increasing from $500 to $1,000 on January 1, 2027; that future change is not applied early.
- On any sync conflict or failure, stop; the sync uses a serializable transaction and does not delete definitions or reset user statuses. If a successful new definition must be withdrawn, use a separately reviewed keyed retirement plan, preserving linked history. Do not reseed or delete records.

## Amex sync coverage additions — 2026-11-02

The live reader exposed three annual usage credits missing from the source catalog. Added stable definitions and independent browser/server matching for:

| Card | Credit | Annual limit | Period | Issuer source |
| --- | --- | ---: | --- | --- |
| Consumer Platinum | CLEAR+ | $219 | Calendar year | [Amex Platinum benefits](https://global.americanexpress.com/card-benefits/detail/hotel-credit/platinum) |
| Consumer Platinum | Equinox | $300 | Calendar year | [Amex Platinum benefits](https://global.americanexpress.com/card-benefits/detail/hotel-credit/platinum) |
| Business Platinum | ChatGPT Business | $300 | Calendar year | [Amex Business Platinum benefits](https://global.americanexpress.com/card-benefits/view-all/business-platinum) |

The provider's live trackers also exposed January 1–December 31 ranges and usage fields for these credits. No private amounts or account identifiers are retained here. The catalog now has 59 Amex definitions, including 50 writable destination tuples; existing keys and terms are unchanged by these three additions. This is source code only: production catalog synchronization and materializing statuses for existing owned cards still require a reviewed, separately authorized plan. Do not treat browser coverage as proof of a saved destination status.

## Flagship terms audit and lifecycle metadata — 2026-11-22

Definitions now carry optional, sync-inert lifecycle metadata (`src/lib/catalog/lifecycle.ts`): `issuerSourceUrl`, `lastVerifiedAt`, `effectiveFrom`, `sunsetAfter` (inclusive UTC day), `upcomingChanges`, and `openDrift`. The global synchronizer copies only canonical fields, so this metadata never reaches the database. Amex provenance is attached in `static-catalog.ts`, not in the shared Amex catalog, so the reader bundles never embed issuer URLs.

`npm run catalog:freshness` replaces the prose reminders above with dated checks: an expired `sunsetAfter` or a due `upcomingChanges` entry is an error (exit 1), anything inside the 45-day horizon is a warning, a description stating "through M/D/YYYY" without a matching `sunsetAfter` is an error, and premium cards without provenance or verified more than 120 days ago are warnings. `--fetch` diffs each `issuerSourceUrl` page for stated fees and credit amounts and writes `build/catalog-freshness/report.{json,md}` plus card-template proposals under `proposals/` (`npm run card-template:validate -- build/catalog-freshness/proposals/*.json`). It never writes to the database.

| Card | Change | Source |
| --- | --- | --- |
| Chase Sapphire Reserve | DoorDash promos $25 → $35/month ($15 general promo replaced the $5 restaurant promo on 2026-10-01); select-hotel credit `sunsetAfter` 2026-12-31 | [DoorDash Chase partnership](https://help.doordash.com/en-us/consumers/article/chase-partnership) |
| Sapphire Reserve for Business | `sunsetAfter` on every dated partner offer; The Edit $500 → $1,000 scheduled for 2027-01-01 (not applied early) | [Chase Travel, 2026-11-05](https://www.businesswire.com/news/home/20261105070160/en/Chase-Travel-Unveils-27-Trips-to-Take-in-2027-and-Previews-Expanded-Luxury-Vacation-Homes-Offering) |
| Citi / AAdvantage Executive | Annual fee $595 → $695 (new cardmembers from 2026-08-23; existing at their next anniversary); added AA Vacations $250 Jan–Jun and Jul–Dec, $100 inflight/Admirals Club, $15 monthly Lyft, $120 Avis/Budget. Product renamed World Legend by Citi; the catalog name is kept because it is the public route identity | [Citi product page](https://www.citi.com/credit-cards/citi-aadvantage-executive-credit-card) |
| Hilton Honors Aspire | CLEAR+ credit $189 → $219 per calendar year | [Aspire terms](https://www.americanexpress.com/us/credit-cards/card-application/apply/member/terms/hilton-honors-aspire-credit-card/36182-11-0/) |
| Capital One Venture X | Added the $120 Global Entry/TSA PreCheck credit (every 4 years) | [Capital One](https://www.capitalone.com/credit-cards/venture-x/) |
| Citi Strata Premier | New product: $95 fee, $100 Annual Hotel Benefit (single $500+ stay via Citi Travel, calendar year) | [Citi product page](https://www.citi.com/credit-cards/citi-strata-premier-credit-card) |

Verified unchanged: Sapphire Preferred ($95; $100 hotel, GE/TSA, $10 DoorDash), Amex Gold ($325), Platinum and Business Platinum ($895), Venture X ($395), Delta Reserve and Bonvoy Brilliant ($650), HSBC Elite ($495), Atmos Summit ($395).

Open drift (reported by the audit, not applied): Chase grants Sapphire Reserve The Edit credits per calendar year, while the definition resets on the card anniversary. Changing `cycleAlignment` in place would collide with stored anniversary Benefit Statuses (the cron skips and reports the discrepancy), so it needs a reviewed status migration first.

Rollout: these are source changes only. Run the guarded `npm run sync:global-catalog -- --dry-run`; relative to the previous source it should add Citi Strata Premier and seven benefits (five AAdvantage Executive, one Venture X, one Strata Premier) and update the changed fee/amount/description fields, with zero retirements and zero conflicts (dev-database dry run on 2026-11-22: 0 conflicts, 0 retirements). Existing statuses are untouched; new cycles pick up the new amounts.
