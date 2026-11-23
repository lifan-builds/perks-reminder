# Perks Reminder

Perks Reminder is a free, open-source credit card benefit tracker. It tracks recurring credits, Benefit Cycles, claimed value, annual fees, loyalty expirations, and practical Benefit Usage Guides without connecting to bank accounts.

[Open Perks Reminder](https://www.perks-reminder.com/) · [Portfolio Overview (`clifan.com/perks-reminder`)](https://clifan.com/perks-reminder/)

## Product model

- A Physical Card is always tracked separately, even when a user owns several copies of the same product.
- Standard Card Definitions and Standard Benefit Definitions come from the shared Catalog.
- Custom Benefit Definitions remain user-owned.
- Benefit Status stores usage state for one Benefit Cycle.
- Every account receives unlimited cards, reminders, custom reminder timing, loyalty tracking, and import/export.

## Features

- Monthly, quarterly, yearly, anniversary, and multi-year Benefit Cycles
- Completion, partial completion, and not-usable tracking
- Claimed-value and annual-fee ROI summaries
- Duplicate Physical Card labels using nickname and stored ending digits
- Benefit Usage Guides with qualification, timing, and caveats
- Email reminders and loyalty-expiration tracking
- Data import/export and bulk card onboarding
- Optional manual AMEX Observation and confirmation workflow
- Installable PWA and focused Capacitor iOS shell

## Technology

- Next.js 15, React 19, and TypeScript
- PostgreSQL through Prisma
- NextAuth authentication
- Resend transactional email
- Vercel hosting and cron scheduling
- Jest and Playwright tests

## Local development

Install dependencies and start the application using an already configured local environment:

```bash
npm install
npm run dev
```

## Safe verification

These checks do not require a database or production access:

```bash
npm test -- --runInBand
npx tsc --noEmit --pretty false --incremental false
npm run check:public-db
npm run card-template:validate
npm run check:amex-userscripts
npm run check:amex-reader-extension
```

## Catalog contributions

The checked-in DB-free Catalog lives in `src/lib/static-catalog.ts`. `card-templates/` is the contributor intake format:

```bash
npm run card-template:validate
```

A Catalog change is not complete until immutable keys, global synchronization, existing-card status propagation, and Benefit Usage Guide disposition are addressed. `prisma/seed.ts` consumes the shared source but is not the normal rollout mechanism.

Read:

- `AGENTS.md` — catalog and benefit update boundaries
- [card-templates/README.md](card-templates/README.md)
- [docs/community-data-quality-loop.md](docs/community-data-quality-loop.md)

## Project guidance

- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow
- [AGENTS.md](AGENTS.md) — project entry point and safety boundary
- [docs/version-history.md](docs/version-history.md) — user-facing release history

## License

Open source under [AGPL-3.0-only](https://github.com/lifan-builds/perks-reminder/blob/main/LICENSE), with the Section 7 attribution terms in [ATTRIBUTION.md](https://github.com/lifan-builds/perks-reminder/blob/main/ATTRIBUTION.md). Copies and modified versions must keep this credit in their README and `--version` or About output, mark their changes, and may not use the Perks Reminder name:

> Based on Perks Reminder by lifan-builds (https://github.com/lifan-builds/perks-reminder)

Copyright © 2026 [lifan-builds](https://github.com/lifan-builds). Pull requests are welcome under [CONTRIBUTING.md](https://github.com/lifan-builds/perks-reminder/blob/main/CONTRIBUTING.md) with a one-time [CLA](https://github.com/lifan-builds/perks-reminder/blob/main/CLA.md). For licensing outside AGPL, open an issue.
