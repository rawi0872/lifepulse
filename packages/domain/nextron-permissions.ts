// ---------------------------------------------------------------------------
// Shared NEXTRON permission semantics (web ↔ mobile convergence).
// ---------------------------------------------------------------------------
// ONE fail-closed model for Body + Wealth NEXTRON gating. Fetchers stay
// client-side (different Supabase clients); every gate decision below is
// shared. Missing/stale state always resolves to denied.
// ---------------------------------------------------------------------------

export type WealthNextronSection =
  | "balances"
  | "cash_flow"
  | "transactions_summary"
  | "recurring_items"
  | "wealth_goals";

export const WEALTH_NEXTRON_SECTIONS: WealthNextronSection[] = [
  "balances",
  "cash_flow",
  "transactions_summary",
  "recurring_items",
  "wealth_goals",
];

export interface WealthNextronPermissions {
  master: boolean;
  sections: WealthNextronSection[];
}

/** Defaults: everything off (fail-closed). */
export const DEFAULT_WEALTH_NEXTRON_PERMISSIONS: WealthNextronPermissions = {
  master: false,
  sections: [],
};

export function sanitizeWealthNextronSections(sections: readonly string[]): WealthNextronSection[] {
  return Array.from(new Set(sections)).filter((s): s is WealthNextronSection =>
    (WEALTH_NEXTRON_SECTIONS as readonly string[]).includes(s),
  );
}

/** Sections effective only when the master switch is on. */
export function getEffectiveWealthNextronSections(perms: WealthNextronPermissions | null): WealthNextronSection[] {
  if (!perms || !perms.master) return [];
  return sanitizeWealthNextronSections(perms.sections);
}

/** Fail-closed helper for evidence builders. */
export function isWealthSectionEffective(
  perms: WealthNextronPermissions | null,
  section: WealthNextronSection,
): boolean {
  return getEffectiveWealthNextronSections(perms).includes(section);
}

/**
 * Body evidence gate: a metric is usable by NEXTRON only when it is both
 * stored (allowed) and explicitly NEXTRON-allowed. Empty/missing inputs
 * deny. Mirrors health-privacy.ts at the metric-list level.
 */
export function effectiveNextronMetrics(allowed: readonly string[], nextronAllowed: readonly string[]): string[] {
  const stored = new Set(allowed ?? []);
  return (nextronAllowed ?? []).filter((m) => stored.has(m));
}

/** True when NEXTRON has any Body evidence available at all. */
export function hasNextronBodyAccess(allowed: readonly string[], nextronAllowed: readonly string[]): boolean {
  return effectiveNextronMetrics(allowed, nextronAllowed).length > 0;
}
