"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { PulseCard } from "@/components/ui/pulse-card";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(): string[] {
  const start = new Date(getWeekStartDate());
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

interface WeekData {
  weekDates: string[];
  habitCount: number;
  taskCount: number;
  workoutCount: number;
  workoutMinutes: number;
  journalCount: number;
  passionMinutes: number;
  passionSessions: number;
  bodyCheckins: number;
  mindCheckins: number;
  avgEnergy: number | null;
  avgSleep: number | null;
  avgMood: number | null;
  avgFocus: number | null;
  avgStress: number | null;
  nutritionCount: number;
  nutritionDays: number;
  waterMl: number;
  avgProteinPerNutritionDay: number | null;
  latestWeight: number | null;
  activeGoals: number;
  completedMilestones: number;
  activeProjects: number;
  bodyLoggedToday: boolean;
  mindLoggedToday: boolean;
  hasWorkoutThisWeek: boolean;
  hasJournalToday: boolean;
  hasPassionSessionThisWeek: boolean;
  hasHighPriorityTasks: boolean;
  topPassion: string | null;
}

export default function WeeklyReviewPage() {
  return (
    <DashboardNav>
      <WeeklyReviewContent />
    </DashboardNav>
  );
}

function WeeklyReviewContent() {
  const router = useRouter();
  const supabase = createClient();
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();
  const weekDates = getWeekDates();
  const todayDow = new Date().getDay();
  const isWeekend = todayDow === 0 || todayDow === 6;

  const [data, setData] = useState<WeekData | null>(null);
  const [reflection, setReflection] = useState({
    wentWell: "",
    feltDifficult: "",
    focusNextWeek: "",
    reduceOrAvoid: "",
    oneWin: "",
  });
  const [planFocus, setPlanFocus] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const weekEnd = weekDates[6];

    const [
      habitsRes, tasksRes, workoutsRes, journalRes,
      bodyRes, mindRes, nutritionRes, measurementRes,
      passionsRes, sessionsRes, goalsRes, milestonesRes, projectsRes,
    ] = await Promise.all([
      supabase.from("habit_logs").select("id").eq("user_id", user.id).gte("completed_date", weekStart).lte("completed_date", weekEnd),
      supabase.from("tasks").select("id").eq("user_id", user.id).eq("status", "done"),
      supabase.from("workouts").select("duration_minutes").eq("user_id", user.id).gte("workout_date", weekStart).lte("workout_date", weekEnd),
      supabase.from("journal_entries").select("id").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", weekEnd),
      supabase.from("body_metrics").select("energy, sleep_hours").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", weekEnd),
      supabase.from("mind_metrics").select("mood, focus, stress").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", weekEnd),
      supabase.from("nutrition_logs").select("id, log_date, protein_g, water_ml").eq("user_id", user.id).gte("log_date", weekStart).lte("log_date", weekEnd),
      supabase.from("body_measurements").select("weight_kg").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(1),
      supabase.from("passions").select("id, name").eq("user_id", user.id).eq("status", "active"),
      supabase.from("passion_sessions").select("duration_minutes, passion_id").eq("user_id", user.id).gte("session_date", weekStart).lte("session_date", weekEnd),
      supabase.from("goals").select("id").eq("user_id", user.id).eq("status", "active"),
      supabase.from("goal_milestones").select("id").eq("user_id", user.id).not("completed_at", "is", null),
      supabase.from("projects").select("id").eq("user_id", user.id).eq("status", "active"),
    ]);

    const bodyMetrics = (bodyRes.data ?? []) as { energy?: number | null; sleep_hours?: number | null }[];
    const mindMetrics = (mindRes.data ?? []) as { mood?: number | null; focus?: number | null; stress?: number | null }[];
    const nutritionLogs = (nutritionRes.data ?? []) as { log_date?: string | null; protein_g?: number | null; water_ml?: number | null }[];
    const sessions = (sessionsRes.data ?? []) as { duration_minutes?: number | null; passion_id?: string }[];
    const passions = (passionsRes.data ?? []) as { id: string; name: string }[];
    const passionMap = new Map(passions.map((p) => [p.id, p.name]));

    const passionTotals = new Map<string, number>();
    for (const s of sessions) {
      if (s.passion_id) {
        passionTotals.set(s.passion_id, (passionTotals.get(s.passion_id) ?? 0) + (s.duration_minutes ?? 0));
      }
    }
    let topPassion: string | null = null;
    let topMin = 0;
    for (const [pid, mins] of passionTotals) {
      if (mins > topMin) {
        topMin = mins;
        topPassion = passionMap.get(pid) ?? null;
      }
    }

    const avg = (vals: (number | null | undefined)[]) => {
      const nums = vals.filter((v): v is number => v !== null && v !== undefined);
      return nums.length > 0 ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : null;
    };

    const nutritionDays = new Set(nutritionLogs.map((n) => n.log_date).filter(Boolean)).size;
    const totalProtein = nutritionLogs.reduce((sum, n) => sum + (n.protein_g ?? 0), 0);
    const waterMl = nutritionLogs.reduce((sum, n) => sum + (n.water_ml ?? 0), 0);

    setData({
      weekDates,
      habitCount: (habitsRes.data ?? []).length,
      taskCount: (tasksRes.data ?? []).length,
      workoutCount: (workoutsRes.data ?? []).length,
      workoutMinutes: ((workoutsRes.data ?? []) as { duration_minutes?: number | null }[]).reduce((s, w) => s + (w.duration_minutes ?? 0), 0),
      journalCount: (journalRes.data ?? []).length,
      passionMinutes: sessions.reduce((s, se) => s + (se.duration_minutes ?? 0), 0),
      passionSessions: sessions.length,
      bodyCheckins: bodyMetrics.length,
      mindCheckins: mindMetrics.length,
      avgEnergy: avg(bodyMetrics.map((b) => b.energy)),
      avgSleep: avg(bodyMetrics.map((b) => b.sleep_hours)),
      avgMood: avg(mindMetrics.map((m) => m.mood)),
      avgFocus: avg(mindMetrics.map((m) => m.focus)),
      avgStress: avg(mindMetrics.map((m) => m.stress)),
      nutritionCount: nutritionLogs.length,
      nutritionDays,
      waterMl,
      avgProteinPerNutritionDay: nutritionDays > 0 ? Math.round(totalProtein / nutritionDays) : null,
      latestWeight: ((measurementRes.data ?? []) as { weight_kg?: number | null }[])[0]?.weight_kg ?? null,
      activeGoals: (goalsRes.data ?? []).length,
      completedMilestones: (milestonesRes.data ?? []).length,
      activeProjects: (projectsRes.data ?? []).length,
      bodyLoggedToday: bodyMetrics.length > 0,
      mindLoggedToday: mindMetrics.length > 0,
      hasWorkoutThisWeek: (workoutsRes.data ?? []).length > 0,
      hasJournalToday: (journalRes.data ?? []).length > 0,
      hasPassionSessionThisWeek: sessions.length > 0,
      hasHighPriorityTasks: false,
      topPassion,
    });
    setLoading(false);
  }, [supabase, router, weekDates, weekStart]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await loadData();
      if (cancelled) return;
    };
    init();
    return () => { cancelled = true; };
  }, [loadData]);

  const handleSaveReflection = async () => {
    setSavingReflection(true);
    const text = [
      reflection.wentWell && `## What went well\n${reflection.wentWell}`,
      reflection.feltDifficult && `## What felt difficult\n${reflection.feltDifficult}`,
      reflection.focusNextWeek && `## Next week focus\n${reflection.focusNextWeek}`,
      reflection.reduceOrAvoid && `## Reduce or avoid\n${reflection.reduceOrAvoid}`,
      reflection.oneWin && `## One win\n${reflection.oneWin}`,
    ].filter(Boolean).join("\n\n");

    if (!text) { setSavingReflection(false); return; }

    const { error } = await supabase.from("journal_entries").upsert({
      entry_date: today,
      content: `**Weekly Reflection (${weekStart}**\n\n${text}`,
    }, { onConflict: "user_id,entry_date" });

    if (error) {
      console.error("Failed to save reflection to journal:", error);
    }
    setSavingReflection(false);
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-[var(--surface)]" />
          <div className="h-4 w-48 rounded bg-[var(--surface)]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-[var(--surface)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const dayLabels = weekDates.map((d, i) => {
    const date = new Date(d + "T12:00:00");
    return `${WEEKDAYS[i]} ${date.getDate()}/${date.getMonth() + 1}`;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text)]">Weekly Review</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Reset, reflect, and choose what deserves attention next week.
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {dayLabels[0]} &ndash; {dayLabels[6]}
          {isWeekend && <span className="ml-2 text-xs text-[var(--accent)]">Weekend &mdash; good time to reflect</span>}
        </p>
      </div>

      {/* ── 1. Week Summary ────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">This week at a glance</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          A quick read on what moved, what stayed quiet, and where your rhythm showed up.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Habits done" value={data.habitCount} />
          <MetricCard label="Tasks done" value={data.taskCount} />
          <MetricCard label="Workouts" value={data.workoutCount} sub={`${data.workoutMinutes} min`} />
          <MetricCard label="Journal entries" value={data.journalCount} />
          <MetricCard label="Body check-ins" value={data.bodyCheckins} />
          <MetricCard label="Mind check-ins" value={data.mindCheckins} />
          <MetricCard label="Passion sessions" value={data.passionSessions} sub={`${data.passionMinutes} min`} />
          <MetricCard label="Nutrition logs" value={data.nutritionCount} />
        </div>
      </section>

      {/* ── 2. Body & Mind Review ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Body and mind signals</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Energy, sleep, mood, focus, and recovery patterns from this week.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Avg energy" value={data.avgEnergy !== null ? `${data.avgEnergy}/5` : "\u2014"} />
          <MetricCard label="Avg sleep" value={data.avgSleep !== null ? `${data.avgSleep}h` : "\u2014"} />
          <MetricCard label="Avg mood" value={data.avgMood !== null ? `${data.avgMood}/5` : "\u2014"} />
          <MetricCard label="Avg focus" value={data.avgFocus !== null ? `${data.avgFocus}/5` : "\u2014"} />
          <MetricCard label="Avg stress" value={data.avgStress !== null ? `${data.avgStress}/5` : "\u2014"} />
          <MetricCard label="Workouts" value={data.workoutCount} sub={`${data.workoutMinutes} min`} />
          <MetricCard label="Nutrition logs" value={data.nutritionCount} />
          <MetricCard label="Nutrition days" value={`${data.nutritionDays} / 7`} />
          <MetricCard label="Water logged" value={`${Math.round((data.waterMl / 1000) * 10) / 10} L`} />
          <MetricCard label="Protein avg" value={data.avgProteinPerNutritionDay !== null ? `${data.avgProteinPerNutritionDay} g/day` : "\u2014"} />
          <MetricCard label="Latest weight" value={data.latestWeight !== null ? `${data.latestWeight} kg` : "\u2014"} />
        </div>
      </section>

      {/* ── 3. Goals & Growth Review ───────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Execution and progress</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Tasks, projects, habits, goals, and milestones that moved forward.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Active goals" value={data.activeGoals} />
          <MetricCard label="Tasks done" value={data.taskCount} />
          <MetricCard label="Active projects" value={data.activeProjects} />
          <MetricCard label="Habits done" value={data.habitCount} />
        </div>
      </section>

      {/* ── 4. Passions Review ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Creative and personal energy</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Practice, passions, and personal momentum outside the normal task loop.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Sessions" value={data.passionSessions} />
          <MetricCard label="Minutes practiced" value={data.passionMinutes} />
          <MetricCard label="Most practiced" value={data.topPassion ?? "\u2014"} />
          <MetricCard label="Milestones" value={data.completedMilestones} />
        </div>
      </section>

      {/* ── 5. Reflection Prompts ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Weekly reset</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Name what worked, what slipped, and what next week needs.
        </p>
        <PulseCard title="Weekly Reflection" accent="accent">
          <div className="p-4 space-y-4">
            <ReflectionField
              label="What went well this week?"
              value={reflection.wentWell}
              onChange={(v) => setReflection((r) => ({ ...r, wentWell: v }))}
            />
            <ReflectionField
              label="What felt difficult?"
              value={reflection.feltDifficult}
              onChange={(v) => setReflection((r) => ({ ...r, feltDifficult: v }))}
            />
            <ReflectionField
              label="What should I focus on next week?"
              value={reflection.focusNextWeek}
              onChange={(v) => setReflection((r) => ({ ...r, focusNextWeek: v }))}
            />
            <ReflectionField
              label="What should I reduce or avoid?"
              value={reflection.reduceOrAvoid}
              onChange={(v) => setReflection((r) => ({ ...r, reduceOrAvoid: v }))}
            />
            <ReflectionField
              label="What is one win I want to remember?"
              value={reflection.oneWin}
              onChange={(v) => setReflection((r) => ({ ...r, oneWin: v }))}
            />
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveReflection}
                disabled={savingReflection || Object.values(reflection).every((v) => !v)}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {savingReflection ? "Saving..." : "Save to Journal"}
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              Reflection is saved as today&rsquo;s journal entry with a weekly review prefix.
            </p>
          </div>
        </PulseCard>
      </section>

      {/* ── Plan Next Week ─────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Next week focus</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Use your current signals to choose a realistic next step.
        </p>
        <PulseCard title="Plan Ahead" accent="accent">
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--text)] mb-1.5">Top focus for next week</label>
            <input
              type="text"
              value={planFocus}
              onChange={(e) => setPlanFocus(e.target.value)}
              placeholder="What is the most important thing to accomplish?"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--text)]">Suggested actions</p>
            <div className="space-y-1.5">
              {suggestedActions(data).map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] transition-colors"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span>{action.text}</span>
                </Link>
              ))}
              {suggestedActions(data).length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">No suggestions &mdash; you&rsquo;re on track!</p>
              )}
            </div>
          </div>
        </PulseCard>

        {/* Coach link */}
        <Link
          href="/coach"
          className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
        >
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            Open Coach
          </span>
          <span className="text-xs text-[var(--text-muted)]">See recommended next actions &rarr;</span>
        </Link>
      </section>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  const displayValue = typeof value === "number" ? String(value) : value;
  return (
    <Card className="p-3 text-center">
      <p className="text-lg font-bold text-[var(--text)]">{displayValue}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      {sub !== undefined && <p className="text-[9px] text-[var(--text-muted)]">{sub}</p>}
    </Card>
  );
}

function ReflectionField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text)] mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] resize-none"
      />
    </div>
  );
}

function suggestedActions(data: WeekData) {
  const actions: { text: string; href: string }[] = [];
  if (!data.hasWorkoutThisWeek) actions.push({ text: "Plan 1 workout for next week", href: "/body" });
  if (!data.hasJournalToday) actions.push({ text: "Schedule one journal reflection", href: "/journal" });
  if (!data.hasPassionSessionThisWeek) actions.push({ text: "Plan a passion practice session", href: "/passions" });
  if (!data.bodyLoggedToday) actions.push({ text: "Build a daily body check-in habit", href: "/body" });
  if (!data.mindLoggedToday) actions.push({ text: "Build a daily mind check-in habit", href: "/mind" });
  return actions.slice(0, 4);
}
