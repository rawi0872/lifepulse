import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextronUserRequest } from "@/lib/nextron/coach";

export const NEXTRON_MEMORY_CONTENT_MAX_LENGTH = 240;
export const NEXTRON_MEMORY_RETRIEVAL_LIMIT = 3;

export type NextronMemoryType = "PREFERENCE";
export type NextronMemoryStatus = "ACTIVE" | "SUPERSEDED" | "DELETED";

export interface NextronMemoryRow {
  id: string;
  user_id: string;
  type: NextronMemoryType;
  content: string;
  status: NextronMemoryStatus;
  source: "explicit_user";
  confirmed_by_user: boolean;
  supersedes_memory_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NextronMemoryDto {
  id: string;
  type: NextronMemoryType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type NextronMemoryCommand =
  | { kind: "remember"; content: string; supersede: boolean }
  | { kind: "view" }
  | { kind: "forget"; content: string }
  | { kind: "none" }
  | { kind: "rejected_implicit"; reason: string };

export type NextronMemoryWriteResult =
  | { ok: true; memory: NextronMemoryDto; supersededCount: number }
  | { ok: false; reason: string };

export type NextronMemoryForgetResult =
  | { ok: true; forgottenCount: number }
  | { ok: false; reason: string };

const SECRET_OR_INTERNAL_PATTERNS = [
  /\b(api[_-]?key|service_role|password|passcode|secret|token|cookie|authorization|bearer)\b/i,
  /\b(user_id|projectRef|internal id|database id|supabase|sql|select\s+\*|insert\s+into|update\s+.+\s+set|delete\s+from|drop\s+table)\b/i,
  /[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}/,
  /\b(?:sk|pk)_[A-Za-z0-9_-]{12,}\b/,
];

const IMPLICIT_INFERENCE_PATTERNS = [
  /^you seem to\b/i,
  /^i noticed\b/i,
  /^you probably\b/i,
  /^it seems like\b/i,
  /^i think you\b/i,
  /^you might\b/i,
];

const PLANNING_TERMS = ["plan", "daily", "day", "today", "tonight", "structure", "focus", "priority", "short", "concise", "detailed"];
const WORK_TERMS = ["work", "deep work", "project", "task", "focus", "priority", "morning", "evening", "tonight"];
const WELLNESS_TERMS = ["workout", "train", "exercise", "run", "gym", "morning", "evening", "tonight"];

function compactText(value: string): string {
  return value.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>`]/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizePreferenceMemory(input: unknown): { ok: true; content: string } | { ok: false; reason: string } {
  if (typeof input !== "string") return { ok: false, reason: "Memory must be text." };
  const content = compactText(input)
    .replace(/^(?:that\s+)?i\s+/i, "You ")
    .replace(/^that\s+/i, "")
    .replace(/\s+now\.?$/i, "")
    .replace(/\.$/, "")
    .trim();
  if (!content) return { ok: false, reason: "Memory cannot be empty." };
  if (content.length > NEXTRON_MEMORY_CONTENT_MAX_LENGTH) return { ok: false, reason: "Memory is too long." };
  if (!/\b(prefer|prefers|like|likes|work best|works best)\b/i.test(content)) return { ok: false, reason: "Memory v1 only stores explicit preferences." };
  if (IMPLICIT_INFERENCE_PATTERNS.some((pattern) => pattern.test(content))) return { ok: false, reason: "I can discuss that, but I will not save an inference as confirmed memory." };
  if (SECRET_OR_INTERNAL_PATTERNS.some((pattern) => pattern.test(content))) return { ok: false, reason: "That looks like a secret or internal identifier, so I will not store it." };
  return { ok: true, content };
}

export function parseNextronMemoryCommand(rawPrompt: string, normalizedPrompt: string): NextronMemoryCommand {
  const prompt = rawPrompt.trim();
  const normalized = normalizedPrompt.trim();

  if (/\b(what|show|view|list)\b.*\b(remember|memory|memories|preferences)\b/i.test(prompt)) return { kind: "view" };

  const forgetMatch = prompt.match(/^forget\s+(?:that\s+)?(.+)$/i);
  if (forgetMatch?.[1]) return { kind: "forget", content: forgetMatch[1] };

  const rememberMatch = prompt.match(/^(?:actually,?\s*)?remember\s+that\s+(.+)$/i);
  if (rememberMatch?.[1]) return { kind: "remember", content: rememberMatch[1], supersede: /^actually/i.test(prompt) };

  const actuallyPreference = prompt.match(/^actually,?\s+(.+\b(?:prefer|like|work best|works best)\b.+)$/i);
  if (actuallyPreference?.[1]) return { kind: "remember", content: actuallyPreference[1], supersede: true };

  if (/^(you seem to|i noticed|you probably|it seems like|i think you|you might)\b/i.test(prompt)) {
    return { kind: "rejected_implicit", reason: "I can discuss patterns, but I will not save an inference as confirmed memory." };
  }

  if (normalized.includes("remember") && !normalized.startsWith("remember that")) {
    return { kind: "rejected_implicit", reason: "Use an explicit phrase like: Remember that I prefer short daily plans." };
  }

  return { kind: "none" };
}

function toDto(row: NextronMemoryRow): NextronMemoryDto {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/\W+/).filter(Boolean));
}

function hasAnyWord(value: string, terms: readonly string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function looksConflicting(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (hasAnyWord(left, WELLNESS_TERMS) && hasAnyWord(right, WELLNESS_TERMS)) return true;
  if (hasAnyWord(left, PLANNING_TERMS) && hasAnyWord(right, PLANNING_TERMS)) return true;
  if (hasAnyWord(left, WORK_TERMS) && hasAnyWord(right, WORK_TERMS)) return true;
  const overlap = [...words(left)].filter((word) => word.length >= 5 && words(right).has(word));
  return overlap.length >= 2;
}

export async function listActivePreferenceMemories(supabase: SupabaseClient, userId: string, limit = 20): Promise<NextronMemoryDto[]> {
  const { data, error } = await supabase
    .from("nextron_memories")
    .select("id, user_id, type, content, status, source, confirmed_by_user, supersedes_memory_id, created_at, updated_at, deleted_at")
    .eq("user_id", userId)
    .eq("type", "PREFERENCE")
    .eq("status", "ACTIVE")
    .eq("confirmed_by_user", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];
  return (data as NextronMemoryRow[]).map(toDto);
}

export async function rememberPreferenceMemory(supabase: SupabaseClient, userId: string, input: unknown): Promise<NextronMemoryWriteResult> {
  const sanitized = sanitizePreferenceMemory(input);
  if (!sanitized.ok) return sanitized;

  const active = await listActivePreferenceMemories(supabase, userId, 50);
  const conflicting = active.filter((memory) => looksConflicting(memory.content, sanitized.content));
  if (conflicting.length > 0) {
    const { error } = await supabase
      .from("nextron_memories")
      .update({ status: "SUPERSEDED" })
      .eq("user_id", userId)
      .in("id", conflicting.map((memory) => memory.id));
    if (error) return { ok: false, reason: "Could not supersede the previous preference." };
  }

  const { data, error } = await supabase
    .from("nextron_memories")
    .insert({
      user_id: userId,
      type: "PREFERENCE",
      content: sanitized.content,
      status: "ACTIVE",
      source: "explicit_user",
      confirmed_by_user: true,
      supersedes_memory_id: conflicting[0]?.id ?? null,
    })
    .select("id, user_id, type, content, status, source, confirmed_by_user, supersedes_memory_id, created_at, updated_at, deleted_at")
    .single();

  if (error || !data) return { ok: false, reason: "Could not save that preference." };
  return { ok: true, memory: toDto(data as NextronMemoryRow), supersededCount: conflicting.length };
}

export async function forgetPreferenceMemory(supabase: SupabaseClient, userId: string, input: unknown): Promise<NextronMemoryForgetResult> {
  const sanitized = sanitizePreferenceMemory(input);
  const target = sanitized.ok ? sanitized.content : compactText(String(input ?? ""));
  if (!target) return { ok: false, reason: "Tell me which preference to forget." };

  const active = await listActivePreferenceMemories(supabase, userId, 50);
  const matches = /^(?:that\s+)?preference$/i.test(target)
    ? active.slice(0, 1)
    : active.filter((memory) => looksConflicting(memory.content, target) || memory.content.toLowerCase().includes(target.toLowerCase()));
  if (matches.length === 0) return { ok: false, reason: "I could not find an active matching preference to forget." };

  const { error } = await supabase
    .from("nextron_memories")
    .update({ status: "DELETED", content: "[deleted preference]", deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", matches.map((memory) => memory.id));

  if (error) return { ok: false, reason: "Could not forget that preference." };
  return { ok: true, forgottenCount: matches.length };
}

export async function supersedePreferenceMemoryById(supabase: SupabaseClient, userId: string, id: string, input: unknown): Promise<NextronMemoryWriteResult> {
  const sanitized = sanitizePreferenceMemory(input);
  if (!sanitized.ok) return sanitized;

  const { error: oldError } = await supabase
    .from("nextron_memories")
    .update({ status: "SUPERSEDED" })
    .eq("user_id", userId)
    .eq("id", id)
    .eq("status", "ACTIVE");
  if (oldError) return { ok: false, reason: "Could not update that preference." };

  const { data, error } = await supabase
    .from("nextron_memories")
    .insert({ user_id: userId, type: "PREFERENCE", content: sanitized.content, status: "ACTIVE", source: "explicit_user", confirmed_by_user: true, supersedes_memory_id: id })
    .select("id, user_id, type, content, status, source, confirmed_by_user, supersedes_memory_id, created_at, updated_at, deleted_at")
    .single();

  if (error || !data) return { ok: false, reason: "Could not save the updated preference." };
  return { ok: true, memory: toDto(data as NextronMemoryRow), supersededCount: 1 };
}

export async function forgetPreferenceMemoryById(supabase: SupabaseClient, userId: string, id: string): Promise<NextronMemoryForgetResult> {
  const { error } = await supabase
    .from("nextron_memories")
    .update({ status: "DELETED", content: "[deleted preference]", deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .eq("status", "ACTIVE");

  if (error) return { ok: false, reason: "Could not forget that preference." };
  return { ok: true, forgottenCount: 1 };
}

export function isMemoryRelevantToRequest(memory: NextronMemoryDto, request: Pick<NextronUserRequest, "intent" | "normalizedPrompt">): boolean {
  if (["PROJECT_AGENT", "REVIEW", "PATTERN", "STUCK", "MEDICAL", "MENTAL_HEALTH_CRISIS", "FINANCIAL_ADVICE", "LEGAL_ADVICE", "AUTONOMOUS_ACTION", "OUT_OF_SCOPE_GENERAL_KNOWLEDGE"].includes(request.intent)) return false;
  const prompt = request.normalizedPrompt;
  const content = memory.content.toLowerCase();
  if (["PLANNING", "TODAY_FOCUS", "NEXT_ACTION", "GENERAL_SUPPORTED"].includes(request.intent)) {
    if (hasAnyWord(content, PLANNING_TERMS) || hasAnyWord(content, WORK_TERMS)) return true;
    if (hasAnyWord(prompt, WELLNESS_TERMS) && hasAnyWord(content, WELLNESS_TERMS)) return true;
  }
  return [...words(prompt)].some((word) => word.length >= 5 && words(content).has(word));
}

export async function retrieveRelevantPreferenceMemories(supabase: SupabaseClient, userId: string, request: Pick<NextronUserRequest, "intent" | "normalizedPrompt">): Promise<NextronMemoryDto[]> {
  const active = await listActivePreferenceMemories(supabase, userId, 20);
  return active.filter((memory) => isMemoryRelevantToRequest(memory, request)).slice(0, NEXTRON_MEMORY_RETRIEVAL_LIMIT);
}

export function memoryIntentResponse(message: string) {
  return {
    facts: [{ category: "memory" as const, text: "NEXTRON Memory v1 stores only explicit confirmed preferences." }],
    interpretation: message,
    nextAction: { label: "Manage NEXTRON Memory", href: "/settings", rationale: "Use Settings to view, edit, or forget saved preferences." },
    priority: "calm" as const,
    ruleId: "memory_preference_command",
    supportingEvidence: ["NEXTRON Memory v1 stores only explicit confirmed preferences."],
    source: "deterministic" as const,
  };
}

export function memoryViewResponse(memories: NextronMemoryDto[]) {
  const facts = memories.length > 0
    ? memories.slice(0, 5).map((memory) => ({ category: "memory" as const, text: memory.content }))
    : [{ category: "memory" as const, text: "No active preference memories are saved." }];
  return {
    facts,
    interpretation: memories.length > 0 ? "These are your active confirmed preference memories." : "I do not have active preference memories saved for you yet.",
    nextAction: { label: "Manage NEXTRON Memory", href: "/settings", rationale: "Use Settings to edit or forget saved preferences." },
    priority: "calm" as const,
    ruleId: "memory_preference_view",
    supportingEvidence: facts.map((fact) => fact.text),
    source: "deterministic" as const,
  };
}

export function memoryFacts(memories: NextronMemoryDto[]) {
  return memories.map((memory) => ({ content: memory.content }));
}
