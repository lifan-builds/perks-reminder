// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.perksreminder.app',
  appName: 'Perks Reminder',
  webDir: 'capacitor-web',
  backgroundColor: '#ffffff',
  server: {
    url: 'https://www.perks-reminder.com',
    cleartext: false,
    errorPath: 'index.html',
    allowNavigation: [
      'www.perks-reminder.com',
      'perks-reminder.com',
      'loyalty.perks-reminder.com',
    ],
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
