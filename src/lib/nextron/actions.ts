import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLifeSetupDraft, type LifeSetupDraft } from "@/lib/nextron/onboarding";

export const NEXTRON_ACTION_EXPIRY_MINUTES = 15;
export const NEXTRON_TASK_ACTION_EXECUTION_ENABLED = true;

export const NEXTRON_ACTION_TYPES = [
  "life_pulse.task.create",
  "life_pulse.task.update",
  "life_pulse.goal.create",
  "life_pulse.goal.update",
  "life_pulse.goal.link",
  "life_pulse.goal.unlink",
  "life_pulse.habit.create",
  "life_pulse.habit.update",
  "life_pulse.project.create",
  "life_pulse.project.update",
  "life_pulse.action_plan.execute",
  "life_pulse.reminder.create",
] as const;

export type NextronActionType = typeof NEXTRON_ACTION_TYPES[number];
export type NextronActionStatus = "pending" | "approved_execution_disabled" | "completed" | "partially_failed" | "failed" | "stale" | "canceled" | "expired" | "invalidated";
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

export type NextronActionPermissionDomain = "taskActions" | "goalActions" | "habitActions" | "projectActions";

interface PlanAction { actionType: NextronActionType; payload: Record<string, unknown>; summary: string; reason: string }

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
const MAX_PLAN_ACTIONS = 20;

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
    .replace(/^(please\s+)?(create|add|make)\s+(a\s+)?(new\s+)?(task|reminder|goal|habit|project)\s+(called|named|to|for)?\s*/i, "")
    .replace(/\b(today|tomorrow|friday|on\s+20\d{2}-\d{2}-\d{2})\b/ig, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDomainPrefix(prompt: string, domain: "goal" | "habit" | "project"): string {
  return prompt
    .replace(new RegExp(`^(please\\s+)?(create|add|make)\\s+(a\\s+)?(new\\s+)?${domain}\\s+(called|named|to|for)?\\s*`, "i"), "")
    .replace(/\b(as my highest priority|highest priority|high priority|low priority|medium priority|three times per week|3 times per week|daily|weekly)\b/ig, "")
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

function parseRelationshipIntent(trimmed: string, normalized: string): ActionParseResult | null {
  const linkMatch = trimmed.match(/^(?:please\s+)?(?:connect|link|attach)\s+(.+?)\s+(?:to|with)\s+(.+?)\.?$/i);
  if (linkMatch && /\b(connect|link|attach)\b/.test(normalized)) {
    const linkedTitle = cleanText(linkMatch[1], 140);
    const goalTitle = cleanText(linkMatch[2].replace(/^my\s+/i, "").replace(/\s+goal$/i, ""), 140);
    if (!linkedTitle || !goalTitle) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the exact goal and item to connect." };
    return { ok: true, actionType: "life_pulse.goal.link", parameters: { goalTitle, linkedTitle } };
  }
  const unlinkMatch = trimmed.match(/^(?:please\s+)?(?:remove|disconnect|unlink|detach)\s+(.+?)\s+from\s+(.+?)\.?$/i);
  if (unlinkMatch && /\b(remove|disconnect|unlink|detach)\b/.test(normalized)) {
    const linkedTitle = cleanText(unlinkMatch[1], 140);
    const goalTitle = cleanText(unlinkMatch[2].replace(/^my\s+/i, "").replace(/\s+goal$/i, ""), 140);
    if (!linkedTitle || !goalTitle) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the exact goal and item to disconnect." };
    return { ok: true, actionType: "life_pulse.goal.unlink", parameters: { goalTitle, linkedTitle } };
  }
  return null;
}

export function parseNextronActionIntent(prompt: string): ActionParseResult {
  const trimmed = prompt.trim();
  const normalized = trimmed.toLowerCase();
  if (/\b(always|skip approval|already approved all future|without approval|auto approve|automatically approve)\b/i.test(trimmed)) {
    if (/\b(create|add|make|move|update|change|remind)\b/i.test(trimmed)) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Action proposals still require explicit approval. I cannot use blanket or remembered approval." };
  }
  if (/\b(shell|sql|http|webhook|file|browser|execute code)\b/i.test(trimmed)) return { ok: false, reason: "UNSUPPORTED_ACTION", message: "That action type is not in NEXTRON's server-owned allowlist." };

  if (/\b(schedule|calendar|event)\b/.test(normalized) && /\b(create|add|move|change|update)\b/.test(normalized)) {
    return { ok: false, reason: "UNSUPPORTED_ACTION", message: "Calendar changes are not enabled. NEXTRON can still help prepare Life Pulse Goals, Habits, Projects, and Tasks for approval." };
  }
  if (/\b(delete|remove permanently|wipe|erase)\b/.test(normalized)) {
    return { ok: false, reason: "UNSUPPORTED_ACTION", message: "Destructive delete actions are not enabled for NEXTRON." };
  }

  const relationshipIntent = parseRelationshipIntent(trimmed, normalized);
  if (relationshipIntent) return relationshipIntent;

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
  if (/\b(create|add|make)\b/.test(normalized) && /\bgoal\b/.test(normalized)) {
    const title = cleanText(stripDomainPrefix(trimmed, "goal"), 140);
    if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the goal title before I can prepare a proposal." };
    return { ok: true, actionType: "life_pulse.goal.create", parameters: { title, priority: normalized.includes("highest") || normalized.includes("high priority") ? "high" : "medium" } };
  }
  if (/\b(create|add|make)\b/.test(normalized) && /\bhabit\b/.test(normalized)) {
    const title = cleanText(stripDomainPrefix(trimmed, "habit"), 140);
    if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the habit title before I can prepare a proposal." };
    const three = /\b(three|3)\s+times\s+per\s+week\b/.test(normalized);
    return { ok: true, actionType: "life_pulse.habit.create", parameters: { title, frequency: three ? "times_per_week" : normalized.includes("weekly") ? "weekly" : "daily", timesPerWeek: three ? 3 : null } };
  }
  if (/\b(create|add|make)\b/.test(normalized) && /\bproject\b/.test(normalized)) {
    const title = cleanText(stripDomainPrefix(trimmed, "project"), 140);
    if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the project title before I can prepare a proposal." };
    return { ok: true, actionType: "life_pulse.project.create", parameters: { title } };
  }
  if (/\b(move|update|change)\b/.test(normalized) && /\b(task|due|deadline)\b/.test(normalized)) {
    const projectMatch = trimmed.match(/^(?:please\s+)?(?:move|update|change)\s+(?:the\s+)?task\s+(.+?)\s+(?:into|to|under)\s+(?:the\s+)?project\s+(.+?)\.?$/i);
    if (projectMatch) {
      const taskTitle = cleanText(projectMatch[1].replace(/^(called|named)\s+/i, ""), 120);
      const projectTitle = cleanText(projectMatch[2], 140);
      if (!taskTitle || !projectTitle) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "I need the exact task and project before I can prepare the move." };
      return { ok: true, actionType: "life_pulse.task.update", parameters: { taskTitle, projectTitle } };
    }
    const dueDate = parseNaturalDate(trimmed);
    if (!dueDate) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Tell me the new date or project before I can prepare a task update proposal." };
    const taskTitle = cleanText(stripUpdateTaskTitle(trimmed), 120);
    if (!taskTitle) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "I need the exact task to change before I can prepare an update proposal." };
    return { ok: true, actionType: "life_pulse.task.update", parameters: { taskTitle, dueDate } };
  }
  if (/\b(update|change|make)\b/.test(normalized) && /\b(goal\b|priority)/.test(normalized)) {
    const title = cleanText(trimmed.replace(/^(please\s+)?(update|change|make)\s+(the\s+)?goal\s+(called|named)?\s*/i, "").replace(/\s+(to|as)\s+(my\s+)?(highest|high|medium|low).*$/i, ""), 140);
    const priority = normalized.includes("highest") || normalized.includes("high") ? "high" : normalized.includes("low") ? "low" : "medium";
    if (!title) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "I need the exact goal to change before I can prepare an update proposal." };
    return { ok: true, actionType: "life_pulse.goal.update", parameters: { goalTitle: title, priority } };
  }
  if (/\b(update|change|make)\b/.test(normalized) && /\bhabit\b/.test(normalized)) {
    const title = cleanText(trimmed.replace(/^(please\s+)?(update|change|make)\s+(the\s+)?habit\s+(called|named)?\s*/i, "").replace(/\s+to\s+.*$/i, ""), 140);
    const three = /\b(three|3)\s+times\s+per\s+week\b/.test(normalized);
    if (!title || !three) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "Tell me the exact habit and new frequency before I can prepare an update proposal." };
    return { ok: true, actionType: "life_pulse.habit.update", parameters: { habitTitle: title, frequency: "times_per_week", timesPerWeek: 3 } };
  }
  if (/\b(update|change|pause|complete)\b/.test(normalized) && /\bproject\b/.test(normalized)) {
    const title = cleanText(trimmed.replace(/^(please\s+)?(update|change|pause|complete)\s+(the\s+)?project\s+(called|named)?\s*/i, "").replace(/\s+to\s+.*$/i, ""), 140);
    const status = normalized.includes("pause") ? "paused" : normalized.includes("complete") ? "completed" : "active";
    if (!title) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "I need the exact project to change before I can prepare an update proposal." };
    return { ok: true, actionType: "life_pulse.project.update", parameters: { projectTitle: title, status } };
  }
  return { ok: false, reason: "NO_ACTION", message: "No action proposal detected." };
}

function rejectExtra(parameters: Record<string, unknown>, allowedKeys: string[]): ValidationResult | null {
  const extra = Object.keys(parameters).filter((key) => !allowedKeys.includes(key));
  return extra.length > 0 ? { ok: false, reason: "MALFORMED_PARAMETERS", message: "Action parameters contained unsupported fields." } : null;
}

function nullableDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

function priority(value: unknown): "low" | "medium" | "high" | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function frequency(value: unknown): "daily" | "weekdays" | "weekends" | "weekly" | "times_per_week" | null {
  return value === "daily" || value === "weekdays" || value === "weekends" || value === "weekly" || value === "times_per_week" ? value : null;
}

async function resolveOne<T extends Record<string, unknown>>(supabase: SupabaseClient, table: "goals" | "habits" | "projects", title: string, select: string): Promise<T[] | null> {
  const { data, error } = await supabase.from(table).select(select).eq("title", title).order("created_at", { ascending: false }).limit(2);
  if (error) return null;
  return (data ?? []) as unknown as T[];
}

type LinkableType = "project" | "task" | "habit";
interface LinkableMatch { linkedType: LinkableType; linkedId: string; title: string; status: string | null }

async function resolveLinkable(supabase: SupabaseClient, title: string): Promise<LinkableMatch[] | null> {
  const [projectsRes, tasksRes, habitsRes] = await Promise.all([
    supabase.from("projects").select("id, title, status").eq("title", title).order("created_at", { ascending: false }).limit(2),
    supabase.from("tasks").select("id, title, status").eq("title", title).order("created_at", { ascending: false }).limit(2),
    supabase.from("habits").select("id, title, frequency").eq("title", title).order("created_at", { ascending: false }).limit(2),
  ]);
  if (projectsRes.error || tasksRes.error || habitsRes.error) return null;
  return [
    ...((projectsRes.data ?? []) as Array<{ id: string; title: string; status: string | null }>).map((row) => ({ linkedType: "project" as const, linkedId: row.id, title: row.title, status: row.status })),
    ...((tasksRes.data ?? []) as Array<{ id: string; title: string; status: string | null }>).map((row) => ({ linkedType: "task" as const, linkedId: row.id, title: row.title, status: row.status })),
    ...((habitsRes.data ?? []) as Array<{ id: string; title: string; frequency: string | null }>).map((row) => ({ linkedType: "habit" as const, linkedId: row.id, title: row.title, status: row.frequency })),
  ];
}

async function validateActionIntent(supabase: SupabaseClient, actionType: string, parameters: Record<string, unknown>): Promise<ValidationResult> {
  if (!ACTION_TYPE_SET.has(actionType)) return { ok: false, reason: "UNSUPPORTED_ACTION", message: "Unsupported action type." };
  if (actionType === "life_pulse.task.update") {
    const extra = rejectExtra(parameters, ["taskTitle", "dueDate", "projectTitle"]);
    if (extra) return extra;
    const dueDate = nullableDate(parameters.dueDate);
    if (dueDate === undefined) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Due date must be YYYY-MM-DD when supplied." };
    const projectTitle = cleanText(parameters.projectTitle, 140);
    if (dueDate === null && !projectTitle) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Task update proposals require a new date or project." };
    const taskTitle = cleanText(parameters.taskTitle, 120);
    if (!taskTitle) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Task update proposals require deterministic resource resolution." };
    const { data, error } = await supabase.rpc("nextron_resolve_task_update_target", { p_title: taskTitle });
    if (error) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that task right now." };
    const matches = (data ?? []) as Array<{ id: string; title: string; due_date: string | null; status: string }>;
    if (matches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned task with that exact title." };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one task matched that title. Rename or specify the exact task first." };
    const task = matches[0];
    if (typeof task.id !== "string" || !task.id || (task.status !== "todo" && task.status !== "done")) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that task right now." };
    if (projectTitle) {
      const projectMatches = await resolveOne<{ id: string; title: string; status: string }>(supabase, "projects", projectTitle, "id, title, status");
      if (!projectMatches) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that project right now." };
      if (projectMatches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned project with that exact title." };
      if (projectMatches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one project matched that title. Rename or specify the exact project first." };
      const project = projectMatches[0];
      return {
        ok: true,
        actionType: "life_pulse.task.update",
        parameters: { taskId: task.id, beforeTitle: task.title, beforeDueDate: task.due_date, beforeStatus: task.status, projectId: project.id, projectTitle: project.title, projectStatus: project.status },
        riskLevel: "low",
        title: `Move task: ${task.title}`,
        description: "NEXTRON can assign this Task to the selected Project only after explicit approval and server-side revalidation.",
        preview: { heading: "MOVE TASK", subheading: task.title, fields: [{ label: "Project", before: "No project change yet", after: project.title }], approvalLabel: "Approve task move" },
      };
    }
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

  if (actionType === "life_pulse.goal.link" || actionType === "life_pulse.goal.unlink") {
    const extra = rejectExtra(parameters, ["goalTitle", "linkedTitle"]);
    if (extra) return extra;
    const goalTitle = cleanText(parameters.goalTitle, 140);
    const linkedTitle = cleanText(parameters.linkedTitle, 140);
    if (!goalTitle || !linkedTitle) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Relationship proposals require exact goal and item titles." };
    const goalMatches = await resolveOne<{ id: string; title: string; status: string }>(supabase, "goals", goalTitle, "id, title, status");
    if (!goalMatches) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that goal right now." };
    if (goalMatches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned goal with that exact title." };
    if (goalMatches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one goal matched that title. Rename or specify the exact goal first." };
    const matches = await resolveLinkable(supabase, linkedTitle);
    if (!matches) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that linked item right now." };
    if (matches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned Project, Task, or Habit with that exact title." };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one Project, Task, or Habit matched that title. Specify the exact item first." };
    const goal = goalMatches[0];
    const linked = matches[0];
    const isLink = actionType === "life_pulse.goal.link";
    return {
      ok: true,
      actionType,
      parameters: { goalId: goal.id, goalTitle: goal.title, goalStatus: goal.status, linkedType: linked.linkedType, linkedId: linked.linkedId, linkedTitle: linked.title, linkedStatus: linked.status },
      riskLevel: "low",
      title: `${isLink ? "Connect" : "Disconnect"}: ${linked.title} ${isLink ? "to" : "from"} ${goal.title}`,
      description: `NEXTRON can ${isLink ? "create" : "remove"} this explicit Goal relationship only after write permission and approval. It will not delete any Goal, Project, Task, or Habit.`,
      preview: { heading: isLink ? "CONNECT TO GOAL" : "DISCONNECT FROM GOAL", subheading: goal.title, fields: [{ label: "Goal", after: goal.title }, { label: linked.linkedType[0].toUpperCase() + linked.linkedType.slice(1), after: linked.title }], approvalLabel: isLink ? "Approve connection" : "Approve disconnect" },
    };
  }

  if (actionType === "life_pulse.goal.update") {
    const extra = rejectExtra(parameters, ["goalTitle", "priority", "targetDate"]);
    if (extra) return extra;
    const goalTitle = cleanText(parameters.goalTitle, 140);
    const nextPriority = priority(parameters.priority);
    const targetDate = nullableDate(parameters.targetDate);
    if (!goalTitle || !nextPriority || targetDate === undefined) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Goal update proposals require an exact goal and legal fields." };
    const matches = await resolveOne<{ id: string; title: string; status: string; priority: string; target_date: string | null }>(supabase, "goals", goalTitle, "id, title, status, priority, target_date");
    if (!matches) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that goal right now." };
    if (matches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned goal with that exact title." };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one goal matched that title. Rename or specify the exact goal first." };
    const goal = matches[0];
    return { ok: true, actionType, parameters: { goalId: goal.id, beforeTitle: goal.title, beforeStatus: goal.status, beforePriority: goal.priority, beforeTargetDate: goal.target_date, priority: nextPriority, targetDate }, riskLevel: "low", title: `Update goal: ${goal.title}`, description: "NEXTRON can update this Goal only after explicit approval and server-side revalidation.", preview: { heading: "UPDATE GOAL", subheading: goal.title, fields: [{ label: "Priority", before: goal.priority, after: nextPriority }, { label: "Target", before: goal.target_date ?? "No target date", after: targetDate ?? "No target date" }], approvalLabel: "Approve goal update" } };
  }

  if (actionType === "life_pulse.habit.update") {
    const extra = rejectExtra(parameters, ["habitTitle", "frequency", "timesPerWeek"]);
    if (extra) return extra;
    const habitTitle = cleanText(parameters.habitTitle, 140);
    const nextFrequency = frequency(parameters.frequency);
    const timesPerWeek = parameters.timesPerWeek === null || parameters.timesPerWeek === undefined ? null : Number(parameters.timesPerWeek);
    const invalidTimes = nextFrequency === "times_per_week" && (timesPerWeek === null || !Number.isInteger(timesPerWeek) || timesPerWeek < 1 || timesPerWeek > 7);
    if (!habitTitle || !nextFrequency || invalidTimes) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Habit update proposals require an exact habit and legal frequency." };
    const matches = await resolveOne<{ id: string; title: string; frequency: string; times_per_week: number | null }>(supabase, "habits", habitTitle, "id, title, frequency, times_per_week");
    if (!matches) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that habit right now." };
    if (matches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned habit with that exact title." };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one habit matched that title. Rename or specify the exact habit first." };
    const habit = matches[0];
    return { ok: true, actionType, parameters: { habitId: habit.id, beforeTitle: habit.title, beforeFrequency: habit.frequency, beforeTimesPerWeek: habit.times_per_week, frequency: nextFrequency, timesPerWeek }, riskLevel: "low", title: `Update habit: ${habit.title}`, description: "NEXTRON can update this Habit only after explicit approval and server-side revalidation.", preview: { heading: "UPDATE HABIT", subheading: habit.title, fields: [{ label: "Frequency", before: habit.frequency === "times_per_week" ? `${habit.times_per_week ?? "?"} times/week` : habit.frequency, after: nextFrequency === "times_per_week" ? `${timesPerWeek} times/week` : nextFrequency }], approvalLabel: "Approve habit update" } };
  }

  if (actionType === "life_pulse.project.update") {
    const extra = rejectExtra(parameters, ["projectTitle", "status", "deadline"]);
    if (extra) return extra;
    const projectTitle = cleanText(parameters.projectTitle, 140);
    const status = parameters.status === "active" || parameters.status === "paused" || parameters.status === "completed" ? parameters.status : null;
    const deadline = nullableDate(parameters.deadline);
    if (!projectTitle || !status || deadline === undefined) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Project update proposals require an exact project and legal fields." };
    const matches = await resolveOne<{ id: string; title: string; status: string; deadline: string | null }>(supabase, "projects", projectTitle, "id, title, status, deadline");
    if (!matches) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "NEXTRON could not verify that project right now." };
    if (matches.length === 0) return { ok: false, reason: "RESOURCE_NOT_FOUND", message: "I could not find an owned project with that exact title." };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_RESOURCE", message: "More than one project matched that title. Rename or specify the exact project first." };
    const project = matches[0];
    return { ok: true, actionType, parameters: { projectId: project.id, beforeTitle: project.title, beforeStatus: project.status, beforeDeadline: project.deadline, status, deadline }, riskLevel: "low", title: `Update project: ${project.title}`, description: "NEXTRON can update this Project only after explicit approval and server-side revalidation.", preview: { heading: "UPDATE PROJECT", subheading: project.title, fields: [{ label: "Status", before: project.status, after: status }, { label: "Deadline", before: project.deadline ?? "No deadline", after: deadline ?? "No deadline" }], approvalLabel: "Approve project update" } };
  }

  const allowed = actionType === "life_pulse.task.create" ? ["title", "dueDate", "priority"] : actionType === "life_pulse.goal.create" ? ["title", "description", "why", "priority", "targetDate"] : actionType === "life_pulse.habit.create" ? ["title", "description", "frequency", "timesPerWeek"] : actionType === "life_pulse.project.create" ? ["title", "description", "deadline"] : ["title", "dueDate"];
  const extra = rejectExtra(parameters, allowed);
  if (extra) return extra;
  const dueDate = nullableDate(parameters.dueDate);
  if (dueDate === undefined) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Due date must be YYYY-MM-DD when supplied." };
  const title = cleanText(parameters.title, 120);
  if (!title) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "A title is required." };

  const noun = actionType.includes("goal") ? "goal" : actionType.includes("habit") ? "habit" : actionType.includes("project") ? "project" : actionType === "life_pulse.reminder.create" ? "reminder" : "task";
  const label = `CREATE ${noun.toUpperCase()}`;
  const targetDate = nullableDate(parameters.targetDate);
  const deadline = nullableDate(parameters.deadline);
  if (targetDate === undefined || deadline === undefined) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Date fields must be YYYY-MM-DD when supplied." };
  const nextPriority = priority(parameters.priority) ?? "medium";
  const nextFrequency = frequency(parameters.frequency) ?? "daily";
  const timesPerWeek = parameters.timesPerWeek === null || parameters.timesPerWeek === undefined ? null : Number(parameters.timesPerWeek);
  const invalidCreateTimes = actionType === "life_pulse.habit.create" && nextFrequency === "times_per_week" && (timesPerWeek === null || !Number.isInteger(timesPerWeek) || timesPerWeek < 1 || timesPerWeek > 7);
  if (invalidCreateTimes) return { ok: false, reason: "MALFORMED_PARAMETERS", message: "Times per week must be between 1 and 7." };
  const description = cleanText(parameters.description, 500);
  const why = cleanText(parameters.why, 300);
  const payload = actionType === "life_pulse.task.create" ? { title, dueDate, priority: nextPriority } : actionType === "life_pulse.goal.create" ? { title, description, why, priority: nextPriority, targetDate } : actionType === "life_pulse.habit.create" ? { title, description, frequency: nextFrequency, timesPerWeek } : actionType === "life_pulse.project.create" ? { title, description, deadline } : { title, dueDate };
  const fields = actionType === "life_pulse.habit.create" ? [{ label: "Title", after: title }, { label: "Frequency", after: nextFrequency === "times_per_week" ? `${timesPerWeek} times/week` : nextFrequency }] : actionType === "life_pulse.goal.create" ? [{ label: "Title", after: title }, { label: "Priority", after: nextPriority }, { label: "Target", after: targetDate ?? "No target date" }] : actionType === "life_pulse.project.create" ? [{ label: "Title", after: title }, { label: "Deadline", after: deadline ?? "No deadline" }] : [{ label: "Title", after: title }, { label: "Due", after: dueDate ?? "No due date" }];
  return {
    ok: true,
    actionType: actionType as NextronActionType,
    riskLevel: "low",
    title: `Create ${noun}: ${title}`,
    description: actionType === "life_pulse.reminder.create" ? "NEXTRON can prepare this reminder, but reminder execution is not enabled." : `NEXTRON can create this ${noun} only after write permission and explicit approval.`,
    preview: { heading: label, subheading: title, fields, approvalLabel: actionType === "life_pulse.reminder.create" ? "Approve reminder" : `Approve ${noun}` },
    parameters: payload,
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

function draftHash(draft: LifeSetupDraft): string {
  let hash = 0;
  const input = JSON.stringify(draft);
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  return `draft-${Math.abs(hash)}`;
}

function planPreview(actions: PlanAction[], source: "onboarding" | "conversation"): NextronActionPreview {
  const counts = actions.reduce<Record<string, number>>((acc, action) => {
    const domain = action.actionType.split(".")[1] ?? "change";
    acc[domain] = (acc[domain] ?? 0) + 1;
    return acc;
  }, {});
  const fields = Object.entries(counts).map(([domain, count]) => ({ label: domain[0].toUpperCase() + domain.slice(1), after: `${count} ${count === 1 ? "change" : "changes"}` }));
  return {
    heading: source === "onboarding" ? "BUILD LIFE PULSE" : "ACTION PLAN",
    subheading: source === "onboarding" ? "Create the approved setup from your saved starting plan" : "Apply approved Life Pulse changes",
    fields,
    approvalLabel: `Approve ${actions.length} ${actions.length === 1 ? "change" : "changes"}`,
  };
}

function setupDraftToActions(draft: LifeSetupDraft): PlanAction[] {
  const actions: PlanAction[] = [];
  for (const goal of draft.goals.slice(0, 4)) {
    actions.push({ actionType: "life_pulse.goal.create", payload: { title: goal.title, why: goal.why, priority: goal.priority, targetDate: null }, summary: `Create goal: ${goal.title}`, reason: goal.why });
  }
  for (const project of draft.projects.slice(0, 3)) {
    actions.push({ actionType: "life_pulse.project.create", payload: { title: project.title, description: project.desiredOutcome, deadline: null }, summary: `Create project: ${project.title}`, reason: project.desiredOutcome });
  }
  for (const habit of draft.starterHabits.slice(0, 4)) {
    const match = habit.frequency.match(/(\d+)/);
    const times = match ? Number(match[1]) : null;
    actions.push({ actionType: "life_pulse.habit.create", payload: { title: habit.title, description: habit.why, frequency: times ? "times_per_week" : habit.frequency.toLowerCase().includes("week") ? "weekly" : "daily", timesPerWeek: times }, summary: `Create habit: ${habit.title}`, reason: habit.why });
  }
  for (const task of draft.initialTasks.slice(0, 6)) {
    actions.push({ actionType: "life_pulse.task.create", payload: { title: task.title, dueDate: null, priority: "medium" }, summary: `Create task: ${task.title}`, reason: task.why });
  }
  return actions.slice(0, MAX_PLAN_ACTIONS);
}

export async function createOnboardingSetupActionPlan(args: { supabase: SupabaseClient; onboardingState: { setup_draft: unknown; updated_at: string; status: string } }): Promise<{ ok: true; proposal: NextronActionProposal } | { ok: false; reason: string; message: string }> {
  const draft = normalizeLifeSetupDraft(args.onboardingState.setup_draft);
  if (!draft) return { ok: false, reason: "DRAFT_NOT_READY", message: "Review the starting plan before building an action plan." };
  const actions = setupDraftToActions(draft);
  if (actions.length === 0) return { ok: false, reason: "EMPTY_PLAN", message: "The saved draft did not contain any supported setup changes." };
  const sourceHash = `${draftHash(draft)}-${Date.parse(args.onboardingState.updated_at) || 0}`;
  const parameters = { planKind: "setup", sourceKind: "onboarding", sourceHash, idempotencyKey: `onboarding:${sourceHash}`, actions };
  const preview = planPreview(actions, "onboarding");
  const expiresAt = new Date(Date.now() + NEXTRON_ACTION_EXPIRY_MINUTES * 60_000).toISOString();
  const { data, error } = await args.supabase.rpc("nextron_create_action_proposal", {
    p_conversation_id: null,
    p_action_type: "life_pulse.action_plan.execute",
    p_validated_payload: parameters,
    p_preview_payload: { title: "Build my Life Pulse", description: "NEXTRON will create only the approved Goals, Habits, Projects, and Tasks in this preview.", preview },
    p_risk_level: "low",
    p_expires_at: expiresAt,
  });
  if (error || !data) return { ok: false, reason: "PLAN_UNAVAILABLE", message: "NEXTRON could not prepare the setup action plan." };
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
  const { data, error } = await supabase.rpc("nextron_execute_action", { p_proposal_id: proposalId });
  if (error || !data) {
    const reason = error?.message?.includes("PRECONDITION") ? "ACTION_PRECONDITION_FAILED" : "PROPOSAL_NOT_FOUND";
    const message = reason === "ACTION_PRECONDITION_FAILED" ? "That item changed after the proposal was prepared. Create a fresh proposal." : "This proposal is unavailable or not yours.";
    return { ok: false, reason, message };
  }
  const proposal = rowToProposal(data as ProposalRow);
  if (proposal.status === "failed" && proposal.finalReason === "PLAN_FAILED") return { ok: false, reason: "ACTION_PERMISSION_OR_EXECUTION_FAILED", message: "NEXTRON could not apply this plan. Check write permissions and regenerate if needed." };
  return { ok: true, proposal };
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
