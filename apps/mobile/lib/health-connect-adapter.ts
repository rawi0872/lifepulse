// HealthConnectAdapter — Android-native Health Connect implementation of the
// shared HealthSourceAdapter contract. Steps-only for Phase 3C.
// No NEXTRON logic. No Supabase calls here (upload path lives in health-sync.ts).

import {
  initialize,
  getSdkStatus,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { Platform } from "react-native";
import type {
  HealthAvailability,
  HealthPermissionStatus,
  HealthMetricType,
} from "@lifepulse/domain";

export type HealthConnectReadResult =
  | { ok: true; records: NormalizedStepsRecord[] }
  | { ok: false; reason: string };

/** Normalized aggregate steps for one local day — maps to a single health_records row */
export interface NormalizedStepsRecord {
  metricType: "steps";
  numericValue: number;
  unit: "count";
  recordedAt: string; // ISO — end of aggregate window (canonical recorded_at)
  localDate: string; // YYYY-MM-DD of the device/source local day the aggregate covers
  provenance: Record<string, unknown>;
}

const STEPS_PERMISSION = { accessType: "read", recordType: "Steps" } as const;

function isAndroid(): boolean {
  return Platform.OS === "android";
}

async function ensureInitialized(): Promise<boolean> {
  try {
    await initialize();
    return true;
  } catch {
    return false;
  }
}

export async function checkHealthConnectAvailability(): Promise<HealthAvailability> {
  if (!isAndroid()) return "unavailable";
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
      const initialized = await ensureInitialized();
      return initialized ? "available" : "unavailable";
    }
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      // Provider present but needs update — treat as available but user may need update
      return "not_configured";
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function getGrantedStepsPermission(): Promise<HealthPermissionStatus> {
  try {
    const granted = await getGrantedPermissions();
    const hasSteps = granted.some(
      (p) => p.accessType === "read" && p.recordType === "Steps",
    );
    return {
      granted: hasSteps ? ["steps"] : [],
      denied: hasSteps ? [] : ["steps"],
      notDetermined: [],
    };
  } catch {
    return { granted: [], denied: [], notDetermined: ["steps"] };
  }
}

export async function requestStepsPermission(): Promise<HealthPermissionStatus> {
  if (!isAndroid()) return { granted: [], denied: ["steps"], notDetermined: [] };
  try {
    await ensureInitialized();
    const results = await requestPermission([STEPS_PERMISSION]);
    const hasSteps = results.some(
      (p) => p.accessType === "read" && p.recordType === "Steps",
    );
    return hasSteps
      ? { granted: ["steps"], denied: [], notDetermined: [] }
      : { granted: [], denied: ["steps"], notDetermined: [] };
  } catch {
    return { granted: [], denied: ["steps"], notDetermined: [] };
  }
}

/**
 * Read today's steps as a normalized daily aggregate.
 *
 * Mapping contract:
 * - Health Connect `StepsRecord` entries are interval records. The Life Pulse
 *   health_records table (00038) requires non-sleep metrics to have NULL
 *   start_at/end_at, so we do NOT persist per-interval rows.
 * - Instead we sum all Steps intervals whose startTime falls within the
 *   requested local day and emit ONE normalized daily aggregate row.
 * - dedupeKey is derived deterministically from provider + metric + local date
 *   so re-syncing the same day is idempotent.
 * - recorded_at = end of the day window (or now if today), matching the DB
 *   convention that non-sleep metrics use recorded_at only.
 */
export async function readTodaySteps(): Promise<HealthConnectReadResult> {
  if (!isAndroid()) return { ok: false, reason: "PLATFORM_UNSUPPORTED" };
  const availability = await checkHealthConnectAvailability();
  if (availability !== "available") return { ok: false, reason: "HC_UNAVAILABLE" };
  const perm = await getGrantedStepsPermission();
  if (perm.granted.length === 0) return { ok: false, reason: "PERMISSION_REQUIRED" };

  try {
    // Bounded read: current local day only
    const now = new Date();
    const startOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfWindow = now;

    const result = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startOfDayLocal.toISOString(),
        endTime: endOfWindow.toISOString(),
      },
    });

    let total = 0;
    for (const rec of result.records) {
      total += Math.max(0, Math.round(rec.count ?? 0));
    }

    const localDate = `${startOfDayLocal.getFullYear()}-${String(startOfDayLocal.getMonth() + 1).padStart(2, "0")}-${String(startOfDayLocal.getDate()).padStart(2, "0")}`;
    const recordedAt = endOfWindow.toISOString();

    return {
      ok: true,
      records: [
        {
          metricType: "steps",
          numericValue: total,
          unit: "count",
          recordedAt,
          localDate,
          provenance: {
            sourceAppBundleId: "androidx.health.connect",
            rawMetricType: "StepsRecord",
          },
        },
      ],
    };
  } catch (e) {
    // Non-sensitive error code only
    const msg = e instanceof Error ? e.message : "READ_ERROR";
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

export function openSystemHealthSettings(): void {
  openHealthConnectSettings();
}

export type { HealthMetricType };
