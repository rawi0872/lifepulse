import { NextResponse } from "next/server";
import { buildInteractiveNextronResponse, isNextronProviderEligibleRequest, parseNextronUserRequest, type NextronCoachResponse } from "@/lib/nextron/coach";
import { calendarReadResponse, runNextronCalendarReadOnly } from "@/lib/nextron/calendar";
import { buildConversationContext, ensureConversation, loadConversationMessages, persistConversationTurn, resolvePromptWithConversation } from "@/lib/nextron/conversation";
import { normalizeNextronPreferences, type NextronPreferenceRow } from "@/lib/nextron/context";
import { buildNextronEvidencePacket } from "@/lib/nextron/evidence";
import { buildNextronRichResponse } from "@/lib/nextron/rich-response";
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
import { runNextronCrossDomainAgentOrFallback, runNextronKnowledgeAgentOrFallback, runNextronProjectAgentOrFallback } from "@/lib/nextron/project-agent/runtime";
import { createConfiguredNextronProvider, getNextronProviderUnavailableReason, runNextronProviderOrFallbackDetailed } from "@/lib/nextron/provider";
import { resolveNextronAuth } from "@/lib/supabase/nextron-auth";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_task_actions, allow_goal_actions, allow_habit_actions, allow_project_actions, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

type AskBody = { prompt?: unknown; conversationId?: unknown; clientMessageId?: unknown };

function logAskFailure(code: string, details: Record<string, string | number | boolean | null> = {}) {
  console.warn("nextron.ask.failure", { code, ...details });
}

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
  if (!body) {
    logAskFailure("REQUEST_BODY_INVALID");
    return NextResponse.json({ error: "Invalid NEXTRON request.", code: "REQUEST_BODY_INVALID" }, { status: 400 });
  }

  const originalParsed = parseNextronUserRequest(body.prompt);
  if (!originalParsed.ok) {
    logAskFailure("PROMPT_INVALID", { reason: originalParsed.reason });
    return NextResponse.json({ error: originalParsed.message, code: "PROMPT_INVALID" }, { status: 400 });
  }
  const originalRequest = originalParsed.request;

  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) {
    logAskFailure("AUTH_REQUIRED");
    return NextResponse.json({ error: "Sign in to ask NEXTRON.", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  const supabase = auth.supabase;
  const user = auth.user;
  const userId = user.id;

  try {
    const conversationId = typeof body.conversationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.conversationId) ? body.conversationId : null;
    if (body.conversationId !== undefined && body.conversationId !== null && !conversationId) {
      logAskFailure("CONVERSATION_ID_INVALID", { userId: userId.slice(0, 8) });
      return NextResponse.json({ error: "NEXTRON conversation is unavailable.", code: "CONVERSATION_ID_INVALID" }, { status: 404 });
    }
    const clientMessageId = typeof body.clientMessageId === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(body.clientMessageId) ? body.clientMessageId : null;
    const conversation = await ensureConversation(supabase, userId, conversationId, originalRequest.rawPrompt);
    if (!conversation) {
      logAskFailure("CONVERSATION_UNAVAILABLE", { userId: userId.slice(0, 8), existingConversation: Boolean(conversationId) });
      return NextResponse.json({ error: "NEXTRON conversation is unavailable.", code: "CONVERSATION_UNAVAILABLE" }, { status: 404 });
    }
    const activeConversation = conversation;
    const priorMessages = await loadConversationMessages(supabase, userId, activeConversation.id) ?? [];
    const conversationContext = buildConversationContext(priorMessages);
    const resolvedPrompt = resolvePromptWithConversation(originalRequest.rawPrompt, conversationContext);
    const parsed = parseNextronUserRequest(resolvedPrompt);
    if (!parsed.ok) {
      logAskFailure("RESOLVED_PROMPT_INVALID", { userId: userId.slice(0, 8), reason: parsed.reason });
      return NextResponse.json({ error: parsed.message, code: "RESOLVED_PROMPT_INVALID" }, { status: 400 });
    }
    const parsedRequest = parsed.request;

    const memoryCommand = parseNextronMemoryCommand(originalRequest.rawPrompt, originalRequest.normalizedPrompt);
    if (memoryCommand.kind === "remember") {
      const result = await rememberPreferenceMemory(supabase, user.id, memoryCommand.content);
      if (!result.ok) return NextResponse.json({ response: memoryIntentResponse(result.reason), source: "deterministic", code: "MEMORY_REJECTED" }, { status: 400 });
      const response = memoryIntentResponse(`Got it. I'll remember that ${result.memory.content.replace(/^You\s+/i, "you ")}.`);
      await persistConversationTurn({ supabase, userId, conversationId: activeConversation.id, clientMessageId, userPrompt: originalRequest.rawPrompt, assistantResponse: response, intent: originalRequest.intent }).catch(() => undefined);
      const messages = await loadConversationMessages(supabase, userId, activeConversation.id) ?? [];
      return NextResponse.json({ response, source: "deterministic", conversation: activeConversation, messages });
    }

    if (memoryCommand.kind === "forget") {
      const result = await forgetPreferenceMemory(supabase, user.id, memoryCommand.content);
      if (!result.ok) return NextResponse.json({ response: memoryIntentResponse(result.reason), source: "deterministic", code: "MEMORY_NOT_FOUND" }, { status: 404 });
      const response = memoryIntentResponse("I've forgotten that preference.");
      await persistConversationTurn({ supabase, userId, conversationId: activeConversation.id, clientMessageId, userPrompt: originalRequest.rawPrompt, assistantResponse: response, intent: originalRequest.intent }).catch(() => undefined);
      const messages = await loadConversationMessages(supabase, userId, activeConversation.id) ?? [];
      return NextResponse.json({ response, source: "deterministic", conversation: activeConversation, messages });
    }

    if (memoryCommand.kind === "view") {
      const memories = await listActivePreferenceMemories(supabase, user.id, 20);
      const response = memoryViewResponse(memories);
      await persistConversationTurn({ supabase, userId, conversationId: activeConversation.id, clientMessageId, userPrompt: originalRequest.rawPrompt, assistantResponse: response, intent: originalRequest.intent }).catch(() => undefined);
      const messages = await loadConversationMessages(supabase, userId, activeConversation.id) ?? [];
      return NextResponse.json({ response, source: "deterministic", conversation: activeConversation, messages });
    }

    if (memoryCommand.kind === "rejected_implicit") {
      return NextResponse.json({ response: memoryIntentResponse(memoryCommand.reason), source: "deterministic", code: "MEMORY_EXPLICIT_PERMISSION_REQUIRED" }, { status: 400 });
    }

    const { data } = await supabase
      .from("nextron_context_preferences")
      .select(PREFERENCE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();

    const { permissions } = normalizeNextronPreferences(data as NextronPreferenceRow | null);
    const evidence = await buildNextronEvidencePacket(supabase, userId, permissions);
    const relevantMemories = await retrieveRelevantPreferenceMemories(supabase, user.id, parsedRequest);
    evidence.memory = relevantMemories.length > 0
      ? { status: "available", data: { preferences: memoryFacts(relevantMemories).map((memory) => memory.content) } }
      : evidence.memory;
    const fallback = () => ({ ...buildInteractiveNextronResponse(evidence, parsedRequest), source: "deterministic" as const });

    async function respond(response: NextronCoachResponse, source: "ai" | "deterministic", fallbackReason?: string | null) {
      const richResponse = buildNextronRichResponse(response, evidence, parsedRequest);
      const responseWithRichUi: NextronCoachResponse = richResponse ? { ...response, richResponse } : response;
      if (fallbackReason) logAskFailure("PROVIDER_FALLBACK", { userId: userId.slice(0, 8), reason: fallbackReason });
      try {
        await persistConversationTurn({ supabase, userId, conversationId: activeConversation.id, clientMessageId, userPrompt: originalRequest.rawPrompt, assistantResponse: responseWithRichUi, intent: parsedRequest.intent });
      } catch (error) {
        logAskFailure("PERSISTENCE_FAILED", { userId: userId.slice(0, 8), name: error instanceof Error ? error.name : "unknown" });
        return NextResponse.json({ error: "NEXTRON prepared an answer but could not save this turn. Try again in a moment.", code: "PERSISTENCE_FAILED" }, { status: 503 });
      }
      const messages = await loadConversationMessages(supabase, userId, activeConversation.id) ?? [];
      return NextResponse.json(
        { response: responseWithRichUi, source, conversation: activeConversation, messages },
        fallbackReason ? { headers: { "X-Nextron-Fallback-Reason": fallbackReason } } : undefined,
      );
    }

    if (parsedRequest.intent === "PROJECT_AGENT") {
      const result = await runNextronProjectAgentOrFallback({ supabase, userId, permissions, evidence, userRequest: parsedRequest, fallback });
      return respond(result.response, result.response.source ?? "deterministic", result.fallbackReason);
    }

    if (parsedRequest.intent === "CROSS_DOMAIN_AGENT") {
      const result = await runNextronCrossDomainAgentOrFallback({ supabase, userId, permissions, evidence, userRequest: parsedRequest, fallback });
      return respond(result.response, result.response.source ?? "deterministic", result.fallbackReason);
    }

    if (parsedRequest.intent === "KNOWLEDGE_QUERY") {
      const result = await runNextronKnowledgeAgentOrFallback({ supabase, userId, permissions, evidence, userRequest: parsedRequest, fallback });
      return respond(result.response, result.response.source ?? "deterministic", result.fallbackReason);
    }

    if (parsedRequest.intent === "CALENDAR_QUERY") {
      const result = await runNextronCalendarReadOnly({ supabase, userId, permissions, request: parsedRequest });
      return respond(calendarReadResponse(result), "deterministic", result.ok ? null : result.reason);
    }

    if (!isNextronProviderEligibleRequest(parsedRequest)) {
      return respond(fallback(), "deterministic");
    }

    const provider = createConfiguredNextronProvider();
    const result = await runNextronProviderOrFallbackDetailed(
      { evidence, userPrompt: parsedRequest.rawPrompt },
      fallback,
      provider ?? undefined,
      provider ? null : getNextronProviderUnavailableReason(),
    );

    return respond(result.response, result.response.source ?? "deterministic", result.fallbackReason);
  } catch (error) {
    logAskFailure("ASK_UNEXPECTED_FAILURE", { name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "NEXTRON could not load permitted context right now.", code: "ASK_UNEXPECTED_FAILURE" }, { status: 503 });
  }
}
