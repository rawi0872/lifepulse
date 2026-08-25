// Health Privacy Model — three explicit consent layers
// SOURCE ACCESS → LIFE PULSE STORAGE → NEXTRON ACCESS are independent.

import type { HealthMetricType } from "./health";

export type HealthScope = HealthMetricType;

export interface HealthPrivacyState {
  // Layer A: what the OS provider has granted on device (HealthKit / Health Connect)
  sourceAccess: {
    provider: "healthkit" | "health_connect";
    grantedScopes: HealthScope[];
    lastCheckedAt: string | null;
  } | null;
  // Layer B: what Life Pulse is allowed to store (user-selected sync categories)
  storageConsent: {
    allowedScopes: HealthScope[];
    updatedAt: string | null;
  };
  // Layer C: what NEXTRON is allowed to read from stored health
  nextronAccess: {
    allowed: boolean;
    allowedScopes: HealthScope[]; // subset of storageConsent.allowedScopes
    updatedAt: string | null;
  };
}

export const DEFAULT_HEALTH_PRIVACY: HealthPrivacyState = {
  sourceAccess: null,
  storageConsent: { allowedScopes: [], updatedAt: null },
  nextronAccess: { allowed: false, allowedScopes: [], updatedAt: null },
};

export function isStorageAllowed(state: HealthPrivacyState, metric: HealthScope): boolean {
  return state.storageConsent.allowedScopes.includes(metric);
}

export function isNextronAllowed(state: HealthPrivacyState, metric: HealthScope): boolean {
  if (!state.nextronAccess.allowed) return false;
  return state.nextronAccess.allowedScopes.includes(metric);
}

// Connecting Apple Health does NOT imply NEXTRON access — explicit separate opt-in
export function nextronHealthRequiresExplicitConsent(state: HealthPrivacyState): boolean {
  return !state.nextronAccess.allowed || state.nextronAccess.allowedScopes.length === 0;
}

export function filterForNextron<T extends { metricType: HealthScope }>(records: T[], state: HealthPrivacyState): T[] {
  if (!state.nextronAccess.allowed) return [];
  const allowed = new Set(state.nextronAccess.allowedScopes);
  return records.filter((r) => allowed.has(r.metricType));
}
