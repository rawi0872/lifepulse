"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { RealmPicker } from "@/components/RealmPicker";
import { SelectPicker } from "@/components/SelectPicker";
import { HelpPopover } from "@/components/HelpPopover";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  "Drink 3L water",
  "Practice guitar",
  "Walk 10 minutes",
  "Study 30 minutes",
  "Journal at night",
  "Morning stretch",
  "Read 20 pages",
  "Meditate 10 minutes",
  "Do plank",
];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<LinkedGoal[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  }

  function applyTemplate(template: string) {
    resetForm();
    setTitle(template);
    setShowForm(true);
  }

  function openEdit(h: Habit) {
    setEditingId(h.id);
    setTitle(h.title);
    setRealmId(h.realm_id);
    setFrequency(h.frequency);
    setDaysOfWeek(h.days_of_week ?? []);
    setTpw(h.times_per_week ?? 3);
    setShowForm(true);
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
    if (!confirm("Delete this habit? This cannot be undone.")) return;
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
              Build the routines your future self depends on.
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

        {habits.length > 0 && habits.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--text-muted)]">
              💡 Consistency compounds. Small daily actions build the routines your future self depends on.
            </p>
          </div>
        )}

        {showForm && (
          <Card className="mb-6 border-[var(--border-strong)]">
            <div className="flex flex-col gap-4 p-4">
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
            {habits.length} habit{habits.length !== 1 ? "s" : ""} tracked
            &middot; {todayCompleted.size} completed today
          </p>
        )}

        {grouped.length === 0 && ungrouped.length === 0 ? (
          <Card variant="subtle" className="border-dashed border-[var(--border)]">
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--text-muted)]">Habits are repeated actions you want to become automatic.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {HABIT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => applyTemplate(tpl)}
                    className="rounded-full bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text)] hover:ring-1 hover:ring-[var(--accent)]/20 sm:py-1.5"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="mt-6"
                onClick={() => { resetForm(); setShowForm(true); }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add habit
              </Button>
            </div>
          </Card>
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
                      const s = streaks[habit.id] ?? 0;
                      const b = bestStreaks[habit.id] ?? 0;
                      const wp = weeklyProgress[habit.id];
                      return (
                        <Card
                          key={habit.id}
                          variant={doneToday ? "subtle" : "default"}
                          className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:py-3 ${doneToday ? "opacity-50" : ""}`}
                        >
                          <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center">
                            {doneToday && (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10 sm:h-5 sm:w-5">
                                ✓
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`text-pretty text-sm font-medium ${doneToday ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                                {habit.title}
                              </p>
                              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 sm:mt-0.5">
                                <p className="text-xs text-[var(--text-muted)]">{frequencyLabel(habit)}</p>
                              {habit.frequency !== "times_per_week" ? (
                                s > 0 ? (
                                  <span className="text-xs text-[var(--accent)]/80">{s}-day streak</span>
                                ) : (
                                  <span className="text-xs text-[var(--text-muted)]">No streak yet</span>
                                )
                              ) : wp ? (
                                <span className="text-xs text-[var(--warning)]/80">{wp.completed}/{wp.target} this week</span>
                              ) : null}
                              {b > 1 && b > s && (
                                <span className="text-xs text-[var(--text-muted)]">Best: {b}</span>
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
                          <div className="flex shrink-0 justify-end gap-1 sm:justify-start">
                            <button
                              onClick={() => openEdit(habit)}
                              className="rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:px-2 sm:py-1"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => remove(habit.id)}
                              className="rounded-lg px-3 py-2 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] sm:px-2 sm:py-1"
                            >
                              Delete
                            </button>
                          </div>
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
                    {ungrouped.map((habit) => (
                      <Card key={habit.id} variant="default" className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-pretty text-sm font-medium text-[var(--text)]">{habit.title}</p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{frequencyLabel(habit)}</p>
                          <p className="mt-1 text-pretty text-[10px] text-[var(--text-muted)]">{getHabitGoalContext(habit.id)}</p>
                        </div>
                        <div className="flex shrink-0 justify-end gap-1 sm:justify-start">
                          <button
                            onClick={() => openEdit(habit)}
                            className="rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] sm:px-2 sm:py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(habit.id)}
                            className="rounded-lg px-3 py-2 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] sm:px-2 sm:py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </Card>
                    ))}
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
                      className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text)] hover:ring-1 hover:ring-[var(--accent)]/20 sm:py-1"
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
