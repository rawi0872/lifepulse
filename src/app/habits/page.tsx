"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { DailyLoopConnector } from "@/components/DailyLoopConnector";
import { RealmPicker } from "@/components/RealmPicker";
import { SelectPicker } from "@/components/SelectPicker";
import { HelpPopover } from "@/components/HelpPopover";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { getCurrentStreak, getBestStreak, getWeeklyProgress, isHabitDueOnDate, normalizeCompletedDates } from "@/lib/streaks";

interface Realm {
  id: string;
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
  realm_id: string;
  created_at: string;
  realms: Realm | null;
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HABIT_TEMPLATES = [
  "2-minute plank",
  "Read 5 pages",
  "Walk 10 minutes",
  "Practice guitar 10 minutes",
  "No phone in bed",
] as const;

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<LinkedGoal[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [realmId, setRealmId] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [tpw, setTpw] = useState(3);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [bestStreaks, setBestStreaks] = useState<Record<string, number>>({});
  const [weeklyProgress, setWeeklyProgress] = useState<Record<string, { completed: number; target: number } | null>>({});
  const [completedDatesByHabit, setCompletedDatesByHabit] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editingId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`habit-edit-panel-${editingId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [editingId]);

  useEffect(() => {
    if (!confirmingDeleteId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`habit-delete-panel-${confirmingDeleteId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [confirmingDeleteId]);

  async function load() {
    if (cancelledRef.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    if (cancelledRef.current) return;

    const [habitsRes, realmsRes, logsRes, goalLinksRes, goalsRes] = await Promise.all([
      supabase
        .from("habits")
        .select("id, title, description, frequency, days_of_week, times_per_week, realm_id, created_at, realms(id, name, color, icon)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("realms")
        .select("id, name, color, icon")
        .eq("user_id", user.id)
        .order("sort_order"),
      supabase
        .from("habit_logs")
        .select("habit_id, completed_date")
        .eq("user_id", user.id),
      supabase
        .from("goal_links")
        .select("goal_id, linked_type, linked_id")
        .eq("user_id", user.id)
        .eq("linked_type", "habit"),
      supabase
        .from("goals")
        .select("id, title, status")
        .eq("user_id", user.id),
    ]);

    if (cancelledRef.current) return;
    if (habitsRes.data) {
      const habits = habitsRes.data as unknown as Habit[];
      setHabits(habits);

      const logsByHabit: Record<string, string[]> = {};
      logsRes.data?.forEach((l: { habit_id: string; completed_date: string }) => {
        if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = [];
        logsByHabit[l.habit_id].push(l.completed_date);
      });

      const todayLogs = logsRes.data?.filter((l: { completed_date: string }) => l.completed_date === today) ?? [];
      setTodayCompleted(new Set(todayLogs.map((l: { habit_id: string }) => l.habit_id)));

      const sMap: Record<string, number> = {};
      const bMap: Record<string, number> = {};
      const wMap: Record<string, { completed: number; target: number } | null> = {};
      habits.forEach((h) => {
        const dates = normalizeCompletedDates(logsByHabit[h.id] ?? [], today);
        logsByHabit[h.id] = dates;
        sMap[h.id] = getCurrentStreak(dates, h.frequency, h.days_of_week, { asOfDate: today });
        bMap[h.id] = getBestStreak(dates, h.frequency, h.days_of_week, { asOfDate: today });
        wMap[h.id] = getWeeklyProgress(dates, h.frequency, h.times_per_week, weekStart, h.days_of_week, { asOfDate: today });
      });
      setStreaks(sMap);
      setBestStreaks(bMap);
      setWeeklyProgress(wMap);
      setCompletedDatesByHabit(logsByHabit);
    }
    if (realmsRes.data) setRealms(realmsRes.data as Realm[]);
    if (goalLinksRes.data) setGoalLinks(goalLinksRes.data as GoalLink[]);
    if (goalsRes.data) setLinkedGoals(goalsRes.data as LinkedGoal[]);
    setLoading(false);
  }

  useEffect(() => {
    cancelledRef.current = false;
    void Promise.resolve().then(load);
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setTitle("");
    setRealmId(realms[0]?.id ?? "");
    setFrequency("daily");
    setDaysOfWeek([]);
    setTpw(3);
    setEditingId(null);
    setConfirmingDeleteId(null);
  }

  function applyTemplate(template: string) {
    resetForm();
    setTitle(template);
    setShowForm(true);
  }

  function openEdit(h: Habit) {
    setEditingId(h.id);
    setConfirmingDeleteId(null);
    setTitle(h.title);
    setRealmId(h.realm_id);
    setFrequency(h.frequency);
    setDaysOfWeek(h.days_of_week ?? []);
    setTpw(h.times_per_week ?? 3);
    setShowForm(false);
  }

  function cancelEdit() {
    resetForm();
    setShowForm(false);
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !title.trim()) return;

    setSaving(true);

    const payload = {
      user_id: user.id,
      realm_id: realmId || null,
      title: title.trim(),
      frequency,
      days_of_week: frequency === "weekdays" ? daysOfWeek : null,
      times_per_week: frequency === "times_per_week" ? tpw : null,
    };

    if (editingId) {
      const { data: updatedHabit, error: err } = await supabase
        .from("habits")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (err || !updatedHabit) {
        toast({ type: "error", title: "Failed to update habit." });
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from("habits").insert(payload);

      if (err) {
        toast({ type: "error", title: "Failed to create habit." });
        setSaving(false);
        return;
      }
    }

    resetForm();
    setShowForm(false);
    setSaving(false);
    toast({ type: "success", title: editingId ? "Habit updated." : "Habit created." });
    await load();
  }

  async function remove(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: logs, error: loadLogErr } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", id);
    if (loadLogErr) {
      toast({ type: "error", title: "Failed to remove habit data." });
      return;
    }

    const logIds = (logs ?? []).map((log) => log.id).filter(Boolean);
    if (logIds.length > 0) {
      const { error: xpErr } = await supabase
        .from("xp_events")
        .delete()
        .eq("user_id", user.id)
        .eq("source_type", "habit")
        .in("source_id", logIds);
      if (xpErr) {
        toast({ type: "error", title: "Failed to remove habit data." });
        return;
      }
    }

    const { error: logErr } = await supabase
      .from("habit_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("habit_id", id);
    if (logErr) {
      toast({ type: "error", title: "Failed to remove habit data." });
      return;
    }
    const { data: deletedHabit, error } = await supabase
      .from("habits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !deletedHabit) {
      toast({ type: "error", title: "Failed to delete habit." });
      return;
    }
    if (editingId === id) cancelEdit();
    setConfirmingDeleteId(null);
    toast({ type: "success", title: "Habit deleted." });
    await load();
  }

  async function toggleHabit(habitId: string, isCompleted: boolean) {
    if (togglingHabitId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setTogglingHabitId(habitId);
    try {
      if (isCompleted) {
        const { data: existing } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("habit_id", habitId)
          .eq("completed_date", today)
          .maybeSingle();

        if (existing) return;

        const { data: log, error: logErr } = await supabase
          .from("habit_logs")
          .insert({ user_id: user.id, habit_id: habitId, completed_date: today })
          .select()
          .single();

        if (logErr || !log) throw logErr;

        const { error: xpErr } = await supabase.from("xp_events").insert({
          user_id: user.id,
          source_type: "habit",
          source_id: log.id,
          amount: 10,
        });

        if (xpErr) {
          const { error: rollbackErr } = await supabase
            .from("habit_logs")
            .delete()
            .eq("id", log.id)
            .eq("user_id", user.id);
          if (rollbackErr) {
            toast({ type: "error", title: "Habit saved without XP.", description: "Try undoing and checking it again." });
            await load();
            return;
          }
          throw xpErr;
        }

        setTodayCompleted((prev) => new Set([...prev, habitId]));
        toast({ type: "success", title: "Visible action logged", description: "+10 XP added. This habit will appear in your weekly rhythm. Return to Today to reflect." });
      } else {
        const { data: logs } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("habit_id", habitId)
          .eq("completed_date", today);

        if (!logs || logs.length === 0) return;

        const logId = logs[0].id;
        const { error: xpDeleteErr } = await supabase.from("xp_events").delete().match({
            source_type: "habit",
            source_id: logId,
            user_id: user.id,
          });
        if (xpDeleteErr) throw xpDeleteErr;

        const { data: deletedLog, error: logDeleteErr } = await supabase
          .from("habit_logs")
          .delete()
          .eq("id", logId)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();
        if (logDeleteErr || !deletedLog) throw logDeleteErr;

        setTodayCompleted((prev) => {
          const next = new Set(prev);
          next.delete(habitId);
          return next;
        });
        toast({ type: "success", title: "Habit unchecked." });
      }

      await load();
    } catch {
      toast({ type: "error", title: "Failed to update habit." });
    } finally {
      setTogglingHabitId(null);
    }
  }

  function toggleDay(d: number) {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  const frequencyLabel = (h: Habit) => {
    if (h.frequency === "daily") return "Every day";
    if (h.frequency === "weekdays") {
      const days = (h.days_of_week ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
      if (days.length === 0) return "No scheduled days";
      return `Selected days: ${days.map((d) => DAY_LABELS[d]).join(", ")}`;
    }
    if (h.frequency === "weekends") return "Weekends";
    if (h.frequency === "weekly") return "Once per week";
    if (h.frequency === "times_per_week") {
      const target = Number.isFinite(h.times_per_week) ? Math.max(1, Math.min(7, Math.floor(h.times_per_week ?? 1))) : 1;
      return `${target} times per week`;
    }
    return "Schedule needs review";
  };

  const isCompletedToday = (habit: Habit) => todayCompleted.has(habit.id);

  const isDueToday = (habit: Habit) => isHabitDueOnDate(habit, today, completedDatesByHabit[habit.id] ?? []);

  const habitStatusLabel = (habit: Habit) => {
    if (isCompletedToday(habit)) return "Completed today";
    if (isDueToday(habit)) return "Due today";

    const wp = weeklyProgress[habit.id];
    if ((habit.frequency === "times_per_week" || habit.frequency === "weekly") && wp && wp.completed >= wp.target) {
      return "Weekly target met";
    }

    if (habit.frequency === "weekdays" && (habit.days_of_week ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).length === 0) {
      return "Schedule needs review";
    }

    if (habit.frequency === "daily") return "Available tomorrow";
    if (habit.frequency === "weekdays" || habit.frequency === "weekends") return "Not scheduled today";
    return "Schedule needs review";
  };

  const dueTodayHabits = useMemo(
    () => habits.filter((habit) => !todayCompleted.has(habit.id) && isHabitDueOnDate(habit, today, completedDatesByHabit[habit.id] ?? [])),
    [completedDatesByHabit, habits, today, todayCompleted],
  );

  const completedTodayHabits = useMemo(
    () => habits.filter((habit) => todayCompleted.has(habit.id)),
    [habits, todayCompleted],
  );

  const otherActiveHabits = useMemo(
    () => habits.filter((habit) => !dueTodayHabits.some((due) => due.id === habit.id) && !todayCompleted.has(habit.id)),
    [dueTodayHabits, habits, todayCompleted],
  );

  const goalsById = useMemo(() => {
    return linkedGoals.reduce<Record<string, LinkedGoal>>((map, goal) => {
      map[goal.id] = goal;
      return map;
    }, {});
  }, [linkedGoals]);

  const goalsByHabitId = useMemo(() => {
    return goalLinks.reduce<Record<string, LinkedGoal[]>>((map, link) => {
      if (link.linked_type !== "habit") return map;
      const goal = goalsById[link.goal_id];
      if (!goal) return map;
      if (!map[link.linked_id]) map[link.linked_id] = [];
      map[link.linked_id].push(goal);
      return map;
    }, {});
  }, [goalLinks, goalsById]);

  const getHabitGoalContext = (habitId: string) => {
    const goals = goalsByHabitId[habitId] ?? [];
    if (goals.length === 0) return "No linked goals yet";

    const activeGoals = goals.filter((goal) => goal.status === "active");
    const displayGoals = activeGoals.length > 0 ? activeGoals : goals;
    const goalTitles = displayGoals.slice(0, 2).map((goal) => goal.title).join(" · ");
    const remainingCount = displayGoals.length - 2;

    if (displayGoals.length === 1) return `Goal: ${goalTitles}`;
    if (goalTitles) return `Supports goals: ${goalTitles}${remainingCount > 0 ? ` +${remainingCount}` : ""}`;
    return `Supports: ${goals.length} goals`;
  };

  const habitFormFields = (
    <>
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Habit title"
        maxLength={100}
      />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Realm</label>
        <RealmPicker
          realms={realms}
          value={realmId}
          onChange={setRealmId}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Frequency</label>
        <SelectPicker
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekdays", label: "Specific days" },
            { value: "times_per_week", label: "Times per week" },
          ]}
          value={frequency}
          onChange={setFrequency}
        />
      </div>

      {frequency === "weekdays" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Days of week</label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`h-9 w-10 rounded-lg text-xs font-medium transition-all duration-150 ${
                  daysOfWeek.includes(i)
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                    : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {frequency === "times_per_week" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Times per week: {tpw}
          </label>
          <input
            type="range"
            min={1}
            max={7}
            value={tpw}
            onChange={(e) => setTpw(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </>
  );

  const renderHabitCard = (habit: Habit, section: "due" | "completed" | "other") => {
    const doneToday = isCompletedToday(habit);
    const isEditing = editingId === habit.id;
    const isConfirmingDelete = confirmingDeleteId === habit.id;
    const streak = streaks[habit.id] ?? 0;
    const best = bestStreaks[habit.id] ?? 0;
    const wp = weeklyProgress[habit.id];
    const realm = realms.find((r) => r.id === habit.realm_id);
    const pending = togglingHabitId === habit.id;
    const canShowStreak = habit.frequency === "daily" || habit.frequency === "weekdays" || habit.frequency === "weekends" || habit.frequency === "weekly";
    const progressPercent = wp && wp.target > 0 ? Math.min(100, Math.round((wp.completed / wp.target) * 100)) : null;

    return (
      <Card
        key={habit.id}
        variant={section === "due" ? "default" : "subtle"}
        className={`overflow-hidden transition-all duration-150 ${section === "due" ? "border-[var(--accent)]/30 bg-[var(--surface-raised)]" : "border-[var(--border)]"}`}
      >
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${doneToday ? "bg-[var(--success-soft)] text-[var(--success)]" : section === "due" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)] text-[var(--text-muted)]"}`}>
                {habitStatusLabel(habit)}
              </span>
              {realm && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {realm.icon} {realm.name}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-pretty text-base font-semibold leading-snug text-[var(--text)] sm:text-sm">
              {habit.title}
            </h3>
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                {frequencyLabel(habit)}
              </span>
              {canShowStreak && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Current streak: {streak}
                </span>
              )}
              {canShowStreak && best > 0 && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Best streak: {best}
                </span>
              )}
              {wp && (
                <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                  This week: {wp.completed}/{wp.target}
                </span>
              )}
            </div>
            {wp && progressPercent !== null && (
              <div className="mt-2 max-w-48">
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]" aria-hidden="true">
                  <div className="h-full rounded-full bg-[var(--warning)]/70 transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}
            <p className="mt-2 text-pretty text-[10px] leading-relaxed text-[var(--text-muted)]">{getHabitGoalContext(habit.id)}</p>
            {doneToday && (
              <div className="mt-2 flex min-w-0 flex-col gap-1 text-[10px] leading-relaxed text-[var(--text-muted)] sm:flex-row sm:items-center sm:gap-2">
                <span>Completed on today&apos;s local date.</span>
                <Link href="/today#evening-reflection" className="font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
                  Reflect from Today &rarr;
                </Link>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2 border-t border-[var(--border)] pt-3 sm:w-36 sm:border-t-0 sm:pt-0">
            <button
              type="button"
              onClick={() => toggleHabit(habit.id, !doneToday)}
              disabled={pending}
              aria-label={`${doneToday ? "Undo check-in for" : "Check in"} ${habit.title}`}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${doneToday ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]" : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"}`}
            >
              {pending ? "Saving..." : doneToday ? "Undo" : "Check in"}
            </button>
            <div className="flex min-w-0 gap-1">
              <button
                type="button"
                onClick={() => openEdit(habit)}
                className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:min-h-0 sm:py-1.5"
                aria-expanded={isEditing}
                aria-controls={`habit-edit-panel-${habit.id}`}
              >
                {isEditing ? "Editing" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() => { if (isEditing) cancelEdit(); setConfirmingDeleteId(habit.id); }}
                className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:min-h-0 sm:py-1.5"
                aria-expanded={isConfirmingDelete}
                aria-controls={`habit-delete-panel-${habit.id}`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {isEditing && (
          <div id={`habit-edit-panel-${habit.id}`} className="border-t border-[var(--border)] bg-[var(--surface-soft)]/60 px-4 py-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[var(--text)]">Edit this habit</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Changes apply to this habit only. Save or cancel right here.</p>
            </div>
            <div className="flex flex-col gap-4">
              {habitFormFields}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {isConfirmingDelete && (
          <div id={`habit-delete-panel-${habit.id}`} className="border-t border-[var(--border)] bg-[var(--surface-soft)]/70 px-4 py-4">
            <p className="text-sm font-semibold text-[var(--text)]">Delete this habit?</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This removes the habit and its habit log data from your list.</p>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                Cancel
              </Button>
              <button type="button" onClick={() => remove(habit.id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                Delete
              </button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-6">
              <div className="mb-3 h-4 w-24 animate-pulse rounded bg-[var(--surface)]" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="h-14 animate-pulse rounded-xl bg-[var(--surface)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text)]">Habits</h1>
            <div className="text-pretty text-sm text-[var(--text-muted)]">
              Choose one small repeatable action and complete it today to keep the loop alive.
              <HelpPopover title="What is a habit?">
                <p>Habits are repeated actions you track over time. They help you build consistency and identity.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Examples: Practice guitar daily, Drink 3L water, Do plank every morning</p>
                <p className="mt-1.5">Use habits for repeated routines, not one-time tasks.</p>
              </HelpPopover>
            </div>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => { resetForm(); setShowForm(true); }}>
            Add habit
          </Button>
        </div>

        {showForm && !editingId && (
          <Card className="mb-6 border-[var(--border-strong)]">
            <div className="flex flex-col gap-4 p-4">
              {habitFormFields}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {habits.length > 0 && (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
            <p className="text-xs text-[var(--text-muted)]">
              {dueTodayHabits.length} due today &middot; {completedTodayHabits.length} completed today &middot; {habits.length} active total
            </p>
          </div>
        )}

        {habits.length === 0 ? (
          <EmptyState
            eyebrow="First habit"
            title="Start with one small repeatable action."
            message="Habits are repeatable visible actions. Choose something tiny enough to do today and repeat for seven days."
            description="Starter chips only fill the form. You still choose what to save."
            action={(
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add first habit
                </Button>
                <Link href="/today#daily-execution" className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
                  Back to Today
                </Link>
              </div>
            )}
            examples={(
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Tiny repeatable actions</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {HABIT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl}
                      onClick={() => applyTemplate(tpl)}
                      className="min-h-10 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)] sm:min-h-0 sm:py-1.5"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="due-today-heading">
              <div className="mb-3 flex min-w-0 items-end justify-between gap-3">
                <div>
                  <h2 id="due-today-heading" className="text-base font-semibold text-[var(--text)]">Due today</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{dueTodayHabits.length} waiting right now</p>
                </div>
              </div>
              {dueTodayHabits.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {dueTodayHabits.map((habit) => renderHabitCard(habit, "due"))}
                </div>
              ) : (
                <Card variant="subtle" className="border-[var(--border)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--text)]">No habits are waiting right now.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">You can add a small repeatable action or check in a not-due habit if you still did it today.</p>
                </Card>
              )}
            </section>

            {completedTodayHabits.length > 0 && (
              <section aria-labelledby="completed-today-heading">
                <div className="mb-3">
                  <h2 id="completed-today-heading" className="text-sm font-semibold text-[var(--text)]">Completed today</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{completedTodayHabits.length} checked in on today&apos;s local date</p>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {completedTodayHabits.map((habit) => renderHabitCard(habit, "completed"))}
                </div>
              </section>
            )}

            {otherActiveHabits.length > 0 && (
              <section aria-labelledby="other-active-heading">
                <div className="mb-3">
                  <h2 id="other-active-heading" className="text-sm font-semibold text-[var(--text-muted)]">Other active habits</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Not currently waiting, but still manageable here.</p>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {otherActiveHabits.map((habit) => renderHabitCard(habit, "other"))}
                </div>
              </section>
            )}

            <DailyLoopConnector
              activeStep="action"
              note="Habits are repeatable visible actions. Start tiny, check off one today, then close the loop from Today&apos;s reflection."
            />

            <Card variant="subtle" className="border-[var(--border)]">
              <div className="px-4 py-3.5 sm:py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Starter routines</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Pick a template to build a new habit faster.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {HABIT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl}
                      onClick={() => applyTemplate(tpl)}
                      className="min-h-10 rounded-full bg-[var(--surface-soft)] px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text)] hover:ring-1 hover:ring-[var(--accent)]/20 sm:min-h-0 sm:py-1"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardNav>
  );
}
