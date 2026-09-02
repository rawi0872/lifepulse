// Health storage-consent + sync orchestration — authenticated Supabase path only.
// No service_role, no secrets. RLS + health_preferences enforce consent server-side.

import { supabase } from "./supabase";
import type { HealthMetricType } from "@lifepulse/domain";
import { buildDailyHealthAggregateDedupeKey } from "@lifepulse/domain";
import { readTodaySteps } from "./health-connect-adapter";

const STEPS: HealthMetricType = "steps";

export async function getStorageConsent(): Promise<{ stepsAllowed: boolean; allowedMetrics: string[] } | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const userId = userData.user.id;
  // RLS guarantees only own row is visible
  const { data, error } = await supabase
    .from("health_preferences")
    .select("allowed_metrics")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return {
    stepsAllowed: (data?.allowed_metrics ?? []).includes(STEPS),
    allowedMetrics: data?.allowed_metrics ?? [],
  };
}

export async function setStepsConsent(enabled: boolean): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const userId = userData.user.id;
  const current = await getStorageConsent();
  const base = new Set(current?.allowedMetrics ?? []);
  if (enabled) base.add(STEPS);
  else base.delete(STEPS);
  const allowed = Array.from(base).sort();

  const { error } = await supabase.from("health_preferences").upsert({
    user_id: userId,
    allowed_metrics: allowed,
  });
  return !error;
}

export async function ensureHealthSource(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const userId = userData.user.id;

  const { data: existing } = await supabase
    .from("health_sources")
    .select("id, status")
    .eq("user_id", userId)
    .eq("provider", "health_connect")
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("health_sources")
    .insert({
      user_id: userId,
      provider: "health_connect",
      status: "connected",
      scopes_granted: [STEPS],
    })
    .select("id")
    .single();
  return error ? null : created?.id ?? null;
}

export interface SyncStepsResult {
  ok: boolean
  reason?: string
  insertedCount?: number
}

export async function syncTodaySteps(): Promise<SyncStepsResult> {
  const consent = await getStorageConsent();
  if (!consent?.stepsAllowed) {
    return { ok: false, reason: "CONSENT_REQUIRED" };
  }

  const readResult = await readTodaySteps();
  if (!readResult.ok) {
    return { ok: false, reason: readResult.reason };
  }
  const normalized = readResult.records[0];
  if (!normalized || normalized.numericValue <= 0) {
    return { ok: true, insertedCount: 0 };
  }

  const sourceId = await ensureHealthSource();
  if (!sourceId) return { ok: false, reason: "SOURCE_UNAVAILABLE" };

  // Stable daily identity: same local day always maps to the same dedupe key,
  // regardless of sync time, step total, synced_at, or recorded_at.
  // recorded_at (latest observation) is stored separately and may change.
  const dedupeKey = buildDailyHealthAggregateDedupeKey("steps", normalized.localDate);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, reason: "AUTH_REQUIRED" };

  const { error } = await supabase.from("health_records").upsert(
    {
      user_id: userData.user.id,
      health_source_id: sourceId,
      dedupe_key: dedupeKey,
      metric_type: "steps",
      numeric_value: normalized.numericValue,
      unit: "count",
      recorded_at: normalized.recordedAt,
      start_at: null,
      end_at: null,
      local_date: normalized.localDate,
      synced_at: new Date().toISOString(),
      provenance: normalized.provenance,
    },
    { onConflict: "user_id,health_source_id,dedupe_key" },
  );

  if (error) {
    const code = typeof error.code === "string" ? error.code : "DB_ERROR";
    return { ok: false, reason: code.slice(0, 40) };
  }

  await supabase
    .from("health_sources")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .eq("provider", "health_connect");

  return { ok: true, insertedCount: 1 };
}
