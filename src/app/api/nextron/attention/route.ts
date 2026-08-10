import { NextResponse } from "next/server";
import { buildNextronAttentionSummary } from "@/lib/nextron/attention";
import { normalizeNextronPreferences, type NextronPreferenceRow } from "@/lib/nextron/context";
import { buildNextronEvidencePacket } from "@/lib/nextron/evidence";
import { buildNextronSignalEvidence, deriveNextronSignals } from "@/lib/nextron/signals";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_task_actions, allow_goal_actions, allow_habit_actions, allow_project_actions, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load NEXTRON attention." }, { status: 401 });

  try {
    const { data } = await supabase
      .from("nextron_context_preferences")
      .select(PREFERENCE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();
    const { permissions } = normalizeNextronPreferences(data as NextronPreferenceRow | null);
    const packet = await buildNextronEvidencePacket(supabase, user.id, permissions);
    const evidence = await buildNextronSignalEvidence({ supabase, userId: user.id, permissions, packet });
    const signals = deriveNextronSignals(evidence);
    const attention = buildNextronAttentionSummary({ signals, localDate: evidence.localDate, observedAt: evidence.observedAt });

    return NextResponse.json({ attention });
  } catch {
    return NextResponse.json({ error: "NEXTRON attention is unavailable right now." }, { status: 503 });
  }
}
