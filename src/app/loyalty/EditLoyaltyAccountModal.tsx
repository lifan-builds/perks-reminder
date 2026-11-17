'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  LoyaltyAccountFormFields,
  LoyaltyModalShell,
  LoyaltyProgramSummaryCard,
  serializeCertificateRows,
  type CertificateFormRow,
  type LoyaltyAccount,
} from './loyalty-account-shared';

interface EditLoyaltyAccountModalProps {
  account: LoyaltyAccount;
  onSubmit: (formData: FormData) => void;
  onClose: () => void;
  isPending: boolean;
}

export function EditLoyaltyAccountModal({
  account,
  onSubmit,
  onClose,
  isPending,
}: EditLoyaltyAccountModalProps) {
  const [certificateRows, setCertificateRows] = useState<CertificateFormRow[]>(
    account.certificates.map((certificate) => ({
      id: certificate.id,
      label: certificate.label || '',
      quantity: String(certificate.quantity),
      expirationDate: new Date(certificate.expirationDate).toISOString().split('T')[0],
      notes: certificate.notes || '',
    }))
  );

  return (
    <LoyaltyModalShell
      title="Edit Loyalty Account"
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.append('accountId', account.id);
        onSubmit(formData);
      }}
    >
      <LoyaltyProgramSummaryCard program={account.loyaltyProgram} showCompanyHeader />

      <LoyaltyAccountFormFields
        program={account.loyaltyProgram}
        defaultAccountNumber={account.accountNumber || ''}
        defaultPointsBalance={account.pointsBalance ?? ''}
        defaultLastActivityDate={new Date(account.lastActivityDate).toISOString().split('T')[0]}
        defaultNotes={account.notes || ''}
        currentExpirationDate={account.expirationDate}
        certificateRows={certificateRows}
        setCertificateRows={setCertificateRows}
        serializedCertificates={serializeCertificateRows(account.loyaltyProgram.type, certificateRows)}
      />

      <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </LoyaltyModalShell>
  );
}
