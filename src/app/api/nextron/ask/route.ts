import { NextResponse } from "next/server";
import { buildInteractiveNextronResponse, isNextronProviderEligibleRequest, parseNextronUserRequest } from "@/lib/nextron/coach";
import { normalizeNextronPreferences, type NextronPreferenceRow } from "@/lib/nextron/context";
import { buildNextronEvidencePacket } from "@/lib/nextron/evidence";
import {
  forgetPreferenceMemory,
  listActivePreferenceMemories,
  memoryFacts,
  memoryIntentResponse,
  memoryViewResponse,
  parseNextronMemoryCommand,
  rememberPreferenceMemory,
  retrieveRelevantPreferenceMemories,
} from "@/lib/nextron/memory";
import { runNextronProjectAgentOrFallback } from "@/lib/nextron/project-agent/runtime";
import { createConfiguredNextronProvider, getNextronProviderUnavailableReason, runNextronProviderOrFallbackDetailed } from "@/lib/nextron/provider";
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
    const memoryCommand = parseNextronMemoryCommand(parsed.request.rawPrompt, parsed.request.normalizedPrompt);
    if (memoryCommand.kind === "remember") {
      const result = await rememberPreferenceMemory(supabase, user.id, memoryCommand.content);
      if (!result.ok) return NextResponse.json({ response: memoryIntentResponse(result.reason), source: "deterministic" }, { status: 400 });
      return NextResponse.json({ response: memoryIntentResponse(`Got it. I'll remember that ${result.memory.content.replace(/^You\s+/i, "you ")}.`), source: "deterministic" });
    }

    if (memoryCommand.kind === "forget") {
      const result = await forgetPreferenceMemory(supabase, user.id, memoryCommand.content);
      if (!result.ok) return NextResponse.json({ response: memoryIntentResponse(result.reason), source: "deterministic" }, { status: 404 });
      return NextResponse.json({ response: memoryIntentResponse("I've forgotten that preference."), source: "deterministic" });
    }

    if (memoryCommand.kind === "view") {
      const memories = await listActivePreferenceMemories(supabase, user.id, 20);
      return NextResponse.json({ response: memoryViewResponse(memories), source: "deterministic" });
    }

    if (memoryCommand.kind === "rejected_implicit") {
      return NextResponse.json({ response: memoryIntentResponse(memoryCommand.reason), source: "deterministic" }, { status: 400 });
    }

    const { data } = await supabase
      .from("nextron_context_preferences")
      .select(PREFERENCE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();

    const { permissions } = normalizeNextronPreferences(data as NextronPreferenceRow | null);
    const evidence = await buildNextronEvidencePacket(supabase, user.id, permissions);
    const relevantMemories = await retrieveRelevantPreferenceMemories(supabase, user.id, parsed.request);
    evidence.memory = relevantMemories.length > 0
      ? { status: "available", data: { preferences: memoryFacts(relevantMemories).map((memory) => memory.content) } }
      : evidence.memory;
    const fallback = () => ({ ...buildInteractiveNextronResponse(evidence, parsed.request), source: "deterministic" as const });

    if (parsed.request.intent === "PROJECT_AGENT") {
      const result = await runNextronProjectAgentOrFallback({ supabase, userId: user.id, permissions, evidence, userRequest: parsed.request, fallback });
      return NextResponse.json(
        { response: result.response, source: result.response.source ?? "deterministic" },
        result.fallbackReason ? { headers: { "X-Nextron-Fallback-Reason": result.fallbackReason } } : undefined,
      );
    }

    if (!isNextronProviderEligibleRequest(parsed.request)) {
      return NextResponse.json({ response: fallback(), source: "deterministic" });
    }

    const provider = createConfiguredNextronProvider();
    const result = await runNextronProviderOrFallbackDetailed(
      { evidence, userPrompt: parsed.request.rawPrompt },
      fallback,
      provider ?? undefined,
      provider ? null : getNextronProviderUnavailableReason(),
    );

    return NextResponse.json(
      { response: result.response, source: result.response.source ?? "deterministic" },
      result.fallbackReason ? { headers: { "X-Nextron-Fallback-Reason": result.fallbackReason } } : undefined,
    );
  } catch {
    return NextResponse.json({ error: "NEXTRON could not load permitted context right now." }, { status: 503 });
  }
}
