"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { PulseCard } from "@/components/ui/pulse-card";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { formatCurrency } from "@/components/finance/financeUtils";

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
  weeklyJournalEntries: number;
  weeklyKnowledgeItems: number;
  latestJournalReflection: string | null;
  latestKnowledgeTitle: string | null;
  latestKnowledgeType: string | null;
  latestWeight: number | null;
  activeGoals: number;
  linkedGoals: number;
  unlinkedGoals: number;
  actionLinks: number;
  projectLinks: number;
  taskLinks: number;
  habitLinks: number;
  completedMilestones: number;
  activeProjects: number;
  financeTransactionCount: number;
  financeIncome: number;
  financeExpenses: number;
  financeNet: number;
  financeCurrency: string | null;
  financeHasMixedCurrencies: boolean;
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
    const knowledgeWeekStart = toLocalDateBoundaryIso(weekStart, "start");
    const knowledgeWeekEnd = toLocalDateBoundaryIso(weekEnd, "end");

    const [
      habitsRes, tasksRes, workoutsRes, journalRes,
      bodyRes, mindRes, nutritionRes, measurementRes,
      passionsRes, sessionsRes, goalsRes, milestonesRes, projectsRes, financeRes,
      journalMemoryRes, knowledgeMemoryRes, goalLinksRes,
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
      supabase.from("finance_transactions")
        .select("amount, type, transaction_date, account_id, finance_accounts(currency)")
        .eq("user_id", user.id)
        .gte("transaction_date", weekStart)
        .lte("transaction_date", weekEnd),
      supabase.from("journal_entries")
        .select("id, entry_date, content")
        .eq("user_id", user.id)
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd)
        .order("entry_date", { ascending: false }),
      supabase.from("knowledge_items")
        .select("id, title, type, created_at")
        .eq("user_id", user.id)
        .gte("created_at", knowledgeWeekStart)
        .lte("created_at", knowledgeWeekEnd)
        .order("created_at", { ascending: false }),
      supabase.from("goal_links")
        .select("goal_id, linked_type")
        .eq("user_id", user.id),
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
    const journalMemoryEntries = (journalMemoryRes.data ?? []) as { content?: string | null }[];
    const knowledgeMemoryItems = (knowledgeMemoryRes.data ?? []) as { title?: string | null; type?: string | null }[];
    const latestJournalReflection = makeMemorySnippet(journalMemoryEntries[0]?.content ?? null);
    const latestKnowledge = knowledgeMemoryItems[0];
    const financeTransactions = (financeRes.data ?? []) as {
      amount?: number | string | null;
      type?: string | null;
      finance_accounts?: { currency?: string | null } | { currency?: string | null }[] | null;
    }[];

    let financeIncome = 0;
    let financeExpenses = 0;
    const financeCurrencies = new Set<string>();

    for (const tx of financeTransactions) {
      const amount = Number(tx.amount);
      if (!Number.isFinite(amount)) continue;

      if (tx.type === "income") financeIncome += amount;
      if (tx.type === "expense") financeExpenses += amount;

      const account = Array.isArray(tx.finance_accounts) ? tx.finance_accounts[0] : tx.finance_accounts;
      if (account?.currency) financeCurrencies.add(account.currency);
    }

    const financeCurrencyList = Array.from(financeCurrencies);
    const financeHasMixedCurrencies = financeCurrencyList.length > 1;
    const financeCurrency = financeCurrencyList.length === 1 ? financeCurrencyList[0] : null;
    const activeGoals = (goalsRes.data ?? []) as { id: string }[];
    const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
    const activeGoalLinks = ((goalLinksRes.data ?? []) as { goal_id?: string | null; linked_type?: string | null }[])
      .filter((link) => link.goal_id && activeGoalIds.has(link.goal_id));
    const linkedGoalIds = new Set(activeGoalLinks.map((link) => link.goal_id).filter(Boolean));
    const linkedGoals = linkedGoalIds.size;
    const unlinkedGoals = activeGoals.length - linkedGoals;

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
      weeklyJournalEntries: journalMemoryEntries.length,
      weeklyKnowledgeItems: knowledgeMemoryItems.length,
      latestJournalReflection,
      latestKnowledgeTitle: latestKnowledge?.title ?? null,
      latestKnowledgeType: latestKnowledge?.type ?? null,
      latestWeight: ((measurementRes.data ?? []) as { weight_kg?: number | null }[])[0]?.weight_kg ?? null,
      activeGoals: activeGoals.length,
      linkedGoals,
      unlinkedGoals,
      actionLinks: activeGoalLinks.length,
      projectLinks: activeGoalLinks.filter((link) => link.linked_type === "project").length,
      taskLinks: activeGoalLinks.filter((link) => link.linked_type === "task").length,
      habitLinks: activeGoalLinks.filter((link) => link.linked_type === "habit").length,
      completedMilestones: (milestonesRes.data ?? []).length,
      activeProjects: (projectsRes.data ?? []).length,
      financeTransactionCount: financeTransactions.length,
      financeIncome,
      financeExpenses,
      financeNet: financeIncome - financeExpenses,
      financeCurrency,
      financeHasMixedCurrencies,
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
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-[var(--surface)] sm:w-64" />
            <div className="h-4 w-40 rounded bg-[var(--surface)] sm:w-48" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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
  const weeklySignalCount = data.habitCount + data.taskCount + data.journalCount + data.bodyCheckins + data.mindCheckins + data.financeTransactionCount;
  const isSparseWeek = weeklySignalCount < 3;

  return (
    <div className="mx-auto max-w-3xl overflow-x-hidden px-4 py-6 sm:px-5 sm:py-8">
      {/* Header */}
      <div className="mb-6 min-w-0">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
          Your week, built from what you logged
        </p>
        <h1 className="break-words text-xl font-bold text-[var(--text)] sm:text-2xl">Weekly Review</h1>
        <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
          Reset, reflect, and choose what deserves attention next week.
        </p>
        <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
          Review tasks, habits, reflections, body, mind, and finance signals in one place. Use this to notice what helped, what drifted, and what to adjust next week.
        </p>
        <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
          {dayLabels[0]} &ndash; {dayLabels[6]}
          {isWeekend && <span className="mt-1 block text-xs text-[var(--accent)] sm:ml-2 sm:mt-0 sm:inline">Weekend &mdash; good time to reflect</span>}
        </p>
      </div>

      <Card variant="subtle" className="mb-8 border-[var(--border)] bg-[var(--surface-soft)]/70">
        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Why this gets useful
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Plan today, complete one visible action, reflect tonight, then review the week when a few days are logged. Life Pulse shows patterns from your entries; it does not judge your life or create outside analysis.
          </p>
          <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-5">
            <span>1. Plan</span>
            <span>2. Act</span>
            <span>3. Reflect</span>
            <span>4. Review</span>
            <span>5. Adjust</span>
          </div>
        </div>
      </Card>

      {isSparseWeek && (
        <Card variant="subtle" className="mb-8 border-dashed border-[var(--border)] bg-black/10">
          <div className="p-4 text-center sm:p-5">
            <p className="text-sm font-semibold text-[var(--text)]">Your weekly picture is still forming.</p>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-muted)]">
              Log a few tasks, habits, reflections, or body and mind check-ins this week. This review becomes clearer as those private data points collect.
            </p>
            <Link href="/today" className="mt-3 inline-flex min-h-10 items-center rounded-md text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] sm:min-h-0">
              Return to Today &rarr;
            </Link>
          </div>
        </Card>
      )}

      {/* ── 1. Week Summary ────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">This week at a glance</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          A quick read on what moved, what stayed quiet, and where your logged rhythm showed up.
        </p>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
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

      {(data.weeklyJournalEntries > 0 || data.weeklyKnowledgeItems > 0) && (
        <section className="mb-8">
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
            <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Memory and learning</h2>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            A read-only view of reflections and knowledge captured this week.
          </p>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Journal entries" value={data.weeklyJournalEntries} />
            <MetricCard label="Knowledge items" value={data.weeklyKnowledgeItems} />
            <MetricCard label="Latest reflection" value={data.latestJournalReflection ?? "—"} />
            <MetricCard
              label="Latest knowledge"
              value={data.latestKnowledgeTitle ?? "—"}
              sub={data.latestKnowledgeType ?? undefined}
            />
          </div>
          <p className="mt-3 text-center text-[10px] text-[var(--text-muted)]">
            Private manual memory. No AI summaries or external processing.
          </p>
        </section>
      )}

      {/* ── 2. Body & Mind Review ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Body and mind signals</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Energy, sleep, mood, focus, and recovery patterns from this week.
        </p>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Execution and progress</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Tasks, projects, habits, goals, and milestones that moved forward.
        </p>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Active goals" value={data.activeGoals} />
          <MetricCard label="Tasks done" value={data.taskCount} />
          <MetricCard label="Active projects" value={data.activeProjects} />
          <MetricCard label="Habits done" value={data.habitCount} />
        </div>
      </section>

      {data.activeGoals > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
            <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Goal alignment</h2>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            A read-only view of whether active goals are connected to projects, tasks, or habits.
          </p>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Active goals" value={data.activeGoals} />
            <MetricCard label="Goals with action links" value={data.linkedGoals} />
            <MetricCard label="Goals without action links" value={data.unlinkedGoals} />
            <MetricCard
              label="Action links"
              value={data.actionLinks}
              sub={`${data.projectLinks} projects / ${data.taskLinks} tasks / ${data.habitLinks} habits`}
            />
          </div>
          <p className="mt-3 text-center text-[10px] text-[var(--text-muted)]">
            {data.unlinkedGoals > 0
              ? "Some active goals are not connected to projects, tasks, or habits yet."
              : "Your active goals are connected to action."}
          </p>
        </section>
      )}

      {/* ── 4. Passions Review ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Creative and personal energy</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Practice, passions, and personal momentum outside the normal task loop.
        </p>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Sessions" value={data.passionSessions} />
          <MetricCard label="Minutes practiced" value={data.passionMinutes} />
          <MetricCard label="Most practiced" value={data.topPassion ?? "\u2014"} />
          <MetricCard label="Milestones" value={data.completedMilestones} />
        </div>
      </section>

      {data.financeTransactionCount > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
            <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Money reflection</h2>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            A read-only summary of manually logged finance activity for this week.
          </p>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Transactions this week" value={data.financeTransactionCount} />
            <MetricCard
              label="Logged income"
              value={formatFinanceReviewAmount(data.financeIncome, data)}
              sub={data.financeHasMixedCurrencies ? "Review detailed amounts in Finance" : undefined}
            />
            <MetricCard
              label="Logged expenses"
              value={formatFinanceReviewAmount(data.financeExpenses, data)}
              sub={data.financeHasMixedCurrencies ? "Review detailed amounts in Finance" : undefined}
            />
            <MetricCard
              label="Net logged"
              value={formatFinanceReviewAmount(data.financeNet, data)}
              sub={data.financeHasMixedCurrencies ? "Review detailed amounts in Finance" : undefined}
            />
          </div>
          <p className="mt-3 text-center text-[10px] text-[var(--text-muted)]">
            Manual tracker. Not financial advice. No bank connection.
          </p>
        </section>
      )}

      {/* ── 5. Reflection Prompts ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Weekly reset</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Name what worked, what slipped, and what next week needs.
        </p>
        <PulseCard title="Weekly Reflection" accent="accent">
          <div className="space-y-4 p-3.5 sm:p-4">
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
            <div className="flex justify-stretch pt-2 sm:justify-end">
              <button
                onClick={handleSaveReflection}
                disabled={savingReflection || Object.values(reflection).every((v) => !v)}
                className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto sm:min-h-0 sm:py-2"
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
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Next week focus</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Use your current signals to choose a realistic next step.
        </p>
        <PulseCard title="Plan Ahead" accent="accent">
          <div className="mb-4 min-w-0 px-3.5 pt-3.5 sm:px-4 sm:pt-4">
            <label className="mb-1.5 block break-words text-xs font-medium text-[var(--text)]">Top focus for next week</label>
            <input
              type="text"
              value={planFocus}
              onChange={(e) => setPlanFocus(e.target.value)}
              placeholder="What is the most important thing to accomplish?"
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] sm:min-h-0"
            />
          </div>

          <div className="min-w-0 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
            <p className="mb-2 text-xs font-medium text-[var(--text)]">Suggested actions</p>
            <div className="space-y-1.5">
              {suggestedActions(data).map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:min-h-0 sm:py-2"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span className="min-w-0 break-words">{action.text}</span>
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
          className="mt-3 flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)] sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex min-w-0 items-center gap-2">
            <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <span className="min-w-0 break-words">Open Coach</span>
          </span>
          <span className="min-w-0 break-words text-xs text-[var(--text-muted)]">See recommended next actions &rarr;</span>
        </Link>
      </section>
    </div>
  );
}

function formatFinanceReviewAmount(amount: number, data: WeekData): string {
  if (data.financeHasMixedCurrencies) return "Mixed currencies";
  return formatCurrency(amount, data.financeCurrency ?? undefined);
}

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function makeMemorySnippet(content: string | null): string | null {
  const text = content?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  const displayValue = typeof value === "number" ? String(value) : value;
  return (
    <Card className="flex min-h-[92px] min-w-0 flex-col justify-center p-3 text-center sm:min-h-[96px]">
      <p className="break-words text-base font-bold leading-tight text-[var(--text)] [overflow-wrap:anywhere] sm:text-lg">{displayValue}</p>
      <p className="mt-1 break-words text-[10px] leading-snug text-[var(--text-muted)]">{label}</p>
      {sub !== undefined && <p className="mt-0.5 break-words text-[9px] leading-snug text-[var(--text-muted)] [overflow-wrap:anywhere]">{sub}</p>}
    </Card>
  );
}

function ReflectionField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-[var(--text)]">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="min-h-24 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] sm:min-h-0 sm:py-2"
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
