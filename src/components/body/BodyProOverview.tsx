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
  onQuickAction?: (tab: "nutrition" | "measurements") => void;
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
  onQuickAction,
}: BodyProOverviewProps) {
  const todayMetrics = bodyMetrics.find((m) => m.entry_date === new Date().toISOString().slice(0, 10)) ?? null;
  const caloriesToday = nutritionToday.reduce((s, n) => s + (n.calories ?? 0), 0);
  const proteinToday = nutritionToday.reduce((s, n) => s + (n.protein_g ?? 0), 0);

  return (
    <div className="min-w-0 space-y-6">
      <PulseCard title="Today body check-in" accent="success" description="Private manual tracking">
        <div className="p-4 sm:p-5">
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Log what happened today: current weight if useful, water, food notes, or a quick body signal. These entries add optional context to Today and Weekly Review.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onQuickAction?.("measurements")}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 text-left transition-all hover:border-[var(--success)]/30 hover:bg-[var(--surface-active)]"
            >
              <span className="block text-xs font-semibold text-[var(--text)]">Current weight</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">
                {latestWeight !== null ? `Last measurement: ${formatNumber(latestWeight, 1)} kg` : "Open weight & measurements."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction?.("nutrition")}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 text-left transition-all hover:border-[var(--success)]/30 hover:bg-[var(--surface-active)]"
            >
              <span className="block text-xs font-semibold text-[var(--text)]">Water today</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">
                {waterToday > 0 ? `${formatNumber(waterToday)} ml logged` : "Log what you drank manually."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction?.("nutrition")}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 text-left transition-all hover:border-[var(--success)]/30 hover:bg-[var(--surface-active)]"
            >
              <span className="block text-xs font-semibold text-[var(--text)]">Food notes</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">
                {nutritionToday.length > 0 ? `${nutritionToday.length} food entries today` : "Breakfast, lunch, snacks, dinner."}
              </span>
            </button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
            Body is optional support for the daily loop. It helps you notice patterns over time; it does not judge your day.
          </p>
        </div>
      </PulseCard>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
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
          label="Food Entries"
          value={nutritionToday.length}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={nutritionToday.length > 0 ? "up" : "neutral"}
          active={nutritionToday.length > 0}
        />
        <MetricCard
          label="Water Today"
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

      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <BodyProfileCard />

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
            <PulseCard title="Food & water" accent="success" description="Today" action={
              <button type="button" onClick={() => onQuickAction?.("nutrition")} className="inline-flex min-h-10 min-w-10 items-center justify-center text-[10px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:min-w-0">
                Log &rarr;
              </button>
            }>
              <EmptyState message="No food or water logged today." description="Manual check-in only. Add water, a meal name, or food notes if useful." />
            </PulseCard>
          )}
          {nutritionToday.length > 0 && (
            <PulseCard title="Food & water" accent="success" description="Today">
              <div className="divide-y divide-[var(--border)]">
                {nutritionToday.map((n) => (
                  <div key={n.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 break-words text-xs text-[var(--text)]">{n.meal_name || "Meal"}</span>
                    <span className="break-words text-xs text-[var(--text-muted)] sm:text-right">
                      {n.calories !== null && `${n.calories} cal`}
                      {n.protein_g !== null && ` · ${n.protein_g}g protein`}
                    </span>
                  </div>
                ))}
                <div className="flex min-w-0 flex-col gap-1 bg-[var(--surface-soft)] px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-[var(--text)]">Totals</span>
                  <span className="break-words text-xs text-[var(--text-secondary)] sm:text-right">
                    {formatNumber(caloriesToday)} cal &middot; {formatNumber(proteinToday)}g protein &middot; {formatNumber(waterToday)}ml water
                  </span>
                </div>
              </div>
            </PulseCard>
          )}

          {latestWeight !== null && (
            <PulseCard title="Current weight" accent="success" description="Last logged" action={
              <button type="button" onClick={() => onQuickAction?.("measurements")} className="inline-flex min-h-10 min-w-10 items-center justify-center text-[10px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:min-w-0">
                Log &rarr;
              </button>
            }>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-[var(--text)]">{formatNumber(latestWeight, 1)} kg</p>
                <p className="text-xs text-[var(--text-muted)]">based on your latest measurement entry</p>
              </div>
            </PulseCard>
          )}
        </div>

        <div className="space-y-6">
          {latestHealthNote && (
            <PulseCard title={`Health: ${latestHealthNote.title}`} accent="warning" description={latestHealthNote.category || "Note"} action={
              <Link href="#health" className="inline-flex min-h-10 items-center text-[10px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
                View all &rarr;
              </Link>
            }>
              {latestHealthNote.notes && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-[var(--text-secondary)]">{latestHealthNote.notes}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-2">
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

      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
        <PulseCard title="Body Habits" accent="success" description={`${bodyHabits.length} habits`} action={
          <Link href="/habits" className="inline-flex min-h-10 items-center text-[10px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
            Manage
          </Link>
        }>
          {bodyHabits.length === 0 ? (
            <div className="p-4">
              <EmptyState message="No body-related habits." action={
                <Link href="/habits" className="inline-flex min-h-10 items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
                  Add a habit &rarr;
                </Link>
              } />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {bodyHabits.map((h) => (
                <div key={h.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words text-xs text-[var(--text)]">{h.title}</span>
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                    {h.streak > 0 ? `${h.streak}d streak` : ` ${h.completionRate}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PulseCard>

        <PulseCard title="Body Tasks" accent="success" description="Open health-related tasks" action={
          <Link href="/tasks" className="inline-flex min-h-10 items-center text-[10px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
            Manage
          </Link>
        }>
          {bodyTaskCount === 0 ? (
            <div className="p-4">
              <EmptyState message="No open body-related tasks." action={
                <Link href="/tasks" className="inline-flex min-h-10 items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
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
