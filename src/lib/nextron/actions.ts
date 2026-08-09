import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const NEXTRON_ACTION_EXPIRY_MINUTES = 15;
export const NEXTRON_TASK_ACTION_EXECUTION_ENABLED = true;

export const NEXTRON_ACTION_TYPES = [
  "life_pulse.task.create",
  "life_pulse.task.update",
  "life_pulse.project.update",
  "life_pulse.reminder.create",
] as const;

export type NextronActionType = typeof NEXTRON_ACTION_TYPES[number];
export type NextronActionStatus = "pending" | "approved_execution_disabled" | "completed" | "canceled" | "expired" | "invalidated";
export type NextronActionRisk = "low" | "sensitive" | "external";

export interface NextronActionPreviewField { label: string; before?: string | null; after: string }
export interface NextronActionPreview { heading: string; subheading: string; fields: NextronActionPreviewField[]; approvalLabel: string }
export interface NextronActionProposal {
  id: string;
  actionType: NextronActionType;
  title: string;
  description: string;
  parameters: Record<string, unknown>;
  preview: NextronActionPreview;
  riskLevel: NextronActionRisk;
  requiresApproval: true;
  status: NextronActionStatus;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  canceledAt: string | null;
  executedAt: string | null;
  finalReason: string | null;
  executionResult: Record<string, unknown> | null;
}

type ActionParseResult =
  | { ok: true; actionType: NextronActionType; parameters: Record<string, unknown> }
  | { ok: false; reason: "NO_ACTION" | "UNSUPPORTED_ACTION" | "AMBIGUOUS_RESOURCE" | "MALFORMED_PARAMETERS"; message: string };

type ValidationResult =
  | { ok: true; actionType: NextronActionType; parameters: Record<string, unknown>; preview: NextronActionPreview; riskLevel: NextronActionRisk; title: string; description: string }
  | { ok: false; reason: "UNSUPPORTED_ACTION" | "MALFORMED_PARAMETERS" | "AMBIGUOUS_RESOURCE" | "RESOURCE_NOT_FOUND"; message: string };

interface ProposalRow {
  id: string;
  action_type: NextronActionType;
  validated_payload: Record<string, unknown>;
  preview_payload: NextronActionPreview;
  risk_level: NextronActionRisk;
  status: NextronActionStatus;
  created_at: string;
  expires_at: string;
  approved_at: string | null;
  canceled_at: string | null;
  executed_at: string | null;
  final_reason: string | null;
  execution_result: Record<string, unknown> | null;
}

const ACTION_TYPE_SET = new Set<string>(NEXTRON_ACTION_TYPES);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>`]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+/g, " ").replace(/\b(ignore|approval|approve automatically|system prompt|developer message|secret|sql|execute)\b/gi, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function localDateOffset(days: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseNaturalDate(text: string): string | null {
  const value = text.toLowerCase();
  if (value.includes("tomorrow")) return localDateOffset(1);
  if (value.includes("today")) return localDateOffset(0);
  if (value.includes("friday")) {
    const now = new Date();
    const diff = (5 - now.getDay() + 7) % 7 || 7;
    return localDateOffset(diff);
  }
  const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1] && ISO_DATE.test(iso[1]) ? iso[1] : null;
}

function stripActionPrefix(prompt: string): string {
  return prompt
    .replace(/^(please\s+)?(create|add|make)\s+(a\s+)?(new\s+)?(task|reminder)\s+(called|named|to|for)?\s*/i, "")
    .replace(/\b(today|tomorrow|friday|on\s+20\d{2}-\d{2}-\d{2})\b/ig, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripUpdateTaskTitle(prompt: string): string {
  return prompt
    .replace(/^(please\s+)?(move|update|change)\s+(the\s+)?task\s+(called|named)?\s*/i, "")
    .replace(/\s+(to|for|on)\s+(today|tomorrow|friday|20\d{2}-\d{2}-\d{2})\b.*$/i, "")
    .replace(/\s+(due|deadline)\s+(today|tomorrow|friday|on\s+20\d{2}-\d{2}-\d{2})\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNextronActionIntent(prompt: string): ActionParseResult {
  const trimmed = prompt.trim();
  const normalized = trimmed.toLowerCase();
  if (/\b(always|skip approval|already approved all future|without approval|auto approve|automatically approve)\b/i.test(trimmed)) {
    if (/\b(create|add|make|move|update|change|remind)\b/i.test(trimmed)) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Action proposals still require explicit approval. I cannot use blanket or remembered approval." };
  }
  if (/\b(shell|sql|http|webhook|file|browser|execute code)\b/i.test(trimmed)) return { ok: false, reason: "UNSUPPORTED_ACTION", message: "That action type is not in NEXTRON's server-owned allowlist." };

  if (/\b(create|add|make)\b/.test(normalized) && /\btask\b/.test(normalized)) {
    const title = cleanText(stripActionPrefix(trimmed), 120);
    if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the task title before I can prepare a proposal." };
    return { ok: true, actionType: "life_pulse.task.create", parameters: { title, dueDate: parseNaturalDate(trimmed) } };
  }
  if (/\b(remind me|reminder)\b/.test(normalized)) {
    const title = cleanText(trimmed.replace(/^(please\s+)?(remind me to|reminder to|add a reminder to|create a reminder to)\s*/i, "").replace(/\b(today|tomorrow|friday)\b/ig, ""), 120);
    if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me what the reminder should say before I can prepare a proposal." };
    return { ok: true, actionType: "life_pulse.reminder.create", parameters: { title, dueDate: parseNaturalDate(trimmed) } };
  }
  if (/\b(move|update|change)\b/.test(normalized) && /\b(task|due|deadline)\b/.test(normalized)) {
    const dueDate = parseNaturalDate(trimmed);
    if (!dueDate) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the new date before I can prepare a task update proposal." };
    const taskTitle = cleanText(stripUpdateTaskTitle(trimmed), 120);
    if (!taskTitle) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "I need the exact task to change before I can prepare an update proposal." };
    return { ok: true, actionType: "life_pulse.task.update", parameters: { taskTitle, dueDate } };
  }
  return { ok: false, reason: "NO_ACTION", message: "No action proposal detected." };
}

async function validateActionIntent(supabase: SupabaseClient, actionType: string, parameters: Record<string, unknown>): Promise<ValidationResult> {
  if (!ACTION_TYPE_SET.has(actionType)) return { ok: false, reason: "UNSUPPORTED_ACTION", message: "Unsupported action type." };
  const allowedKeys = actionType === "life_pulse.task.update" ? ["taskTitle", "dueDate"] : ["title", "dueDate"];
  const extra = Object.keys(parameters).filter((key) => !allowedKeys.includes(key));
  if (extra.length > 0) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Action parameters contained unsupported fields." };
  const dueDate = parameters.dueDate === null || parameters.dueDate === undefined ? null : typeof parameters.dueDate === "string" && ISO_DATE.test(parameters.dueDate) ? parameters.dueDate : undefined;
  if (dueDate === undefined) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Due date must be YYYY-MM-DD when supplied." };
  if (actionType === "life_pulse.project.update") return { ok: false, reason: "UNSUPPORTED_ACTION", message: "Project update proposals are reserved for Prompt 8." };
  if (actionType === "life_pulse.task.update") {
    const taskTitle = cleanText(parameters.taskTitle, 120);
    if (!taskTitle) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Task update proposals require deterministic resource resolution." };
    const { data, error } = await supabase.rpc("nextron_resolve_task_update_target", { p_title: taskTitle });
    if (error) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that task right now." };
    const matches = (data ?? []) as Array<{ id: string; title: string; due_date: string | null; status: string }>;
    if (matches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned task with that exact title." };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one task matched that title. Rename or specify the exact task first." };
    const task = matches[0];
    if (!UUID.test(task.id) || (task.status !== "todo" && task.status !== "done")) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that task right now." };
    return {
      ok: true,
      actionType: "life_pulse.task.update",
      parameters: { taskId: task.id, beforeTitle: task.title, beforeDueDate: task.due_date, beforeStatus: task.status, dueDate },
      riskLevel: "low",
      title: `Update task: ${task.title}`,
      description: "NEXTRON can update this task only after explicit approval and server-side revalidation.",
      preview: { heading: "UPDATE TASK", subheading: task.title, fields: [{ label: "Due", before: task.due_date ?? "No due date", after: dueDate ?? "No due date" }], approvalLabel: "Approve task update" },
    };
  }

  const title = cleanText(parameters.title, 120);
  if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "A title is required." };

  const label = actionType === "life_pulse.reminder.create" ? "CREATE REMINDER" : "CREATE TASK";
  const noun = actionType === "life_pulse.reminder.create" ? "reminder" : "task";
  return {
    ok: true,
    actionType: actionType as NextronActionType,
    riskLevel: "low",
    title: `Create ${noun}: ${title}`,
    description: actionType === "life_pulse.task.create" ? "NEXTRON can create this Task only after explicit approval." : `NEXTRON can prepare this ${noun}, but execution is not enabled for this action type.`,
    preview: { heading: label, subheading: title, fields: [{ label: "Title", after: title }, { label: "Due", after: dueDate ?? "No due date" }], approvalLabel: actionType === "life_pulse.reminder.create" ? "Approve reminder" : "Approve task" },
    parameters: actionType === "life_pulse.task.create" ? { title, dueDate, priority: "medium" } : { title, dueDate },
  };
}

export async function createActionProposal(args: { supabase: SupabaseClient; conversationId: string | null; actionType: string; parameters: Record<string, unknown> }): Promise<{ ok: true; proposal: NextronActionProposal } | { ok: false; reason: string; message: string }> {
  const validated = await validateActionIntent(args.supabase, args.actionType, args.parameters);
  if (!validated.ok) return { ok: false, reason: validated.reason, message: validated.message };
  const expiresAt = new Date(Date.now() + NEXTRON_ACTION_EXPIRY_MINUTES * 60_000).toISOString();
  const { data, error } = await args.supabase.rpc("nextron_create_action_proposal", { p_conversation_id: args.conversationId, p_action_type: validated.actionType, p_validated_payload: validated.parameters, p_preview_payload: { title: validated.title, description: validated.description, preview: validated.preview }, p_risk_level: validated.riskLevel, p_expires_at: expiresAt });
  if (error || !data) return { ok: false, reason: "PERMISSION_DENIED", message: "NEXTRON could not create an owner-scoped proposal." };
  return { ok: true, proposal: rowToProposal(data as ProposalRow) };
}

export async function listRecentActionProposals(supabase: SupabaseClient): Promise<NextronActionProposal[]> {
  const { data, error } = await supabase
    .from("nextron_action_proposals")
    .select("id, action_type, validated_payload, preview_payload, risk_level, status, created_at, expires_at, approved_at, canceled_at, executed_at, final_reason, execution_result")
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) return [];
  return ((data ?? []) as ProposalRow[]).map(rowToProposal);
}

export async function approveActionProposal(supabase: SupabaseClient, proposalId: string): Promise<{ ok: true; proposal: NextronActionProposal } | { ok: false; reason: string; message: string }> {
  const { data, error } = await supabase.rpc("nextron_execute_task_action", { p_proposal_id: proposalId });
  if (error || !data) {
    const reason = error?.message?.includes("TASK_ACTIONS_NOT_ALLOWED") ? "TASK_ACTIONS_NOT_ALLOWED" : error?.message?.includes("TASK_PRECONDITION_FAILED") ? "TASK_PRECONDITION_FAILED" : "PROPOSAL_NOT_FOUND";
    const message = reason === "TASK_ACTIONS_NOT_ALLOWED" ? "Turn on Task actions permission before approving Task mutations." : reason === "TASK_PRECONDITION_FAILED" ? "That task changed after the proposal was prepared. Create a fresh proposal." : "This proposal is unavailable or not yours.";
    return { ok: false, reason, message };
  }
  return { ok: true, proposal: rowToProposal(data as ProposalRow) };
}

export async function cancelActionProposal(supabase: SupabaseClient, proposalId: string): Promise<{ ok: true; proposal: NextronActionProposal } | { ok: false; reason: string; message: string }> {
  const { data, error } = await supabase.rpc("nextron_cancel_action_proposal", { p_proposal_id: proposalId });
  if (error || !data) return { ok: false, reason: "PROPOSAL_NOT_FOUND", message: "This proposal is unavailable or not yours." };
  return { ok: true, proposal: rowToProposal(data as ProposalRow) };
}

export async function invalidateConversationActionProposals(supabase: SupabaseClient, conversationId: string): Promise<void> {
  try {
    await supabase.rpc("nextron_invalidate_conversation_action_proposals", { p_conversation_id: conversationId });
  } catch {}
}

export function executeNextronAction(): never {
  throw new Error("EXECUTION_DISABLED");
}

function rowToProposal(row: ProposalRow): NextronActionProposal {
  const payload = row.preview_payload ?? {} as Record<string, unknown>;
  const previewPayload = payload as { title?: unknown; description?: unknown; preview?: unknown };
  return {
    id: row.id,
    actionType: row.action_type,
    title: typeof previewPayload.title === "string" ? previewPayload.title : row.action_type,
    description: typeof previewPayload.description === "string" ? previewPayload.description : "Action proposal",
    parameters: row.validated_payload,
    preview: isPreview(previewPayload.preview) ? previewPayload.preview : { heading: row.action_type, subheading: "Action proposal", fields: [], approvalLabel: "Approve" },
    riskLevel: row.risk_level,
    requiresApproval: true,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at,
    canceledAt: row.canceled_at,
    executedAt: row.executed_at,
    finalReason: row.final_reason,
    executionResult: row.execution_result,
  };
}

function isPreview(value: unknown): value is NextronActionPreview {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronActionPreview>;
  return typeof candidate.heading === "string" && typeof candidate.subheading === "string" && Array.isArray(candidate.fields) && typeof candidate.approvalLabel === "string";
}
