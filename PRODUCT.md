# Product

<!-- impeccable:product-schema 1 -->

> Interview round was dismissed on 2026-11-22. Facts below come from the repository (README, PLAN.md, AGENTS.md, docs/, code) and the 2026-11-22 upgrade brief. Lines marked *(inferred)* were not confirmed by the owner.

## Platform

web

Installable PWA plus a focused Capacitor iOS shell that wraps the website (`ios/`, `capacitor.config.ts`); the design language is web.

## Users

- Primary *(inferred from README, catalog scope, and community channels)*: US points-and-miles holders carrying several premium cards (Amex Platinum/Gold, Chase Sapphire, Capital One Venture X, Citi, Bilt, co-brands), often multiple copies of the same product. They currently track monthly, quarterly, semi-annual, and anniversary credits in a spreadsheet and lose money when a Benefit Cycle resets unused.
- Their situation: a few minutes at a time, often on a phone, right before a reset (month end, Jun 30, Dec 31) or right after a purchase, deciding what to charge where.
- Secondary: newcomers comparing cards in the public catalog and reading Benefit Usage Guides before applying or using a credit.

## Product Purpose

Perks Reminder is a free, open-source credit card benefit tracker. It tracks recurring credits, exact Benefit Cycles, claimed value, annual fees, loyalty expirations, and practical Benefit Usage Guides without connecting to bank accounts. Success means users capture the credits they pay for before each window closes and can see whether each card's annual fee is earning its keep.

## Positioning

"Tracking plus how to use" (PLAN.md durable decision): exact Benefit Cycle math (calendar, half-year, quarterly, anniversary, multi-year windows) paired with Benefit Usage Guides that explain qualification, trigger steps, posting timing, and failure modes. No bank connection, no Plaid, no credentials. Completely free: unlimited cards, reminders, custom reminder timing, loyalty tracking, and import/export for every account.

## Operating Context

- Daily/weekly glance at the dashboard (`/benefits`) to mark credits used, partially used, or not usable.
- Reset-driven rituals: end of month, end of quarter, Jun 30 and Dec 31 half-year/annual resets, card anniversaries, annual-fee posting dates.
- Statement-credit posting lag: a purchase must post (not just authorize) before the window closes for the credit to count *(inferred from usage guides)*.
- Optional manual AMEX Observation via a Chrome extension or Tampermonkey userscript that reads the user's own Amex benefits page and hands confirmations back.
- Email reminders from a daily cron; loyalty-program expirations.

## Capabilities and Constraints

- Terminology: Physical Card (one owned card, distinct even for duplicate products), Standard/Custom Benefit Definition, Benefit Status (usage for one Benefit Cycle), Benefit Cycle, Benefit Usage Guide, Catalog, AMEX Observation.
- Public, anonymous, DB-free surfaces: home (signed out), catalog browse and card detail, usage guides, search, referrals, Amex reader setup (`npm run check:public-db`).
- Catalog identity is immutable `catalogKey`; card art is self-owned studio art (no issuer logos).
- Next.js 15 / React 19 / Tailwind 4 / shadcn-style tokens; light and dark themes via `next-themes`.
- No paid tier; `/pricing` explains the free commitment.

## Brand Commitments

- Name: Perks Reminder; domain perks-reminder.com.
- Voice: plain, specific, caveated where the issuer is the authority; community data points stay labeled as such.
- Free forever, open source, no bank connection — stated prominently, never as fine print *(inferred from home and pricing copy)*.

## Evidence on Hand

- Real catalog: 45 cards / 166 benefit definitions in `src/lib/static-catalog.ts`, with provenance in `docs/card-catalog-provenance.md`.
- Real usage guides in the static catalog; FAQ content in `src/lib/faq-data.ts`.
- Self-owned studio card art in `public/images/cards/`.
- No testimonials, user counts, savings totals, press, or ratings are on hand; do not fabricate them. Traction numbers (stars, reach) live outside the repo and are not product claims.

## Product Principles

1. A missed reset is the failure that matters; surface what expires next before anything else.
2. Show the rule, then the action: every credit links to how to actually trigger it.
3. Never require trust we do not need: no bank connection, local-first reader, issuer pages stay the authority.
4. Physical cards are identities, not product names.
5. Free means free: no gates, no upsell language.

## Accessibility & Inclusion

WCAG 2.2 AA *(inferred; existing SkipLink, labeled main landmark, focus rings)*. Must work on 390px phones and in both color schemes; respect reduced motion.
