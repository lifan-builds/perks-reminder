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
