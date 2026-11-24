-- Add indexes for Amex reader eligibility and sync provenance lookups.
CREATE INDEX IF NOT EXISTS "CreditCard_user_issuer_lifecycle_idx"
  ON "CreditCard" ("userId", "issuer", "lifecycleStatus");

CREATE INDEX IF NOT EXISTS "AmexSyncAttempt_user_completed_idx"
  ON "AmexSyncAttempt" ("userId", "completedAt");

CREATE INDEX IF NOT EXISTS "BenefitStatusSourceProvenance_source_status_idx"
  ON "BenefitStatusSourceProvenance" ("source", "benefitStatusId");
