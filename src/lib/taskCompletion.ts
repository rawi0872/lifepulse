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
      const { data: updatedTask, error: tErr } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("user_id", userId)
        .eq("status", "todo")
        .select("id")
        .maybeSingle();

      if (tErr) return { success: false, error: "Could not update task." };
      if (!updatedTask) return { success: false, error: "Task unavailable." };

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

        if (xpErr) return { success: false, error: "Could not update task." };
      }
    } else {
      const { data: updatedTask, error: tErr } = await supabase
        .from("tasks")
        .update({ status: "todo", completed_at: null })
        .eq("id", taskId)
        .eq("user_id", userId)
        .eq("status", "done")
        .select("id")
        .maybeSingle();

      if (tErr) return { success: false, error: "Could not update task." };
      if (!updatedTask) return { success: false, error: "Task unavailable." };

      const { error: xpDelErr } = await supabase
        .from("xp_events")
        .delete()
        .match({ user_id: userId, source_type: "task", source_id: taskId });
      if (xpDelErr) return { success: false, error: "Could not update task." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Could not update task." };
  }
}
