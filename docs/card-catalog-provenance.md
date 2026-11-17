# Added card catalog provenance

Reviewed 2026-09-20 for the public static catalog. Issuer pages are the authority for fees, eligibility, redemption restrictions, and expiration; the catalog models only recurring or certificate-style benefits that users can track. Earning rates, welcome offers, lounge membership, insurance, and elite status are intentionally omitted.

| Catalog card | Issuer source | Catalog scope |
| --- | --- | --- |
| Southwest Rapid Rewards Performance Business Card | https://creditcards.chase.com/southwest/performance-business-credit-card | Anniversary points, qualifying points, and the four-year security-screening credit |
| Sapphire Reserve for Business | https://creditcards.chase.com/business-credit-cards/sapphire/reserve | Travel, hotel, security-screening, business-service, rideshare, delivery, and gift-card credits with their stated windows |
| American Airlines AAdvantage cards | https://www.citi.com/credit-cards/credit-card-miles/which-aadvantage-credit-card-should-you-get | Citi MileUp, Platinum Select, Executive, Business, and Globe products; recurring credits and certificates only where listed |

Card art for these additions is `null` until a card-specific image has an attributable source. Existing artwork must not be reused for a different product.

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
