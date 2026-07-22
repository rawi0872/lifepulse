// Life Pulse Results — Pure calculation utilities (Phase 1)
// No UI, no hooks, no Supabase, no I/O

import type { MetricEntryRow, MetricDefinitionRow, ResultTargetDirection } from "@/lib/results/types";
import { NUMERIC_ABS_MAX, NUMERIC_ABS_MIN, RATING_MIN, RATING_MAX, PERCENTAGE_MIN, PERCENTAGE_MAX, DURATION_MIN, DURATION_MAX, COUNT_MIN, COUNT_MAX } from "@/lib/results/contract";

export function parseNumeric(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === "") return null;
  const num = Number(str);
  if (!isFinite(num) || isNaN(num)) return null;
  return num;
}

export function validateValueForKind(
  value: string | number | null,
  kind: MetricDefinitionRow["value_kind"]
): { valid: boolean; error?: string; normalized?: number } {
  const num = parseNumeric(value);
  if (num === null) return { valid: false, error: "Value is required" };

  if (num < NUMERIC_ABS_MIN || num > NUMERIC_ABS_MAX) {
    return { valid: false, error: "Value exceeds allowed range" };
  }

  switch (kind) {
    case "count":
      if (!Number.isInteger(num)) return { valid: false, error: "Count must be a whole number" };
      if (num < COUNT_MIN || num > COUNT_MAX) return { valid: false, error: `Count must be between ${COUNT_MIN} and ${COUNT_MAX}` };
      break;
    case "percentage":
      if (num < PERCENTAGE_MIN || num > PERCENTAGE_MAX) return { valid: false, error: "Percentage must be between 0 and 100" };
      break;
    case "duration":
      if (num < DURATION_MIN || num > DURATION_MAX) return { valid: false, error: "Duration must be between 0 and 525,600 minutes" };
      break;
    case "rating":
      if (num < RATING_MIN || num > RATING_MAX) return { valid: false, error: "Rating must be between 1 and 10" };
      if (!Number.isInteger(num)) return { valid: false, error: "Rating must be a whole number" };
      break;
    case "currency":
    case "number":
      // general numeric bounds already checked
      break;
  }
  return { valid: true, normalized: num };
}

export function sortEntriesChronological(entries: MetricEntryRow[]): MetricEntryRow[] {
  return [...entries].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
}

export function getLatestEntry(entries: MetricEntryRow[]): MetricEntryRow | null {
  if (entries.length === 0) return null;
  const sorted = sortEntriesChronological(entries);
  return sorted[sorted.length - 1];
}

export function getPreviousEntry(entries: MetricEntryRow[]): MetricEntryRow | null {
  if (entries.length < 2) return null;
  const sorted = sortEntriesChronological(entries);
  return sorted[sorted.length - 2];
}

export function getAbsoluteChange(latest: MetricEntryRow | null, previous: MetricEntryRow | null): number | null {
  if (!latest || !previous) return null;
  const latestVal = parseNumeric(latest.value);
  const prevVal = parseNumeric(previous.value);
  if (latestVal === null || prevVal === null) return null;
  return latestVal - prevVal;
}

export function getPercentageChange(latest: MetricEntryRow | null, previous: MetricEntryRow | null): number | null {
  if (!latest || !previous) return null;
  const latestVal = parseNumeric(latest.value);
  const prevVal = parseNumeric(previous.value);
  if (latestVal === null || prevVal === null) return null;
  if (prevVal === 0) return null; // unavailable, not Infinity
  return ((latestVal - prevVal) / Math.abs(prevVal)) * 100;
}

export function getBaselineChange(latest: MetricEntryRow | null, baselineValue: string | number | null): number | null {
  if (!latest) return null;
  const latestVal = parseNumeric(latest.value);
  const baseline = parseNumeric(baselineValue);
  if (latestVal === null || baseline === null) return null;
  return latestVal - baseline;
}

export function getTargetDistance(
  latest: MetricEntryRow | null,
  targetValue: string | number | null,
  targetDirection: ResultTargetDirection
): { distance: number | null; direction: "toward" | "away" | "at" | "none" } {
  if (!latest || targetValue === null || targetDirection === "none") {
    return { distance: null, direction: "none" };
  }
  const latestVal = parseNumeric(latest.value);
  const target = parseNumeric(targetValue);
  if (latestVal === null || target === null) return { distance: null, direction: "none" };

  const distance = latestVal - target;
  const absDistance = Math.abs(distance);

  let direction: "toward" | "away" | "at" | "none" = "none";
  if (absDistance === 0) direction = "at";
  else if (targetDirection === "increase") direction = distance > 0 ? "away" : "toward";
  else if (targetDirection === "decrease") direction = distance < 0 ? "away" : "toward";
  else if (targetDirection === "maintain") direction = absDistance <= 1 ? "at" : "away";

  return { distance: absDistance, direction };
}

export function formatChangeLabel(change: number | null): string {
  if (change === null) return "—";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}`;
}

export function formatPercentageChangeLabel(change: number | null): string {
  if (change === null) return "Unavailable (previous value was zero)";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function getEntryCount(entries: MetricEntryRow[]): number {
  return entries.length;
}

export function hasEntries(entries: MetricEntryRow[]): boolean {
  return entries.length > 0;
}

export function getSingleEntry(entries: MetricEntryRow[]): MetricEntryRow | null {
  return entries.length === 1 ? entries[0] : null;
}