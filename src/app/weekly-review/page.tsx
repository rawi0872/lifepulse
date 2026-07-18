"use client";

import { useState, useEffect, useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { DailyLoopConnector } from "@/components/DailyLoopConnector";
import { PulseCard } from "@/components/ui/pulse-card";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { formatCurrency } from "@/components/finance/financeUtils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MindTrendDay {
  label: string;
  mood: number | null;
  focus: number | null;
  stress: number | null;
  hasEntry: boolean;
}

interface ActivityDay {
  label: string;
  habits: number;
  tasks: number;
  reflections: number;
  mind: number;
  body: number;
  nutrition: number;
  finance: number;
  total: number;
}

interface WeeklySummaryItem {
  label: string;
  value: string;
  detail: string;
}

interface WeeklyChangeSummaryData {
  items: WeeklySummaryItem[];
  isQuiet: boolean;
}

interface PreviousWeekData {
  activityByDay: ActivityDay[];
  habitLogs: number;
  completedTasks: number;
  reflections: number;
  mindCheckins: number;
  bodyNutritionCheckins: number;
  financeEntries: number;
}

interface WeeklyComparisonRow {
  label: string;
  current: number;
  previous: number;
  detail: string;
}

interface WeeklyComparisonData {
  rows: WeeklyComparisonRow[];
  isSparse: boolean;
}

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

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  rhythmByDay: { label: string; habits: number; tasks: number; reflections: number }[];
  mindByDay: MindTrendDay[];
  activityByDay: ActivityDay[];
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
  const [supabase] = useState(() => createClient());
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();
  const weekDates = useMemo(() => getWeekDates(), []);
  const todayDow = new Date().getDay();
  const isWeekend = todayDow === 0 || todayDow === 6;

  const [data, setData] = useState<WeekData | null>(null);
  const [previousWeekData, setPreviousWeekData] = useState<PreviousWeekData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(true);
  const [reflection, setReflection] = useState({
    wentWell: "",
    feltDifficult: "",
    focusNextWeek: "",
    reduceOrAvoid: "",
    oneWin: "",
  });
  const [planFocus, setPlanFocus] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);
  const [loading, setLoading] = useState(true);
  const planFocusId = useId();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const weekEnd = weekDates[6];
    const previousWeekDates = weekDates.map((date) => addDays(date, -7));
    const previousWeekStart = previousWeekDates[0];
    const previousWeekEnd = previousWeekDates[6];
    const knowledgeWeekStart = toLocalDateBoundaryIso(weekStart, "start");
    const knowledgeWeekEnd = toLocalDateBoundaryIso(weekEnd, "end");
    setComparisonLoading(true);
    setPreviousWeekData(null);

    const [
      habitsRes, tasksRes, workoutsRes, journalRes,
      bodyRes, mindRes, nutritionRes, measurementRes,
      passionsRes, sessionsRes, goalsRes, milestonesRes, projectsRes, financeRes,
      journalMemoryRes, knowledgeMemoryRes, goalLinksRes,
    ] = await Promise.all([
      supabase.from("habit_logs").select("id, completed_date").eq("user_id", user.id).gte("completed_date", weekStart).lte("completed_date", weekEnd),
      supabase.from("tasks").select("id, completed_at").eq("user_id", user.id).eq("status", "done").gte("completed_at", `${weekStart}T00:00:00`).lte("completed_at", `${weekEnd}T23:59:59`),
      supabase.from("workouts").select("duration_minutes").eq("user_id", user.id).gte("workout_date", weekStart).lte("workout_date", weekEnd),
      supabase.from("journal_entries").select("id").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", weekEnd),
      supabase.from("body_metrics").select("entry_date, energy, sleep_hours").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", weekEnd),
      supabase.from("mind_metrics").select("entry_date, mood, focus, stress").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", weekEnd),
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

    const bodyMetrics = (bodyRes.data ?? []) as { entry_date?: string | null; energy?: number | null; sleep_hours?: number | null }[];
    const mindMetrics = (mindRes.data ?? []) as { entry_date?: string | null; mood?: number | null; focus?: number | null; stress?: number | null }[];
    const nutritionLogs = (nutritionRes.data ?? []) as { log_date?: string | null; protein_g?: number | null; water_ml?: number | null }[];
    const habitLogs = (habitsRes.data ?? []) as { completed_date?: string | null }[];
    const completedTasks = (tasksRes.data ?? []) as { completed_at?: string | null }[];
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
    const journalMemoryEntries = (journalMemoryRes.data ?? []) as { entry_date?: string | null; content?: string | null }[];
    const knowledgeMemoryItems = (knowledgeMemoryRes.data ?? []) as { title?: string | null; type?: string | null }[];
    const latestJournalReflection = makeMemorySnippet(journalMemoryEntries[0]?.content ?? null);
    const latestKnowledge = knowledgeMemoryItems[0];
    const financeTransactions = (financeRes.data ?? []) as {
      amount?: number | string | null;
      type?: string | null;
      transaction_date?: string | null;
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

    const rhythmByDay = weekDates.map((date, index) => ({
      label: WEEKDAYS[index],
      habits: habitLogs.filter((log) => log.completed_date === date).length,
      tasks: completedTasks.filter((task) => task.completed_at?.slice(0, 10) === date).length,
      reflections: journalMemoryEntries.filter((entry) => entry.entry_date === date).length,
    }));

    const mindByDay = weekDates.map((date, index) => {
      const entries = mindMetrics.filter((entry) => entry.entry_date === date);
      return {
        label: WEEKDAYS[index],
        mood: avg(entries.map((entry) => entry.mood)),
        focus: avg(entries.map((entry) => entry.focus)),
        stress: avg(entries.map((entry) => entry.stress)),
        hasEntry: entries.length > 0,
      };
    });

    const activityByDay = weekDates.map((date, index) => {
      const habits = habitLogs.filter((log) => log.completed_date === date).length;
      const tasks = completedTasks.filter((task) => task.completed_at?.slice(0, 10) === date).length;
      const reflections = journalMemoryEntries.filter((entry) => entry.entry_date === date).length;
      const mind = mindMetrics.filter((entry) => entry.entry_date === date).length;
      const body = bodyMetrics.filter((entry) => entry.entry_date === date).length;
      const nutrition = nutritionLogs.filter((entry) => entry.log_date === date).length;
      const finance = financeTransactions.filter((entry) => entry.transaction_date === date).length;

      return {
        label: WEEKDAYS[index],
        habits,
        tasks,
        reflections,
        mind,
        body,
        nutrition,
        finance,
        total: habits + tasks + reflections + mind + body + nutrition + finance,
      };
    });

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
      rhythmByDay,
      mindByDay,
      activityByDay,
      bodyLoggedToday: bodyMetrics.length > 0,
      mindLoggedToday: mindMetrics.length > 0,
      hasWorkoutThisWeek: (workoutsRes.data ?? []).length > 0,
      hasJournalToday: (journalRes.data ?? []).length > 0,
      hasPassionSessionThisWeek: sessions.length > 0,
      hasHighPriorityTasks: false,
      topPassion,
    });
    setLoading(false);

    try {
      const [prevHabitsRes, prevTasksRes, prevJournalRes, prevMindRes, prevBodyRes, prevNutritionRes, prevFinanceRes] = await Promise.all([
        supabase.from("habit_logs").select("completed_date").eq("user_id", user.id).gte("completed_date", previousWeekStart).lte("completed_date", previousWeekEnd),
        supabase.from("tasks").select("completed_at").eq("user_id", user.id).eq("status", "done").gte("completed_at", `${previousWeekStart}T00:00:00`).lte("completed_at", `${previousWeekEnd}T23:59:59`),
        supabase.from("journal_entries").select("entry_date").eq("user_id", user.id).gte("entry_date", previousWeekStart).lte("entry_date", previousWeekEnd),
        supabase.from("mind_metrics").select("entry_date").eq("user_id", user.id).gte("entry_date", previousWeekStart).lte("entry_date", previousWeekEnd),
        supabase.from("body_metrics").select("entry_date").eq("user_id", user.id).gte("entry_date", previousWeekStart).lte("entry_date", previousWeekEnd),
        supabase.from("nutrition_logs").select("log_date").eq("user_id", user.id).gte("log_date", previousWeekStart).lte("log_date", previousWeekEnd),
        supabase.from("finance_transactions").select("transaction_date").eq("user_id", user.id).gte("transaction_date", previousWeekStart).lte("transaction_date", previousWeekEnd),
      ]);

      const prevHabitLogs = (prevHabitsRes.data ?? []) as { completed_date?: string | null }[];
      const prevCompletedTasks = (prevTasksRes.data ?? []) as { completed_at?: string | null }[];
      const prevJournalEntries = (prevJournalRes.data ?? []) as { entry_date?: string | null }[];
      const prevMindEntries = (prevMindRes.data ?? []) as { entry_date?: string | null }[];
      const prevBodyEntries = (prevBodyRes.data ?? []) as { entry_date?: string | null }[];
      const prevNutritionEntries = (prevNutritionRes.data ?? []) as { log_date?: string | null }[];
      const prevFinanceEntries = (prevFinanceRes.data ?? []) as { transaction_date?: string | null }[];

      setPreviousWeekData({
        activityByDay: previousWeekDates.map((date, index) => {
          const habits = prevHabitLogs.filter((log) => log.completed_date === date).length;
          const tasks = prevCompletedTasks.filter((task) => task.completed_at?.slice(0, 10) === date).length;
          const reflections = prevJournalEntries.filter((entry) => entry.entry_date === date).length;
          const mind = prevMindEntries.filter((entry) => entry.entry_date === date).length;
          const body = prevBodyEntries.filter((entry) => entry.entry_date === date).length;
          const nutrition = prevNutritionEntries.filter((entry) => entry.log_date === date).length;
          const finance = prevFinanceEntries.filter((entry) => entry.transaction_date === date).length;

          return {
            label: WEEKDAYS[index],
            habits,
            tasks,
            reflections,
            mind,
            body,
            nutrition,
            finance,
            total: habits + tasks + reflections + mind + body + nutrition + finance,
          };
        }),
        habitLogs: prevHabitLogs.length,
        completedTasks: prevCompletedTasks.length,
        reflections: prevJournalEntries.length,
        mindCheckins: prevMindEntries.length,
        bodyNutritionCheckins: prevBodyEntries.length + prevNutritionEntries.length,
        financeEntries: prevFinanceEntries.length,
      });
    } catch (comparisonError) {
      console.warn("Failed to load previous-week comparison", comparisonError);
    } finally {
      setComparisonLoading(false);
    }
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
    setReviewSaved(false);
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
    } else {
      setReviewSaved(true);
    }
    setSavingReflection(false);
  };

  const updateReflectionField = (field: keyof typeof reflection, value: string) => {
    setReviewSaved(false);
    setReflection((current) => ({ ...current, [field]: value }));
  };

  const weeklyChangeSummary = useMemo(() => data ? buildWeeklyChangeSummary(data) : null, [data]);
  const weeklyComparison = useMemo(
    () => data && previousWeekData ? buildWeeklyComparison(data, previousWeekData) : null,
    [data, previousWeekData]
  );

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="mb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">Weekly Review</p>
          <h1 className="text-xl font-bold text-[var(--text)] sm:text-2xl">Preparing your week...</h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            Loading this week first. Previous-week comparison can finish after the main review appears.
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-[var(--surface)]" />
            ))}
          </div>
          <div className="h-36 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
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
  const nextActions = suggestedActions(data);

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
          Review what changed from tasks, habits, reflections, body, mind, and finance logs. This is a private manual review built from what you logged, not a score.
        </p>
        <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
          {dayLabels[0]} &ndash; {dayLabels[6]}
          {isWeekend && <span className="mt-1 block text-xs text-[var(--accent)] sm:ml-2 sm:mt-0 sm:inline">Weekend &mdash; good time to reflect</span>}
        </p>
      </div>

      <DailyLoopConnector
        activeStep="review"
        note="Weekly Review is the payoff from what you logged: priorities, visible actions, and private reflections across the week."
      />

      <Card variant="subtle" className="mb-8 border-[var(--border)] bg-[var(--surface-soft)]/70">
        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Why this gets useful
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Plan today, complete one visible action, reflect tonight, then review the week when a few days are logged. Use this page to notice patterns and adjust next week. No AI summaries or external processing.
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
              Log a few tasks, habits, reflections, body or mind check-ins, or manual finance entries this week. This review becomes clearer as private history collects. No shame if the week is quiet.
            </p>
            <Link href="/today" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0">
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

      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">What changed this week</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          A deterministic read on logged days, quiet days, and activity rhythm. Based on logged activity only.
        </p>
        <WeeklyChangeSummary summary={weeklyChangeSummary} />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Compared with last week</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          A bounded comparison between this week and the previous week. Based on logged activity only.
        </p>
        <WeeklyComparison summary={weeklyComparison} loading={comparisonLoading} />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Weekly rhythm and trends</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Daily bars and strips show what changed across the week. This is based only on logged activity from this week.
        </p>
        <div className="space-y-3">
          <WeeklyRhythmChart rows={data.rhythmByDay} />
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <DailyActionBars rows={data.rhythmByDay} />
            <ReflectionRhythm rows={data.rhythmByDay} />
          </div>
          <MindTrendStrip rows={data.mindByDay} />
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

      {/* ── Close The Week ─────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Close the week</h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Turn this manual review into one small focus, save it to your private Journal, then return to Today when you are ready.
        </p>
        <PulseCard title="Turn this review into next week" accent="accent">
          <div className="space-y-5 p-3.5 sm:p-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3 py-3 text-xs leading-relaxed text-[var(--text-muted)]">
              Use the prompts to capture what changed, what to carry forward, what to reduce, and one focus to carry into next week. This is a manual review based on what you logged.
            </div>

            <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/10 p-3.5 sm:p-4">
              <ReflectionField
                label="Choose one focus to carry into next week"
                value={reflection.focusNextWeek}
                onChange={(v) => updateReflectionField("focusNextWeek", v)}
                placeholder="Keep it small enough to remember."
              />
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
                This saves with the weekly review note. It is a note for you, not an automatic task.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ReflectionField
                label="What changed this week?"
                value={reflection.wentWell}
                onChange={(v) => updateReflectionField("wentWell", v)}
                placeholder="Name what stood out from the week."
              />
              <ReflectionField
                label="What felt difficult?"
                value={reflection.feltDifficult}
                onChange={(v) => updateReflectionField("feltDifficult", v)}
              />
              <ReflectionField
                label="What can I reduce or avoid?"
                value={reflection.reduceOrAvoid}
                onChange={(v) => updateReflectionField("reduceOrAvoid", v)}
              />
              <ReflectionField
                label="What is one win I want to remember?"
                value={reflection.oneWin}
                onChange={(v) => updateReflectionField("oneWin", v)}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3.5 sm:p-4">
              <label htmlFor={planFocusId} className="mb-1.5 block break-words text-xs font-medium text-[var(--text)]">Small focus note for this screen</label>
              <p className="mb-2 text-[10px] leading-relaxed text-[var(--text-muted)]">A private planning note while this page is open. It does not create a task, habit, goal, or new saved field.</p>
              <input
                id={planFocusId}
                type="text"
                value={planFocus}
                onChange={(e) => setPlanFocus(e.target.value)}
                placeholder="One thing to remember next week"
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">Save this review to today&apos;s private Journal entry.</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    Save writes the reflection prompts above into Journal with a weekly review prefix. You can return to it from Journal. No AI summaries or external processing.
                  </p>
                </div>
                <button
                  onClick={handleSaveReflection}
                  disabled={savingReflection || Object.values(reflection).every((v) => !v)}
                  className="min-h-11 w-full shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
                >
                  {savingReflection ? "Saving..." : "Save to Journal"}
                </button>
              </div>

              {reviewSaved && (
                <div className="mt-3 rounded-xl border border-[var(--success)]/20 bg-[var(--success-soft)]/10 px-3 py-3 text-xs text-[var(--text-muted)]">
                  <p className="font-semibold text-[var(--success)]">Weekly review saved to Journal.</p>
                  <p className="mt-1 leading-relaxed">Next: return to Today when you are ready, or open Journal to review the saved entry.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Link href="/today" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
                      Return to Today
                    </Link>
                    <Link href="/journal" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] px-3 font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">
                      Open Journal
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-dashed border-[var(--border)] bg-black/[0.08] p-3.5 sm:p-4">
              <p className="mb-2 text-xs font-medium text-[var(--text)]">Optional follow-up paths</p>
              <div className="space-y-1.5">
                {nextActions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text)]"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                    <span className="min-w-0 break-words">{action.text}</span>
                  </Link>
                ))}
                {nextActions.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">No optional prompts right now.</p>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link href="/today" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:bg-transparent">
                  Return to Today
                </Link>
                <Link href="/journal" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">
                  Open Journal
                </Link>
              </div>
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
          <span className="min-w-0 break-words text-xs text-[var(--text-muted)]">Review optional prompts &rarr;</span>
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

function WeeklyChangeSummary({ summary }: { summary: WeeklyChangeSummaryData | null }) {
  if (!summary) return null;

  return (
    <Card className="min-w-0 overflow-hidden border-[var(--border)] bg-[linear-gradient(180deg,rgba(244,247,251,0.035),rgba(244,247,251,0.01)),var(--surface)]">
      {summary.isQuiet && (
        <div className="border-b border-[var(--border)] bg-black/[0.08] px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-[var(--text)]">This week is still quiet.</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            A few tasks, habits, or reflections will make this review clearer. No judgment - quiet weeks still count.
          </p>
        </div>
      )}
      <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-5">
        {summary.items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-2 break-words text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">{item.value}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{item.detail}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-[var(--border)] px-4 py-3 text-[10px] leading-relaxed text-[var(--text-muted)] sm:px-5">
        Private weekly context from your logged activity. No AI summaries or external processing.
      </p>
    </Card>
  );
}

function WeeklyComparison({ summary, loading }: { summary: WeeklyComparisonData | null; loading: boolean }) {
  if (loading) {
    return (
      <Card className="min-w-0 p-4 sm:p-5">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 rounded-xl bg-[var(--surface-soft)]" />
          ))}
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="min-w-0 border-dashed border-[var(--border)] bg-black/[0.08] p-4 text-center sm:p-5">
        <p className="text-sm font-semibold text-[var(--text)]">Comparison becomes clearer after another logged week.</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">No judgment - quiet weeks still count.</p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden border-[var(--border)] bg-[var(--surface)]">
      {summary.isSparse && (
        <div className="border-b border-[var(--border)] bg-black/[0.08] px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-[var(--text)]">Comparison becomes clearer after another logged week.</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">No judgment - quiet weeks still count.</p>
        </div>
      )}
      <div className="divide-y divide-[var(--border)]">
        {summary.rows.map((row) => (
          <div key={row.label} className="grid min-w-0 gap-3 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">{row.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{row.detail}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-44">
              <ComparisonValue label="This week" value={row.current} />
              <ComparisonValue label="Last week" value={row.previous} />
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-[var(--border)] px-4 py-3 text-[10px] leading-relaxed text-[var(--text-muted)] sm:px-5">
        Private manual comparison. No AI summaries or external processing.
      </p>
    </Card>
  );
}

function ComparisonValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center">
      <p className="text-base font-semibold tabular-nums text-[var(--text)]">{value}</p>
      <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function buildWeeklyComparison(data: WeekData, previous: PreviousWeekData): WeeklyComparisonData {
  const currentLoggedDays = data.activityByDay.filter((day) => day.total > 0).length;
  const previousLoggedDays = previous.activityByDay.filter((day) => day.total > 0).length;
  const currentBodyNutrition = data.activityByDay.reduce((sum, day) => sum + day.body + day.nutrition, 0);
  const currentFinanceEntries = data.activityByDay.reduce((sum, day) => sum + day.finance, 0);
  const previousTotal = previous.activityByDay.reduce((sum, day) => sum + day.total, 0);
  const currentTotal = data.activityByDay.reduce((sum, day) => sum + day.total, 0);

  const rows: WeeklyComparisonRow[] = [
    makeComparisonRow("Logged days", currentLoggedDays, previousLoggedDays),
    makeComparisonRow("Habit logs", data.habitCount, previous.habitLogs),
    makeComparisonRow("Completed tasks", data.taskCount, previous.completedTasks),
    makeComparisonRow("Reflections", data.weeklyJournalEntries, previous.reflections),
    makeComparisonRow("Mind check-ins", data.mindCheckins, previous.mindCheckins),
    makeComparisonRow("Manual check-ins", currentBodyNutrition + currentFinanceEntries, previous.bodyNutritionCheckins + previous.financeEntries),
  ];

  return {
    rows,
    isSparse: currentTotal < 3 || previousTotal < 3,
  };
}

function makeComparisonRow(label: string, current: number, previous: number): WeeklyComparisonRow {
  return {
    label,
    current,
    previous,
    detail: formatDifference(current - previous),
  };
}

function formatDifference(diff: number): string {
  if (diff === 0) return "Same as last week.";
  if (diff > 0) return `+${diff} from last week.`;
  return `${Math.abs(diff)} fewer than last week.`;
}

function buildWeeklyChangeSummary(data: WeekData): WeeklyChangeSummaryData {
  const activeDays = data.activityByDay.filter((day) => day.total > 0);
  const quietDays = data.activityByDay.filter((day) => day.total === 0);
  const habitDays = data.activityByDay.filter((day) => day.habits > 0).length;
  const taskDays = data.activityByDay.filter((day) => day.tasks > 0).length;
  const reflectionDays = data.activityByDay.filter((day) => day.reflections > 0).length;
  const mindDays = data.activityByDay.filter((day) => day.mind > 0).length;
  const bodyOrNutritionDays = data.activityByDay.filter((day) => day.body > 0 || day.nutrition > 0).length;
  const financeDays = data.activityByDay.filter((day) => day.finance > 0).length;
  const mostActiveDay = [...data.activityByDay].sort((a, b) => b.total - a.total)[0];
  const isQuiet = activeDays.length <= 1 || data.activityByDay.reduce((sum, day) => sum + day.total, 0) < 3;

  const items: WeeklySummaryItem[] = [
    {
      label: "Logged days",
      value: `${activeDays.length} / 7`,
      detail: `${activeDays.length} day${activeDays.length === 1 ? "" : "s"} had at least one logged signal this week.`,
    },
    {
      label: "Action rhythm",
      value: `${habitDays} habit / ${taskDays} task`,
      detail: `Habits appeared on ${habitDays} day${habitDays === 1 ? "" : "s"}; completed tasks appeared on ${taskDays} day${taskDays === 1 ? "" : "s"}.`,
    },
    {
      label: "Reflection rhythm",
      value: `${reflectionDays} day${reflectionDays === 1 ? "" : "s"}`,
      detail: reflectionDays > 0
        ? `Journal entries appeared on ${reflectionDays} day${reflectionDays === 1 ? "" : "s"}.`
        : "No reflection days were logged in this week window.",
    },
    {
      label: "Manual check-ins",
      value: `${mindDays} mind / ${bodyOrNutritionDays} body`,
      detail: `Mind check-ins appeared on ${mindDays} day${mindDays === 1 ? "" : "s"}; body or nutrition logs appeared on ${bodyOrNutritionDays} day${bodyOrNutritionDays === 1 ? "" : "s"}.`,
    },
    {
      label: "Most active day",
      value: mostActiveDay.total > 0 ? mostActiveDay.label : "-",
      detail: mostActiveDay.total > 0
        ? `${mostActiveDay.label} had ${mostActiveDay.total} logged signal${mostActiveDay.total === 1 ? "" : "s"}, based on logged activity.`
        : "No active day is visible yet from this week window.",
    },
    {
      label: "Quiet days",
      value: `${quietDays.length}`,
      detail: `${quietDays.length} day${quietDays.length === 1 ? "" : "s"} had no logged activity in this review window${financeDays > 0 ? `; finance entries appeared on ${financeDays} day${financeDays === 1 ? "" : "s"}.` : "."}`,
    },
  ];

  return { items, isQuiet };
}

function ReflectionField({
  label,
  value,
  onChange,
  placeholder = "Write a few words, or leave it blank.",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fieldId = useId();

  return (
    <div className="min-w-0">
      <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-[var(--text)]">{label}</label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="min-h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-base leading-relaxed text-[var(--text)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] sm:min-h-24 sm:px-3 sm:py-2.5 sm:text-sm"
      />
    </div>
  );
}

function WeeklyRhythmChart({ rows }: { rows: { label: string; habits: number; tasks: number; reflections: number }[] }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.habits + row.tasks + row.reflections));

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="grid min-w-0 grid-cols-7 items-end gap-2" aria-label="Weekly rhythm chart">
        {rows.map((row) => {
          const total = row.habits + row.tasks + row.reflections;
          const height = Math.max(total > 0 ? 18 : 4, Math.round((total / maxValue) * 104));

          return (
            <div key={row.label} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-28 w-full max-w-8 items-end rounded-full bg-[var(--surface-soft)] p-1 ring-1 ring-inset ring-[var(--border)]">
                <div
                  className="w-full rounded-full bg-gradient-to-t from-[var(--accent)] to-[var(--accent-strong)] transition-all"
                  style={{ height }}
                  title={`${row.label}: ${total} logged actions`}
                />
              </div>
              <span className="text-[9px] font-medium text-[var(--text-muted)]">{row.label}</span>
              <span className="text-[10px] font-semibold text-[var(--text)]">{total}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2 text-[10px] text-[var(--text-muted)] sm:grid-cols-3">
        <span>Habits: checked actions</span>
        <span>Tasks: completed this week</span>
        <span>Reflections: journal entries</span>
      </div>
    </Card>
  );
}

function DailyActionBars({ rows }: { rows: { label: string; habits: number; tasks: number; reflections: number }[] }) {
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.habits, row.tasks]));
  const hasAnyAction = rows.some((row) => row.habits > 0 || row.tasks > 0);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">Daily action mix</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          Habits and completed tasks by day. Logged this week only.
        </p>
      </div>
      {!hasAnyAction ? (
        <TrendEmptyState />
      ) : (
        <div className="space-y-3" aria-label="Daily habit and task completion bars">
          {rows.map((row) => {
            const habitWidth = Math.round((row.habits / maxValue) * 100);
            const taskWidth = Math.round((row.tasks / maxValue) * 100);

            return (
              <div key={row.label} className="grid min-w-0 grid-cols-[2.5rem_1fr_auto] items-center gap-2 text-xs">
                <span className="font-medium text-[var(--text-muted)]">{row.label}</span>
                <div className="min-w-0 space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)] ring-1 ring-inset ring-[var(--border)]">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${habitWidth}%` }} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)] ring-1 ring-inset ring-[var(--border)]">
                    <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${taskWidth}%` }} />
                  </div>
                </div>
                <span className="text-right text-[10px] tabular-nums text-[var(--text-muted)]">
                  {row.habits}h / {row.tasks}t
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" />Habits</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" />Tasks</span>
      </div>
    </Card>
  );
}

function ReflectionRhythm({ rows }: { rows: { label: string; reflections: number }[] }) {
  const reflectionDays = rows.filter((row) => row.reflections > 0).length;

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">Reflection rhythm</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          Which days had private reflection activity. No judgment - quiet weeks still count.
        </p>
      </div>
      <div className="grid grid-cols-7 gap-2" aria-label="Reflection rhythm by day">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 text-center">
            <div
              className={`mx-auto flex h-10 w-full max-w-10 items-center justify-center rounded-2xl border text-xs font-semibold transition-colors ${
                row.reflections > 0
                  ? "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)]"
              }`}
              title={`${row.label}: ${row.reflections} reflection${row.reflections === 1 ? "" : "s"}`}
            >
              {row.reflections > 0 ? row.reflections : "-"}
            </div>
            <p className="mt-1 text-[9px] font-medium text-[var(--text-muted)]">{row.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
        {reflectionDays > 0
          ? `${reflectionDays} day${reflectionDays === 1 ? "" : "s"} with reflection activity.`
          : "This becomes clearer after a few logged reflection days."}
      </p>
    </Card>
  );
}

function MindTrendStrip({ rows }: { rows: MindTrendDay[] }) {
  const hasMindData = rows.some((row) => row.hasEntry);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">Mind trend strip</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Mood, focus, and stress from manual mind check-ins. Patterns from your entries only.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]">
          Private manual review
        </span>
      </div>
      {!hasMindData ? (
        <TrendEmptyState />
      ) : (
        <div className="space-y-4" aria-label="Mind trend strip by day">
          <TrendMetricRow label="Mood" rows={rows} accessor={(row) => row.mood} color="var(--accent)" />
          <TrendMetricRow label="Focus" rows={rows} accessor={(row) => row.focus} color="var(--success)" />
          <TrendMetricRow label="Stress" rows={rows} accessor={(row) => row.stress} color="var(--warning)" />
        </div>
      )}
      <p className="mt-4 text-[10px] leading-relaxed text-[var(--text-muted)]">
        Factual check-in values only. No clinical interpretation, treatment guidance, or AI analysis.
      </p>
    </Card>
  );
}

function TrendMetricRow({
  label,
  rows,
  accessor,
  color,
}: {
  label: string;
  rows: MindTrendDay[];
  accessor: (row: MindTrendDay) => number | null;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-[10px] text-[var(--text-muted)]">1-5 logged value</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {rows.map((row) => {
          const value = accessor(row);
          const height = value === null ? 4 : Math.max(8, Math.round((value / 5) * 44));

          return (
            <div key={`${label}-${row.label}`} className="flex min-w-0 flex-col items-center gap-1.5">
              <div className="flex h-12 w-full max-w-7 items-end rounded-full bg-[var(--surface-soft)] p-1 ring-1 ring-inset ring-[var(--border)]">
                <div
                  className="w-full rounded-full transition-all"
                  style={{ height, backgroundColor: value === null ? "var(--border)" : color, opacity: value === null ? 0.7 : 0.9 }}
                  title={`${row.label}: ${value === null ? "No entry" : `${value}/5`}`}
                />
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">{row.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-black/[0.08] px-4 py-5 text-center">
      <p className="text-sm font-medium text-[var(--text)]">This becomes clearer after a few logged days.</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">No judgment - quiet weeks still count.</p>
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
