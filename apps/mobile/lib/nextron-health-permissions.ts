/* eslint-disable @typescript-eslint/no-explicit-any */
// NEXTRON health permission — explicit, separate from storage consent
// Metric usable by NEXTRON only when: metric ∈ allowed_metrics AND metric ∈ nextron_allowed_metrics
// Handles pending 00040 gracefully: if column/helper unavailable → OFF

import { supabase } from "./supabase";
import type { HealthMetricType } from "@lifepulse/domain";

export async function loadNextronHealthPermissions(): Promise<{ allowed: HealthMetricType[]; nextronAllowed: HealthMetricType[]; schemaAvailable: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: [], nextronAllowed: [], schemaAvailable: true };
  const { data, error } = await supabase.from("health_preferences").select("allowed_metrics, nextron_allowed_metrics").eq("user_id", user.id).maybeSingle() as any;
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("nextron_allowed_metrics") || msg.includes("column") || msg.includes("schema cache")) {
      // 00040 not yet applied — treat as OFF but storage still readable via fallback
      const { data: fallback } = await supabase.from("health_preferences").select("allowed_metrics").eq("user_id", user.id).maybeSingle();
      return { allowed: (fallback as any)?.allowed_metrics ?? [], nextronAllowed: [], schemaAvailable: false };
    }
    return { allowed: [], nextronAllowed: [], schemaAvailable: true };
  }
  return {
    allowed: (data?.allowed_metrics ?? []) as HealthMetricType[],
    nextronAllowed: (data?.nextron_allowed_metrics ?? []) as HealthMetricType[],
    schemaAvailable: true,
  };
}

export async function setNextronHealthMetricPermission(metric: HealthMetricType, enabled: boolean): Promise<{ ok: boolean; schemaAvailable: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, schemaAvailable: true };
  // enforce storage consent: cannot enable NEXTRON if storage OFF
  const current = await loadNextronHealthPermissions();
  if (!current.schemaAvailable) return { ok: false, schemaAvailable: false };
  if (enabled && !current.allowed.includes(metric)) return { ok: false, schemaAvailable: true };
  const next = new Set(current.nextronAllowed);
  if (enabled) next.add(metric);
  else next.delete(metric);
  const arr = Array.from(next).sort();
  const { error } = await (supabase.from("health_preferences") as any).update({ nextron_allowed_metrics: arr }).eq("user_id", user.id);
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("nextron_allowed_metrics") || msg.includes("column")) return { ok: false, schemaAvailable: false };
    return { ok: false, schemaAvailable: true };
  }
  return { ok: true, schemaAvailable: true };
}

export function effectiveNextronMetrics(allowed: HealthMetricType[], nextronAllowed: HealthMetricType[]): HealthMetricType[] {
  const allowedSet = new Set(allowed);
  return nextronAllowed.filter((m) => allowedSet.has(m));
}
