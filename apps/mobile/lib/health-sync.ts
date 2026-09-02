// Health storage-consent + multi-metric sync orchestration — authenticated Supabase path only.
// No service_role, no secrets. RLS + health_preferences enforce consent server-side.
/* eslint-disable @typescript-eslint/no-explicit-any -- Health Connect record types are dynamic */

import { supabase } from "./supabase";
import type { HealthMetricType } from "@lifepulse/domain";
import { buildDailyHealthAggregateDedupeKey } from "@lifepulse/domain";
import {
  readTodaySteps,
  readSleepDay,
  readWeightDay,
  readRestingHeartRateDay,
  readExerciseMinutesDay,
  getGrantedHealthPermissions,
} from "./health-connect-adapter";

const ALL_BODY_METRICS: HealthMetricType[] = ["steps", "sleep_duration", "resting_heart_rate", "weight", "exercise_minutes"];

export async function getStorageConsent(): Promise<{ stepsAllowed: boolean; allowedMetrics: string[] } | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const userId = userData.user.id;
  const { data, error } = await supabase.from("health_preferences").select("allowed_metrics").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return {
    stepsAllowed: (data?.allowed_metrics ?? []).includes("steps"),
    allowedMetrics: data?.allowed_metrics ?? [],
  };
}

export async function getAllowedMetrics(): Promise<HealthMetricType[]> {
  const c = await getStorageConsent();
  return (c?.allowedMetrics ?? []) as HealthMetricType[];
}

export async function setMetricConsent(metric: HealthMetricType, enabled: boolean): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const userId = userData.user.id;
  const current = await getStorageConsent();
  const base = new Set(current?.allowedMetrics ?? []);
  if (enabled) base.add(metric);
  else base.delete(metric);
  const allowed = Array.from(base).sort();
  const { error } = await supabase.from("health_preferences").upsert({ user_id: userId, allowed_metrics: allowed });
  return !error;
}

export async function setStepsConsent(enabled: boolean): Promise<boolean> {
  return setMetricConsent("steps", enabled);
}

export async function ensureHealthSource(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const userId = userData.user.id;
  const perms = await getGrantedHealthPermissions();
  const scopes = perms.granted;

  const { data: existing } = await supabase.from("health_sources").select("id, status, scopes_granted").eq("user_id", userId).eq("provider", "health_connect").maybeSingle();

  if (existing) {
    // update scopes to reflect current grants (honest source state)
    await supabase.from("health_sources").update({ scopes_granted: scopes, status: "connected" }).eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("health_sources")
    .insert({ user_id: userId, provider: "health_connect", status: "connected", scopes_granted: scopes })
    .select("id")
    .single();
  return error ? null : created?.id ?? null;
}

export interface SyncStepsResult {
  ok: boolean;
  reason?: string;
  insertedCount?: number;
}

export async function syncTodaySteps(): Promise<SyncStepsResult> {
  const r = await syncSelectedHealthMetrics(["steps"]);
  const one = r.results.find((x) => x.metric === "steps");
  if (!one) return { ok: false, reason: "UNAVAILABLE" };
  if (one.status === "synced") return { ok: true, insertedCount: 1 };
  if (one.status === "no_data") return { ok: true, insertedCount: 0 };
  return { ok: false, reason: (one.status as string).toUpperCase() };
}

export type SyncMetricStatus = "synced" | "no_data" | "skipped_no_consent" | "permission_missing" | "unavailable" | "invalid_data" | "error";

export interface SyncMetricResult {
  metric: HealthMetricType;
  status: SyncMetricStatus;
  reason?: string;
}

export async function syncSelectedHealthMetrics(
  selectedMetrics: HealthMetricType[],
  opts?: { date?: Date },
): Promise<{ results: SyncMetricResult[] }> {
  const day = opts?.date ?? new Date();
  const consent = await getStorageConsent();
  const allowed = new Set(consent?.allowedMetrics ?? []);
  const grantedPerms = await getGrantedHealthPermissions();
  const grantedSet = new Set(grantedPerms.granted);

  const results: SyncMetricResult[] = [];

  const readers: Record<string, (d: Date) => Promise<{ ok: boolean; records?: any[]; reason?: string }>> = {
    steps: readTodaySteps as any,
    sleep_duration: () => readSleepDay(day),
    resting_heart_rate: () => readRestingHeartRateDay(day),
    weight: () => readWeightDay(day),
    exercise_minutes: () => readExerciseMinutesDay(day),
  };

  for (const metric of selectedMetrics) {
    if (!ALL_BODY_METRICS.includes(metric)) {
      results.push({ metric, status: "unavailable", reason: "unsupported" });
      continue;
    }
    if (!allowed.has(metric)) {
      results.push({ metric, status: "skipped_no_consent" });
      continue;
    }
    if (!grantedSet.has(metric)) {
      results.push({ metric, status: "permission_missing" });
      continue;
    }

    const reader = readers[metric];
    if (!reader) {
      results.push({ metric, status: "unavailable" });
      continue;
    }

    let readResult: any;
    try {
      readResult = await reader(day);
    } catch (e) {
      results.push({ metric, status: "error", reason: e instanceof Error ? e.message.slice(0, 40) : "READ_ERROR" });
      continue;
    }

    if (!readResult.ok) {
      const r = (readResult.reason || "error").toUpperCase();
      if (r.includes("PERMISSION")) results.push({ metric, status: "permission_missing", reason: r });
      else if (r.includes("UNAVAILABLE") || r.includes("PLATFORM")) results.push({ metric, status: "unavailable", reason: r });
      else results.push({ metric, status: "error", reason: r });
      continue;
    }

    const records = readResult.records as Array<{ metricType: HealthMetricType; numericValue: number; unit: string; recordedAt: string; localDate: string; provenance: Record<string, unknown> }>;
    if (!records || records.length === 0) {
      results.push({ metric, status: "no_data" });
      continue;
    }

    const sourceId = await ensureHealthSource();
    if (!sourceId) {
      results.push({ metric, status: "error", reason: "SOURCE_UNAVAILABLE" });
      continue;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      results.push({ metric, status: "error", reason: "AUTH_REQUIRED" });
      continue;
    }

    let okCount = 0;
    for (const rec of records) {
      // bounds already applied in adapter (invalid filtered to empty)
      const dedupeKey = buildDailyHealthAggregateDedupeKey(rec.metricType, rec.localDate);
      const { error } = await supabase.from("health_records").upsert(
        {
          user_id: userData.user.id,
          health_source_id: sourceId,
          dedupe_key: dedupeKey,
          metric_type: rec.metricType,
          numeric_value: rec.numericValue,
          unit: rec.unit,
          recorded_at: rec.recordedAt,
          start_at: null,
          end_at: null,
          local_date: rec.localDate,
          synced_at: new Date().toISOString(),
          provenance: rec.provenance,
        },
        { onConflict: "user_id,health_source_id,dedupe_key" },
      );
      if (!error) okCount++;
    }

    if (okCount === 0) {
      results.push({ metric, status: "error", reason: "DB_ERROR" });
      continue;
    }

    await supabase.from("health_sources").update({ last_sync_at: new Date().toISOString(), scopes_granted: Array.from(grantedSet) }).eq("id", sourceId);
    results.push({ metric, status: "synced" });
  }

  return { results };
}
