import type { NextronCoachResponse } from "@/lib/nextron/coach";
import { PROJECT_AGENT_MAX_OUTPUT_CHARS, type ProjectAgentFallbackReason, type ProjectAgentParsedOutput } from "@/lib/nextron/project-agent/schemas";

const ALLOWED_AGENT_ROUTES = new Set(["/projects", "/tasks", "/goals", "/habits", "/results", "/today", "/coach", "/knowledge"]);
const PROJECT_AGENT_CATEGORIES = new Set(["projects", "tasks", "goals"]);
const CROSS_DOMAIN_AGENT_CATEGORIES = new Set(["today", "tasks", "habits", "results", "goals", "projects", "memory"]);
const KNOWLEDGE_AGENT_CATEGORIES = new Set(["knowledge"]);
const FORBIDDEN_TEXT = /[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}|\S+@\S+|supabase|user_id|service_role|api[_-]?key|secret|sql|insert\s+into|update\s+.+\s+set|delete\s+from|drop\s+table|created a task|edited a project|scheduled|sent an email|deleted a/i;
const INTERNAL_REF_TEXT = /\bref\s+p\d+\b|\bp\d+\b/i;

export type ProjectAgentValidationResult =
  | { ok: true; response: NextronCoachResponse }
  | { ok: false; reason: ProjectAgentFallbackReason };

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>`*]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function lineValue(lines: string[], label: string): string | null {
  const pattern = new RegExp(`^(?:[-*]\\s*)?(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:`, "i");
  const line = lines.find((item) => pattern.test(item));
  return line ? line.replace(pattern, "").trim() : null;
}

function factsValue(lines: string[]): string | null {
  const direct = lineValue(lines, "facts");
  if (direct) return direct;
  const start = lines.findIndex((line) => /^(?:[-*]\s*)?(?:\*\*)?facts(?:\*\*)?\s*:?\s*$/i.test(line));
  if (start === -1) return null;
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^(?:[-*]\s*)?(?:\*\*)?(interpretation|nextActionLabel|nextActionRoute|nextActionRationale)(?:\*\*)?\s*:/i.test(line)) break;
    const cleaned = line.replace(/^(?:[-*]\s*)/, "").trim();
    if (cleaned.includes("|")) collected.push(cleaned);
  }
  return collected.length > 0 ? collected.join(";") : null;
}

export function parseProjectAgentOutput(text: unknown, allowedCategories: Set<string> = PROJECT_AGENT_CATEGORIES): ProjectAgentParsedOutput | null {
  if (typeof text !== "string" || text.length > PROJECT_AGENT_MAX_OUTPUT_CHARS) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const factsText = factsValue(lines);
  const interpretation = clean(lineValue(lines, "interpretation"), 420);
  const nextActionLabel = clean(lineValue(lines, "nextActionLabel"), 80);
  const nextActionRoute = clean(lineValue(lines, "nextActionRoute"), 40);
  const nextActionRationale = clean(lineValue(lines, "nextActionRationale"), 260);
  const sources = lineValue(lines, "sources")?.split(";").map((item) => clean(item, 120)).filter((item): item is string => Boolean(item)).slice(0, 3);
  if (!factsText || !interpretation || !nextActionLabel || !nextActionRoute || !nextActionRationale) return null;
  if (!ALLOWED_AGENT_ROUTES.has(nextActionRoute)) return null;
  const facts = factsText.split(";").map((item) => {
    const [category, ...rest] = item.split("|");
    const text = clean(rest.join("|"), 220);
    return category && text ? { category: category.trim(), text } : null;
  }).filter((item): item is { category: string; text: string } => Boolean(item));
  if (facts.length < 1 || facts.length > 4) return null;
  if (facts.some((fact) => !allowedCategories.has(fact.category))) return null;
  return { facts: facts as ProjectAgentParsedOutput["facts"], interpretation, nextAction: { label: nextActionLabel, href: nextActionRoute as ProjectAgentParsedOutput["nextAction"]["href"], rationale: nextActionRationale }, sources };
}

function collectNumbers(evidence: unknown): Set<string> {
  return new Set([...(JSON.stringify(evidence).match(/-?\d+(?:\.\d+)?/g) ?? []), "1"]);
}

function hasUnsupportedNumber(text: string, allowedNumbers: Set<string>): boolean {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).some((value) => !allowedNumbers.has(value));
}

function collectVisibleLabels(value: unknown, labels = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return labels;
  if (Array.isArray(value)) {
    value.forEach((item) => collectVisibleLabels(item, labels));
    return labels;
  }
  for (const [key, item] of Object.entries(value)) {
    if ((key === "title" || key === "description") && typeof item === "string") {
      const label = clean(item, 180);
      if (label) labels.add(label);
    } else {
      collectVisibleLabels(item, labels);
    }
  }
  return labels;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasInternalRefLeak(text: string, evidence: unknown): boolean {
  let remainder = text;
  for (const label of collectVisibleLabels(evidence)) {
    remainder = remainder.replace(new RegExp(escapeRegExp(label), "gi"), " ");
  }
  return INTERNAL_REF_TEXT.test(remainder);
}

export function validateProjectAgentOutput(parsed: ProjectAgentParsedOutput | null, evidence: unknown): ProjectAgentValidationResult {
  return validateAgentOutput(parsed, evidence, PROJECT_AGENT_CATEGORIES, "project_agent_focus");
}

export function validateCrossDomainAgentOutput(parsed: ProjectAgentParsedOutput | null, evidence: unknown): ProjectAgentValidationResult {
  return validateAgentOutput(parsed, evidence, CROSS_DOMAIN_AGENT_CATEGORIES, "cross_domain_agent");
}

export function validateKnowledgeAgentOutput(parsed: ProjectAgentParsedOutput | null, evidence: unknown): ProjectAgentValidationResult {
  const result = validateAgentOutput(parsed, evidence, KNOWLEDGE_AGENT_CATEGORIES, "knowledge_notes_agent");
  if (!result.ok) return result;
  if (result.response.nextAction.href !== "/knowledge" && result.response.nextAction.href !== "/coach") return { ok: false, reason: "ROUTE_INVALID" };
  const sources = parsed?.sources ?? [];
  if (sources.length < 1 || sources.length > 3) return { ok: false, reason: "STRUCTURE_INVALID" };
  const allowedSources = collectKnowledgeSources(evidence);
  if (sources.some((source) => !allowedSources.has(source))) return { ok: false, reason: "FORBIDDEN_CONTENT" };
  return { ok: true, response: { ...result.response, sources, supportingEvidence: [...result.response.supportingEvidence, ...sources].slice(0, 6) } };
}

function collectKnowledgeSources(evidence: unknown): Set<string> {
  const sources = new Set<string>();
  const stack = [evidence];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      stack.push(...item);
      continue;
    }
    for (const [key, value] of Object.entries(item)) {
      if (key === "source" && typeof value === "string") {
        const source = clean(value, 120);
        if (source) sources.add(source);
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return sources;
}

function validateAgentOutput(parsed: ProjectAgentParsedOutput | null, evidence: unknown, allowedCategories: Set<string>, ruleId: "project_agent_focus" | "cross_domain_agent" | "knowledge_notes_agent"): ProjectAgentValidationResult {
  if (!parsed) return { ok: false, reason: "PARSER_FAILED" };
  const allowedNumbers = collectNumbers(evidence);
  const allText = [parsed.interpretation, parsed.nextAction.label, parsed.nextAction.rationale, ...parsed.facts.map((fact) => fact.text)];
  if (allText.some((text) => FORBIDDEN_TEXT.test(text))) return { ok: false, reason: "FORBIDDEN_CONTENT" };
  if (allText.some((text) => hasInternalRefLeak(text, evidence))) return { ok: false, reason: "FORBIDDEN_CONTENT" };
  if (allText.some((text) => hasUnsupportedNumber(text, allowedNumbers))) return { ok: false, reason: "NUMERIC_FACT_INVALID" };
  if (!ALLOWED_AGENT_ROUTES.has(parsed.nextAction.href)) return { ok: false, reason: "ROUTE_INVALID" };
  if (parsed.facts.some((fact) => !allowedCategories.has(fact.category))) return { ok: false, reason: "EVIDENCE_CATEGORY_INVALID" };
  return {
    ok: true,
    response: {
      facts: parsed.facts,
      interpretation: parsed.interpretation,
      nextAction: parsed.nextAction,
      priority: "medium",
      ruleId,
      supportingEvidence: parsed.facts.map((fact) => fact.text),
      sources: parsed.sources,
      source: "ai",
    },
  };
}
