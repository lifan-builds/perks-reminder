// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowTopRightOnSquareIcon, ComputerDesktopIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AMEX_GREASY_FORK_URL, AMEX_READER_SETUP_PATH } from '@/lib/amex-benefit-reader/public-links';
import { AMEX_CHROME_WEB_STORE_URL, AMEX_READER_SUGGESTION_DISMISSED_COOKIE } from '@/lib/amex-reader-suggestion';

const secondaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const inlineLink = 'font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground';

export default function AmexReaderSuggestion({ amexCardCount, isMobile }: { amexCardCount: number; isMobile: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const dismiss = () => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${AMEX_READER_SUGGESTION_DISMISSED_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    setDismissed(true);
  };

  const userscriptLink = (
    <a href={AMEX_GREASY_FORK_URL} target="_blank" rel="noopener noreferrer" className={inlineLink}>
      Greasy Fork userscript
    </a>
  );

  return (
    <section
      aria-labelledby="amex-reader-suggestion-title"
      className="relative rounded-xl border border-border bg-card p-5 pr-14 shadow-sm shadow-black/[0.03] sm:p-6 sm:pr-16"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss the Amex extension suggestion"
        className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <h2 id="amex-reader-suggestion-title" className="text-lg font-semibold tracking-tight text-foreground">
        Sync your Amex benefits instead of checking them off by hand
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        You have {amexCardCount} Amex cards here. The free Perks Reminder extension for Chrome reads which credits
        you have used on americanexpress.com and updates them here after you review the changes. It works in the Amex
        tab you are already signed in to and never asks for your password.
      </p>
      {isMobile ? (
        <>
          <p className="mt-4 flex max-w-3xl items-start gap-2 text-sm leading-6 text-foreground">
            <ComputerDesktopIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              Phones can&apos;t install browser extensions, so this is a desktop step. Open Perks Reminder in Chrome on
              your computer to add it, or use the {userscriptLink} in another desktop browser.
            </span>
          </p>
          <Link href={AMEX_READER_SETUP_PATH} className={`${secondaryButton} mt-4 w-full sm:w-auto`}>
            See how it works
          </Link>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={AMEX_CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Add to Chrome
              <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
            <Link href={AMEX_READER_SETUP_PATH} className={secondaryButton}>
              See how it works
            </Link>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Not using Chrome? Install the {userscriptLink} with Tampermonkey instead.
          </p>
        </>
      )}
    </section>
  );
}
