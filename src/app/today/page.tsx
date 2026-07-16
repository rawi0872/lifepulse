"use client";

import { useState, useEffect, useMemo } from "react";
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
import { NextBestAction } from "@/components/today/NextBestAction";
import { TodayEcosystemStrip } from "@/components/today/TodayEcosystemStrip";
import { resolveIntendedUse, TODAY_COPY, type IntendedUse } from "@/lib/intendedUse";
import { getRecommendedModules } from "@/lib/modules";

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
  project_id: string | null;
  realms: RealmInfo | null;
  projects?: { title: string } | null;
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

interface TaskProjectContext {
  id: string;
  title: string;
  status: string | null;
}

interface GoalLink {
  goal_id: string;
  linked_type: string;
  linked_id: string;
}

interface LinkedGoal {
  id: string;
  title: string;
  status: string | null;
}

interface TodayTaskExecutionContext {
  projectTitle?: string;
  goalContext?: string;
}

function formatGoalContext(goals: LinkedGoal[]): string | undefined {
  if (goals.length === 0) return undefined;

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const displayGoals = activeGoals.length > 0 ? activeGoals : goals;
  const goalTitles = displayGoals.slice(0, 2).map((goal) => goal.title).join(" · ");
  const remainingCount = displayGoals.length - 2;

  if (displayGoals.length === 1) return `Goal: ${goalTitles}`;
  if (goalTitles) return `Supports goals: ${goalTitles}${remainingCount > 0 ? ` +${remainingCount}` : ""}`;
  return `Supports ${goals.length} goals`;
}

let priorityIdCounter = 0;

function TodayContent() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedHabitIds, setCompletedHabitIds] = useState<Set<string>>(new Set());
  const [tpwCounts, setTpwCounts] = useState<Record<string, number>>({});
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [weeklyProgressMap, setWeeklyProgressMap] = useState<Record<string, { completed: number; target: number } | null>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskProjects, setTaskProjects] = useState<TaskProjectContext[]>([]);
  const [taskGoalLinks, setTaskGoalLinks] = useState<GoalLink[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<LinkedGoal[]>([]);
  const [todayXp, setTodayXp] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [intendedUse, setIntendedUse] = useState<IntendedUse>("personal");
  const [hasJournal, setHasJournal] = useState(false);
  const [weeklyKnowledgeItems, setWeeklyKnowledgeItems] = useState(0);
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
  const [bodyLoggedToday, setBodyLoggedToday] = useState(false);
  const [bodyEnergyToday, setBodyEnergyToday] = useState<number | null>(null);
  const [mindLoggedToday, setMindLoggedToday] = useState(false);
  const [mindMoodToday, setMindMoodToday] = useState<number | null>(null);
  const [hasWorkoutThisWeek, setHasWorkoutThisWeek] = useState(true);
  const [hasNutritionToday, setHasNutritionToday] = useState(true);
  const [hasActivePassions, setHasActivePassions] = useState(true);
  const [hasPassionSessionThisWeek, setHasPassionSessionThisWeek] = useState(true);
  const [goalPreviewGoals, setGoalPreviewGoals] = useState<{ id: string; status: string; target_date: string | null }[]>([]);
  const [goalPreviewMilestones, setGoalPreviewMilestones] = useState<{ goal_id: string; completed_at: string | null }[]>([]);
  const [goalPreviewLinks, setGoalPreviewLinks] = useState<{ goal_id: string | null; linked_type: string | null }[]>([]);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();
  const knowledgeWeekStart = toLocalDateBoundaryIso(weekStart, "start");
  const knowledgeWeekEnd = toLocalDateBoundaryIso(today, "end");
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
  const linkedGoalIds = new Set(goalPreviewLinks.map((link) => link.goal_id).filter(Boolean));
  const activeGoalPreviews = goalPreviewGoals.filter((g) => g.status === "active");
  const hasGoalWithoutLinks = activeGoalPreviews.length > 0 && activeGoalPreviews.some((goal) => !linkedGoalIds.has(goal.id));
  const activeGoalIds = new Set(activeGoalPreviews.map((goal) => goal.id));
  const activeGoalLinks = goalPreviewLinks.filter((link) => link.goal_id && activeGoalIds.has(link.goal_id));
  const activeGoalsCount = activeGoalPreviews.length;
  const linkedGoalsCount = new Set(activeGoalLinks.map((link) => link.goal_id).filter(Boolean)).size;
  const unlinkedGoalsCount = activeGoalsCount - linkedGoalsCount;
  const projectLinksCount = activeGoalLinks.filter((link) => link.linked_type === "project").length;
  const taskLinksCount = activeGoalLinks.filter((link) => link.linked_type === "task").length;
  const habitLinksCount = activeGoalLinks.filter((link) => link.linked_type === "habit").length;
  const actionLinksCount = projectLinksCount + taskLinksCount + habitLinksCount;

  const taskProjectsById = useMemo(() => {
    return taskProjects.reduce<Record<string, TaskProjectContext>>((map, project) => {
      map[project.id] = project;
      return map;
    }, {});
  }, [taskProjects]);

  const goalsById = useMemo(() => {
    return linkedGoals.reduce<Record<string, LinkedGoal>>((map, goal) => {
      map[goal.id] = goal;
      return map;
    }, {});
  }, [linkedGoals]);

  const goalsByTaskId = useMemo(() => {
    return taskGoalLinks.reduce<Record<string, LinkedGoal[]>>((map, link) => {
      if (link.linked_type !== "task") return map;
      const goal = goalsById[link.goal_id];
      if (!goal) return map;
      if (!map[link.linked_id]) map[link.linked_id] = [];
      map[link.linked_id].push(goal);
      return map;
    }, {});
  }, [taskGoalLinks, goalsById]);

  const taskExecutionContextById = useMemo(() => {
    return tasks.reduce<Record<string, TodayTaskExecutionContext>>((map, task) => {
      const projectTitle = task.project_id
        ? taskProjectsById[task.project_id]?.title ?? task.projects?.title
        : undefined;
      const goalContext = formatGoalContext(goalsByTaskId[task.id] ?? []);
      if (projectTitle || goalContext) {
        map[task.id] = { projectTitle, goalContext };
      }
      return map;
    }, {});
  }, [tasks, taskProjectsById, goalsByTaskId]);
  const suggestedTaskGoalContext = suggestedTask ? formatGoalContext(goalsByTaskId[suggestedTask.id] ?? []) : undefined;

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

        const [profileRes, habitsRes, tasksRes, journalRes, projectTasksRes, taskProjectsRes, taskGoalLinksRes, taskGoalsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("first_name, intended_use")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("habits")
            .select("*, realms(name, color, icon)")
            .eq("user_id", user.id),
          supabase
            .from("tasks")
            .select("*, realms(name, color, icon), projects(title)")
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
          supabase
            .from("projects")
            .select("id, title, status")
            .eq("user_id", user.id),
          supabase
            .from("goal_links")
            .select("goal_id, linked_type, linked_id")
            .eq("user_id", user.id)
            .eq("linked_type", "task"),
          supabase
            .from("goals")
            .select("id, title, status")
            .eq("user_id", user.id),
        ]);

        if (cancelled) return;

        if (profileRes.data) {
          setFirstName(profileRes.data.first_name ?? "");
          setIntendedUse(resolveIntendedUse(profileRes.data.intended_use));
        }
        if (journalRes.data) setHasJournal(true);
        if (projectTasksRes.data) setProjectTasks(projectTasksRes.data as ProjectTask[]);
        if (taskProjectsRes.data) setTaskProjects(taskProjectsRes.data as TaskProjectContext[]);
        if (taskGoalLinksRes.data) setTaskGoalLinks(taskGoalLinksRes.data as GoalLink[]);
        if (taskGoalsRes.data) setLinkedGoals(taskGoalsRes.data as LinkedGoal[]);

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

        const [bodyRes, mindRes, workoutRes, nutritionRes, passionsRes, sessionsRes, knowledgeWeekRes] = await Promise.all([
          supabase
            .from("body_metrics")
            .select("energy")
            .eq("user_id", user.id)
            .eq("entry_date", today)
            .maybeSingle(),
          supabase
            .from("mind_metrics")
            .select("mood")
            .eq("user_id", user.id)
            .eq("entry_date", today)
            .maybeSingle(),
          supabase
            .from("workouts")
            .select("id")
            .eq("user_id", user.id)
            .gte("workout_date", weekStart),
          supabase
            .from("nutrition_logs")
            .select("id")
            .eq("user_id", user.id)
            .eq("log_date", today),
          supabase
            .from("passions")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active"),
          supabase
            .from("passion_sessions")
            .select("id")
            .eq("user_id", user.id)
            .gte("session_date", weekStart),
          supabase
            .from("knowledge_items")
            .select("id, created_at")
            .eq("user_id", user.id)
            .gte("created_at", knowledgeWeekStart)
            .lte("created_at", knowledgeWeekEnd),
        ]);

        if (!cancelled) {
          if (bodyRes.data) {
            setBodyLoggedToday(true);
            setBodyEnergyToday(bodyRes.data.energy);
          }
          if (mindRes.data) {
            setMindLoggedToday(true);
            setMindMoodToday(mindRes.data.mood);
          }
          setHasWorkoutThisWeek((workoutRes.data ?? []).length > 0);
          setHasNutritionToday((nutritionRes.data ?? []).length > 0);
          setHasActivePassions((passionsRes.data ?? []).length > 0);
          setHasPassionSessionThisWeek((sessionsRes.data ?? []).length > 0);
          setWeeklyKnowledgeItems((knowledgeWeekRes.data ?? []).length);
        }

        const { data: goalData } = await supabase
          .from("goals")
          .select("id, status, target_date")
          .eq("user_id", user.id);
        const { data: goalMsData } = await supabase
          .from("goal_milestones")
          .select("goal_id, completed_at")
          .eq("user_id", user.id);
        const { data: goalLinkData } = await supabase
          .from("goal_links")
          .select("goal_id, linked_type")
          .eq("user_id", user.id);
        if (!cancelled && goalData) {
          setGoalPreviewGoals(goalData);
          if (goalMsData) setGoalPreviewMilestones(goalMsData);
          if (goalLinkData) setGoalPreviewLinks(goalLinkData);
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

    const [tasksRes, habitsRes, projectTasksRes, allLogsRes, xpRes, totalXpRes, taskProjectsRes, taskGoalLinksRes, taskGoalsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, realms(name, color, icon), projects(title)")
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
      supabase
        .from("projects")
        .select("id, title, status")
        .eq("user_id", user.id),
      supabase
        .from("goal_links")
        .select("goal_id, linked_type, linked_id")
        .eq("user_id", user.id)
        .eq("linked_type", "task"),
      supabase
        .from("goals")
        .select("id, title, status")
        .eq("user_id", user.id),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (projectTasksRes.data) setProjectTasks(projectTasksRes.data as ProjectTask[]);
    if (taskProjectsRes.data) setTaskProjects(taskProjectsRes.data as TaskProjectContext[]);
    if (taskGoalLinksRes.data) setTaskGoalLinks(taskGoalLinksRes.data as GoalLink[]);
    if (taskGoalsRes.data) setLinkedGoals(taskGoalsRes.data as LinkedGoal[]);

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

        toast({ type: "success", title: "Habit logged!", description: "+10 XP added to today's momentum." });
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
      toast({ type: "success", title: "Task completed!", description: "+25 XP added to today's momentum." });
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
  const copy = TODAY_COPY[intendedUse];
  const ecosystemModules = getRecommendedModules(intendedUse)
    .filter((module) => module.href && module.status !== "planned")
    .slice(0, 8);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(244,247,251,0.04),rgba(244,247,251,0.01))] p-4 shadow-xl shadow-black/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
            Opening your command center
          </p>
          <h1 className="mt-1 text-xl font-bold text-[var(--text)]">Preparing your day...</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Loading your priorities, habits, and next actions.
          </p>
        </div>
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
          <div className="p-4">
            <div className="mb-3 h-4 w-28 animate-pulse rounded bg-[var(--surface-active)]" />
            <div className="grid gap-2 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]/70" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-44 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
            <div className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          </div>
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
            <div className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-5 animate-fade-in sm:px-5 sm:py-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-4 top-0 -z-10 h-80 rounded-[2rem] bg-[linear-gradient(180deg,rgba(122,162,199,0.08),rgba(11,13,16,0))]" />

      <TodaysPulseHeader firstName={firstName} totalXp={totalXp} todayXp={todayXp} subtitle={copy.subtitle} />

      {error && (
        <div className="mb-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <MissionControl
        priorities={priorities}
        priorityInput={priorityInput}
        addingPriority={addingPriority}
        quickCapture={quickCapture}
        quickType={quickType}
        quickSaving={quickSaving}
        focusPrompt={copy.focusPrompt}
        onPriorityInputChange={setPriorityInput}
        onAddPriority={addPriorityItem}
        onTogglePriority={togglePriorityItem}
        onRemovePriority={removePriorityItem}
        onAddingPriorityChange={setAddingPriority}
        onQuickCaptureChange={handleQuickChange}
        onQuickTypeChange={setQuickType}
        onQuickCapture={handleQuickCapture}
      />

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

      <NextBestAction
        hasBodyLogged={bodyLoggedToday}
        hasMindLogged={mindLoggedToday}
        hasHighPriorityTasks={tasks.some((t) => t.priority === "high" && t.status === "todo")}
        hasGoalWithoutLinks={hasGoalWithoutLinks}
        hasJournalToday={hasJournal}
        hasContent={hasContent}
        hasWorkoutThisWeek={hasWorkoutThisWeek}
        hasNutritionToday={hasNutritionToday}
        hasActivePassions={hasActivePassions}
        hasPassionSessionThisWeek={hasPassionSessionThisWeek}
        dayOfWeek={todayDow}
      />

      {activeGoalsCount > 0 && (
        <Card variant="subtle" className="mb-4 overflow-hidden border-dashed border-[var(--border)] bg-[var(--surface-soft)]/55">
          <div className="border-b border-[var(--border)] px-4 py-3 sm:py-2.5">
            <p className="text-[10px] font-medium tracking-wider text-[var(--text-muted)]">
              Optional goal context
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Later, connect today&apos;s actions to the goals they support.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-0 divide-x divide-y divide-[var(--border)] sm:grid-cols-4 sm:divide-y-0">
            <ExecutionBridgeMetric label="Active goals" value={activeGoalsCount} />
            <ExecutionBridgeMetric label="Goals with action links" value={linkedGoalsCount} />
            <ExecutionBridgeMetric label="Goals without action links" value={unlinkedGoalsCount} />
            <ExecutionBridgeMetric
              label="Action links"
              value={actionLinksCount}
              sub={`${projectLinksCount} projects / ${taskLinksCount} tasks / ${habitLinksCount} habits`}
            />
          </div>
          <div className="border-t border-[var(--border)] px-4 py-3.5 sm:py-3">
            <p className="text-xs text-[var(--text-muted)]">
              {unlinkedGoalsCount > 0
                ? "Some active goals are not connected to projects, tasks, or habits yet."
                : "Your active goals are connected to action."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs sm:mt-2">
              <Link href="/goals" className="rounded-md py-1 text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:py-0">Open Goals</Link>
              <span className="hidden text-[var(--text-muted)] sm:inline">/</span>
              <Link href="/projects" className="rounded-md py-1 text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:py-0">Open Projects</Link>
              <span className="hidden text-[var(--text-muted)] sm:inline">/</span>
              <Link href="/tasks" className="rounded-md py-1 text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:py-0">Open Tasks</Link>
              <span className="hidden text-[var(--text-muted)] sm:inline">/</span>
              <Link href="/habits" className="rounded-md py-1 text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:py-0">Open Habits</Link>
            </div>
          </div>
        </Card>
      )}

      {/* Next action */}
      {suggestedTask && suggestedTask.projects ? (
        <Card className="mb-4 border-[var(--accent)]/20 bg-[var(--surface-raised)]/80">
          <div className="flex flex-col gap-3 px-4 py-3.5 hover:bg-[var(--surface-active)] sm:flex-row sm:items-center sm:py-3">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <button
                onClick={() => toggleSuggestedTask(suggestedTask.id, true)}
                aria-label={`Complete "${suggestedTask.title}"`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--text-muted)]/40 shadow-sm transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)] hover:shadow-[var(--accent)]/10 sm:h-6 sm:w-6"
              >
                <svg className="h-3 w-3 text-transparent transition-colors group-hover:text-[var(--accent-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium tracking-wider text-[var(--accent)]">Project next action</p>
                <p className="text-pretty text-sm font-medium text-[var(--text)]">{suggestedTask.title}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:mt-0.5">
                  <span className="min-w-0 text-[10px] text-[var(--text-muted)]">From: {suggestedTask.projects.title}</span>
                  {suggestedTaskGoalContext && (
                    <span className="min-w-0 text-[10px] text-[var(--accent)]">{suggestedTaskGoalContext}</span>
                  )}
                  {suggestedTask.realms && (
                    <span className="text-[10px]" style={{ color: suggestedTask.realms.color }}>
                      {suggestedTask.realms.icon} {suggestedTask.realms.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1 sm:ml-auto">
              <button
                onClick={() => setSuggestedHidden(true)}
                className="rounded-md px-3 py-2 text-xs text-[var(--text-muted)] transition-all hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:px-2 sm:py-1"
              >
                Skip
              </button>
              <Link
                href="/projects"
                className="rounded-md px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:px-2 sm:py-1"
              >
                View
              </Link>
            </div>
          </div>
        </Card>
      ) : hasContent ? (
        <Card variant="subtle" className="mb-4 border-dashed border-[var(--border)] bg-black/10">
          <div className="px-4 py-3.5 sm:py-3">
            <p className="text-[10px] font-medium text-[var(--text-muted)]">No project action queued</p>
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
          Day complete &middot; visible progress made
        </div>
      )}

      {/* Empty state welcome */}
      {!hasContent && (
        <Card variant="elevated" className="mb-6 overflow-hidden border-[var(--accent)]/20 bg-[linear-gradient(135deg,rgba(244,247,251,0.055),rgba(122,162,199,0.045)),var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">First setup</p>
            <h2 className="mt-1 text-base font-semibold text-[var(--text)]">Start with one daily action.</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {copy.emptyTitle}. Add one task or one habit, then come back tonight to reflect.
            </p>
          </div>
          <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/tasks"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)] sm:min-h-0 sm:bg-transparent sm:px-0 sm:text-[var(--accent)] sm:hover:bg-transparent sm:hover:text-[var(--accent-strong)]"
            >
              Create one task &rarr;
            </Link>
            <Link
              href="/habits"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)] sm:min-h-0 sm:border-0 sm:px-0"
            >
              Add one habit &rarr;
            </Link>
          </div>
          <div className="border-t border-[var(--border)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Simple path
            </p>
            <ol className="mt-2 grid gap-2 text-xs leading-relaxed text-[var(--text-muted)] sm:grid-cols-3">
              <li>1. Set one priority.</li>
              <li>2. Complete one visible action.</li>
              <li>3. Log what happened tonight.</li>
            </ol>
          </div>
        </Card>
      )}

      <div className="mb-3 mt-1 flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Daily execution
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
            Complete one task or habit first. The rest can wait.
            </p>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
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
            taskContextById={taskExecutionContextById}
            onToggleTask={toggleTask}
          />
        </div>

        <div className="min-w-0 space-y-4 lg:pl-1">
          <SectionHeader label="Life Pulse context" />

          <XpDisplay
            totalXp={totalXp}
            todayXp={todayXp}
            dueHabitCount={dueHabits.length}
            completedHabitCount={completedHabitCount}
          />

          <FinanceOverview financeNet={financeNet} financeHasTx={financeHasTx} />

          <Link
            href="/body"
            className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)] sm:flex-nowrap sm:py-2.5"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
            Body Pulse
            {bodyLoggedToday ? (
              <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[9px] text-[var(--success)]">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Logged
                </span>
                {bodyEnergyToday !== null && <span className="text-[var(--text-muted)]">Energy {bodyEnergyToday}/5</span>}
              </span>
            ) : (
              <span className="ml-auto text-[10px] text-[var(--text-muted)]">Log &rarr;</span>
            )}
          </Link>

          <Link
            href="/mind"
            className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)] sm:flex-nowrap sm:py-2.5"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            Mind Pulse
            {mindLoggedToday ? (
              <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[9px] text-[var(--success)]">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Logged
                </span>
                {mindMoodToday !== null && <span className="text-[var(--text-muted)]">Mood {mindMoodToday}/5</span>}
              </span>
            ) : (
              <span className="ml-auto text-[10px] text-[var(--text-muted)]">Log &rarr;</span>
            )}
          </Link>

          <Link
            href="/goals"
            className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)] sm:flex-nowrap sm:py-2.5"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            Goal Pulse
            <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[10px]">
              {(() => {
                const active = goalPreviewGoals.filter((g) => g.status === "active");
                if (active.length === 0) return <span className="text-[var(--text-muted)]">View &rarr;</span>;
                const nearest = active
                  .filter((g) => g.target_date)
                  .sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? ""))[0];
                const goalMsTotal = goalPreviewMilestones.length;
                const goalMsDone = goalPreviewMilestones.filter((m) => m.completed_at).length;
                const msRate = goalMsTotal > 0 ? Math.round(goalMsDone / goalMsTotal * 100) : null;
                return (
                  <>
                    <span className="text-[var(--accent)]">{active.length} active</span>
                    {nearest && <span className="text-[var(--text-muted)]">by {new Date(nearest.target_date!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    {msRate !== null && <span className="text-[var(--text-muted)]">{msRate}%</span>}
                  </>
                );
              })()}
            </span>
          </Link>

          <Link
            href="/passions"
            className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)] sm:py-2.5"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            Passions
            <span className="ml-auto text-[10px] text-[var(--text-muted)]">View &rarr;</span>
          </Link>

          <Card variant="subtle" className="border-[var(--border)]">
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Memory loop</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Later today, capture one reflection and review what matters.
              </p>
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-col items-start justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text)]">Today reflection</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{hasJournal ? "Captured today" : "Not captured yet"}</p>
                  </div>
                  <a href="#evening-reflection" className="shrink-0 rounded-md py-1 text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] sm:py-0">
                    Evening Reflection
                  </a>
                </div>
                <div className="flex flex-col items-start justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text)]">Knowledge this week</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{weeklyKnowledgeItems} items captured this week</p>
                  </div>
                  <Link href="/knowledge" className="shrink-0 rounded-md py-1 text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] sm:py-0">
                    Open Knowledge
                  </Link>
                </div>
                <div className="flex flex-col items-start justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text)]">Weekly memory review</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Review reflections and knowledge from the week.</p>
                  </div>
                  <Link href="/weekly-review" className="shrink-0 rounded-md py-1 text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] sm:py-0">
                    Open Weekly Review
                  </Link>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-[var(--text-muted)]">
                Private manual memory. No AI summaries or external processing.
              </p>
            </div>
          </Card>

          <SectionHeader label="Evening Reflection" accent="warning" />

          <section id="evening-reflection">
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

      <TodayEcosystemStrip modules={ecosystemModules} />
    </div>
  );
}

function ExecutionBridgeMetric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="min-w-0 p-3 text-center">
      <p className="text-lg font-bold text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-pretty text-[var(--text-muted)]">{label}</p>
      {sub && <p className="mt-0.5 break-words text-[9px] text-[var(--text-muted)]">{sub}</p>}
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

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}
