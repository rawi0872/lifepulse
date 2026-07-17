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
import { getCurrentStreak, getBestStreak, getWeeklyProgress } from "@/lib/streaks";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        .select("*, realms(name, color, icon)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("realms")
        .select("*")
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
      const habits = habitsRes.data as Habit[];
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
        const dates = logsByHabit[h.id] ?? [];
        sMap[h.id] = getCurrentStreak(dates, h.frequency, h.days_of_week);
        bMap[h.id] = getBestStreak(dates, h.frequency, h.days_of_week);
        wMap[h.id] = getWeeklyProgress(dates, h.frequency, h.times_per_week, weekStart);
      });
      setStreaks(sMap);
      setBestStreaks(bMap);
      setWeeklyProgress(wMap);
    }
    if (realmsRes.data) setRealms(realmsRes.data as Realm[]);
    if (goalLinksRes.data) setGoalLinks(goalLinksRes.data as GoalLink[]);
    if (goalsRes.data) setLinkedGoals(goalsRes.data as LinkedGoal[]);
    setLoading(false);
  }

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
      const { error: err } = await supabase.from("habits").update(payload).eq("id", editingId);

      if (err) {
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
    const { error: logErr } = await supabase.from("habit_logs").delete().eq("habit_id", id);
    if (logErr) {
      toast({ type: "error", title: "Failed to remove habit data." });
      return;
    }
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) {
      toast({ type: "error", title: "Failed to delete habit." });
      return;
    }
    if (editingId === id) cancelEdit();
    setConfirmingDeleteId(null);
    toast({ type: "success", title: "Habit deleted." });
    await load();
  }

  function toggleDay(d: number) {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  const grouped = realms
    .map((r) => ({
      realm: r,
      habits: habits.filter((h) => h.realm_id === r.id),
    }))
    .filter((g) => g.habits.length > 0);

  const ungrouped = habits.filter(
    (h) => !realms.some((r) => r.id === h.realm_id),
  );

  const frequencyLabel = (h: Habit) => {
    if (h.frequency === "daily") return "Daily";
    if (h.frequency === "weekdays" && h.days_of_week)
      return h.days_of_week.map((d) => DAY_LABELS[d]).join(", ");
    if (h.frequency === "times_per_week")
      return `${h.times_per_week ?? "?"}×/week`;
    return h.frequency;
  };

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

        <DailyLoopConnector
          activeStep="action"
          note="Habits are repeatable visible actions. Start tiny, check off one today, then close the loop from Today&apos;s reflection."
        />

        {habits.length > 0 && habits.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--text-muted)]">
              One small repeatable action is enough. Keep it easy to do today, then use it as your visible action.
            </p>
            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Tiny starters</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {HABIT_TEMPLATES.slice(0, 3).map((tpl) => (
                  <button key={tpl} type="button" onClick={() => applyTemplate(tpl)} className="min-h-10 rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)] sm:min-h-0 sm:py-0.5">
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
              <Link href="/today#daily-execution" className="inline-flex min-h-10 shrink-0 items-center rounded-md py-1 text-[10px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:py-0">
                Return to today&apos;s loop
              </Link>
            </div>
          </div>
        )}

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
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            {`${habits.length} ${habits.length === 1 ? "habit" : "habits"} tracked`} &middot; {todayCompleted.size} completed today
          </p>
        )}

        {grouped.length === 0 && ungrouped.length === 0 ? (
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
          <>
            {grouped.map((g) => (
              <section key={g.realm.id} className="mb-6">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <h3 className="min-w-0 text-sm font-semibold" style={{ color: g.realm.color }}>
                    {g.realm.icon} {g.realm.name}
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">{g.habits.length}</span>
                </div>
                <Card variant="subtle" className="border-[var(--border)]">
                  <div className="p-1 flex flex-col gap-1">
                    {g.habits.map((habit) => {
                      const doneToday = todayCompleted.has(habit.id);
                      const isEditing = editingId === habit.id;
                      const isConfirmingDelete = confirmingDeleteId === habit.id;
                      const s = streaks[habit.id] ?? 0;
                      const b = bestStreaks[habit.id] ?? 0;
                      const wp = weeklyProgress[habit.id];
                      return (
                        <Card
                          key={habit.id}
                          variant={doneToday ? "subtle" : "default"}
                          className={`overflow-hidden transition-all duration-150 ${doneToday ? "border-[var(--success)]/20 bg-[var(--success-soft)]/15" : "hover:border-[var(--border-strong)] hover:bg-[var(--surface-active)] hover:shadow-md hover:shadow-black/10"}`}
                        >
                          <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:py-3">
                            <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                              <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-[10px] transition-all duration-150 sm:h-7 sm:w-7 ${doneToday ? "border-[var(--success)] bg-[var(--success)] text-white shadow-sm shadow-[var(--success)]/15" : "border-[var(--text-muted)]/30 text-transparent"}`}>
                                ✓
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                                  <p className={`min-w-0 flex-1 text-pretty text-sm font-semibold leading-snug ${doneToday ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                                    {habit.title}
                                  </p>
                                  {doneToday && (
                                    <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                                      Done today
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                                <p className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{frequencyLabel(habit)}</p>
                              {habit.frequency !== "times_per_week" ? (
                                s > 0 ? (
                                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">{s}-day streak</span>
                                ) : (
                                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">No streak yet</span>
                                )
                              ) : wp ? (
                                <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">{wp.completed}/{wp.target} this week</span>
                              ) : null}
                              {b > 1 && b > s && (
                                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">Best: {b}</span>
                              )}
                              </div>
                              <p className="mt-1 text-pretty text-[10px] text-[var(--text-muted)]">{getHabitGoalContext(habit.id)}</p>
                              {habit.frequency === "times_per_week" && wp && (
                                <div className="mt-1.5 h-1 w-full max-w-32 overflow-hidden rounded-full bg-[var(--surface)] sm:max-w-24">
                                  <div
                                    className="h-full rounded-full bg-[var(--warning)]/60 transition-all"
                                    style={{ width: `${Math.round((wp.completed / wp.target) * 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                            </div>
                          <div className="flex shrink-0 justify-end gap-1 border-t border-[var(--border)] pt-2 sm:border-t-0 sm:pt-0">
                            <button
                              onClick={() => openEdit(habit)}
                              className="min-h-10 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:py-1"
                              aria-expanded={isEditing}
                            >
                              {isEditing ? "Editing" : "Edit"}
                            </button>
                            <button
                              onClick={() => { if (isEditing) cancelEdit(); setConfirmingDeleteId(habit.id); }}
                              className="min-h-10 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:py-1"
                              aria-expanded={isConfirmingDelete}
                            >
                              Delete
                            </button>
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
                              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This removes the habit from your list.</p>
                              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                                  Cancel
                                </Button>
                                <button onClick={() => remove(habit.id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </Card>
              </section>
            ))}

            {ungrouped.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Other</h3>
                <Card variant="subtle" className="border-[var(--border)]">
                  <div className="p-1 flex flex-col gap-1">
                    {ungrouped.map((habit) => {
                      const isEditing = editingId === habit.id;
                      const isConfirmingDelete = confirmingDeleteId === habit.id;
                      return (
                        <Card key={habit.id} variant="default" className="overflow-hidden transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-active)]">
                          <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-pretty text-sm font-semibold text-[var(--text)]">{habit.title}</p>
                              <p className="mt-1.5 w-fit rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{frequencyLabel(habit)}</p>
                              <p className="mt-1 text-pretty text-[10px] text-[var(--text-muted)]">{getHabitGoalContext(habit.id)}</p>
                            </div>
                            <div className="flex shrink-0 justify-end gap-1 border-t border-[var(--border)] pt-2 sm:border-t-0 sm:pt-0 sm:justify-start">
                              <button
                                onClick={() => openEdit(habit)}
                                className="min-h-10 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:py-1"
                                aria-expanded={isEditing}
                              >
                                {isEditing ? "Editing" : "Edit"}
                              </button>
                              <button
                                onClick={() => { if (isEditing) cancelEdit(); setConfirmingDeleteId(habit.id); }}
                                className="min-h-10 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:py-1"
                                aria-expanded={isConfirmingDelete}
                              >
                                Delete
                              </button>
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
                              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This removes the habit from your list.</p>
                              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                                  Cancel
                                </Button>
                                <button onClick={() => remove(habit.id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </Card>
              </section>
            )}

            {/* Starter routines */}
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
          </>
        )}
      </div>
    </DashboardNav>
  );
}
