/**
 * Optional provenance and lifecycle metadata for Catalog definitions.
 *
 * Purely descriptive: the global synchronizer copies only canonical fields, so
 * none of this reaches the database or changes existing-user Benefit Statuses.
 * `npm run catalog:freshness` reads it to flag stale verification, expired
 * timed offers, and scheduled issuer changes before they land.
 */

export type CatalogIsoDate = string;

export interface CatalogScheduledChange {
  /** First day (UTC) the issuer change applies. */
  effectiveOn: CatalogIsoDate;
  summary: string;
  annualFee?: number;
  maxAmount?: number;
  sourceUrl?: string;
}

export interface CatalogLifecycleMetadata {
  issuerSourceUrl?: string;
  lastVerifiedAt?: CatalogIsoDate;
  /** First day the definition is valid; earlier it is scheduled, not active. */
  effectiveFrom?: CatalogIsoDate;
  /** Last day (UTC, inclusive) the definition is valid. */
  sunsetAfter?: CatalogIsoDate;
  upcomingChanges?: readonly CatalogScheduledChange[];
  /**
   * Known issuer drift that cannot be applied in place (for example a cycle
   * alignment change that would collide with stored Benefit Statuses). Stays
   * on the freshness report until a reviewed migration resolves it.
   */
  openDrift?: string;
}

export type CatalogLifecycleState = 'active' | 'scheduled' | 'expired';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCatalogIsoDate(value: unknown): value is CatalogIsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** UTC calendar day of an instant, as YYYY-MM-DD. */
export function catalogDay(instant: Date): CatalogIsoDate {
  return instant.toISOString().slice(0, 10);
}

export function catalogLifecycleState(
  metadata: CatalogLifecycleMetadata,
  today: CatalogIsoDate,
): CatalogLifecycleState {
  if (metadata.effectiveFrom && today < metadata.effectiveFrom) return 'scheduled';
  if (metadata.sunsetAfter && today > metadata.sunsetAfter) return 'expired';
  return 'active';
}

export function assertCatalogLifecycle(key: string, metadata: CatalogLifecycleMetadata): void {
  for (const field of ['lastVerifiedAt', 'effectiveFrom', 'sunsetAfter'] as const) {
    const value = metadata[field];
    if (value !== undefined && !isCatalogIsoDate(value)) {
      throw new Error(`Invalid ${field} for ${key}; expected YYYY-MM-DD.`);
    }
  }
  if (metadata.issuerSourceUrl !== undefined && !/^https:\/\//.test(metadata.issuerSourceUrl)) {
    throw new Error(`issuerSourceUrl for ${key} must be an https URL.`);
  }
  if (metadata.effectiveFrom && metadata.sunsetAfter && metadata.sunsetAfter < metadata.effectiveFrom) {
    throw new Error(`sunsetAfter precedes effectiveFrom for ${key}.`);
  }
  if (metadata.openDrift !== undefined && !metadata.openDrift.trim()) {
    throw new Error(`openDrift for ${key} must describe the drift.`);
  }
  for (const change of metadata.upcomingChanges ?? []) {
    if (!isCatalogIsoDate(change.effectiveOn) || !change.summary.trim()) {
      throw new Error(`Invalid upcoming change for ${key}; expected effectiveOn YYYY-MM-DD and a summary.`);
    }
    if (change.sourceUrl !== undefined && !/^https:\/\//.test(change.sourceUrl)) {
      throw new Error(`Upcoming change sourceUrl for ${key} must be an https URL.`);
    }
  }
}
