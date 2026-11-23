// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { Metadata } from 'next';
import Link from 'next/link';
import { PRIMARY_SITE_URL, SITE_NAME } from '@/lib/site';
import { calculateAnnualBenefitValue, getPublicStaticCards } from '@/lib/static-catalog';

const FEATURED_CARDS = ['card:csr', 'card:american-express-platinum-card', 'card:venture-x'];

export const metadata: Metadata = {
  title: "Credit Card Benefits Guide - How to Maximize Your Rewards",
  description: "Complete guide to tracking credit card benefits, maximizing annual fee ROI, and never missing expiring perks. Tips for Chase, Amex, Capital One, and all major issuers.",
  keywords: [
    "credit card benefits guide",
    "how to maximize credit card rewards",
    "credit card annual fee worth it",
    "tracking credit card perks",
    "Chase Sapphire benefits guide",
    "Amex Platinum benefits guide",
    "Capital One Venture benefits",
    "credit card ROI calculator",
    "travel credit optimization",
    "dining credit tracker"
  ],
  alternates: {
    canonical: '/guide',
  },
};

export default function GuidePage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Complete Guide to Maximizing Credit Card Benefits',
    description: metadata.description,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    mainEntityOfPage: `${PRIMARY_SITE_URL}/guide`,
  };

  const featured = getPublicStaticCards()
    .filter((card) => FEATURED_CARDS.includes(card.catalogKey))
    .sort((left, right) => FEATURED_CARDS.indexOf(left.catalogKey) - FEATURED_CARDS.indexOf(right.catalogKey));

  return (
    <div className="mx-auto max-w-3xl px-1 py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <article className="prose">
        <h1>Complete Guide to Maximizing Credit Card Benefits</h1>

        <p className="lead">
          How to track, time, and actually use the credits a premium card charges you for, so the annual fee pays for
          itself instead of quietly expiring.
        </p>

        <h2>Why Credit Card Benefit Tracking Matters</h2>
        <p>
          Premium cards now carry annual fees in the $500–$900 range and pay them back through a long list of small,
          use-it-or-lose-it credits. Each one has its own window, merchant rules, and enrollment step, and an unused
          window does not roll over.
        </p>

        <h2>Understanding Credit Card Benefit Cycles</h2>
        <p>
          Credits reset on different clocks, often several on the same card:
        </p>
        <ul>
          <li><strong>Calendar month:</strong> streaming, rideshare, and delivery credits (reset on the 1st)</li>
          <li><strong>Calendar quarter:</strong> dining and retail credits (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)</li>
          <li><strong>Half year:</strong> hotel, shopping, and event credits split Jan–Jun and Jul–Dec</li>
          <li><strong>Calendar year:</strong> airline-fee, membership, and business-software credits (reset Jan 1)</li>
          <li><strong>Card anniversary:</strong> travel credits, free nights, and anniversary points tied to your open date</li>
          <li><strong>Multi-year:</strong> Global Entry, TSA PreCheck, or NEXUS credits every four or four-and-a-half years</li>
        </ul>
        <p>
          Many of these windows close together on Dec 31, and a credit counts by the date the purchase <em>posts</em>,
          not the day you buy. The <Link href="/expiring">Year-End Rescue</Link> lists every Dec 31 credit with a safe
          charge-by date.
        </p>

        <h2>Top Credit Cards and Their Benefits</h2>
        <p>
          Straight from the Perks Reminder catalog, so these stay current. Issuer terms are the authority; each card page
          links its usage guides.
        </p>

        {featured.map((card) => {
          const credits = [...card.benefits]
            .filter((benefit) => benefit.maxAmount > 0)
            .sort((left, right) =>
              calculateAnnualBenefitValue(right.maxAmount, right.frequency, right.fixedCycleDurationMonths)
              - calculateAnnualBenefitValue(left.maxAmount, left.frequency, left.fixedCycleDurationMonths))
            .slice(0, 6);
          return (
            <section key={card.catalogKey}>
              <h3>
                <Link href={`/cards/browse/${encodeURIComponent(card.name)}`}>{card.name}</Link>
                <span className="not-prose ml-2 align-middle text-sm font-sans font-medium text-muted-foreground">${card.annualFee} annual fee</span>
              </h3>
              <ul>
                {credits.map((benefit) => (
                  <li key={benefit.catalogKey}>
                    {benefit.usageWay ? (
                      <Link href={`/benefits/how-to-use/${benefit.usageWay.slug}`}>{benefit.description}</Link>
                    ) : benefit.description}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <h2>How to Calculate Your Credit Card ROI</h2>
        <p>
          To determine if your annual fee is worth it, calculate your return on investment:
        </p>
        
        <ol>
          <li>List all benefits you actually use and their cash value</li>
          <li>Add any cash back or points value you earn</li>
          <li>Subtract the annual fee</li>
          <li>Divide by the annual fee to get your ROI percentage</li>
        </ol>

        <p>
          <strong>Example:</strong> If you use $1,100 worth of credits and earn $300 in points value on a $795 annual fee card,
          your net value is $605, a 76% return on the fee.
        </p>

        <h2>Best Practices for Benefit Tracking</h2>
        
        <h3>Set Up Automated Tracking</h3>
        <p>
          Use tools like Perks Reminder to automatically track your benefit cycles and get notifications 
          before benefits expire. Manual tracking often leads to missed opportunities.
        </p>

        <h3>Calendar Your Benefits</h3>
        <p>
          Add benefit expiration dates to your calendar with reminders set 30 days before expiration. 
          This gives you time to plan usage.
        </p>

        <h3>Track Usage Throughout the Year</h3>
        <p>
          Don&apos;t wait until the end of the year to use benefits. Plan ahead and use credits consistently 
          throughout your benefit cycle.
        </p>

        <h3>Understand Benefit Categories</h3>
        <p>
          Some benefits are more flexible than others. Travel credits often have broad usage, 
          while dining credits may be limited to specific merchants.
        </p>

        <h2>Common Mistakes to Avoid</h2>
        
        <ul>
          <li><strong>Forgetting to Use Credits:</strong> Set reminders and track usage regularly</li>
          <li><strong>Not Understanding Terms:</strong> Read the fine print on benefit usage</li>
          <li><strong>Overpaying Annual Fees:</strong> Calculate ROI before keeping expensive cards</li>
          <li><strong>Ignoring Lesser-Known Benefits:</strong> Many cards offer hidden perks</li>
        </ul>

        <h2>Advanced Strategies</h2>
        
        <h3>Credit Card Churning</h3>
        <p>
          For experienced users, opening and closing cards strategically can maximize sign-up bonuses 
          and benefits while minimizing annual fees.
        </p>

        <h3>Product Changes</h3>
        <p>
          Many issuers allow downgrading to no-fee versions when benefits no longer justify the cost. 
          This preserves your credit history while reducing fees.
        </p>

        <h3>Multiple Cards Strategy</h3>
        <p>
          Having multiple cards can maximize benefits across different categories, but requires 
          careful tracking to ensure you&apos;re getting value from each card.
        </p>

        <h2>Getting Started</h2>
        <p>
          Ready to maximize your credit card benefits? Start by:
        </p>
        
        <ol>
          <li>Listing all your current credit cards and their benefits</li>
          <li>Setting up a tracking system (like Perks Reminder)</li>
          <li>Calculating the ROI for each card</li>
          <li>Setting up reminders for benefit expirations</li>
          <li>Creating a plan to use benefits throughout the year</li>
        </ol>

        <aside className="not-prose document-frame mt-12 rounded-xl p-6 sm:p-8">
          <h2 className="font-display text-3xl leading-tight text-foreground">Start tracking your benefits</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Every card, every reset window, and a reminder before each one closes. Free, open source, no bank connection.
          </p>
          <Link
            href="/auth/signup?callbackUrl=%2Fcards%2Fnew"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start tracking free
          </Link>
        </aside>
      </article>
    </div>
  );
}
