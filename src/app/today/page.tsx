"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getTodayDateString,
  getWeekStartDate,
  getTodayStartISO,
  getTodayDayOfWeek,
} from "@/lib/utils";
import { getCurrentStreak, getWeeklyProgress } from "@/lib/streaks";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { DashboardNav } from "@/components/DashboardNav";
import { JournalSection } from "@/components/JournalSection";
import { XpDisplay } from "@/components/XpDisplay";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/ui/section-header";
import { TodaysPulseHeader } from "@/components/today/TodaysPulseHeader";
import { CommandStrip } from "@/components/today/CommandStrip";
import { MissionControl } from "@/components/today/MissionControl";
import { BodyPulseSection } from "@/components/today/BodyPulseSection";
import { MindPulseSection } from "@/components/today/MindPulseSection";
import { FinanceOverview } from "@/components/today/FinanceOverview";

interface RealmInfo {
  name: string;
  color: string;
  icon: string;
}

interface Habit {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  days_of_week: number[] | null;
  times_per_week: number | null;
  realms: RealmInfo | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  realms: RealmInfo | null;
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  project_id: string;
  projects: { title: string } | null;
  realms: RealmInfo | null;
}

let priorityIdCounter = 0;

function TodayContent() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedHabitIds, setCompletedHabitIds] = useState<Set<string>>(new Set());
  const [tpwCounts, setTpwCounts] = useState<Record<string, number>>({});
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [weeklyProgressMap, setWeeklyProgressMap] = useState<Record<string, { completed: number; target: number } | null>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayXp, setTodayXp] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [hasJournal, setHasJournal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  interface Priority {
    id: string;
    text: string;
    done: boolean;
  }

  const [priorities, setPriorities] = useState<Priority[]>(() => {
    try {
      const saved = localStorage.getItem("lifepulse_priorities");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.date === getTodayDateString()) return data.items;
      }
      const oldFocus = localStorage.getItem("lifepulse_focus");
      if (oldFocus) {
        const { text, date } = JSON.parse(oldFocus);
        if (date === getTodayDateString() && text) {
          localStorage.removeItem("lifepulse_focus");
          return [{ id: `p${++priorityIdCounter}`, text, done: false }];
        }
      }
    } catch {}
    return [];
  });
  const [priorityInput, setPriorityInput] = useState("");
  const [addingPriority, setAddingPriority] = useState(false);

  const [quickCapture, setQuickCapture] = useState("");
  const [quickType, setQuickType] = useState<"task" | "habit" | "project">("task");
  const [quickSaving, setQuickSaving] = useState(false);


  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [financeNet, setFinanceNet] = useState<number | null>(null);
  const [financeHasTx, setFinanceHasTx] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();
  const todayDow = getTodayDayOfWeek();

  const dueHabits = habits.filter((h) => {
    if (h.frequency === "daily") return true;
    if (h.frequency === "weekdays") {
      return h.days_of_week?.includes(todayDow) ?? false;
    }
    if (h.frequency === "times_per_week") {
      return (tpwCounts[h.id] ?? 0) < (h.times_per_week ?? 1);
    }
    return false;
  });

  const completedHabitCount = dueHabits.filter((h) => completedHabitIds.has(h.id)).length;
  const doneTaskCount = tasks.filter((t) => t.status === "done").length;
  const [suggestedHidden, setSuggestedHidden] = useState(false);
  const todoProjectTasks = projectTasks.filter((t) => t.status === "todo");
  const suggestedTask = !suggestedHidden ? (todoProjectTasks[0] ?? null) : null;

  function savePriorities(items: Priority[]) {
    localStorage.setItem("lifepulse_priorities", JSON.stringify({ date: today, items }));
    setPriorities(items);
  }

  function addPriorityItem() {
    if (!priorityInput.trim() || priorities.length >= 3) return;
    const newItem: Priority = { id: `p${++priorityIdCounter}`, text: priorityInput.trim(), done: false };
    savePriorities([...priorities, newItem]);
    setPriorityInput("");
    setAddingPriority(false);
  }

  function togglePriorityItem(id: string) {
    savePriorities(priorities.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  }

  function removePriorityItem(id: string) {
    savePriorities(priorities.filter((p) => p.id !== id));
  }

  function detectQuickType(text: string): "task" | "habit" | "project" {
    const lower = text.toLowerCase();
    if (/\b(daily|every day|each day|morning routine|night routine|habit)\b/.test(lower)) return "habit";
    if (/\b(project|build|launch|create|develop|make|start)\b/.test(lower)) return "project";
    return "task";
  }

  async function handleQuickCapture() {
    if (!quickCapture.trim() || quickSaving) return;
    setQuickSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const type = quickType;
      let success = false;

      if (type === "task") {
        const { error: err } = await supabase.from("tasks").insert({
          user_id: user.id,
          title: quickCapture.trim(),
          status: "todo",
          priority: "medium",
          due_date: today,
        });
        if (err) { toast({ type: "error", title: "Failed to save task." }); setQuickSaving(false); return; }
        success = true;
      } else if (type === "habit") {
        const { data: realms } = await supabase
          .from("realms")
          .select("id")
          .eq("user_id", user.id)
          .order("sort_order")
          .limit(1);
        const realmId = realms?.[0]?.id ?? "";
        if (!realmId) {
          toast({ type: "error", title: "Create a life area first in Settings." });
          setQuickSaving(false);
          return;
        }
        const { error: err } = await supabase.from("habits").insert({
          user_id: user.id,
          realm_id: realmId,
          title: quickCapture.trim(),
          frequency: "daily",
        });
        if (err) { toast({ type: "error", title: "Failed to save habit." }); setQuickSaving(false); return; }
        success = true;
      } else if (type === "project") {
        const { error: err } = await supabase.from("projects").insert({
          user_id: user.id,
          title: quickCapture.trim(),
          status: "active",
        });
        if (err) { toast({ type: "error", title: "Failed to save project." }); setQuickSaving(false); return; }
        success = true;
      }

      if (success) {
        toast({ type: "success", title: "Quick capture saved!" });
        setQuickCapture("");
        reloadAll();
      }
    } catch {
      toast({ type: "error", title: "Quick capture failed. Try again." });
    }

    setQuickSaving(false);
  }

  function handleQuickChange(text: string) {
    setQuickCapture(text);
    if (text.trim()) {
      setQuickType(detectQuickType(text));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const [profileRes, habitsRes, tasksRes, journalRes, projectTasksRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("first_name")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("habits")
            .select("*, realms(name, color, icon)")
            .eq("user_id", user.id),
          supabase
            .from("tasks")
            .select("*, realms(name, color, icon)")
            .eq("user_id", user.id)
            .or(`due_date.eq.${today},and(due_date.lt.${today},status.eq.todo),and(due_date.is.null,status.eq.todo)`)
            .order("due_date", { ascending: true }),
          supabase
            .from("journal_entries")
            .select("id")
            .eq("user_id", user.id)
            .eq("entry_date", today)
            .maybeSingle(),
          supabase
            .from("tasks")
            .select("*, projects!inner(title), realms(name, color, icon)")
            .eq("user_id", user.id)
            .not("project_id", "is", null)
            .eq("status", "todo")
            .order("due_date", { ascending: true })
            .limit(5),
        ]);

        if (cancelled) return;

        if (profileRes.data) setFirstName(profileRes.data.first_name ?? "");
        if (journalRes.data) setHasJournal(true);
        if (projectTasksRes.data) setProjectTasks(projectTasksRes.data as ProjectTask[]);

        const [allLogsRes, xpRes, totalXpRes] = await Promise.all([
          supabase
            .from("habit_logs")
            .select("habit_id, completed_date")
            .eq("user_id", user.id),
          supabase
            .from("xp_events")
            .select("amount")
            .eq("user_id", user.id)
            .gte("created_at", getTodayStartISO()),
          supabase
            .from("xp_events")
            .select("amount")
            .eq("user_id", user.id),
        ]);

        if (cancelled) return;

        if (habitsRes.data) {
          const habits = habitsRes.data as Habit[];
          setHabits(habits);

          const logsByHabit: Record<string, string[]> = {};
          allLogsRes.data?.forEach((l: { habit_id: string; completed_date: string }) => {
            if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = [];
            logsByHabit[l.habit_id].push(l.completed_date);
          });

          const todayLogs = allLogsRes.data?.filter((l: { completed_date: string }) => l.completed_date === today) ?? [];
          const weekLogs = allLogsRes.data?.filter((l: { completed_date: string }) => l.completed_date >= weekStart) ?? [];

          setCompletedHabitIds(new Set(todayLogs.map((l: { habit_id: string }) => l.habit_id)));

          const counts: Record<string, number> = {};
          weekLogs.forEach((l: { habit_id: string }) => { counts[l.habit_id] = (counts[l.habit_id] ?? 0) + 1; });
          setTpwCounts(counts);

          const sMap: Record<string, number> = {};
          const wMap: Record<string, { completed: number; target: number } | null> = {};
          habits.forEach((h) => {
            const dates = logsByHabit[h.id] ?? [];
            sMap[h.id] = getCurrentStreak(dates, h.frequency, h.days_of_week);
            wMap[h.id] = getWeeklyProgress(dates, h.frequency, h.times_per_week, weekStart);
          });
          setStreakMap(sMap);
          setWeeklyProgressMap(wMap);
        }
        if (tasksRes.data) setTasks(tasksRes.data as Task[]);
        if (xpRes.data) {
          setTodayXp(xpRes.data.reduce((sum, e) => sum + e.amount, 0));
        }
        if (totalXpRes.data) {
          setTotalXp(totalXpRes.data.reduce((sum, e) => sum + e.amount, 0));
        }

        const year = today.slice(0, 4);
        const month = today.slice(5, 7);
        const monthStart = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

        const [incomeRes, expenseRes] = await Promise.all([
          supabase
            .from("finance_transactions")
            .select("amount")
            .eq("user_id", user.id)
            .eq("type", "income")
            .gte("transaction_date", monthStart)
            .lte("transaction_date", monthEnd),
          supabase
            .from("finance_transactions")
            .select("amount")
            .eq("user_id", user.id)
            .eq("type", "expense")
            .gte("transaction_date", monthStart)
            .lte("transaction_date", monthEnd),
        ]);

        if (!cancelled) {
          const income = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
          const expense = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
          setFinanceNet(income - expense);
          setFinanceHasTx((incomeRes.data?.length ?? 0) + (expenseRes.data?.length ?? 0) > 0);
        }
      } catch {
        setError("Failed to load dashboard.");
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [tasksRes, habitsRes, projectTasksRes, allLogsRes, xpRes, totalXpRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, realms(name, color, icon)")
        .eq("user_id", user.id)
        .or(`due_date.eq.${today},and(due_date.lt.${today},status.eq.todo),and(due_date.is.null,status.eq.todo)`)
        .order("due_date", { ascending: true }),
      supabase
        .from("habits")
        .select("*, realms(name, color, icon)")
        .eq("user_id", user.id),
      supabase
        .from("tasks")
        .select("*, projects!inner(title), realms(name, color, icon)")
        .eq("user_id", user.id)
        .not("project_id", "is", null)
        .eq("status", "todo")
        .order("due_date", { ascending: true })
        .limit(5),
      supabase
        .from("habit_logs")
        .select("habit_id, completed_date")
        .eq("user_id", user.id),
      supabase
        .from("xp_events")
        .select("amount")
        .eq("user_id", user.id)
        .gte("created_at", getTodayStartISO()),
      supabase
        .from("xp_events")
        .select("amount")
        .eq("user_id", user.id),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (projectTasksRes.data) setProjectTasks(projectTasksRes.data as ProjectTask[]);

    if (habitsRes.data) {
      const habits = habitsRes.data as Habit[];
      setHabits(habits);

      const logsByHabit: Record<string, string[]> = {};
      allLogsRes.data?.forEach((l: { habit_id: string; completed_date: string }) => {
        if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = [];
        logsByHabit[l.habit_id].push(l.completed_date);
      });

      const todayLogs = allLogsRes.data?.filter((l: { completed_date: string }) => l.completed_date === today) ?? [];
      const weekLogs = allLogsRes.data?.filter((l: { completed_date: string }) => l.completed_date >= weekStart) ?? [];

      setCompletedHabitIds(new Set(todayLogs.map((l: { habit_id: string }) => l.habit_id)));

      const counts: Record<string, number> = {};
      weekLogs.forEach((l: { habit_id: string }) => { counts[l.habit_id] = (counts[l.habit_id] ?? 0) + 1; });
      setTpwCounts(counts);

      const sMap: Record<string, number> = {};
      const wMap: Record<string, { completed: number; target: number } | null> = {};
      habits.forEach((h) => {
        const dates = logsByHabit[h.id] ?? [];
        sMap[h.id] = getCurrentStreak(dates, h.frequency, h.days_of_week);
        wMap[h.id] = getWeeklyProgress(dates, h.frequency, h.times_per_week, weekStart);
      });
      setStreakMap(sMap);
      setWeeklyProgressMap(wMap);
    }

    if (xpRes.data) {
      setTodayXp(xpRes.data.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0));
    }
    if (totalXpRes.data) {
      setTotalXp(totalXpRes.data.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0));
    }

    setSuggestedHidden(false);
  }

  async function toggleHabit(habitId: string, isCompleted: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (isCompleted) {
        const { data: existing } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("habit_id", habitId)
          .eq("completed_date", today)
          .maybeSingle();
        if (existing) return;

        const { data: log, error: logErr } = await supabase
          .from("habit_logs")
          .insert({
            user_id: user.id,
            habit_id: habitId,
            completed_date: today,
          })
          .select()
          .single();

        if (logErr || !log) return;

        await supabase.from("xp_events").insert({
          user_id: user.id,
          source_type: "habit",
          source_id: log.id,
          amount: 10,
        });

        toast({ type: "success", title: "Habit logged!" });
        setCompletedHabitIds(new Set([...completedHabitIds, habitId]));
        setTpwCounts((prev) => ({ ...prev, [habitId]: (prev[habitId] ?? 0) + 1 }));
        setTodayXp((prev) => prev + 10);
        setTotalXp((prev) => prev + 10);
      } else {
        const { data: logs } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("habit_id", habitId)
          .eq("completed_date", today);

        if (logs && logs.length > 0) {
          const logId = logs[0].id;
          await supabase.from("xp_events").delete().match({
            source_type: "habit",
            source_id: logId,
            user_id: user.id,
          });
          await supabase.from("habit_logs").delete().eq("id", logId);
        }

        const newSet = new Set(completedHabitIds);
        newSet.delete(habitId);
        setCompletedHabitIds(newSet);
        setTpwCounts((prev) => ({ ...prev, [habitId]: Math.max(0, (prev[habitId] ?? 1) - 1) }));
        setTodayXp((prev) => Math.max(0, prev - 10));
        setTotalXp((prev) => Math.max(0, prev - 10));
      }
    } catch {
      toast({ type: "error", title: "Failed to update habit." });
    }
  }

  async function toggleTask(taskId: string, isDone: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await toggleTaskCompletion(supabase, user.id, taskId, isDone);
    if (!result.success) return;

    if (isDone) {
      toast({ type: "success", title: "Task completed!" });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "done", completed_at: new Date().toISOString() }
            : t,
        ),
      );
      setTodayXp((prev) => prev + 25);
      setTotalXp((prev) => prev + 25);
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "todo", completed_at: null } : t,
        ),
      );
      setTodayXp((prev) => Math.max(0, prev - 25));
      setTotalXp((prev) => Math.max(0, prev - 25));
    }
  }

  async function toggleSuggestedTask(taskId: string, isDone: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await toggleTaskCompletion(supabase, user.id, taskId, isDone);
    if (!result.success) return;

    setProjectTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: isDone ? "done" : "todo" } : t,
      ),
    );
    if (isDone) {
      setTodayXp((prev) => prev + 25);
      setTotalXp((prev) => prev + 25);
    } else {
      setTodayXp((prev) => Math.max(0, prev - 25));
      setTotalXp((prev) => Math.max(0, prev - 25));
    }
  }

  const allDone = completedHabitCount === dueHabits.length && doneTaskCount === tasks.length && dueHabits.length > 0 && tasks.length > 0 && hasJournal;
  const hasContent = habits.length > 0 || tasks.length > 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-8">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-[var(--surface)]" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded-lg bg-[var(--surface)]" />
        </div>
        <div className="mb-8 grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--surface)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-6 h-64 animate-pulse rounded-xl bg-[var(--surface)]" />
            <div className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />
          </div>
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />
            <div className="h-32 animate-pulse rounded-xl bg-[var(--surface)]" />
            <div className="h-52 animate-pulse rounded-xl bg-[var(--surface)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 animate-fade-in">

      <TodaysPulseHeader firstName={firstName} totalXp={totalXp} todayXp={todayXp} />

      {error && (
        <div className="mb-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <CommandStrip
        completedHabitCount={completedHabitCount}
        dueHabitsLength={dueHabits.length}
        doneTaskCount={doneTaskCount}
        tasksLength={tasks.length}
        hasJournal={hasJournal}
        todayXp={todayXp}
        financeNet={financeNet}
        financeHasTx={financeHasTx}
      />

      <MissionControl
        priorities={priorities}
        priorityInput={priorityInput}
        addingPriority={addingPriority}
        quickCapture={quickCapture}
        quickType={quickType}
        quickSaving={quickSaving}
        onPriorityInputChange={setPriorityInput}
        onAddPriority={addPriorityItem}
        onTogglePriority={togglePriorityItem}
        onRemovePriority={removePriorityItem}
        onAddingPriorityChange={setAddingPriority}
        onQuickCaptureChange={handleQuickChange}
        onQuickTypeChange={setQuickType}
        onQuickCapture={handleQuickCapture}
      />

      {/* Next action */}
      {suggestedTask && suggestedTask.projects ? (
        <Card className="mb-4">
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-active)]">
            <button
              onClick={() => toggleSuggestedTask(suggestedTask.id, true)}
              aria-label={`Complete "${suggestedTask.title}"`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--text-muted)]/40 hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)] shadow-sm hover:shadow-[var(--accent)]/10 transition-all cursor-pointer"
            >
              <svg className="h-3 w-3 text-transparent group-hover:text-[var(--accent-strong)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium tracking-wider text-[var(--accent)]">&rarr; Next action</p>
              <p className="text-sm font-medium text-[var(--text)] truncate">{suggestedTask.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)]">From: {suggestedTask.projects.title}</span>
                {suggestedTask.realms && (
                  <span className="text-[10px]" style={{ color: suggestedTask.realms.color }}>
                    {suggestedTask.realms.icon} {suggestedTask.realms.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setSuggestedHidden(true)}
                className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] transition-all"
              >
                Skip
              </button>
              <Link
                href="/projects"
                className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] transition-colors"
              >
                View
              </Link>
            </div>
          </div>
        </Card>
      ) : hasContent ? (
        <Card variant="subtle" className="mb-4 border-dashed border-[var(--border)]">
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-[var(--text-muted)]">No next action</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              No project action waiting.{' '}
              <Link href="/tasks" className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Capture a task
              </Link>
              {' '}or{' '}
              <Link href="/projects" className="text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                create a project plan
              </Link>.
            </p>
          </div>
        </Card>
      ) : null}

      {allDone && (
        <div className="mb-4 flex items-center gap-2 text-xs text-[var(--success)] font-medium">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Day complete &middot; you&apos;re in motion
        </div>
      )}

      {/* Empty state welcome */}
      {!hasContent && (
        <Card variant="elevated" className="mb-6 overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--text)]">Welcome to your Life OS</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              This is your daily command center. Add a habit or task to get started.
            </p>
          </div>
          <div className="flex items-center gap-4 px-5 py-3">
            <Link
              href="/habits"
              className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
            >
              Add a habit &rarr;
            </Link>
            <Link
              href="/tasks"
              className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
            >
              Create a task &rarr;
            </Link>
          </div>
        </Card>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <BodyPulseSection
            dueHabits={dueHabits}
            completedHabitIds={completedHabitIds}
            completedHabitCount={completedHabitCount}
            dueHabitsLength={dueHabits.length}
            streakMap={streakMap}
            weeklyProgressMap={weeklyProgressMap}
            onToggleHabit={toggleHabit}
          />

          <MindPulseSection
            tasks={tasks}
            doneTaskCount={doneTaskCount}
            tasksLength={tasks.length}
            onToggleTask={toggleTask}
          />
        </div>

        <div className="space-y-4">
          <XpDisplay
            totalXp={totalXp}
            todayXp={todayXp}
            dueHabitCount={dueHabits.length}
            completedHabitCount={completedHabitCount}
          />

          <FinanceOverview financeNet={financeNet} financeHasTx={financeHasTx} />

          <SectionHeader label="Evening Reflection" accent="warning" />

          <section>
            <JournalSection
              stats={{
                habitsDone: completedHabitCount,
                habitsTotal: dueHabits.length,
                tasksDone: doneTaskCount,
                tasksTotal: tasks.length,
                xpToday: todayXp,
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
 
export default function TodayPage() {
  return (
    <DashboardNav>
      <TodayContent />
    </DashboardNav>
  );
}
