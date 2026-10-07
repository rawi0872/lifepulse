// Daily planning service (PLAN V1 — Prompt 2/3).
// Mirrors web src/lib/priorities.ts additions against the same tables and
// domain rules. The Supabase client is injected so tests can pass a mock.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyPlanEventType, TodayPriority, TodayPriorityInput } from "@lifepulse/domain";
import { MAX_PRIORITIES_PER_DAY, buildPlanEventInsert } from "@lifepulse/domain";

/** Load the day's priorities in canonical order. */
export async function loadDayPriorities(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
): Promise<TodayPriority[]> {
  const { data, error } = await supabase
    .from("today_priorities")
    .select("*")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("position", { ascending: true })
    .limit(MAX_PRIORITIES_PER_DAY);
  if (error) return [];
  return (data ?? []) as TodayPriority[];
}

/** Add a priority at the next free position (max 3, one reference max). */
export async function addDayPriority(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
  existing: TodayPriority[],
  input: TodayPriorityInput,
): Promise<TodayPriority | null> {
  const taken = new Set(existing.map((p) => p.position));
  let position: number | null = null;
  for (let p = 1; p <= MAX_PRIORITIES_PER_DAY; p += 1) {
    if (!taken.has(p)) {
      position = p;
      break;
    }
  }
  if (position === null || !input.text.trim()) return null;
  const refs = [input.task_id, input.habit_id, input.outcome_id].filter(Boolean);
  if (refs.length > 1) return null;
  const { data, error } = await supabase
    .from("today_priorities")
    .insert({
      user_id: userId,
      local_date: localDate,
      position,
      text: input.text.trim().slice(0, 120),
      task_id: input.task_id ?? null,
      habit_id: input.habit_id ?? null,
      outcome_id: input.outcome_id ?? null,
      done: input.done ?? false,
    })
    .select("*")
    .single();
  if (error) return null;
  return data as TodayPriority;
}

/** Edit a priority's text/done state. Returns false when nothing changes. */
export async function updateDayPriorityFields(
  supabase: SupabaseClient,
  userId: string,
  priorityId: string,
  edits: { text?: string; done?: boolean },
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (edits.text !== undefined) {
    if (!edits.text.trim()) return false;
    payload.text = edits.text.trim().slice(0, 120);
  }
  if (edits.done !== undefined) payload.done = edits.done;
  if (Object.keys(payload).length === 0) return false;
  const { error } = await supabase
    .from("today_priorities")
    .update(payload)
    .eq("id", priorityId)
    .eq("user_id", userId);
  return !error;
}

/** Set exactly one Daily Must Win (or clear with null). DB partial index enforces max 1. */
export async function setDailyMustWin(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
  priorityId: string | null,
  priorities: TodayPriority[],
): Promise<boolean> {
  // Re-read flagged rows: the passed list may be stale after a concurrent
  // switch, and clearing only stale flags trips the partial unique index.
  const flaggedIds = new Set(
    priorities.filter((p) => p.is_must_win).map((p) => p.id),
  );
  const { data: fresh } = await supabase
    .from("today_priorities")
    .select("id")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .eq("is_must_win", true);
  for (const row of ((fresh ?? []) as { id: string }[])) flaggedIds.add(row.id);
  for (const id of flaggedIds) {
    if (id !== priorityId) {
      const { error } = await supabase
        .from("today_priorities")
        .update({ is_must_win: false })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return false;
    }
  }
  if (priorityId) {
    const { error } = await supabase
      .from("today_priorities")
      .update({ is_must_win: true })
      .eq("id", priorityId)
      .eq("user_id", userId)
      .eq("local_date", localDate);
    if (error) return false;
  }
  return true;
}

/** Append a daily-plan history event. Fire-and-forget safe (returns success). */
export async function logPlanEvent(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
  eventType: DailyPlanEventType,
  priorityId?: string | null,
  detail?: string | null,
): Promise<boolean> {
  const payload = buildPlanEventInsert(userId, localDate, eventType, priorityId, detail);
  if (!payload) return false;
  const { error } = await supabase.from("daily_plan_events").insert(payload);
  return !error;
}
