// HealthConnectAdapter — multi-metric (Body V1)
// Real Health Connect record types via react-native-health-connect@4.0
// No NEXTRON, no Supabase here.

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

// Body V1 mapping table — verified against installed 4.0 types:
// steps                → StepsRecord               → READ_STEPS
// sleep_duration       → SleepSessionRecord        → READ_SLEEP
// resting_heart_rate   → RestingHeartRateRecord    → READ_HEART_RATE
// weight               → WeightRecord              → READ_WEIGHT
// exercise_minutes     → ExerciseSessionRecord     → READ_EXERCISE
// active_minutes       → no direct record — deferred (no fake from calories)

export type BodyMetric = "steps" | "sleep_duration" | "resting_heart_rate" | "weight" | "exercise_minutes";

const METRIC_PERMISSION: Record<BodyMetric, { accessType: "read"; recordType: string } & { metric: HealthMetricType }> = {
  steps: { accessType: "read", recordType: "Steps", metric: "steps" },
  sleep_duration: { accessType: "read", recordType: "SleepSession", metric: "sleep_duration" },
  resting_heart_rate: { accessType: "read", recordType: "RestingHeartRate", metric: "resting_heart_rate" },
  weight: { accessType: "read", recordType: "Weight", metric: "weight" },
  exercise_minutes: { accessType: "read", recordType: "ExerciseSession", metric: "exercise_minutes" },
};

export type HealthConnectReadResult =
  | { ok: true; records: NormalizedHealthRecord[] }
  | { ok: false; reason: string };

export interface NormalizedHealthRecord {
  metricType: HealthMetricType;
  numericValue: number;
  unit: string;
  recordedAt: string;
  localDate: string;
  provenance: Record<string, unknown>;
}

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
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "not_configured";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

// ── Generic permission helpers ──
export async function getGrantedHealthPermissions(): Promise<HealthPermissionStatus> {
  try {
    const granted = await getGrantedPermissions();
    const has = (rt: string) => granted.some((p: any) => p.accessType === "read" && p.recordType === rt);
    const grantedMetrics: HealthMetricType[] = [];
    const deniedMetrics: HealthMetricType[] = [];
    for (const [k, v] of Object.entries(METRIC_PERMISSION)) {
      if (has(v.recordType)) grantedMetrics.push(v.metric);
      else deniedMetrics.push(v.metric);
    }
    return { granted: grantedMetrics, denied: deniedMetrics, notDetermined: [] };
  } catch {
    return { granted: [], denied: Object.values(METRIC_PERMISSION).map((v) => v.metric), notDetermined: [] };
  }
}

export async function requestHealthPermissions(metrics: BodyMetric[]): Promise<HealthPermissionStatus> {
  if (!isAndroid()) return { granted: [], denied: metrics.map((m) => METRIC_PERMISSION[m].metric), notDetermined: [] };
  try {
    await ensureInitialized();
    const perms = metrics.map((m) => ({ accessType: "read", recordType: METRIC_PERMISSION[m].recordType }));
    const results = await requestPermission(perms as any);
    const has = (rt: string) => results.some((p: any) => p.accessType === "read" && p.recordType === rt);
    const granted: HealthMetricType[] = [];
    const denied: HealthMetricType[] = [];
    for (const m of metrics) {
      const rt = METRIC_PERMISSION[m].recordType;
      (has(rt) ? granted : denied).push(METRIC_PERMISSION[m].metric);
    }
    // include already granted not requested?
    const already = await getGrantedHealthPermissions();
    for (const g of already.granted) if (!granted.includes(g) && !denied.includes(g)) granted.push(g);
    return { granted, denied, notDetermined: [] };
  } catch {
    return { granted: [], denied: metrics.map((m) => METRIC_PERMISSION[m].metric), notDetermined: [] };
  }
}

// ── Back-compat Steps wrappers ──
export async function getGrantedStepsPermission(): Promise<HealthPermissionStatus> {
  const all = await getGrantedHealthPermissions();
  const has = all.granted.includes("steps");
  return has ? { granted: ["steps"], denied: [], notDetermined: [] } : { granted: [], denied: ["steps"], notDetermined: [] };
}

export async function requestStepsPermission(): Promise<HealthPermissionStatus> {
  return requestHealthPermissions(["steps"]);
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Readers ──
export async function readTodaySteps(): Promise<HealthConnectReadResult> {
  return readStepsDay(new Date());
}

async function readStepsDay(day: Date): Promise<HealthConnectReadResult> {
  if (!isAndroid()) return { ok: false, reason: "PLATFORM_UNSUPPORTED" };
  const availability = await checkHealthConnectAvailability();
  if (availability !== "available") return { ok: false, reason: "HC_UNAVAILABLE" };
  const perm = await getGrantedHealthPermissions();
  if (!perm.granted.includes("steps")) return { ok: false, reason: "PERMISSION_REQUIRED" };
  try {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    // Use end as recordedAt
    const result: any = await readRecords("Steps", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    let total = 0;
    for (const rec of result.records) total += Math.max(0, Math.round(rec.count ?? 0));
    const localDate = localDateStr(start);
    return {
      ok: true,
      records: [
        {
          metricType: "steps",
          numericValue: total,
          unit: "count",
          recordedAt: end.toISOString(),
          localDate,
          provenance: { sourceAppBundleId: "androidx.health.connect", rawMetricType: "StepsRecord" },
        },
      ],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "READ_ERROR";
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

export async function readSleepDay(day: Date): Promise<HealthConnectReadResult> {
  if (!isAndroid()) return { ok: false, reason: "PLATFORM_UNSUPPORTED" };
  const availability = await checkHealthConnectAvailability();
  if (availability !== "available") return { ok: false, reason: "HC_UNAVAILABLE" };
  const perm = await getGrantedHealthPermissions();
  if (!perm.granted.includes("sleep_duration")) return { ok: false, reason: "PERMISSION_REQUIRED" };
  try {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 18, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const result: any = await readRecords("SleepSession", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    // Aggregate overlapping sessions, de-duplicate by time, sum durations whose end localDate == day
    let totalMinutes = 0;
    const wakeDate = localDateStr(day);
    for (const rec of result.records) {
      const endLocal = localDateStr(new Date(rec.endTime));
      if (endLocal !== wakeDate) continue;
      const s = new Date(rec.startTime).getTime();
      const e = new Date(rec.endTime).getTime();
      if (e > s) totalMinutes += Math.round((e - s) / 60000);
    }
    if (totalMinutes < 0 || totalMinutes > 1440) return { ok: true, records: [] };
    if (totalMinutes === 0) return { ok: true, records: [] };
    return {
      ok: true,
      records: [
        {
          metricType: "sleep_duration",
          numericValue: totalMinutes,
          unit: "minutes",
          recordedAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0).toISOString(),
          localDate: wakeDate,
          provenance: { sourceAppBundleId: "androidx.health.connect", rawMetricType: "SleepSessionRecord" },
        },
      ],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "READ_ERROR";
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

export async function readWeightDay(day: Date): Promise<HealthConnectReadResult> {
  if (!isAndroid()) return { ok: false, reason: "PLATFORM_UNSUPPORTED" };
  const availability = await checkHealthConnectAvailability();
  if (availability !== "available") return { ok: false, reason: "HC_UNAVAILABLE" };
  const perm = await getGrantedHealthPermissions();
  if (!perm.granted.includes("weight")) return { ok: false, reason: "PERMISSION_REQUIRED" };
  try {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const result: any = await readRecords("Weight", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    if (!result.records.length) return { ok: true, records: [] };
    // latest of day
    let latest = result.records[0];
    for (const r of result.records) if (new Date(r.time).getTime() > new Date(latest.time).getTime()) latest = r;
    const kg = latest.weight?.inKilograms ?? latest.weight?.value ?? null;
    if (kg == null || kg <= 0 || kg > 635) return { ok: true, records: [] };
    return {
      ok: true,
      records: [
        {
          metricType: "weight",
          numericValue: Number(kg.toFixed(2)),
          unit: "kg",
          recordedAt: new Date(latest.time).toISOString(),
          localDate: localDateStr(day),
          provenance: { sourceAppBundleId: "androidx.health.connect", rawMetricType: "WeightRecord" },
        },
      ],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "READ_ERROR";
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

export async function readRestingHeartRateDay(day: Date): Promise<HealthConnectReadResult> {
  if (!isAndroid()) return { ok: false, reason: "PLATFORM_UNSUPPORTED" };
  const availability = await checkHealthConnectAvailability();
  if (availability !== "available") return { ok: false, reason: "HC_UNAVAILABLE" };
  const perm = await getGrantedHealthPermissions();
  if (!perm.granted.includes("resting_heart_rate")) return { ok: false, reason: "PERMISSION_REQUIRED" };
  try {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const result: any = await readRecords("RestingHeartRate", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    if (!result.records.length) return { ok: true, records: [] };
    // latest or average? spec: latest valid
    let latest = result.records[0];
    for (const r of result.records) if (new Date(r.time).getTime() > new Date(latest.time).getTime()) latest = r;
    const bpm = latest.beatsPerMinute;
    if (bpm == null || bpm < 25 || bpm > 220) return { ok: true, records: [] };
    return {
      ok: true,
      records: [
        {
          metricType: "resting_heart_rate",
          numericValue: Math.round(bpm),
          unit: "bpm",
          recordedAt: new Date(latest.time).toISOString(),
          localDate: localDateStr(day),
          provenance: { sourceAppBundleId: "androidx.health.connect", rawMetricType: "RestingHeartRateRecord" },
        },
      ],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "READ_ERROR";
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

export async function readExerciseMinutesDay(day: Date): Promise<HealthConnectReadResult> {
  if (!isAndroid()) return { ok: false, reason: "PLATFORM_UNSUPPORTED" };
  const availability = await checkHealthConnectAvailability();
  if (availability !== "available") return { ok: false, reason: "HC_UNAVAILABLE" };
  const perm = await getGrantedHealthPermissions();
  if (!perm.granted.includes("exercise_minutes")) return { ok: false, reason: "PERMISSION_REQUIRED" };
  try {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const result: any = await readRecords("ExerciseSession", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    // sum durations, avoid double-count overlapping — sort and merge
    const intervals: Array<[number, number]> = result.records
      .map((r: any) => [new Date(r.startTime).getTime(), new Date(r.endTime).getTime()] as [number, number])
      .filter(([s, e]: [number, number]) => e > s)
      .sort((a: [number, number], b: [number, number]) => a[0] - b[0]);
    let merged: Array<[number, number]> = [];
    for (const iv of intervals) {
      const last = merged[merged.length - 1];
      if (!last || iv[0] > last[1]) merged.push(iv);
      else merged[merged.length - 1] = [last[0], Math.max(last[1], iv[1])];
    }
    let totalMin = 0;
    for (const [s, e] of merged) totalMin += Math.round((e - s) / 60000);
    if (totalMin <= 0) return { ok: true, records: [] };
    if (totalMin > 1440) totalMin = 1440;
    return {
      ok: true,
      records: [
        {
          metricType: "exercise_minutes",
          numericValue: totalMin,
          unit: "minutes",
          recordedAt: end.toISOString(),
          localDate: localDateStr(day),
          provenance: { sourceAppBundleId: "androidx.health.connect", rawMetricType: "ExerciseSessionRecord" },
        },
      ],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "READ_ERROR";
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

export function openSystemHealthSettings(): void {
  openHealthConnectSettings();
}

export type { HealthMetricType };
export { METRIC_PERMISSION };
