// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import { useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSession, SessionContext, SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { Session } from 'next-auth';
import { SESSION_HINT_COOKIE } from '@/lib/session-cookie';

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

function hasClientSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((entry) => entry === `${SESSION_HINT_COOKIE}=1`);
}

function SessionHintSync({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: Session | null;
}) {
  const pathname = usePathname();
  const baseContext = useContext(SessionContext);
  const [hydratedSession, setHydratedSession] = useState<Session | null>(null);

  useEffect(() => {
    if (initialSession !== undefined || hydratedSession || !hasClientSessionHint()) return;
    let cancelled = false;
    getSession({ broadcast: false }).then((loaded) => {
      if (!cancelled && loaded) {
        setHydratedSession(loaded);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialSession, hydratedSession, pathname]);

  if (hydratedSession && baseContext && SessionContext) {
    return (
      <SessionContext.Provider
        value={{
          data: hydratedSession,
          status: 'authenticated',
          update: baseContext.update,
        }}
      >
        {children}
      </SessionContext.Provider>
    );
  }

  return <>{children}</>;
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session ?? null} refetchOnWindowFocus={false}>
      <SessionHintSync initialSession={session}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </SessionHintSync>
    </SessionProvider>
  );
}
