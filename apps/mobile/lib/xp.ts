import { supabase } from "./supabase";

// XP awards (parity with web taskCompletion + habit toggle paths).
// Same table, same amounts, same source identity:
// - task completion: +25 keyed by task id (dup-checked, rolled back)
// - habit check-in: +10 keyed by habit_log id (log removed on rollback)
// Reopen/undo/delete revoke what completion granted so cross-client
// XP totals agree no matter which client acted.

export const TASK_COMPLETE_XP = 25;
export const HABIT_COMPLETE_XP = 10;

type XpResult = { ok: true } | { ok: false; error: string };

export async function awardTaskXp(userId: string, taskId: string): Promise<XpResult> {
  const { data: existing, error: existingErr } = await supabase
    .from("xp_events")
    .select("id")
    .match({ user_id: userId, source_type: "task", source_id: taskId })
    .maybeSingle();
  if (existingErr) return { ok: false, error: "Could not update task." };
  if (existing) return { ok: true };
  const { error } = await supabase.from("xp_events").insert({
    user_id: userId,
    source_type: "task",
    source_id: taskId,
    amount: TASK_COMPLETE_XP,
  });
  if (error) return { ok: false, error: "Could not update task." };
  return { ok: true };
}

export async function revokeTaskXp(userId: string, taskId: string): Promise<XpResult> {
  const { error } = await supabase
    .from("xp_events")
    .delete()
    .match({ user_id: userId, source_type: "task", source_id: taskId });
  if (error) return { ok: false, error: "Could not update task." };
  return { ok: true };
}

export async function awardHabitXp(userId: string, logId: string): Promise<XpResult> {
  const { error } = await supabase.from("xp_events").insert({
    user_id: userId,
    source_type: "habit",
    source_id: logId,
    amount: HABIT_COMPLETE_XP,
  });
  if (error) return { ok: false, error: "Could not log habit." };
  return { ok: true };
}

export async function revokeHabitXpForLogs(userId: string, logIds: string[]): Promise<XpResult> {
  if (logIds.length === 0) return { ok: true };
  const { error } = await supabase
    .from("xp_events")
    .delete()
    .eq("user_id", userId)
    .eq("source_type", "habit")
    .in("source_id", logIds);
  if (error) return { ok: false, error: "Could not update habit." };
  return { ok: true };
}
