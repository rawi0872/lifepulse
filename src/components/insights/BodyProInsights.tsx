"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/bodyPro";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";

function getLocalDateDaysAgo(daysAgo: number): string {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function BodyProInsights() {
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<{
    weeklyWorkouts: number;
    weeklyMinutes: number;
    avgDailyProtein: number | null;
    avgDailyCalories: number | null;
    nutritionDays: number;
    totalWaterMl: number;
    latestWeight: number | null;
    healthNoteCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekStart = getWeekStartDate();
      const todayStr = getTodayDateString();
      const sevenDaysAgo = getLocalDateDaysAgo(7);

      const [workoutRes, nutritionRes, measurementRes, healthRes] = await Promise.all([
        supabase.from("workouts").select("duration_minutes").eq("user_id", user.id).gte("workout_date", weekStart),
        supabase.from("nutrition_logs").select("log_date, calories, protein_g, water_ml").eq("user_id", user.id).gte("log_date", sevenDaysAgo).lte("log_date", todayStr),
        supabase.from("body_measurements").select("weight_kg").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(1),
        supabase.from("health_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (cancelled) return;

      const workouts = (workoutRes.data ?? []) as { duration_minutes?: number | string | null }[];
      const nutritionLogs = (nutritionRes.data ?? []) as { calories?: number | string | null; protein_g?: number | string | null; water_ml?: number | string | null; log_date?: string }[];

      const daysWithData = new Set(nutritionLogs.map((l) => l.log_date).filter(Boolean)).size;
      const totalCalories = nutritionLogs.reduce((s, l) => s + toFiniteNumber(l.calories), 0);
      const totalProtein = nutritionLogs.reduce((s, l) => s + toFiniteNumber(l.protein_g), 0);
      const totalWater = nutritionLogs.reduce((s, l) => s + toFiniteNumber(l.water_ml), 0);
      const latestWeight = ((measurementRes.data ?? []) as { weight_kg?: number | string | null }[])[0]?.weight_kg ?? null;

      setData({
        weeklyWorkouts: workouts.length,
        weeklyMinutes: workouts.reduce((s, w) => s + toFiniteNumber(w.duration_minutes), 0),
        avgDailyCalories: daysWithData > 0 ? Math.round(totalCalories / daysWithData) : null,
        avgDailyProtein: daysWithData > 0 ? Math.round((totalProtein / daysWithData) * 10) / 10 : null,
        nutritionDays: daysWithData,
        totalWaterMl: totalWater,
        latestWeight: latestWeight !== null ? toFiniteNumber(latestWeight) : null,
        healthNoteCount: healthRes.count ?? 0,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!data) return null;

  const waterLiters = Math.round((data.totalWaterMl / 1000) * 10) / 10;

  return (
    <Card className="min-w-0 p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <svg className="h-4 w-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
        <p className="min-w-0 break-words text-[10px] font-medium tracking-wider text-[var(--text-muted)]">Body Pulse Pro</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0 text-center">
          <p className="break-words text-lg font-bold text-[var(--text)]">{formatNumber(data.weeklyWorkouts)}</p>
          <p className="break-words text-[10px] text-[var(--text-muted)]">Workouts / wk</p>
          <p className="break-words text-[9px] text-[var(--text-muted)]">{formatNumber(data.weeklyMinutes)} min</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words text-lg font-bold text-[var(--text)]">
            {data.avgDailyCalories !== null ? formatNumber(data.avgDailyCalories) : "\u2014"}
          </p>
          <p className="break-words text-[10px] text-[var(--text-muted)]">Avg cal / day</p>
          {data.avgDailyProtein !== null && (
            <p className="break-words text-[9px] text-[var(--text-muted)]">{formatNumber(data.avgDailyProtein, 1)}g protein</p>
          )}
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words text-lg font-bold text-[var(--text)]">
            {data.latestWeight !== null ? `${formatNumber(data.latestWeight, 1)}` : "\u2014"}
          </p>
          <p className="break-words text-[10px] text-[var(--text-muted)]">Weight kg</p>
          <p className="break-words text-[9px] text-[var(--text-muted)]">{data.healthNoteCount} health notes</p>
        </div>
      </div>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-3">
        <div className="min-w-0 text-center">
          <p className="break-words text-sm font-bold text-[var(--text)]">{data.nutritionDays} / 7</p>
          <p className="break-words text-[10px] text-[var(--text-muted)]">Nutrition days</p>
          <p className="break-words text-[9px] text-[var(--text-muted)]">Days with at least one meal or water log.</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words text-sm font-bold text-[var(--text)]">{formatNumber(waterLiters, 1)} L</p>
          <p className="break-words text-[10px] text-[var(--text-muted)]">Water logged</p>
          <p className="break-words text-[9px] text-[var(--text-muted)]">Total water recorded in recent nutrition logs.</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words text-sm font-bold text-[var(--text)]">
            {data.avgDailyProtein !== null ? `${formatNumber(data.avgDailyProtein, 0)} g/day` : "No logs yet"}
          </p>
          <p className="break-words text-[10px] text-[var(--text-muted)]">Protein avg</p>
          <p className="break-words text-[9px] text-[var(--text-muted)]">Average across days with nutrition logs.</p>
        </div>
      </div>
    </Card>
  );
}

function toFiniteNumber(value: number | string | null | undefined): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
