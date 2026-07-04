"use client";

import Link from "next/link";
import { PulseCard } from "@/components/ui/pulse-card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { BodyMetricsForm } from "@/components/body/BodyMetricsForm";
import { BodyMetricsAverages } from "@/components/body/BodyMetricsAverages";
import { BodyMetricsSummary } from "@/components/body/BodyMetricsSummary";
import { BodyProfileCard } from "@/components/body/BodyProfileCard";
import type { BodyMetrics, BodyMetricsFormData } from "@/lib/bodyMetrics";
import { formatNumber, type NutritionLog, type HealthNote } from "@/lib/bodyPro";

interface HabitInfo { id: string; title: string; streak: number; completionRate: number; }

interface BodyProOverviewProps {
  bodyMetrics: BodyMetrics[];
  onSaveBody: (data: BodyMetricsFormData) => void;
  saving: boolean;
  workoutsThisWeek: number;
  workoutMinutesThisWeek: number;
  nutritionToday: NutritionLog[];
  waterToday: number;
  latestWeight: number | null;
  latestHealthNote: HealthNote | null;
  bodyHabits: HabitInfo[];
  bodyTaskCount: number;
}

export function BodyProOverview({
  bodyMetrics,
  onSaveBody,
  saving,
  workoutsThisWeek,
  workoutMinutesThisWeek,
  nutritionToday,
  waterToday,
  latestWeight,
  latestHealthNote,
  bodyHabits,
  bodyTaskCount,
}: BodyProOverviewProps) {
  const todayMetrics = bodyMetrics.find((m) => m.entry_date === new Date().toISOString().slice(0, 10)) ?? null;
  const caloriesToday = nutritionToday.reduce((s, n) => s + (n.calories ?? 0), 0);
  const proteinToday = nutritionToday.reduce((s, n) => s + (n.protein_g ?? 0), 0);

  return (
    <div className="space-y-6">
      <BodyProfileCard />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Workouts / Week"
          value={workoutsThisWeek}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
          }
          trend={workoutsThisWeek > 0 ? "up" : "neutral"}
          active={workoutsThisWeek > 0}
        />
        <MetricCard
          label="Workout Min"
          value={`${formatNumber(workoutMinutesThisWeek)}`}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={workoutMinutesThisWeek > 0 ? "up" : "neutral"}
          active={workoutMinutesThisWeek > 0}
        />
        <MetricCard
          label="Calories Today"
          value={formatNumber(caloriesToday)}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={caloriesToday > 0 ? "up" : (caloriesToday === 0 ? "neutral" : "down")}
          active={caloriesToday > 0}
        />
        <MetricCard
          label="Water (ml)"
          value={formatNumber(waterToday)}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
          }
          trend={waterToday > 0 ? "up" : "neutral"}
          active={waterToday > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <BodyMetricsForm
            initial={{
              sleep_hours: todayMetrics?.sleep_hours ?? null,
              sleep_quality: todayMetrics?.sleep_quality ?? null,
              energy: todayMetrics?.energy ?? null,
              steps: todayMetrics?.steps ?? null,
              workout_minutes: todayMetrics?.workout_minutes ?? null,
              weight_kg: todayMetrics?.weight_kg ?? null,
              resting_heart_rate: todayMetrics?.resting_heart_rate ?? null,
              recovery_score: todayMetrics?.recovery_score ?? null,
              notes: todayMetrics?.notes ?? null,
            }}
            saving={saving}
            onSave={onSaveBody}
          />

          {nutritionToday.length === 0 && waterToday === 0 && (
            <PulseCard title="Nutrition" accent="success" description="Today" action={
              <Link href="#nutrition" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Log &rarr;
              </Link>
            }>
              <EmptyState message="No nutrition logged today." />
            </PulseCard>
          )}
          {nutritionToday.length > 0 && (
            <PulseCard title="Nutrition" accent="success" description="Today">
              <div className="divide-y divide-[var(--border)]">
                {nutritionToday.map((n) => (
                  <div key={n.id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs text-[var(--text)]">{n.meal_name || "Meal"}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {n.calories !== null && `${n.calories} cal`}
                      {n.protein_g !== null && ` · ${n.protein_g}g protein`}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-soft)]">
                  <span className="text-xs font-medium text-[var(--text)]">Totals</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatNumber(caloriesToday)} cal &middot; {formatNumber(proteinToday)}g protein &middot; {formatNumber(waterToday)}ml water
                  </span>
                </div>
              </div>
            </PulseCard>
          )}

          {latestWeight !== null && (
            <PulseCard title="Latest Weight" accent="success" action={
              <Link href="#measurements" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Log &rarr;
              </Link>
            }>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-[var(--text)]">{formatNumber(latestWeight, 1)} kg</p>
                <p className="text-xs text-[var(--text-muted)]">latest measurement</p>
              </div>
            </PulseCard>
          )}
        </div>

        <div className="space-y-6">
          {latestHealthNote && (
            <PulseCard title={`Health: ${latestHealthNote.title}`} accent="warning" description={latestHealthNote.category || "Note"} action={
              <Link href="#health" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                View all &rarr;
              </Link>
            }>
              {latestHealthNote.notes && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-[var(--text-secondary)]">{latestHealthNote.notes}</p>
                </div>
              )}
              <div className="border-t border-[var(--border)] px-4 py-2 flex items-center gap-2">
                {latestHealthNote.severity !== null && (
                  <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                    Severity {latestHealthNote.severity}/5
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-muted)]">
                  {new Date(latestHealthNote.note_date).toLocaleDateString()}
                </span>
              </div>
            </PulseCard>
          )}

          <BodyMetricsAverages recent={bodyMetrics} />
          <BodyMetricsSummary recent={bodyMetrics} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PulseCard title="Body Habits" accent="success" description={`${bodyHabits.length} habits`} action={
          <Link href="/habits" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
            Manage
          </Link>
        }>
          {bodyHabits.length === 0 ? (
            <div className="p-4">
              <EmptyState message="No body-related habits." action={
                <Link href="/habits" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                  Add a habit &rarr;
                </Link>
              } />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {bodyHabits.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-[var(--text)]">{h.title}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {h.streak > 0 ? `${h.streak}d streak` : ` ${h.completionRate}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PulseCard>

        <PulseCard title="Body Tasks" accent="success" description="Open health-related tasks" action={
          <Link href="/tasks" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
            Manage
          </Link>
        }>
          {bodyTaskCount === 0 ? (
            <div className="p-4">
              <EmptyState message="No open body-related tasks." action={
                <Link href="/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                  Add a task &rarr;
                </Link>
              } />
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-[var(--text)]">{bodyTaskCount}</p>
              <p className="text-xs text-[var(--text-muted)]">open task{bodyTaskCount !== 1 ? "s" : ""}</p>
            </div>
          )}
        </PulseCard>
      </div>
    </div>
  );
}
