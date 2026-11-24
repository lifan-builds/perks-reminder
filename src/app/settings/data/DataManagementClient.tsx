// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';

export default function DataManagementClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setImportMessage(null);
      setImportErrors([]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setImportMessage('Please select a JSON file to import.');
      return;
    }

    setIsImporting(true);
    setImportMessage('Importing...');
    setImportErrors([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/user-cards/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setImportMessage(`Import failed: ${result.message || 'Unknown error'}`);
        if (result.errors && Array.isArray(result.errors)) {
          setImportErrors(result.errors);
        }
      } else {
        setImportMessage(result.message || 'Import successful!');
        setImportErrors(result.errors || []);
        setFile(null);
      }
    } catch (error) {
      console.error('Import fetch error:', error);
      setImportMessage('An error occurred during import. Please check the console.');
      setImportErrors([]);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Data Management"
        description="Export a backup or restore cards from a previous Perks Reminder file."
      />

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Your Data, Your Control</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          We believe you should always own and control your data. You can export your added credit card list at any time.
          You can also import a previously exported file to restore your list.
        </p>
      </div>

      {/* Export Section */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Export Your Data</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Download a JSON file containing your list of added credit cards and their opening dates.
        </p>
        <Button variant="outline" asChild>
          <a href="/api/user-cards/export" download>Download My Data</a>
        </Button>
      </div>

      {/* Import Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Import Data</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Upload a previously exported JSON file (`perks_reminder_data_*.json` or `couponcycle_data_*.json`) to add cards to your account.
          Existing cards with the same name, issuer, and opening date will be skipped.
        </p>
        <div className="space-y-4">
          <Input
            id="import-file-input"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            disabled={isImporting || isPending}
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30"
            key={file ? 'file-selected' : 'no-file'}
          />
          <Button
            onClick={() => startTransition(() => handleImport())}
            disabled={!file || isImporting || isPending}
          >
            {isPending ? 'Processing...' : isImporting ? 'Importing...' : 'Import Selected File'}
          </Button>
          {importMessage && (
            <p className={`text-sm ${importErrors.length > 0 || importMessage.toLowerCase().includes('fail') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {importMessage}
            </p>
          )}
          {importErrors.length > 0 && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-md">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Import Errors:</h3>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                {importErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
