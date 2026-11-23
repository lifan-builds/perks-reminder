---
name: Perks Reminder
description: The security-printed travel document — every credit stamped before its window closes.
colors:
  security-paper: "oklch(0.975 0.011 84)"
  paper-card: "oklch(0.99 0.007 85)"
  intaglio-ink: "oklch(0.255 0.06 262)"
  passport-ink: "oklch(0.32 0.09 262)"
  ink-muted: "oklch(0.455 0.033 262)"
  paper-rule: "oklch(0.875 0.017 78)"
  stamp-vermilion: "oklch(0.545 0.185 33)"
  stamp-wash: "oklch(0.95 0.035 45)"
  visa-green: "oklch(0.47 0.1 160)"
  visa-wash: "oklch(0.95 0.03 160)"
  foil-gold: "oklch(0.64 0.1 80)"
  cover-navy: "oklch(0.175 0.035 262)"
  cover-board: "oklch(0.215 0.04 262)"
  cover-foil: "oklch(0.85 0.075 82)"
  cover-paper-type: "oklch(0.94 0.014 84)"
  cover-stamp: "oklch(0.72 0.15 38)"
  email-ink: "#2B3A6E"
  email-muted: "#5B6478"
  email-faint: "#8A90A0"
typography:
  display:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "5.25rem"
    fontWeight: 560
    lineHeight: 1.02
    letterSpacing: "-0.035em"
    fontVariation: "\"opsz\" 36"
  headline:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "2.25rem"
    fontWeight: 560
    lineHeight: 1.15
    letterSpacing: "-0.025em"
    fontVariation: "\"opsz\" 36"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  reading-title:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "3.75rem"
    fontWeight: 560
    lineHeight: 1.04
  reading-title-min:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "2.5rem"
    fontWeight: 560
    lineHeight: 1.04
  headline-min:
    fontFamily: "Bodoni Moda, Didot, serif"
    fontSize: "1.75rem"
    fontWeight: 560
    lineHeight: 1.15
  lead:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.65
  reading:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  body-dense:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  data:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  micro:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.12em"
  email-body:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "14px"
    lineHeight: 1.6
  email-caption:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "12px"
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.passport-ink}"
    textColor: "{colors.security-paper}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.intaglio-ink}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "48px"
  button-rescue:
    backgroundColor: "{colors.stamp-vermilion}"
    textColor: "{colors.security-paper}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "48px"
  chip:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.intaglio-ink}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-selected:
    backgroundColor: "{colors.passport-ink}"
    textColor: "{colors.security-paper}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.intaglio-ink}"
    rounded: "{rounded.lg}"
    height: "48px"
  document-frame:
    backgroundColor: "{colors.paper-card}"
    rounded: "{rounded.xl}"
    padding: "28px"
---

# Design System: Perks Reminder

## Overview

Perks Reminder is drawn as a security-printed travel document. A user's year of credits reads like the pages of a passport: security paper as the ground, intaglio-blue engraved type, one guilloche rosette as ornament, and rubber-stamp impressions that mean exactly two things — vermilion for a window that is closing, visa green for a credit that is claimed or free. The world earns its place by explaining the product: each credit has a validity window ("valid until Dec 31"), a stamp that says when to charge it, and a document field label for every fact.

Light mode is the open passport page in daylight. Dark mode is the passport cover at night: navy board, foil-gold primary, paper-white type. Both are complete themes; neither is derived by inversion.

Persuade surfaces (home, pricing, loyalty landing, referrals, `/expiring`) let the document carry the page: a document-frame object at one scale, the engraved display face for headlines, and the rosette behind the first viewport. Operate surfaces (dashboard, cards, calendar, settings, Amex sync) keep their familiar layouts and inherit the inks through retuned gray and blue scales; the world shows in precise details (field labels, stamps, tabular figures). Read surfaces (`/guide`, usage guides) use the `.prose` document page with a 68ch measure.

## Colors

All colors are OKLCH and live as CSS custom properties in `src/app/globals.css`. Raw Tailwind `gray-*` scales run from security paper to intaglio navy, `blue-*` is passport ink, and `green-*` / `emerald-*` are visa green, so the ~700 legacy utility classes across the app stay inside the same inks.

### Primary

- **Passport ink** (`--primary`, light): actions, links, open validity windows, the selected chip.
- **Cover foil** (`--primary`, dark): the same roles on the navy cover.

### Secondary

- **Stamp vermilion** (`--stamp`): only for a window that is closing or a charge-by date — the today needle, a window that closes this month or next, rescue banners, "last time — not renewed".

### Tertiary

- **Visa green** (`--visa`): claimed value, "free", "paid in full".

### Neutral

- **Security paper** (`--background`), **paper card** (`--card`), **paper rule** (`--border`), **ink muted** (`--muted-foreground`, 4.5:1+ on paper).

### Named Rules

- **Stamp law.** Vermilion means "act before this closes". Never use it for decoration, errors that are not deadlines, or emphasis.
- **Two inks, then paper.** A surface uses ink plus at most one stamp ink. Amber stays for warnings; red stays for destructive actions.

## Typography

- **Display / headline:** Bodoni Moda (self-hosted via `@fontsource-variable/bodoni-moda`, loaded with `next/font/local` as `--font-display-face`), `opsz` 36, weight 560, tracking -0.035em. Page titles, document headings, amounts in ledgers, the charge-by date.
- **Body / title / UI:** Geist Sans. Body 16–17px at 1.75 in reading surfaces.
- **Field label:** Geist 11px, 600, 0.14em tracked uppercase (`.field-label`) for document fields: VALID UNTIL, CHARGE BY, POSTING BUFFER. Never above a heading.
- **Transactional email** uses Georgia with the `email-*` hex inks, because mail clients do not load web fonts or OKLCH reliably.
- Figures are tabular wherever amounts or dates line up (`.tabular`, tables, `<time>`).

### Hierarchy

Display (hero h1, up to 5.25rem) → headline (h2, 2–2.25rem) → title (h3/semibold 18px) → body → field label. Space above a heading exceeds space below it.

## Layout

Max content width 80rem (`max-w-7xl`); reading measure 68ch; hero sections bleed edge to edge on the security-paper ground. Mobile is single-column at 390px with full-width stacked actions; no horizontal overflow at any breakpoint (asserted by the E2E suite).

## Elevation & Depth

Paper sits flat; the one raised object per view is the `document-frame`: a 1px paper rule, a 4px inset card band with a hairline inner rule, and a soft offset shadow (`0 12px 32px -18px` ink at 28%). No glass, no glows.

## Shapes

10px radius on controls, 14px on document frames, full pills for chips. Card art is ISO/IEC 7810 ID-1 (1.586:1) with its own 3.18mm-equivalent corner radius.

## Components

### Buttons

Primary passport ink (foil in dark), 48px tall on Persuade surfaces and 40px in Operate. Rescue actions use stamp vermilion. Secondary is paper card with a paper rule.

### Chips

Pills that toggle with `aria-pressed`; the selected state inverts to ink.

### Cards / Containers

Operate surfaces keep `bg-card` panels with a paper rule. Persuade and rescue surfaces use one `document-frame` object instead of rows of equal cards.

### Inputs / Fields

Paper-card field, input rule, ink focus ring at 25%, 48px search fields with a leading magnifier and a combobox listbox.

### Navigation

Sticky paper header with hairline rule; active item inverts to ink. "Dec 31" links to the Year-End Rescue.

### Ink stamp (`src/components/art/InkStamp.tsx`)

A circular rubber-stamp impression with rim text on a path, a display-face center, and a caption. Decorative only (`aria-hidden`): the same fact is always set as text nearby.

### Guilloche rosette (`src/components/art/GuillocheRosette.tsx`)

Procedural security-print rosette in `currentColor` at 15–25% opacity behind first viewports. One per page.

### Validity record (`src/components/home/CycleLedger.tsx`)

Twelve-month strip per credit family with inked open windows, vermilion closing windows, past windows in muted paper, and one vermilion today needle.

### Studio card art (`scripts/generate-card-art.mjs`)

Self-owned ID-1 card art in six material families (brushed platinum, obsidian carbon, cobalt sapphire, rose-brass, emerald fluting, titanium guilloche). No issuer or network marks.

## Do's and Don'ts

### Do:

- Show the rule and the action together: window, charge-by date, and the usage-guide link on the same row.
- Put real catalog data in every demonstration.
- Theme the browser surfaces: selection (stamp wash), caret (stamp), scrollbars (ink), focus rings (ink/foil).

### Don't:

- Kickers or eyebrows above headings; section numbers; emoji as icons.
- Gradient text, purple/violet gradients, side-stripe accents, glass.
- Third-party bank logos, card scans, or network marks anywhere.
- Vermilion for anything that is not a closing window.
