'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  LoyaltyAccountFormFields,
  LoyaltyModalShell,
  LoyaltyProgramSummaryCard,
  serializeCertificateRows,
  type CertificateFormRow,
  type LoyaltyProgram,
} from './loyalty-account-shared';

interface AddLoyaltyAccountModalProps {
  availablePrograms: LoyaltyProgram[];
  onSubmit: (formData: FormData) => void;
  onClose: () => void;
  isPending: boolean;
}

export function AddLoyaltyAccountModal({
  availablePrograms,
  onSubmit,
  onClose,
  isPending,
}: AddLoyaltyAccountModalProps) {
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgram | null>(null);
  const [certificateRows, setCertificateRows] = useState<CertificateFormRow[]>([]);

  const getDefaultLastActivityDate = () => {
    const today = new Date();
    today.setMonth(today.getMonth() - 1);
    return today.toISOString().split('T')[0];
  };

  return (
    <LoyaltyModalShell
      title="Add Loyalty Program"
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Loyalty Program *
        </label>
        <select
          name="loyaltyProgramId"
          required
          value={selectedProgram?.id || ''}
          onChange={(e) => {
            const program = availablePrograms.find((p) => p.id === e.target.value);
            setSelectedProgram(program || null);
            if (program?.type !== 'HOTEL') {
              setCertificateRows([]);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Choose a program...</option>
          {availablePrograms.map((program) => (
            <option key={program.id} value={program.id}>
              {program.displayName} ({program.company})
            </option>
          ))}
        </select>
      </div>

      {selectedProgram && <LoyaltyProgramSummaryCard program={selectedProgram} />}

      <LoyaltyAccountFormFields
        program={selectedProgram}
        defaultLastActivityDate={getDefaultLastActivityDate()}
        lastActivityNeverExpiresLabel="Last Activity *"
        certificateRows={certificateRows}
        setCertificateRows={setCertificateRows}
        serializedCertificates={serializeCertificateRows(selectedProgram?.type, certificateRows)}
      />

      <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !selectedProgram}>
          {isPending ? 'Adding...' : 'Add Account'}
        </Button>
      </div>
    </LoyaltyModalShell>
  );
}
