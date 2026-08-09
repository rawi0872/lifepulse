import { NextResponse } from "next/server";
import { normalizeNextronPreferences, type NextronPreferenceRow } from "@/lib/nextron/context";
import { generateDailyBrief, buildDailyBriefEvidence } from "@/lib/nextron/daily-brief";
import { buildNextronEvidencePacket } from "@/lib/nextron/evidence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_task_actions, allow_goal_actions, allow_habit_actions, allow_project_actions, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate the NEXTRON Daily Brief." }, { status: 401 });

  try {
    const { data } = await supabase
      .from("nextron_context_preferences")
      .select(PREFERENCE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();
    const { permissions } = normalizeNextronPreferences(data as NextronPreferenceRow | null);
    const packet = await buildNextronEvidencePacket(supabase, user.id, permissions);
    const evidence = await buildDailyBriefEvidence({ supabase, userId: user.id, permissions, packet });
    const brief = await generateDailyBrief(evidence);

    return NextResponse.json({
      brief,
      meta: {
        maxPriorities: 3,
        cache: "client-session-only",
        persisted: false,
        modelCalls: brief.source === "ai" ? 1 : 0,
        provider: brief.source === "ai" ? "groq" : "deterministic-fallback",
        knowledgeAutomaticRetrieval: false,
        memoryAutomaticUse: false,
      },
    });
  } catch {
    return NextResponse.json({ error: "NEXTRON could not generate the Daily Brief right now." }, { status: 503 });
  }
}
