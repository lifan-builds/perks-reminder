// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { useId } from 'react';
import { cn } from '@/lib/utils';

interface InkStampProps {
  /** Text around the rim, e.g. "CHARGE BY". */
  rim: string;
  /** Large center line, e.g. "27". */
  center: string;
  /** Small line under the center, e.g. "DEC 2026". */
  caption: string;
  tone?: 'stamp' | 'visa' | 'ink';
  rotate?: number;
  className?: string;
}

const TONE_CLASS = {
  stamp: 'text-stamp',
  visa: 'text-visa',
  ink: 'text-primary',
} as const;

/** A circular rubber-stamp impression. Decorative: the same facts are always set as text nearby. */
export default function InkStamp({ rim, center, caption, tone = 'stamp', rotate = -8, className }: InkStampProps) {
  const id = useId().replace(/:/g, '');
  const rimText = `${rim} · ${rim} · `;
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', TONE_CLASS[tone], className)}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <defs>
        <path id={`rim-${id}`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <g fill="none" stroke="currentColor" opacity="0.9">
        <circle cx="60" cy="60" r="56" strokeWidth="3" />
        <circle cx="60" cy="60" r="34" strokeWidth="1.25" />
      </g>
      <text fill="currentColor" fontSize="10.5" fontWeight="700" letterSpacing="2.2" opacity="0.9">
        <textPath href={`#rim-${id}`}>{rimText}</textPath>
      </text>
      <text x="60" y="66" textAnchor="middle" fill="currentColor" fontSize="26" fontWeight="700" opacity="0.92" style={{ fontFamily: 'var(--font-display)' }}>
        {center}
      </text>
      <text x="60" y="80" textAnchor="middle" fill="currentColor" fontSize="7.5" fontWeight="700" letterSpacing="1.6" opacity="0.85">
        {caption}
      </text>
    </svg>
  );
}
