// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client'; // Make this a Client Component

import React, { useState, useEffect, useTransition } from 'react'; // Import useTransition
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { addCardAction, bulkAddCardsAction } from '@/app/benefits/actions'; // Import the actions from the new file
import { searchCards, type CardWithBenefits } from '@/lib/cardSearchUtils';
import { isAmexCard } from '@/lib/cardDisplayUtils';
import { parseBulkCardInput } from '@/lib/bulk-card-parser';
import { Tooltip } from '@/components/ui/Tooltip';
import CardImageWell from '@/components/ui/CardImageWell';
import PageHeader from '@/components/ui/PageHeader';

// Helper arrays
const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i); // Last 10 years

interface BulkReviewRow {
  rowId: string;
  input: string;
  cardId: string;
  owner: string;
  nickname: string;
  lastFourDigits: string;
  candidates: CardWithBenefits[];
  error?: string;
}

// --- Sub-component for the card form with its own transition state ---
function PredefinedCardForm({ card, matchedFields }: { card: CardWithBenefits; matchedFields?: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [showBenefits, setShowBenefits] = useState(false);

  // Check if this is an AMEX card for dynamic form constraints
  const isAmex = isAmexCard(card.issuer);
  const maxLength = isAmex ? 5 : 4;
  const pattern = isAmex ? "[0-9]{4,5}" : "[0-9]{4}";
  const placeholder = isAmex ? "12345" : "1234";
  const label = isAmex ? "Last 5 Digits" : "Last 4 Digits";
  const helperText = isAmex
    ? "Enter exactly 5 digits to enable AMEX sync; legacy 4-digit entries remain supported for display"
    : "Helps identify your specific card if you have multiple of the same type";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      // Consider adding error handling or success feedback here if addCardAction returns status
      addCardAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="predefinedCardId" value={card.id} />
      <div className="flex h-full flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600">
        <div>
          {/* Card Image - Slightly Smaller */}
          <CardImageWell
            imageUrl={card.imageUrl}
            alt={card.name}
            issuer={card.issuer}
            className="h-36 rounded-none border-x-0 border-t-0"
            imageClassName="p-2"
            sizes="220px"
            unoptimized
          />

          {/* Card Name and Match Badges */}
          <div className="space-y-3 p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className={`text-lg font-semibold leading-snug text-gray-950 dark:text-gray-100 ${matchedFields?.includes('name') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                {card.name}
              </h2>
              {matchedFields && matchedFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {matchedFields.map(field => (
                    <span key={field} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                      {field}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Issuer and Annual Fee - More Compact */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
              <p className={`text-xs text-gray-500 dark:text-gray-400 ${matchedFields?.includes('issuer') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                {card.issuer}
              </p>
              <p className={`rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300 ${matchedFields?.includes('annual fee') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                ${card.annualFee}/year
              </p>
            </div>
          </div>

          {/* Collapsible Benefits Section */}
          {card.benefits && card.benefits.length > 0 && (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => setShowBenefits(!showBenefits)}
                className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800">
                    {card.benefits.length} {card.benefits.length === 1 ? 'benefit' : 'benefits'}
                  </span>
                </span>
                {showBenefits ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>

              {showBenefits && (
                <div className="mt-2 space-y-1 border-l-2 border-emerald-200 pl-2 dark:border-emerald-800">
                  {card.benefits.map((benefit, index) => (
                    <div key={index} className={`text-xs text-gray-600 dark:text-gray-400 ${matchedFields?.includes('benefit') || matchedFields?.includes('category') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                      - {benefit.description} {benefit.maxAmount && `($${benefit.maxAmount})`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nickname Field with Tooltip */}
          <div className="px-4 pb-3">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
              Nickname <span className="text-xs text-gray-400 ml-1">(optional)</span>
              <Tooltip content="Helpful for identifying cards when you have multiple of the same type" />
            </label>
            <input
              type="text"
              id={`nickname-${card.id}`}
              name="nickname"
              maxLength={50}
              placeholder="My Travel Card, Work Card..."
              className="block w-full px-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
            />
          </div>

          {/* Last Digits Field with Tooltip */}
          <div className="px-4 pb-3">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
              {label} <span className="text-xs text-gray-400 ml-1">(optional)</span>
              <Tooltip content={helperText} />
            </label>
            <input
              type="text"
              id={`lastFourDigits-${card.id}`}
              name="lastFourDigits"
              maxLength={maxLength}
              pattern={pattern}
              placeholder={placeholder}
              className="block w-full px-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                const cleaned = target.value.replace(/[^0-9]/g, '');
                target.value = cleaned.slice(0, maxLength);
              }}
            />
          </div>

          {/* Opened Date with Tooltip */}
          <div className="px-4 pb-4">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
              Opened Date <span className="text-xs text-gray-400 ml-1">(optional)</span>
              <Tooltip
                content={
                  <>
                    Helps track annual fees/benefits. Check your credit report (
                    <a href="https://www.creditkarma.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Credit Karma</a>
                    {', '}
                    <a href="https://www.experian.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Experian</a>
                    , etc.) if unsure.
                  </>
                }
              />
            </label>
            <div className="flex gap-2">
              <select
                id={`openedMonth-${card.id}`}
                name="openedMonth"
                className="block w-1/2 px-2 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Month...</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
              <select
                id={`openedYear-${card.id}`}
                name="openedYear"
                className="block w-1/2 px-2 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Year...</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className={`mt-auto w-full border-t border-indigo-500 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-700 ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPending ? 'Adding...' : 'Add Card'}
        </button>
      </div>
    </form>
  );
}

// --- Page Component ---

export {PredefinedCardForm};
