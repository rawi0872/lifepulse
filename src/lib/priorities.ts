import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyPlanEventType, TodayPriority, TodayPriorityInput } from "@lifepulse/domain";
import { MAX_PRIORITIES_PER_DAY, buildPlanEventInsert } from "@lifepulse/domain";

/** Load today's priorities from backend */
export async function loadPriorities(
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

/** Load with explicit success surface — lets migration distinguish empty vs network/error */
export async function loadPrioritiesResult(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
): Promise<{ data: TodayPriority[]; error: unknown | null }> {
  const { data, error } = await supabase
    .from("today_priorities")
    .select("*")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("position", { ascending: true })
    .limit(MAX_PRIORITIES_PER_DAY);

  if (error) return { data: [], error };
  return { data: (data ?? []) as TodayPriority[], error: null };
}

/** Upsert a full set of priorities for a day (replaces all priorities for that day) */
export async function savePriorities(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
  items: TodayPriorityInput[],
): Promise<boolean> {
  const truncated = items.slice(0, MAX_PRIORITIES_PER_DAY);

  // Delete existing priorities for this day
  const { error: deleteErr } = await supabase
    .from("today_priorities")
    .delete()
    .eq("user_id", userId)
    .eq("local_date", localDate);

  if (deleteErr) return false;

  if (truncated.length === 0) return true;

  // Insert new priorities
  const rows = truncated.map((item, index) => ({
    user_id: userId,
    local_date: localDate,
    position: index + 1,
    text: item.text.trim(),
    task_id: item.task_id ?? null,
    habit_id: item.habit_id ?? null,
    outcome_id: item.outcome_id ?? null,
    done: item.done ?? false,
  }));

  const { error: insertErr } = await supabase
    .from("today_priorities")
    .insert(rows);

  return !insertErr;
}

/** Toggle done state of a priority */
export async function togglePriority(
  supabase: SupabaseClient,
  userId: string,
  priorityId: string,
  done: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("today_priorities")
    .update({ done })
    .eq("id", priorityId)
    .eq("user_id", userId);

  return !error;
}

/** Delete a single priority */
export async function deletePriority(
  supabase: SupabaseClient,
  userId: string,
  priorityId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("today_priorities")
    .delete()
    .eq("id", priorityId)
    .eq("user_id", userId);

  return !error;
}

/** Add a new priority (appends to end, max 3) */
export async function addPriority(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
  input: TodayPriorityInput,
): Promise<TodayPriority | null> {
  // Get current count
  const existing = await loadPriorities(supabase, userId, localDate);
  if (existing.length >= MAX_PRIORITIES_PER_DAY) return null;

  const newPosition = existing.length + 1;

  const { data, error } = await supabase
    .from("today_priorities")
    .insert({
      user_id: userId,
      local_date: localDate,
      position: newPosition,
      text: input.text.trim(),
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
export async function updatePriorityFields(
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
