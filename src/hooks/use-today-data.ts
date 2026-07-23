"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveIntendedUse } from "@/lib/intendedUse";
import { getTodayDateString, getTodayDayOfWeek, getTodayStartISO, getWeekStartDate } from "@/lib/utils";
import { loadExactXpTotals } from "@/lib/xpTotals";
import { normalizeTodayData } from "@/lib/today/normalize";
import type {
  TodayDataSnapshot,
  TodayDateContext,
  TodayHabit,
  TodayModel,
  TodayProjectTask,
  TodayTask,
} from "@/lib/today/types";

type JoinedRelation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: JoinedRelation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeHabitRows(rows: unknown[]): TodayHabit[] {
  return rows.map((row) => {
    const habit = row as TodayHabit & { realms?: JoinedRelation<TodayHabit["realms"]> };
    return { ...habit, realms: firstRelation(habit.realms) };
  });
}

function normalizeTaskRows(rows: unknown[]): TodayTask[] {
  return rows.map((row) => {
    const task = row as TodayTask & { realms?: JoinedRelation<TodayTask["realms"]>; projects?: JoinedRelation<TodayTask["projects"]> };
    return { ...task, realms: firstRelation(task.realms), projects: firstRelation(task.projects) };
  });
}

function normalizeProjectTaskRows(rows: unknown[]): TodayProjectTask[] {
  return rows.map((row) => {
    const task = row as TodayProjectTask & { realms?: JoinedRelation<TodayProjectTask["realms"]>; projects?: JoinedRelation<TodayProjectTask["projects"]> };
    return { ...task, realms: firstRelation(task.realms), projects: firstRelation(task.projects) };
  });
}

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function buildTodayDateContext(): TodayDateContext {
  const localDate = getTodayDateString();
  return {
    localDate,
    displayDate: new Date(`${localDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    dayStart: toLocalDateBoundaryIso(localDate, "start"),
    dayEnd: toLocalDateBoundaryIso(localDate, "end"),
    dayOfWeek: getTodayDayOfWeek(),
    weekStart: getWeekStartDate(),
  };
}

function msUntilNextLocalDate(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  const delay = nextMidnight.getTime() - now.getTime();
  return Math.max(1_000, Math.min(delay, 24 * 60 * 60 * 1_000 + 60_000));
}

function normalizeWithStatus(snapshot: TodayDataSnapshot, date: TodayDateContext, userId: string): TodayModel {
  const model = normalizeTodayData(snapshot, date);
  return {
    ...model,
    status: {
      ...model.status,
      userId,
    },
  };
}

export function useTodayData(supabase: SupabaseClient) {
  const router = useRouter();
  const requestSeq = useRef(0);
  const snapshotRef = useRef<TodayDataSnapshot | null>(null);
  const dateRef = useRef<TodayDateContext>(buildTodayDateContext());
  const userIdRef = useRef<string | null>(null);
  const [model, setModel] = useState<TodayModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: TodayDataSnapshot, date: TodayDateContext, userId: string) => {
    snapshotRef.current = snapshot;
    dateRef.current = date;
    userIdRef.current = userId;
    setModel(normalizeWithStatus(snapshot, date, userId));
  }, []);

  const updateSnapshot = useCallback((updater: (snapshot: TodayDataSnapshot) => TodayDataSnapshot) => {
    const current = snapshotRef.current;
    const userId = userIdRef.current;
    if (!current || !userId) return;
    applySnapshot(updater(current), dateRef.current, userId);
  }, [applySnapshot]);

  const loadTodayData = useCallback(async () => {
    const seq = ++requestSeq.current;
    const date = buildTodayDateContext();
    setLoading(!snapshotRef.current);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (seq !== requestSeq.current) return;
      if (!user) {
        snapshotRef.current = null;
        userIdRef.current = null;
        setModel(null);
        router.push("/login");
        return;
      }

      const [
        profileRes,
        habitsRes,
        tasksRes,
        journalRes,
        weekLogsRes,
        xpTotals,
        projectTasksRes,
        taskProjectsRes,
        taskGoalLinksRes,
        taskGoalsRes,
        goalMilestonesRes,
        goalLinksRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("intended_use")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("habits")
          .select("id, title, description, frequency, days_of_week, times_per_week, realms(name, color, icon)")
          .eq("user_id", user.id),
        supabase
          .from("tasks")
          .select("id, title, description, priority, due_date, status, completed_at, project_id, realms(name, color, icon), projects(title)")
          .eq("user_id", user.id)
          .or(`due_date.eq.${date.localDate},and(due_date.lt.${date.localDate},status.eq.todo),and(due_date.is.null,status.eq.todo)`)
          .order("due_date", { ascending: true }),
        supabase
          .from("journal_entries")
          .select("id")
          .eq("user_id", user.id)
          .eq("entry_date", date.localDate)
          .maybeSingle(),
        supabase
          .from("habit_logs")
          .select("habit_id, completed_date")
          .eq("user_id", user.id)
          .gte("completed_date", date.weekStart),
        loadExactXpTotals(supabase, user.id, getTodayStartISO()),
        supabase
          .from("tasks")
          .select("id, title, status, due_date, project_id, projects!inner(title), realms(name, color, icon)")
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
          .select("id, title, status, target_date")
          .eq("user_id", user.id),
        supabase
          .from("goal_milestones")
          .select("goal_id, completed_at")
          .eq("user_id", user.id),
        supabase
          .from("goal_links")
          .select("goal_id, linked_type")
          .eq("user_id", user.id),
      ]);

      if (seq !== requestSeq.current) return;

      const snapshot: TodayDataSnapshot = {
        habits: normalizeHabitRows(habitsRes.data ?? []),
        tasks: normalizeTaskRows(tasksRes.data ?? []),
        weekLogs: (weekLogsRes.data ?? []) as TodayDataSnapshot["weekLogs"],
        todayEntry: journalRes.data ?? null,
        projectTasks: normalizeProjectTaskRows(projectTasksRes.data ?? []),
        taskProjects: (taskProjectsRes.data ?? []) as TodayDataSnapshot["taskProjects"],
        taskGoalLinks: (taskGoalLinksRes.data ?? []) as TodayDataSnapshot["taskGoalLinks"],
        linkedGoals: (taskGoalsRes.data ?? []) as TodayDataSnapshot["linkedGoals"],
        goalPreviewMilestones: (goalMilestonesRes.data ?? []) as TodayDataSnapshot["goalPreviewMilestones"],
        goalPreviewLinks: (goalLinksRes.data ?? []) as TodayDataSnapshot["goalPreviewLinks"],
        todayXp: xpTotals.todayXp,
        totalXp: xpTotals.totalXp,
        intendedUse: resolveIntendedUse(profileRes.data?.intended_use),
      };

      applySnapshot(snapshot, date, user.id);
    } catch {
      if (seq !== requestSeq.current) return;
      setError("Failed to load dashboard.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [applySnapshot, router, supabase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await loadTodayData();
      if (cancelled) requestSeq.current += 1;
    };
    load();
    return () => {
      cancelled = true;
      requestSeq.current += 1;
    };
  }, [loadTodayData]);

  useEffect(() => {
    let timeoutId: number;
    const scheduleRolloverCheck = () => {
      timeoutId = window.setTimeout(() => {
        if (dateRef.current.localDate !== getTodayDateString()) {
          loadTodayData();
        }
        scheduleRolloverCheck();
      }, msUntilNextLocalDate());
    };

    scheduleRolloverCheck();
    return () => window.clearTimeout(timeoutId);
  }, [loadTodayData]);

  const actions = useMemo(() => ({
    refresh: loadTodayData,
    setTasks(updater: (tasks: TodayTask[]) => TodayTask[]) {
      updateSnapshot((snapshot) => ({ ...snapshot, tasks: updater(snapshot.tasks) }));
    },
    setProjectTasks(updater: (tasks: TodayProjectTask[]) => TodayProjectTask[]) {
      updateSnapshot((snapshot) => ({ ...snapshot, projectTasks: updater(snapshot.projectTasks) }));
    },
    setHabitCompleted(habitId: string, completed: boolean) {
      updateSnapshot((snapshot) => {
        const withoutTodayLog = snapshot.weekLogs.filter((log) => !(log.habit_id === habitId && log.completed_date === dateRef.current.localDate));
        const weekLogs = completed
          ? [...withoutTodayLog, { habit_id: habitId, completed_date: dateRef.current.localDate }]
          : withoutTodayLog;
        return { ...snapshot, weekLogs };
      });
    },
    adjustXp(todayDelta: number, totalDelta: number) {
      updateSnapshot((snapshot) => ({
        ...snapshot,
        todayXp: Math.max(0, snapshot.todayXp + todayDelta),
        totalXp: Math.max(0, snapshot.totalXp + totalDelta),
      }));
    },
  }), [loadTodayData, updateSnapshot]);

  return {
    model,
    loading,
    error,
    userId: model?.status.userId ?? null,
    ...actions,
  };
}
