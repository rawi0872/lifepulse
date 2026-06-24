"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/bodyPro";

export function BodyProInsights() {
  const supabase = createClient();
  const [data, setData] = useState<{
    weeklyWorkouts: number;
    weeklyMinutes: number;
    avgDailyProtein: number | null;
    avgDailyCalories: number | null;
    latestWeight: number | null;
    healthNoteCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(today.setDate(diff)).toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const [workoutRes, nutritionRes, measurementRes, healthRes] = await Promise.all([
        supabase.from("workouts").select("duration_minutes").eq("user_id", user.id).gte("workout_date", weekStart),
        supabase.from("nutrition_logs").select("calories, protein_g").eq("user_id", user.id).gte("log_date", sevenDaysAgo).lte("log_date", todayStr),
        supabase.from("body_measurements").select("weight_kg").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(1),
        supabase.from("health_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (cancelled) return;

      const workouts = (workoutRes.data ?? []) as { duration_minutes?: number | null }[];
      const nutritionLogs = (nutritionRes.data ?? []) as { calories?: number | null; protein_g?: number | null; log_date?: string }[];

      const daysWithData = new Set(nutritionLogs.map((l) => l.log_date ?? "")).size;
      const totalCalories = nutritionLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
      const totalProtein = nutritionLogs.reduce((s, l) => s + (l.protein_g ?? 0), 0);

      setData({
        weeklyWorkouts: workouts.length,
        weeklyMinutes: workouts.reduce((s, w) => s + (w.duration_minutes ?? 0), 0),
        avgDailyCalories: daysWithData > 0 ? Math.round(totalCalories / daysWithData) : null,
        avgDailyProtein: daysWithData > 0 ? Math.round((totalProtein / daysWithData) * 10) / 10 : null,
        latestWeight: ((measurementRes.data ?? []) as { weight_kg?: number | null }[])[0]?.weight_kg ?? null,
        healthNoteCount: healthRes.count ?? 0,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!data) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
        <p className="text-[10px] font-medium tracking-wider text-[var(--text-muted)]">Body Pulse Pro</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text)]">{formatNumber(data.weeklyWorkouts)}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Workouts / wk</p>
          <p className="text-[9px] text-[var(--text-muted)]">{formatNumber(data.weeklyMinutes)} min</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text)]">
            {data.avgDailyCalories !== null ? formatNumber(data.avgDailyCalories) : "\u2014"}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Avg cal / day</p>
          {data.avgDailyProtein !== null && (
            <p className="text-[9px] text-[var(--text-muted)]">{formatNumber(data.avgDailyProtein, 1)}g protein</p>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text)]">
            {data.latestWeight !== null ? `${formatNumber(data.latestWeight, 1)}` : "\u2014"}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Weight kg</p>
          <p className="text-[9px] text-[var(--text-muted)]">{data.healthNoteCount} health notes</p>
        </div>
      </div>
    </Card>
  );
}
