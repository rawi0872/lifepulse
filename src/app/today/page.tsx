"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getTodayDateString,
} from "@/lib/utils";
import { getCurrentStreak, normalizeCompletedDates, toLocalPriority, type TodayPriority } from "@lifepulse/domain";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { DashboardNav } from "@/components/DashboardNav";
import { useToast } from "@/hooks/use-toast";
import { EveningShutdown } from "@/components/today/EveningShutdown";
import { useTodayData } from "@/hooks/use-today-data";
import { recordProductLearningEvent } from "@/lib/product-learning/client";
import { selectMorningPlanFirstAction, type MorningPlanFirstAction } from "@lifepulse/domain";
import { loadPriorities, addPriority, togglePriority, deletePriority } from "@/lib/priorities";
import { executePriorityMigration } from "@/lib/priority-migration";

type TodayTimePeriod = "morning" | "day" | "evening";
type AttentionSeverity = "info" | "attention" | "important";

interface NextronAttentionItem {
  id: string;
  domain: string;
  severity: AttentionSeverity;
  title: string;
  explanation: string;
  evidence: string[];
  route: string;
  bridgePrompt: string;
}

interface NextronAttentionSummary {
  version: "nextron-attention-v1";
  status: "active" | "calm" | "partial";
  localDate: string;
  primary: NextronAttentionItem | null;
  secondary: NextronAttentionItem[];
  calmMessage: string;
  currentFocus: { title: string; detail: string; route: string; bridgePrompt: string } | null;
  meta: { modelCalls: 0; provider: "deterministic"; persisted: false; source: "signals" };
}

function getTodayTimePeriod(): TodayTimePeriod {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "day";
  return "evening";
}

function msUntilNextTimePeriodBoundary(): number {
  const now = new Date();
  const nextBoundary = new Date(now);
  const hour = now.getHours();

  if (hour < 12) {
    nextBoundary.setHours(12, 0, 1, 0);
  } else if (hour < 18) {
    nextBoundary.setHours(18, 0, 1, 0);
  } else {
    nextBoundary.setDate(nextBoundary.getDate() + 1);
    nextBoundary.setHours(0, 0, 1, 0);
  }

  return Math.max(1_000, nextBoundary.getTime() - now.getTime());
}

function TodayContent() {
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});

  const [priorities, setPriorities] = useState<TodayPriority[]>([]);
  const [priorityInput, setPriorityInput] = useState("");
  const [planningOpen, setPlanningOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TodayTimePeriod>(() => getTodayTimePeriod());
  const [attention, setAttention] = useState<NextronAttentionSummary | null>(null);
  const [attentionStatus, setAttentionStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { toast } = useToast();
  const todayData = useTodayData(supabase);

  useEffect(() => {
    void recordProductLearningEvent("today_opened");
  }, []);
  const todayModel = todayData.model;
  const today = todayModel?.date.localDate ?? getTodayDateString();
  const habits = useMemo(() => todayModel?.habits.all ?? [], [todayModel?.habits.all]);
  const dueHabits = useMemo(() => todayModel?.habits.dueToday ?? [], [todayModel?.habits.dueToday]);
  const completedHabitIds = todayModel?.habits.completedIds ?? new Set<string>();
  const completedHabitCount = todayModel?.habits.completedCount ?? 0;
  const weeklyProgressMap = todayModel?.habits.weeklyProgressById ?? {};
  const tasks = useMemo(() => todayModel?.tasks.relevant ?? [], [todayModel?.tasks.relevant]);
  const doneTaskCount = todayModel?.tasks.doneCount ?? 0;
  const hasJournal = todayModel?.reflection.hasReflection ?? false;
  const loading = todayData.loading;
  const error = todayData.error;
  const todayUserId = todayData.userId;
  const taskExecutionContextById = todayModel?.tasks.contextById ?? {};

  async function loadNextronAttention() {
    setAttentionStatus("loading");
    const result = await fetch("/api/nextron/attention").then((res) => res.ok ? res.json() : null).catch(() => null) as { attention?: unknown } | null;
    if (!result || !isNextronAttentionSummary(result.attention)) {
      setAttentionStatus("error");
      return;
    }
    setAttention(result.attention);
    setAttentionStatus("ready");
  }

  useEffect(() => {
    if (!todayUserId) return;
    const timeoutId = window.setTimeout(() => void loadNextronAttention(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [todayUserId]);

  // Load priorities from backend on mount and when today changes — backend-first, safe migration
  useEffect(() => {
    if (!todayUserId) return;
    let cancelled = false;

    void (async () => {
      const result = await executePriorityMigration({
        supabase,
        userId: todayUserId,
        localDate: today,
        localStorage: window.localStorage,
      });
      if (!cancelled) setPriorities(result.priorities);
    })();

    return () => { cancelled = true; };
  }, [todayUserId, today, supabase]);

  async function addPriorityItem() {
    if (!priorityInput.trim() || priorities.length >= 3 || !todayUserId) return;
    setPriorityInput("");
    const created = await addPriority(supabase, todayUserId, today, { text: priorityInput.trim() });
    if (created) {
      const loaded = await loadPriorities(supabase, todayUserId, today);
      setPriorities(loaded);
    }
  }

  async function togglePriorityItem(id: string) {
    const priority = priorities.find(p => p.id === id);
    if (!priority || !todayUserId) return;
    setPriorities(priorities.map(p => p.id === id ? { ...p, done: !p.done } : p));
    await togglePriority(supabase, todayUserId, id, !priority.done);
  }

  async function removePriorityItem(id: string) {
    if (!todayUserId) return;
    setPriorities(priorities.filter(p => p.id !== id));
    await deletePriority(supabase, todayUserId, id);
  }

  useEffect(() => {
    let timeoutId: number;
    const scheduleBoundaryRefresh = () => {
      timeoutId = window.setTimeout(() => {
        setTimePeriod(getTodayTimePeriod());
        scheduleBoundaryRefresh();
      }, msUntilNextTimePeriodBoundary());
    };

    scheduleBoundaryRefresh();
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!todayUserId) return;

    let cancelled = false;

    async function loadHabitStreaks() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.id !== todayUserId) return;

        const { data } = await supabase
          .from("habit_logs")
          .select("habit_id, completed_date")
          .eq("user_id", user.id);

        if (cancelled) return;

        const logsByHabit: Record<string, string[]> = {};
        ((data ?? []) as { habit_id: string; completed_date: string }[]).forEach((log) => {
          if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = [];
          logsByHabit[log.habit_id].push(log.completed_date);
        });

        const nextStreakMap: Record<string, number> = {};
        habits.forEach((habit) => {
          const dates = normalizeCompletedDates(logsByHabit[habit.id] ?? [], today);
          nextStreakMap[habit.id] = getCurrentStreak(dates, habit.frequency, habit.days_of_week, { asOfDate: today });
        });
        setStreakMap(nextStreakMap);
      } catch (secondaryError) {
        console.warn("Failed to load Today habit streaks", secondaryError);
      }
    }

    loadHabitStreaks();
    return () => { cancelled = true; };
  }, [habits, supabase, today, todayUserId]);

  async function reloadAll() {
    await todayData.refresh();
  }

  async function toggleHabit(habitId: string, isCompleted: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
          .insert({
            user_id: user.id,
            habit_id: habitId,
            completed_date: today,
          })
          .select()
          .single();

        if (logErr || !log) return;

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
            await reloadAll();
            return;
          }
          toast({ type: "error", title: "Failed to update habit." });
          return;
        }

        toast({
          type: "success",
          title: "Visible action logged",
          description: "+10 XP added. This habit will appear in your weekly rhythm. Reflect tonight to add context.",
        });
        todayData.setHabitCompleted(habitId, true);
        todayData.adjustXp(10, 10);
        void recordProductLearningEvent("habit_completed");
      } else {
        const { data: logs } = await supabase
          .from("habit_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("habit_id", habitId)
          .eq("completed_date", today);

        if (logs && logs.length > 0) {
          const logId = logs[0].id;
          const { error: xpDeleteErr } = await supabase.from("xp_events").delete().match({
            source_type: "habit",
            source_id: logId,
            user_id: user.id,
          });
          if (xpDeleteErr) { toast({ type: "error", title: "Failed to update habit." }); return; }

          const { error: logDeleteErr } = await supabase
            .from("habit_logs")
            .delete()
            .eq("id", logId)
            .eq("user_id", user.id);
          if (logDeleteErr) { toast({ type: "error", title: "Failed to update habit." }); return; }
        }

        todayData.setHabitCompleted(habitId, false);
        todayData.adjustXp(-10, -10);
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
      toast({
        type: "success",
        title: "Visible action logged",
        description: "+25 XP added. This task will appear in your weekly rhythm. Reflect tonight to add context.",
      });
      todayData.setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "done", completed_at: new Date().toISOString() }
            : t,
        ),
      );
      todayData.adjustXp(25, 25);
      void recordProductLearningEvent("task_completed");
    } else {
      todayData.setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "todo", completed_at: null } : t,
        ),
      );
      todayData.adjustXp(-25, -25);
    }
  }

  const nextAction = todayModel ? selectMorningPlanFirstAction(todayModel, priorities.map(toLocalPriority)) : null;
  const openTasks = tasks.filter((task) => task.status !== "done").filter((task) => task.id !== nextAction?.id).slice(0, 5);
  const openHabits = dueHabits.filter((habit) => !completedHabitIds.has(habit.id)).slice(0, 5);
  const showEvening = timePeriod === "evening" || hasJournal;
  const formattedDate = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const openingToday = loading && !todayModel;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-fade-in sm:px-6 sm:py-9">
      <header className="mb-8 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[var(--text)] sm:text-5xl">Today</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{formattedDate}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPlanningOpen(true)} className="inline-flex min-h-10 items-center rounded-full border border-white/[0.10] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)]">
            Plan day
          </button>
          <Link href="/nextron?subject=today" prefetch className="inline-flex min-h-10 w-fit items-center rounded-full border border-[var(--accent)]/20 px-3 py-2 text-xs font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--accent-strong)]">
            Ask NEXTRON
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <main className="grid gap-8 xl:grid-cols-[minmax(0,1.85fr)_minmax(18rem,0.95fr)] xl:items-start">
        <section id="daily-execution" className="min-w-0 space-y-8" aria-labelledby="up-next-heading">
          <UpNextAction
            action={nextAction}
            loading={openingToday}
            hasTodayPlan={priorities.length > 0}
            completedTodayCount={doneTaskCount + completedHabitCount}
            streakMap={streakMap}
            onPlan={() => setPlanningOpen(true)}
            onComplete={(action) => action.type === "task" ? void toggleTask(action.id, true) : void toggleHabit(action.id, true)}
          />

          <section id="daily-focus" className="min-w-0 border-b border-white/[0.08] pb-6" aria-labelledby="today-focus-heading">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Today&apos;s focus</p>
            <h2 id="today-focus-heading" className="sr-only">Today&apos;s focus</h2>
            {priorities.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {priorities.map((priority, index) => (
                  <li key={priority.id} className="flex min-w-0 items-start gap-3 text-lg leading-snug text-[var(--text)]">
                    <button type="button" onClick={() => togglePriorityItem(priority.id)} className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${priority.done ? "border-[var(--success)] bg-[var(--success)]" : "border-[var(--text-muted)]/45"}`} aria-label={`Toggle ${priority.text}`}>
                      {priority.done && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </button>
                    <span className={`min-w-0 flex-1 break-words ${priority.done ? "text-[var(--text-muted)] line-through" : ""}`}>{index + 1}. {priority.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-4">
                <p className="text-lg text-[var(--text-secondary)]">No priorities planned yet.</p>
                <button type="button" onClick={() => setPlanningOpen(true)} className="mt-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]">Plan today &rarr;</button>
              </div>
            )}
          </section>

          <div>
            <TodayTaskList tasks={openTasks} contextById={taskExecutionContextById} doneCount={doneTaskCount} totalCount={tasks.length} loading={openingToday} onToggle={toggleTask} />
          </div>
        </section>

        <aside className="min-w-0 space-y-8 xl:pt-1">
          <TodayHabitList habits={openHabits} completedCount={completedHabitCount} totalCount={dueHabits.length} weeklyProgressMap={weeklyProgressMap} loading={openingToday} onToggle={toggleHabit} />

          <section aria-labelledby="today-nextron-attention" data-today-nextron-attention="true" className="min-w-0 border-t border-white/[0.08] pt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">NEXTRON</p>
              <button type="button" onClick={() => void loadNextronAttention()} disabled={attentionStatus === "loading"} className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)]">{attentionStatus === "loading" ? "Checking" : "Refresh"}</button>
            </div>
            <h2 id="today-nextron-attention" className="sr-only">NEXTRON insight</h2>
            <TodayNextronInsight attention={attention} status={attentionStatus} />
            <Link href="/nextron?subject=today" prefetch className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]">Ask NEXTRON &rarr;</Link>
          </section>
        </aside>
      </main>

      {planningOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setPlanningOpen(false)} />
          <section className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/[0.08] bg-[linear-gradient(180deg,rgba(244,247,251,0.035),rgba(244,247,251,0)),var(--bg-elevated)] p-5 shadow-2xl shadow-black/40 sm:p-6" aria-labelledby="plan-day-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Plan mode</p>
                <h2 id="plan-day-heading" className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Plan day</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">Set up to three priorities. Close this when you are ready to use Today.</p>
              </div>
              <button type="button" onClick={() => setPlanningOpen(false)} className="rounded-full border border-white/[0.10] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)]">Close</button>
            </div>

            <div className="mt-6 space-y-3">
              {priorities.length > 0 ? priorities.map((priority, index) => (
                <div key={priority.id} className="flex min-w-0 items-center gap-3 border-b border-white/[0.06] pb-3">
                  <span className="text-xs text-[var(--text-muted)]">{index + 1}</span>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-[var(--text)]">{priority.text}</span>
                  <button type="button" onClick={() => removePriorityItem(priority.id)} className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]">Remove</button>
                </div>
              )) : <p className="text-sm text-[var(--text-muted)]">No priorities planned yet.</p>}
            </div>

            {priorities.length < 3 && (
              <div className="mt-5 flex gap-2">
                <input value={priorityInput} onChange={(event) => setPriorityInput(event.target.value.slice(0, 80))} onKeyDown={(event) => { if (event.key === "Enter") addPriorityItem(); }} autoFocus placeholder="Add one priority" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]/50" />
                <button type="button" onClick={addPriorityItem} className="rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[#071018]">Add</button>
              </div>
            )}
          </section>
        </div>
      )}

      {showEvening && todayModel && (
        <EveningShutdown
          model={todayModel}
          supabase={supabase}
          timePeriod={timePeriod}
          onSaved={todayData.refresh}
          onAuthRequired={() => router.push("/login")}
          onSuccess={() => { void recordProductLearningEvent("journal_entry_created"); toast({ type: "success", title: "Evening Shutdown saved." }); }}
          onError={() => toast({ type: "error", title: "Failed to save Evening Shutdown." })}
        />
      )}

    </div>
  );
}

function isNextronAttentionSummary(value: unknown): value is NextronAttentionSummary {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronAttentionSummary>;
  return candidate.version === "nextron-attention-v1"
    && (candidate.status === "active" || candidate.status === "calm" || candidate.status === "partial")
    && typeof candidate.localDate === "string"
    && (candidate.primary === null || isNextronAttentionItem(candidate.primary))
    && Array.isArray(candidate.secondary)
    && candidate.secondary.every(isNextronAttentionItem)
    && typeof candidate.calmMessage === "string"
    && candidate.meta?.modelCalls === 0
    && candidate.meta.provider === "deterministic";
}

function isNextronAttentionItem(value: unknown): value is NextronAttentionItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronAttentionItem>;
  return typeof candidate.id === "string"
    && typeof candidate.domain === "string"
    && (candidate.severity === "info" || candidate.severity === "attention" || candidate.severity === "important")
    && typeof candidate.title === "string"
    && typeof candidate.explanation === "string"
    && Array.isArray(candidate.evidence)
    && candidate.evidence.every((item) => typeof item === "string")
    && typeof candidate.route === "string"
    && ["/today", "/tasks", "/habits", "/projects", "/weekly-review", "/settings"].includes(candidate.route)
    && typeof candidate.bridgePrompt === "string";
}

type TodayTask = {
  id: string;
  title: string;
  status: string;
};

type TodayHabit = {
  id: string;
  title: string;
};

function UpNextAction({ action, loading, hasTodayPlan, completedTodayCount, streakMap, onPlan, onComplete }: { action: MorningPlanFirstAction | null; loading: boolean; hasTodayPlan: boolean; completedTodayCount: number; streakMap: Record<string, number>; onPlan: () => void; onComplete: (action: MorningPlanFirstAction) => void }) {
  const reason = loading ? "Loading current Today data." : action ? upNextReason(action, streakMap) : hasTodayPlan || completedTodayCount > 0 ? "Nothing urgent right now." : "No Today plan yet.";
  const detail = loading ? "Your daily structure is ready; current tasks and habits are resolving." : action ? upNextDetail(action) : hasTodayPlan || completedTodayCount > 0 ? "Your planned work is clear for the moment." : "Set one priority to give Today a clear first move.";

  return (
    <section aria-labelledby="up-next-heading" className="border-y border-white/[0.08] py-5 sm:py-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Up next</p>
            <span className={`h-1.5 w-1.5 rounded-full ${action?.reason === "Overdue" ? "bg-[var(--warning)]" : "bg-[var(--accent)]"}`} aria-hidden="true" />
          </div>
          <h2 id="up-next-heading" className="break-words text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[1.7rem]">
            {loading ? "Preparing next action..." : action?.title ?? (completedTodayCount > 0 ? "Next action complete." : "Nothing urgent right now.")}
          </h2>
          <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{detail}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{reason}</p>
        </div>
        {loading ? null : action ? (
          <button type="button" onClick={() => onComplete(action)} className="inline-flex min-h-10 w-fit shrink-0 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[#071018] transition-colors hover:bg-[var(--accent-strong)]">
            Complete
          </button>
        ) : (
          <button type="button" onClick={onPlan} className="inline-flex min-h-10 w-fit shrink-0 items-center rounded-lg border border-white/[0.10] px-3 text-sm font-medium text-[var(--accent)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)]">
            Plan today &rarr;
          </button>
        )}
      </div>
    </section>
  );
}

function upNextReason(action: MorningPlanFirstAction, streakMap: Record<string, number>): string {
  if (action.type === "habit") return `${streakMap[action.id] ?? 0} day streak · habit due today`;
  if (action.reason === "Top priority") return "Linked to today's first unfinished priority";
  if (action.reason === "Overdue") return action.task.priority === "high" ? "Overdue high-priority work" : "Overdue unfinished work";
  if (action.reason === "Due today") return action.task.priority === "high" ? "Highest-priority task due today" : "Due today";
  return action.task.priority === "high" ? "Next high-priority incomplete task" : "Next relevant incomplete task";
}

function upNextDetail(action: MorningPlanFirstAction): string {
  if (action.type === "habit") return "Keep the rhythm before it becomes an open loop.";
  if (action.context?.projectTitle) return `Project action · ${action.context.projectTitle}`;
  if (action.context?.goalContext) return action.context.goalContext;
  if (action.task.due_date) return action.reason;
  return "Focused task block";
}

function TodayNextronInsight({ attention, status }: { attention: NextronAttentionSummary | null; status: "idle" | "loading" | "ready" | "error" }) {
  const primary = attention?.primary ?? null;
  if (status === "loading" && !attention) return <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">Checking the day...</p>;
  if (status === "error") return <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">NEXTRON is unavailable right now. Today still works.</p>;
  if (!primary) return <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">{attention?.calmMessage ?? "Nothing urgent is competing with your next action."}</p>;
  const bridgePrompt = primary.bridgePrompt;

  function bridgeAttentionPrompt() {
    try {
      sessionStorage.setItem("lifepulse:nextron-bridge", JSON.stringify({ subject: "today", prompt: bridgePrompt, createdAt: Date.now() }));
    } catch {}
  }

  return (
    <Link href="/nextron?subject=today" onClick={bridgeAttentionPrompt} className="mt-3 block text-base leading-relaxed text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]">
      <span className="block font-medium text-[var(--text)]">{primary.title}</span>
      <span className="mt-1 block">{primary.explanation}</span>
    </Link>
  );
}

function TodayTaskList({ tasks, contextById, doneCount, totalCount, loading, onToggle }: { tasks: TodayTask[]; contextById: Record<string, { projectTitle?: string; goalContext?: string }>; doneCount: number; totalCount: number; loading: boolean; onToggle: (taskId: string, isDone: boolean) => void }) {
  return (
    <section aria-labelledby="today-tasks-heading" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2">
        <h2 id="today-tasks-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Tasks</h2>
        <span className="text-xs text-[var(--text-muted)]">{doneCount}/{totalCount}</span>
      </div>
      {loading ? <p className="py-3 text-sm text-[var(--text-muted)]">Loading tasks...</p> : tasks.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {tasks.map((task) => {
            const context = contextById[task.id];
            return (
              <div key={task.id} className="flex min-w-0 items-start gap-3 py-2.5">
                <button type="button" onClick={() => onToggle(task.id, true)} aria-label={`Complete ${task.title}`} className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-[var(--text-muted)]/50 transition-colors hover:border-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-[var(--text)]">{task.title}</p>
                  {(context?.projectTitle || context?.goalContext) && <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{context.projectTitle ?? context.goalContext}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="py-3 text-sm text-[var(--text-muted)]">No tasks for today.</p>}
      <Link href="/tasks" prefetch className="mt-2 inline-flex text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]">View all &rarr;</Link>
    </section>
  );
}

function TodayHabitList({ habits, completedCount, totalCount, weeklyProgressMap, loading, onToggle }: { habits: TodayHabit[]; completedCount: number; totalCount: number; weeklyProgressMap: Record<string, { completed: number; target: number } | null>; loading: boolean; onToggle: (habitId: string, isCompleted: boolean) => void }) {
  return (
    <section aria-labelledby="today-habits-heading" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2">
        <h2 id="today-habits-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Habits</h2>
        <span className="text-xs text-[var(--text-muted)]">{completedCount}/{totalCount}</span>
      </div>
      {loading ? <p className="py-3 text-sm text-[var(--text-muted)]">Loading habits...</p> : habits.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {habits.map((habit) => {
            const weeklyProgress = weeklyProgressMap[habit.id];
            return (
              <div key={habit.id} className="flex min-w-0 items-start gap-3 py-2.5">
                <button type="button" onClick={() => onToggle(habit.id, true)} aria-label={`Complete ${habit.title}`} className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-[var(--text-muted)]/50 transition-colors hover:border-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-[var(--text)]">{habit.title}</p>
                  {weeklyProgress && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{weeklyProgress.completed}/{weeklyProgress.target} this week</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="py-3 text-sm text-[var(--text-muted)]">No habits due today.</p>}
      <Link href="/habits" prefetch className="mt-2 inline-flex text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]">View all &rarr;</Link>
    </section>
  );
}

export default function TodayPage() {
  return (
    <DashboardNav>
      <TodayContent />
    </DashboardNav>
  );
}
