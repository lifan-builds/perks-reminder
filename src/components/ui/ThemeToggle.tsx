// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';

const emptySubscribe = () => () => {};

export default function ThemeToggle() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Toggle theme"
      >
        <div className="h-5 w-5" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      {theme === 'light' && (
        <SunIcon className="h-5 w-5 text-amber-500" aria-hidden="true" />
      )}
      {theme === 'dark' && (
        <MoonIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
      {theme === 'system' && (
        <ComputerDesktopIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

