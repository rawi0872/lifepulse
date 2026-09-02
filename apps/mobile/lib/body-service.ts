// Body Realm — query boundary (RLS, no service_role)
// Screens call these helpers instead of inline Supabase queries.

import { supabase } from "./supabase";
import { getBodyDailySummary, type BodyDailySummary } from "@lifepulse/domain";
import { getLocalTodayDateString } from "@lifepulse/domain";

export async function loadBodyDailySummary(date = getLocalTodayDateString()): Promise<BodyDailySummary | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: prefs } = await supabase.from("health_preferences").select("allowed_metrics").eq("user_id", user.id).maybeSingle();
  const allowed = (prefs?.allowed_metrics as string[] | null) ?? [];

  const dayStart = new Date(`${date}T00:00:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59.999`).toISOString();

  const { data: records } = await supabase
    .from("health_records")
    .select("metric, value, recorded_at, source")
    .eq("user_id", user.id)
    .gte("recorded_at", dayStart)
    .lte("recorded_at", dayEnd);

  const { data: bodyMetrics } = await supabase
    .from("body_metrics")
    .select("steps, workout_minutes, sleep_hours, weight_kg, resting_heart_rate")
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .maybeSingle();

  const manual = bodyMetrics
    ? {
        steps: bodyMetrics.steps ?? undefined,
        exerciseMinutes: bodyMetrics.workout_minutes ?? undefined,
        sleepDuration: bodyMetrics.sleep_hours != null ? bodyMetrics.sleep_hours * 60 : undefined,
        weight: bodyMetrics.weight_kg ?? undefined,
        restingHeartRate: bodyMetrics.resting_heart_rate ?? undefined,
      }
    : undefined;

  return getBodyDailySummary({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    date, healthRecords: (records ?? []) as any, manualBodyMetrics: manual, allowedMetrics: allowed as any,
  });
}

export async function loadBodyMetricHistory(metric: string, days: number = 30) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("health_records")
    .select("value, recorded_at")
    .eq("user_id", user.id)
    .eq("metric", metric)
    .gte("recorded_at", since.toISOString())
    .order("recorded_at", { ascending: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({ date: r.recorded_at.slice(0, 10), value: Number(r.value) }));
}
