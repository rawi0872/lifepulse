import { NextResponse } from "next/server";
import { buildNextronPreferenceUpsert, normalizeNextronPreferences, type NextronContextDomain, type NextronPreferenceRow } from "@/lib/nextron/context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_task_actions, allow_goal_actions, allow_habit_actions, allow_project_actions, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";
const WRITE_DOMAINS = new Set<NextronContextDomain>(["taskActions", "goalActions", "habitActions", "projectActions"]);

async function readBody(request: Request): Promise<{ grant?: unknown; revoke?: unknown } | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body as { grant?: unknown; revoke?: unknown } : null;
  } catch {
    return null;
  }
}

function safeDomains(value: unknown): NextronContextDomain[] | null {
  if (!Array.isArray(value)) return [];
  const domains: NextronContextDomain[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !WRITE_DOMAINS.has(item as NextronContextDomain)) return null;
    domains.push(item as NextronContextDomain);
  }
  return [...new Set(domains)];
}

export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid permission request." }, { status: 400 });
  const grant = safeDomains(body.grant);
  const revoke = safeDomains(body.revoke);
  if (!grant || !revoke) return NextResponse.json({ error: "Only NEXTRON write permissions can be changed here." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update NEXTRON action permissions." }, { status: 401 });

  const { data } = await supabase.from("nextron_context_preferences").select(PREFERENCE_COLUMNS).eq("user_id", user.id).maybeSingle();
  const normalized = normalizeNextronPreferences(data as NextronPreferenceRow | null).permissions;
  for (const domain of grant) normalized[domain] = "allowed";
  for (const domain of revoke) normalized[domain] = "denied";
  const { data: saved, error } = await supabase
    .from("nextron_context_preferences")
    .upsert(buildNextronPreferenceUpsert(user.id, normalized), { onConflict: "user_id" })
    .select(PREFERENCE_COLUMNS)
    .single();
  if (error || !saved) return NextResponse.json({ error: "NEXTRON action permissions could not be saved." }, { status: 503 });
  return NextResponse.json({ permissions: normalizeNextronPreferences(saved as NextronPreferenceRow).permissions });
}
