import { NextResponse } from "next/server";
import { buildConversationTitle, ensureConversation, loadConversationMessages, sanitizeConversationContent } from "@/lib/nextron/conversation";
import {
  ensureOnboardingState,
  generateOnboardingTurn,
  normalizeLifeSetupDraft,
  normalizeOnboardingUnderstanding,
  NEXTRON_ONBOARDING_MAX_MESSAGES,
  NEXTRON_ONBOARDING_MAX_PROMPT,
  type NextronOnboardingStatus,
} from "@/lib/nextron/onboarding";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MessageBody = { prompt?: unknown; clientMessageId?: unknown };
type StateBody = { action?: unknown };

function validClientMessageId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : null;
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    return body as T;
  } catch {
    return null;
  }
}

function safeStatus(value: unknown): NextronOnboardingStatus {
  return value === "not_started" || value === "in_progress" || value === "draft_ready" || value === "completed" || value === "skipped" ? value : "not_started";
}

async function readProfileState(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("onboarding_completed, intended_use").eq("user_id", userId).maybeSingle();
  return { onboardingCompleted: Boolean(data?.onboarding_completed), intendedUse: typeof data?.intended_use === "string" ? data.intended_use : null };
}

async function loadStateResponse(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const state = await ensureOnboardingState(supabase, userId);
  if (!state) return null;
  const conversationId = typeof state.conversation_id === "string" ? state.conversation_id : null;
  const messages = conversationId ? await loadConversationMessages(supabase, userId, conversationId) : [];
  const profile = await readProfileState(supabase, userId);
  return {
    state: {
      ...state,
      status: safeStatus(state.status),
      understanding: normalizeOnboardingUnderstanding(state.understanding),
      setup_draft: normalizeLifeSetupDraft(state.setup_draft),
      profile,
    },
    messages: messages?.slice(-NEXTRON_ONBOARDING_MAX_MESSAGES) ?? [],
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load NEXTRON onboarding." }, { status: 401 });
  const response = await loadStateResponse(supabase, user.id);
  if (!response) return NextResponse.json({ error: "NEXTRON onboarding could not be loaded." }, { status: 503 });
  return NextResponse.json(response);
}

export async function PATCH(request: Request) {
  const body = await readJson<StateBody>(request);
  if (!body || (body.action !== "skip" && body.action !== "complete" && body.action !== "resume")) return NextResponse.json({ error: "Invalid onboarding transition." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update NEXTRON onboarding." }, { status: 401 });
  const state = await ensureOnboardingState(supabase, user.id);
  if (!state) return NextResponse.json({ error: "NEXTRON onboarding could not be loaded." }, { status: 503 });

  if (body.action === "skip") {
    await supabase.from("nextron_onboarding").update({ status: "skipped", skipped_at: new Date().toISOString(), last_error: null }).eq("user_id", user.id);
  }

  if (body.action === "resume") {
    await supabase.from("nextron_onboarding").update({ status: "in_progress", skipped_at: null, last_error: null }).eq("user_id", user.id);
  }

  if (body.action === "complete") {
    const draft = normalizeLifeSetupDraft(state.setup_draft);
    if (!draft) return NextResponse.json({ error: "Review the Life Setup Draft before marking setup ready." }, { status: 409 });
    const completedAt = new Date().toISOString();
    const { error: onboardingError } = await supabase.from("nextron_onboarding").update({ status: "completed", completed_at: completedAt, last_error: null }).eq("user_id", user.id);
    if (onboardingError) return NextResponse.json({ error: "NEXTRON onboarding could not be completed." }, { status: 503 });
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    const profileWrite = profile
      ? await supabase.from("profiles").update({ onboarding_completed: true }).eq("user_id", user.id)
      : await supabase.from("profiles").insert({ user_id: user.id, onboarding_completed: true });
    if (profileWrite.error) return NextResponse.json({ error: "NEXTRON onboarding completed, but profile state could not be saved." }, { status: 503 });
  }

  const response = await loadStateResponse(supabase, user.id);
  if (!response) return NextResponse.json({ error: "NEXTRON onboarding could not be refreshed." }, { status: 503 });
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const body = await readJson<MessageBody>(request);
  const prompt = sanitizeConversationContent(typeof body?.prompt === "string" ? body.prompt : "", NEXTRON_ONBOARDING_MAX_PROMPT);
  if (!prompt) return NextResponse.json({ error: "Tell NEXTRON what is going on first." }, { status: 400 });
  const clientMessageId = validClientMessageId(body?.clientMessageId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to talk with NEXTRON." }, { status: 401 });
  const state = await ensureOnboardingState(supabase, user.id);
  if (!state) return NextResponse.json({ error: "NEXTRON onboarding could not be loaded." }, { status: 503 });

  if (clientMessageId) {
    const existing = await supabase.from("nextron_messages").select("id").eq("user_id", user.id).eq("client_message_id", clientMessageId).maybeSingle();
    if (!existing.error && existing.data) {
      const response = await loadStateResponse(supabase, user.id);
      return response ? NextResponse.json(response) : NextResponse.json({ error: "NEXTRON onboarding could not be refreshed." }, { status: 503 });
    }
  }

  const conversation = await ensureConversation(supabase, user.id, state.conversation_id, prompt || "NEXTRON onboarding");
  if (!conversation) return NextResponse.json({ error: "NEXTRON onboarding conversation could not be opened." }, { status: 503 });
  if (!state.conversation_id) await supabase.from("nextron_onboarding").update({ conversation_id: conversation.id }).eq("user_id", user.id);

  const messages = await loadConversationMessages(supabase, user.id, conversation.id) ?? [];
  const currentUnderstanding = normalizeOnboardingUnderstanding(state.understanding);
  const turn = await generateOnboardingTurn({ prompt, current: currentUnderstanding, messages });
  const nextStatus: NextronOnboardingStatus = turn.readiness === "ready" && turn.setupDraft ? "draft_ready" : "in_progress";

  const userMessage = {
    conversation_id: conversation.id,
    user_id: user.id,
    role: "user",
    content: prompt,
    metadata: { intent: "ONBOARDING", surface: "nextron_onboarding" },
    client_message_id: clientMessageId,
  };
  const assistantMessage = {
    conversation_id: conversation.id,
    user_id: user.id,
    role: "assistant",
    content: turn.reply,
    response: null,
    metadata: { intent: "ONBOARDING", surface: "nextron_onboarding", readiness: turn.readiness, source: turn.source, fallbackReason: turn.fallbackReason ?? null },
  };

  const { error: messageError } = await supabase.from("nextron_messages").insert([userMessage, assistantMessage]);
  if (messageError) return NextResponse.json({ error: "NEXTRON could not save that onboarding turn." }, { status: 503 });
  await supabase.from("nextron_conversations").update({ title: buildConversationTitle(prompt), updated_at: new Date().toISOString() }).eq("id", conversation.id).eq("user_id", user.id);
  await supabase
    .from("nextron_onboarding")
    .update({ status: nextStatus, understanding: turn.understanding, setup_draft: turn.setupDraft, last_error: turn.fallbackReason ? `Provider fallback: ${turn.fallbackReason}` : null })
    .eq("user_id", user.id);

  const response = await loadStateResponse(supabase, user.id);
  if (!response) return NextResponse.json({ error: "NEXTRON onboarding could not be refreshed." }, { status: 503 });
  return NextResponse.json({ ...response, turn });
}
