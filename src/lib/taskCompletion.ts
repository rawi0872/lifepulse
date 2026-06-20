import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToggleTaskResult {
  success: boolean;
  error?: string;
}

/**
 * Toggle a task between done and todo.
 * Handles: task status update, completed_at, and XP event creation/removal.
 * Protects against duplicate XP events by checking before inserting.
 */
export async function toggleTaskCompletion(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  makeDone: boolean,
): Promise<ToggleTaskResult> {
  try {
    if (makeDone) {
      const { error: tErr } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId);

      if (tErr) return { success: false, error: tErr.message };

      const { data: existing } = await supabase
        .from("xp_events")
        .select("id")
        .match({ user_id: userId, source_type: "task", source_id: taskId })
        .maybeSingle();

      if (!existing) {
        const { error: xpErr } = await supabase.from("xp_events").insert({
          user_id: userId,
          source_type: "task",
          source_id: taskId,
          amount: 25,
        });

        if (xpErr) return { success: false, error: xpErr.message };
      }
    } else {
      const { error: tErr } = await supabase
        .from("tasks")
        .update({ status: "todo", completed_at: null })
        .eq("id", taskId);

      if (tErr) return { success: false, error: tErr.message };

      const { error: xpDelErr } = await supabase
        .from("xp_events")
        .delete()
        .match({ user_id: userId, source_type: "task", source_id: taskId });
      if (xpDelErr) return { success: false, error: xpDelErr.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update task";
    return { success: false, error: message };
  }
}
