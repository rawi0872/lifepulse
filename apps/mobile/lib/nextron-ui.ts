// ---------------------------------------------------------------------------
// NEXTRON presentation helpers — deterministic, framework-free.
// Calm error mapping (never surface provider internals) and truthful
// context summaries built only from actual permission state.
// Tested in apps/mobile/scripts/test-today-nextron.mjs.
// ---------------------------------------------------------------------------

export type NextronErrorCode = "AUTH_REQUIRED" | "NETWORK_ERROR" | "INVALID_RESPONSE" | "UNKNOWN";

export function toCalmNextronError(code: string | undefined, status: number | undefined): string {
  if (code === "AUTH_REQUIRED" || status === 401) return "Sign in again to continue.";
  if (code === "NETWORK_ERROR" || status === 0) return "Couldn't reach NEXTRON. Check your connection and try again.";
  return "NEXTRON couldn't reply. Try again.";
}

export interface NextronContextState {
  wealthMaster: boolean;
  /** Effective (master-gated) wealth sections with access. */
  wealthSections: string[];
  /** Effective body metrics NEXTRON may use (storage ∩ NEXTRON consent). */
  bodyMetrics: string[];
}

/**
 * One calm line describing what NEXTRON can actually use right now.
 * Tasks/habits are first-party Life Pulse data (existing product claim);
 * Wealth/Body appear only when their permission state grants access.
 * Never names raw data, IDs, or notes.
 */
export function buildNextronContextSummary(state: NextronContextState): string {
  const parts = ["tasks, habits"];
  if (state.wealthMaster && state.wealthSections.length > 0) {
    parts.push(`wealth (${state.wealthSections.length} ${state.wealthSections.length === 1 ? "area" : "areas"})`);
  }
  if (state.bodyMetrics.length > 0) {
    parts.push(`body (${state.bodyMetrics.length} ${state.bodyMetrics.length === 1 ? "metric" : "metrics"})`);
  }
  const suffix =
    !state.wealthMaster && state.bodyMetrics.length === 0 ? " · wealth and body off" : "";
  return `Can use: ${parts.join(", ")}${suffix}`;
}
