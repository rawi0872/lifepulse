import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodayPriority, TodayPriorityInput } from "@lifepulse/domain";
import { MAX_PRIORITIES_PER_DAY } from "@lifepulse/domain";

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
      done: input.done ?? false,
    })
    .select("*")
    .single();

  if (error) return null;
  return data as TodayPriority;
}
