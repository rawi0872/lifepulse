"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_DAILY_PRIORITIES,
  buildPriorityInsert,
  isHabitDueOnDate,
  nextPriorityPosition,
  orderDailyPriorities,
  rankMorningCandidates,
  summarizeDayPlan,
  type MorningCandidate,
  type TodayPriority,
  type WeeklyPlanSnapshot,
} from "@lifepulse/domain";
import {
  addPriority,
  deletePriority,
  loadPriorities,
  logPlanEvent,
  setDailyMustWin,
  togglePriority,
} from "@/lib/priorities";
import { loadWeeklyPlan } from "@/lib/plan";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface TodayPlannerProps {
  supabase: SupabaseClient;
  userId: string;
  localDate: string;
  weekStart: string;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
}

interface HabitRow {
  id: string;
  title: string;
  frequency: string;
  days_of_week: number[] | null;
  times_per_week: number | null;
}

async function toggleHabitCanonical(
  supabase: SupabaseClient,
  userId: string,
  habitId: string,
  localDate: string,
  makeDone: boolean,
): Promise<boolean> {
  if (makeDone) {
    const { data: existing } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("habit_id", habitId)
      .eq("completed_date", localDate)
      .maybeSingle();
    if (existing) return true;
    const { data: log, error: logErr } = await supabase
      .from("habit_logs")
      .insert({ user_id: userId, habit_id: habitId, completed_date: localDate })
      .select()
      .single();
    if (logErr || !log) return false;
    const { error: xpErr } = await supabase.from("xp_events").insert({
      user_id: userId,
      source_type: "habit",
      source_id: log.id,
      amount: 10,
    });
    if (xpErr) {
      await supabase.from("habit_logs").delete().eq("id", log.id).eq("user_id", userId);
      return false;
    }
    return true;
  }
  const { data: logs } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("completed_date", localDate);
  if (logs && logs.length > 0) {
    const logId = logs[0].id;
    const { error: xpDelErr } = await supabase
      .from("xp_events")
      .delete()
      .match({ source_type: "habit", source_id: logId, user_id: userId });
    if (xpDelErr) return false;
    const { error: logDelErr } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", logId)
      .eq("user_id", userId);
    if (logDelErr) return false;
  }
  return true;
}

export function TodayPlanner({ supabase, userId, localDate, weekStart }: TodayPlannerProps) {
  const { toast } = useToast();
  const requestSeq = useRef(0);
  const [priorities, setPriorities] = useState<TodayPriority[]>([]);
  const [snapshot, setSnapshot] = useState<WeeklyPlanSnapshot | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateInput, setCandidateInput] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmedToday, setConfirmedToday] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    const [loadedPriorities, loadedPlan, tasksRes, habitsRes, eventsRes] = await Promise.all([
      loadPriorities(supabase, userId, localDate),
      loadWeeklyPlan(supabase, userId, weekStart),
      supabase.from("tasks").select("id, title, due_date, status, priority").eq("user_id", userId).eq("status", "todo").order("due_date", { ascending: true }).limit(200),
      supabase.from("habits").select("id, title, frequency, days_of_week, times_per_week").eq("user_id", userId).limit(200),
      supabase.from("daily_plan_events").select("event_type").eq("user_id", userId).eq("local_date", localDate).in("event_type", ["morning_plan_confirmed", "midday_reset"]).limit(2),
    ]);
    if (seq !== requestSeq.current) return;
    setPriorities(loadedPriorities);
    setSnapshot(loadedPlan);
    setTasks(((tasksRes.data ?? []) as TaskRow[]));
    setHabits(((habitsRes.data ?? []) as HabitRow[]));
    setConfirmedToday(((eventsRes.data ?? []) as { event_type: string }[]).length > 0);
    setLoading(false);
  }, [supabase, userId, localDate, weekStart]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return () => {
      requestSeq.current += 1;
    };
  }, [refresh]);

  const ordered = useMemo(() => orderDailyPriorities(priorities), [priorities]);
  const summary = useMemo(() => summarizeDayPlan(ordered), [ordered]);
  const weeklyMustWin = useMemo(
    () => snapshot?.outcomes.find((o) => o.must_win)?.text ?? null,
    [snapshot],
  );
  const outcomeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of snapshot?.outcomes ?? []) map.set(o.id, o.text);
    return map;
  }, [snapshot]);

  const candidates: MorningCandidate[] = useMemo(() => {
    const plannedTaskIds = new Set(ordered.filter((p) => p.task_id).map((p) => p.task_id as string));
    const plannedHabitIds = new Set(ordered.filter((p) => p.habit_id).map((p) => p.habit_id as string));
    const plannedOutcomeIds = new Set(ordered.filter((p) => p.outcome_id).map((p) => p.outcome_id as string));
    const habitsDue = habits
      .filter((h) =>
        isHabitDueOnDate(
          { frequency: h.frequency as "daily" | "weekdays" | "weekly", days_of_week: h.days_of_week, times_per_week: h.times_per_week },
          localDate,
        ),
      )
      .map((h) => ({ id: h.id, title: h.title }));
    return rankMorningCandidates({
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status, priority: t.priority })),
      habitsDue,
      outcomes: (snapshot?.outcomes ?? []).map((o) => ({ id: o.id, title: o.text, done: o.done })),
      localDate,
      plannedTaskIds,
      plannedHabitIds,
      plannedOutcomeIds,
    }).slice(0, 8);
  }, [ordered, tasks, habits, snapshot, localDate]);

  async function handleAddCandidate(candidate: MorningCandidate) {
    const position = nextPriorityPosition(ordered);
    if (position === null) {
      toast({ type: "error", title: "Three priorities is the daily maximum." });
      return;
    }
    const created = await addPriority(supabase, userId, localDate, {
      text: candidate.title,
      task_id: candidate.kind === "task" ? candidate.id : null,
      habit_id: candidate.kind === "habit" ? candidate.id : null,
      outcome_id: candidate.kind === "outcome" ? candidate.id : null,
    });
    if (created) {
      await logPlanEvent(supabase, userId, localDate, "priority_added", created.id);
    }
    await refresh();
  }

  async function handleAddText() {
    if (!candidateInput.trim()) return;
    const position = nextPriorityPosition(ordered);
    if (position === null) {
      toast({ type: "error", title: "Three priorities is the daily maximum." });
      return;
    }
    const created = await addPriority(supabase, userId, localDate, { text: candidateInput.trim() });
    if (created) {
      setCandidateInput("");
      await logPlanEvent(supabase, userId, localDate, "priority_added", created.id);
    }
    await refresh();
  }

  async function handleConfirm() {
    const ok = await logPlanEvent(supabase, userId, localDate, "morning_plan_confirmed");
    if (ok) setConfirmedToday(true);
    toast({ type: "success", title: "Today's plan set." });
  }

  async function handleTogglePriority(priority: TodayPriority) {
    setBusyId(priority.id);
    if (priority.task_id) {
      const result = await toggleTaskCompletion(supabase, userId, priority.task_id, !priority.done);
      if (result.success) await togglePriority(supabase, userId, priority.id, !priority.done);
      else toast({ type: "error", title: result.error ?? "Couldn't update." });
    } else if (priority.habit_id) {
      const ok = await toggleHabitCanonical(supabase, userId, priority.habit_id, localDate, !priority.done);
      if (ok) await togglePriority(supabase, userId, priority.id, !priority.done);
      else toast({ type: "error", title: "Couldn't update habit." });
    } else {
      await togglePriority(supabase, userId, priority.id, !priority.done);
    }
    setBusyId(null);
    await refresh();
  }

  async function handleMustWin(priority: TodayPriority) {
    const next = priority.is_must_win ? null : priority.id;
    const ok = await setDailyMustWin(supabase, userId, localDate, next, ordered);
    if (ok && next) await logPlanEvent(supabase, userId, localDate, "must_win_changed", next);
    await refresh();
  }

  async function handleRemove(priority: TodayPriority) {
    await deletePriority(supabase, userId, priority.id);
    await logPlanEvent(supabase, userId, localDate, "priority_removed", null, `removed "${priority.text}"`);
    await refresh();
  }

  async function handleReplace(priority: TodayPriority, candidate: MorningCandidate) {
    await deletePriority(supabase, userId, priority.id);
    const payload = buildPriorityInsert(userId, localDate, priority.position, {
      text: candidate.title,
      task_id: candidate.kind === "task" ? candidate.id : null,
      habit_id: candidate.kind === "habit" ? candidate.id : null,
      outcome_id: candidate.kind === "outcome" ? candidate.id : null,
    });
    if (payload) {
      const { data } = await supabase.from("today_priorities").insert(payload).select("*").single();
      if (data) {
        await logPlanEvent(supabase, userId, localDate, "priority_replaced", (data as { id: string }).id, `replaced "${priority.text}" with "${candidate.title}"`);
      }
    }
    await refresh();
  }

  async function handleMove(priority: TodayPriority, direction: -1 | 1) {
    const target = priority.position + direction;
    if (target < 1 || target > MAX_DAILY_PRIORITIES) return;
    const other = ordered.find((p) => p.position === target);
    if (!other) return;
    // Swap via delete + reinsert (positions are DB-constrained, no temp slot exists).
    const copyOf = (p: TodayPriority, position: number) => ({
      user_id: userId,
      local_date: localDate,
      position,
      text: p.text,
      task_id: p.task_id,
      habit_id: p.habit_id,
      outcome_id: p.outcome_id,
      done: p.done,
      is_must_win: p.is_must_win,
    });
    await supabase.from("today_priorities").delete().eq("id", priority.id).eq("user_id", userId);
    await supabase.from("today_priorities").delete().eq("id", other.id).eq("user_id", userId);
    await supabase.from("today_priorities").insert([
      copyOf(priority, target),
      copyOf(other, priority.position),
    ]);
    await refresh();
  }

  async function handleRebuild() {
    const unfinished = ordered.filter((p) => !p.done);
    for (const priority of unfinished) {
      await deletePriority(supabase, userId, priority.id);
      await logPlanEvent(supabase, userId, localDate, "priority_removed", null, `cleared "${priority.text}"`);
    }
    await logPlanEvent(supabase, userId, localDate, "midday_reset");
    setResetting(false);
    setAdjusting(true);
    await refresh();
    toast({ type: "success", title: "Fresh slate for the rest of today." });
  }

  if (loading) {
    return <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading today's plan...</p>;
  }

  const mustWinPriority = ordered.find((p) => p.is_must_win) ?? null;
  const showPicker = nextPriorityPosition(ordered) !== null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">This week</p>
        {weeklyMustWin ? (
          <p className="mt-1 text-sm text-[var(--text)]"><span className="font-semibold text-[var(--accent)]">Must Win · </span>{weeklyMustWin}</p>
        ) : snapshot ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{snapshot.outcomes.length} outcome{snapshot.outcomes.length === 1 ? "" : "s"} planned this week.</p>
        ) : (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            No weekly plan yet. <Link href="/plan" className="font-medium text-[var(--accent)]">Plan your week</Link> to give today context.
          </p>
        )}
      </Card>

      {mustWinPriority && (
        <Card variant="elevated" className="border-[var(--accent)]/30 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Today&apos;s Must Win</p>
          <p className="mt-1 text-lg font-semibold text-[var(--text)]">{mustWinPriority.text}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{mustWinPriority.done ? "Done. The day has its win." : "If only one thing gets done today, this is it."}</p>
        </Card>
      )}

      {ordered.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {summary.doneCount} of {summary.total} priorities complete
            {summary.total > 0 && summary.doneCount === summary.total ? " · Today's plan complete." : ""}
          </p>
          {!confirmedToday && (
            <Button size="sm" onClick={() => void handleConfirm()}>Confirm today</Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {ordered.map((priority, index) => (
          <Card key={priority.id} className="p-4">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => void handleTogglePriority(priority)}
                disabled={busyId === priority.id}
                aria-label={`Toggle priority ${index + 1}`}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${priority.done ? "border-[var(--success)] bg-[var(--success)]" : "border-[var(--text-muted)]/50 hover:border-[var(--accent)]"}`}
              >
                {priority.done && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`break-words text-base font-medium ${priority.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
                  <span className="mr-2 text-xs text-[var(--text-muted)]">{index + 1}</span>{priority.text}
                </p>
                {priority.outcome_id && outcomeById.get(priority.outcome_id) && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Supports: {outcomeById.get(priority.outcome_id)}</p>
                )}
                {adjusting && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleMustWin(priority)} className={`inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs font-semibold ${priority.is_must_win ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                      {priority.is_must_win ? "★ Must Win" : "Must Win"}
                    </button>
                    <button type="button" onClick={() => void handleMove(priority, -1)} disabled={index === 0} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs text-[var(--text-muted)] disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => void handleMove(priority, 1)} disabled={index === ordered.length - 1} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs text-[var(--text-muted)] disabled:opacity-40">↓</button>
                    <button type="button" onClick={() => void handleRemove(priority)} className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]">Remove</button>
                  </div>
                )}
                {adjusting && candidates.length > 0 && (
                  <div className="mt-2 border-t border-[var(--border)] pt-2">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Replace with</p>
                    <div className="flex flex-wrap gap-1.5">
                      {candidates.slice(0, 4).map((candidate) => (
                        <button
                          key={`${candidate.kind}:${candidate.id}`}
                          type="button"
                          onClick={() => void handleReplace(priority, candidate)}
                          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:border-[var(--accent)]/30"
                        >
                          {candidate.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showPicker && (
        <Card variant="subtle" className="p-4">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            {ordered.length === 0 ? "What matters today? Choose up to 3." : "Add another priority"}
          </p>
          <div className="space-y-1.5">
            {candidates.map((candidate) => (
              <button
                key={`${candidate.kind}:${candidate.id}`}
                type="button"
                onClick={() => void handleAddCandidate(candidate)}
                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left hover:border-[var(--border)]"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--accent)]/50 text-[10px] font-bold text-[var(--accent)]">+</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--text)]">{candidate.title}</span>
                  <span className="block text-[11px] text-[var(--text-muted)]">{candidate.reason}</span>
                </span>
              </button>
            ))}
            {candidates.length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">Nothing due — add your own below.</p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={candidateInput}
              onChange={(e) => setCandidateInput(e.target.value.slice(0, 120))}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAddText(); }}
              placeholder="Or type your own priority"
            />
            <Button onClick={() => void handleAddText()} disabled={!candidateInput.trim()}>Add</Button>
          </div>
        </Card>
      )}

      {ordered.length > 0 && (
        <Card variant="subtle" className="p-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Still the right plan?</p>
          {!resetting ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => toast({ type: "success", title: "Keep going." })}>Keep going</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdjusting(!adjusting)}>{adjusting ? "Done adjusting" : "Adjust"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setResetting(true)}>Reset today</Button>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                Clearing unfinished priorities keeps what&apos;s done. History stays for Weekly Review.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void handleRebuild()}>Rebuild remaining day</Button>
                <Button size="sm" variant="ghost" onClick={() => setResetting(false)}>Keep plan</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
