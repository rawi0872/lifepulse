// Body Realm — query boundary (RLS, no service_role)

import { supabase } from "./supabase";
import {
  getBodyDailySummary,
  type BodyDailySummary,
  type BodyTrendSummary,
  type BodyGoalProgress,
  type BodyMetricKey,
} from "@lifepulse/domain";
import { getLocalTodayDateString } from "@lifepulse/domain";

// ── Ensure Body realm (idempotent) ──
export async function ensureBodyRealm(): Promise<{ id: string; name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("realms")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", "Body")
    .limit(1)
    .maybeSingle();

  if (existing) return existing as { id: string; name: string };

  const { data: created, error } = await supabase
    .from("realms")
    .insert({ user_id: user.id, name: "Body", color: "#ef4444", icon: "body" })
    .select("id, name")
    .single();

  if (error) {
    // race: another client created it — re-fetch
    const { data: retry } = await supabase.from("realms").select("id, name").eq("user_id", user.id).ilike("name", "Body").limit(1).maybeSingle();
    return (retry as { id: string; name: string } | null) ?? null;
  }
  return created as { id: string; name: string };
}

// ── Daily summary (existing) ──
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

// ── Overview ──
export interface BodyOverview {
  realm: { id: string; name: string } | null;
  today: BodyDailySummary | null;
  trends: Record<BodyMetricKey, BodyTrendSummary | null>;
  goals: Array<{ id: string; title: string; status: string; target_date: string | null; realm_id: string | null }>;
  goalProgress: BodyGoalProgress[];
  habits: Array<{ id: string; title: string; frequency: string; realm_id: string | null }>;
  habitLogs: Array<{ habit_id: string; completed_date: string }>;
  tasks: Array<{ id: string; title: string; status: string; due_date: string | null }>;
  healthStatus: { allowed: string[]; hasSteps: boolean; source: string | null };
}

export async function loadBodyOverview(periodDays: 7 | 30 = 7): Promise<BodyOverview | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const realm = await ensureBodyRealm();

  const todayStr = getLocalTodayDateString();
  const todayPromise = loadBodyDailySummary(todayStr);

  const prefsPromise = supabase.from("health_preferences").select("allowed_metrics").eq("user_id", user.id).maybeSingle();
  const healthSourcePromise = supabase.from("health_sources").select("provider").eq("user_id", user.id).limit(1).maybeSingle();

  const goalsPromise = realm
    ? supabase.from("goals").select("id, title, status, target_date, realm_id").eq("user_id", user.id).eq("realm_id", realm.id).order("created_at", { ascending: false }).limit(10)
    : Promise.resolve({ data: [] as unknown[] } as { data: unknown[] });

  const habitsPromise = realm
    ? supabase.from("habits").select("id, title, frequency, realm_id").eq("user_id", user.id).eq("realm_id", realm.id).limit(20)
    : Promise.resolve({ data: [] as unknown[] } as { data: unknown[] });

  const tasksPromise = realm
    ? supabase.from("tasks").select("id, title, status, due_date").eq("user_id", user.id).eq("realm_id", realm.id).limit(20)
    : Promise.resolve({ data: [] as unknown[] } as { data: unknown[] });

  const [today, prefsRes, sourceRes, goalsRes, habitsRes, tasksRes] = await Promise.all([
    todayPromise,
    prefsPromise,
    healthSourcePromise,
    goalsPromise as Promise<{ data: unknown[] | null }>,
    habitsPromise as Promise<{ data: unknown[] | null }>,
    tasksPromise as Promise<{ data: unknown[] | null }>,
  ]);

  // trend histories for key metrics — bounded to periodDays*2 for previous comparison
  const metricKeys: BodyMetricKey[] = ["steps", "sleepDuration", "weight", "restingHeartRate"];
  const healthMetricMap: Record<BodyMetricKey, string> = {
    steps: "steps",
    activeMinutes: "active_minutes",
    exerciseMinutes: "exercise_minutes",
    sleepDuration: "sleep_duration",
    restingHeartRate: "resting_heart_rate",
    weight: "weight",
  };

  const histories = await Promise.all(
    metricKeys.map(async (k) => {
      const h = await loadBodyMetricHistory(healthMetricMap[k], periodDays * 2);
      return [k, h] as const;
    }),
  );

  const trends: Record<string, BodyTrendSummary | null> = {};
  for (const [k, hist] of histories) {
    const mapped = (hist as Array<{ date: string; value: number }>).map((p) => ({ date: p.date, value: p.value }));
    // deduplicate by date keep last
    const byDate = new Map<string, number>();
    for (const p of mapped) byDate.set(p.date, p.value);
    const points = Array.from(byDate.entries()).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) trends[k] = null;
    else {
      const { getBodyMetricTrend } = await import("@lifepulse/domain");
      trends[k] = getBodyMetricTrend(points, k, periodDays);
    }
  }

  const prefs = prefsRes as unknown as { data: { allowed_metrics: string[] | null } | null };
  const goals = (goalsRes.data ?? []) as BodyOverview["goals"];
  const habits = (habitsRes.data ?? []) as BodyOverview["habits"];
  const tasks = (tasksRes.data ?? []) as BodyOverview["tasks"];

  // goal progress — only if targetValue can be inferred (not persisted for body yet, so will be insufficient)
  const goalProgress = goals.map((g) => {
    // No quantitative target persisted yet (frequency only in goals table) — return insufficient
    return { kind: "general_fitness" as const, progress01: null, status: "insufficient" as const, currentValue: null, targetValue: null, message: g.title };
  });

  // habit logs for this week for consistency
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const { data: logs } = await supabase
    .from("habit_logs")
    .select("habit_id, completed_date")
    .eq("user_id", user.id)
    .gte("completed_date", weekStart.toISOString().slice(0, 10));

  const source = (sourceRes as unknown as { data: { provider: string } | null })?.data?.provider ?? null;

  return {
    realm,
    today: today ?? null,
    trends: trends as BodyOverview["trends"],
    goals,
    goalProgress,
    habits,
    habitLogs: (logs ?? []) as BodyOverview["habitLogs"],
    tasks,
    healthStatus: { allowed: (prefs?.data?.allowed_metrics as string[] | null) ?? [], hasSteps: (prefs?.data?.allowed_metrics as string[] | null)?.includes("steps") ?? false, source },
  };
}
