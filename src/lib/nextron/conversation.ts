import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextronCoachResponse, NextronCoachingIntent } from "@/lib/nextron/coach";

export const NEXTRON_CONVERSATION_TURN_LIMIT = 10;
export const NEXTRON_CONVERSATION_CONTEXT_MAX_CHARS = 2_400;

export interface NextronConversationRow {
  id: string;
  user_id: string;
  title: string;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NextronMessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  response: NextronCoachResponse | null;
  metadata: Record<string, unknown>;
  client_message_id: string | null;
  created_at: string;
}

export interface ConversationContextMessage {
  role: "user" | "assistant";
  content: string;
  intent?: NextronCoachingIntent;
  sources?: string[];
}

function compactText(value: string, max: number): string {
  return value.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildConversationTitle(prompt: string): string {
  const clean = compactText(prompt.replace(/^what did i write about the\s+/i, "").replace(/^what does my\s+/i, ""), 90);
  if (!clean) return "New NEXTRON conversation";
  const title = clean.replace(/[?.!]+$/g, "");
  return title.length <= 90 ? title : `${title.slice(0, 87).trim()}...`;
}

export function sanitizeConversationContent(value: string, max = 1_500): string {
  return compactText(value, max);
}

export function safeResponseMetadata(response: NextronCoachResponse, intent: NextronCoachingIntent) {
  return {
    intent,
    priority: response.priority,
    ruleId: response.ruleId.slice(0, 80),
    source: response.source ?? "deterministic",
    sources: (response.sources ?? []).map((source) => compactText(source, 120)).filter(Boolean).slice(0, 4),
  };
}

export function buildConversationContext(messages: NextronMessageRow[]): ConversationContextMessage[] {
  const recent = messages.slice(-NEXTRON_CONVERSATION_TURN_LIMIT * 2);
  const bounded: ConversationContextMessage[] = [];
  let total = 0;
  for (const message of [...recent].reverse()) {
    const content = sanitizeConversationContent(message.content, 420);
    if (!content) continue;
    const nextTotal = total + content.length;
    if (nextTotal > NEXTRON_CONVERSATION_CONTEXT_MAX_CHARS) break;
    total = nextTotal;
    const metadata = message.metadata ?? {};
    const intent = typeof metadata.intent === "string" ? metadata.intent as NextronCoachingIntent : undefined;
    const sources = Array.isArray(metadata.sources) ? metadata.sources.filter((source): source is string => typeof source === "string").slice(0, 4) : undefined;
    bounded.unshift({ role: message.role, content, intent, sources });
  }
  return bounded;
}

export function resolvePromptWithConversation(rawPrompt: string, context: ConversationContextMessage[]): string {
  const prompt = sanitizeConversationContent(rawPrompt, 500);
  const normalized = prompt.toLowerCase();
  const lastUser = [...context].reverse().find((message) => message.role === "user");
  const lastAssistant = [...context].reverse().find((message) => message.role === "assistant");
  const lastIntent = [...context].reverse().map((message) => message.intent).find(Boolean);
  const isFollowUp = /^(why|why\?|what about tomorrow\??|what about it\??|which one\??|which project\??|which commitment\??|what task\??|what should i do about it\??|what should i do after that\??|why did i make that decision\??)$/i.test(prompt)
    || /\b(it|that|they|those|one|decision|commitment)\b/i.test(normalized) && prompt.length < 80;
  if (!isFollowUp || (!lastUser && !lastAssistant)) return prompt;

  const previous = [lastUser?.content, lastAssistant?.content].filter(Boolean).join(" / ").slice(0, 520);
  const hint = lastIntent === "KNOWLEDGE_QUERY"
    ? "Continue as a Knowledge question using current permitted Knowledge evidence."
    : lastIntent === "CALENDAR_QUERY"
      ? "Continue as a Calendar question and re-check current Calendar evidence."
      : lastIntent === "PROJECT_AGENT" || lastIntent === "CROSS_DOMAIN_AGENT"
        ? "Continue as a project or cross-domain Life Pulse question using the current allowed context."
        : "Continue this Life Pulse intelligence question using the current allowed context.";
  return `${hint} Previous turn context: ${previous}. Current follow-up: ${prompt}`.slice(0, 500);
}

export async function loadConversationMessages(supabase: SupabaseClient, userId: string, conversationId: string): Promise<NextronMessageRow[] | null> {
  const { data: conversation, error: conversationError } = await supabase
    .from("nextron_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (conversationError || !conversation) return null;

  const { data, error } = await supabase
    .from("nextron_messages")
    .select("id, conversation_id, user_id, role, content, response, metadata, client_message_id, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) return null;
  return (data ?? []) as NextronMessageRow[];
}

export async function ensureConversation(supabase: SupabaseClient, userId: string, conversationId: string | null | undefined, firstPrompt: string): Promise<NextronConversationRow | null> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("nextron_conversations")
      .select("id, user_id, title, archived_at, deleted_at, created_at, updated_at")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    return error ? null : data as NextronConversationRow | null;
  }
  const { data, error } = await supabase
    .from("nextron_conversations")
    .insert({ user_id: userId, title: buildConversationTitle(firstPrompt) })
    .select("id, user_id, title, archived_at, deleted_at, created_at, updated_at")
    .single();
  return error ? null : data as NextronConversationRow;
}

export async function persistConversationTurn(args: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  clientMessageId: string | null;
  userPrompt: string;
  assistantResponse: NextronCoachResponse;
  intent: NextronCoachingIntent;
}) {
  const existing = args.clientMessageId
    ? await args.supabase.from("nextron_messages").select("id").eq("user_id", args.userId).eq("client_message_id", args.clientMessageId).maybeSingle()
    : null;
  if (existing && !existing.error && existing.data) return false;

  const userMessage = {
    conversation_id: args.conversationId,
    user_id: args.userId,
    role: "user",
    content: sanitizeConversationContent(args.userPrompt, 1_500),
    metadata: { intent: args.intent },
    client_message_id: args.clientMessageId,
  };
  const assistantMessage = {
    conversation_id: args.conversationId,
    user_id: args.userId,
    role: "assistant",
    content: sanitizeConversationContent(args.assistantResponse.interpretation, 2_000),
    response: args.assistantResponse,
    metadata: safeResponseMetadata(args.assistantResponse, args.intent),
  };

  const { error } = await args.supabase.from("nextron_messages").insert([userMessage, assistantMessage]);
  if (error) throw error;
  await args.supabase.from("nextron_conversations").update({ updated_at: new Date().toISOString() }).eq("id", args.conversationId).eq("user_id", args.userId);
  return true;
}
