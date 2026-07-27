import { NextResponse } from "next/server";
import { buildInteractiveNextronResponse, isNextronProviderEligibleRequest, parseNextronUserRequest } from "@/lib/nextron/coach";
import { normalizeNextronPreferences, type NextronPreferenceRow } from "@/lib/nextron/context";
import { buildNextronEvidencePacket } from "@/lib/nextron/evidence";
import { createConfiguredNextronProvider, runNextronProviderOrFallback } from "@/lib/nextron/provider";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_habits, allow_results, allow_goals, allow_projects, allow_journal, allow_evening_shutdown, allow_weekly_review";

type AskBody = { prompt?: unknown };

async function readAskBody(request: Request): Promise<AskBody | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    return body as AskBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readAskBody(request);
  if (!body) return NextResponse.json({ error: "Invalid NEXTRON request." }, { status: 400 });

  const parsed = parseNextronUserRequest(body.prompt);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to ask NEXTRON." }, { status: 401 });

  try {
    const { data } = await supabase
      .from("nextron_context_preferences")
      .select(PREFERENCE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();

    const { permissions } = normalizeNextronPreferences(data as NextronPreferenceRow | null);
    const evidence = await buildNextronEvidencePacket(supabase, user.id, permissions);
    const fallback = () => ({ ...buildInteractiveNextronResponse(evidence, parsed.request), source: "deterministic" as const });

    if (!isNextronProviderEligibleRequest(parsed.request)) {
      return NextResponse.json({ response: fallback(), source: "deterministic" });
    }

    const response = await runNextronProviderOrFallback(
      { evidence, userPrompt: parsed.request.rawPrompt },
      fallback,
      createConfiguredNextronProvider() ?? undefined,
    );

    return NextResponse.json({ response, source: response.source ?? "deterministic" });
  } catch {
    return NextResponse.json({ error: "NEXTRON could not load permitted context right now." }, { status: 503 });
  }
}
