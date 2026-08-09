import type { NextronCoachResponse, NextronEvidenceCategory } from "@/lib/nextron/coach";

export const NEXTRON_PROJECT_AGENT_MODEL = "groq/openai/gpt-oss-120b";
export const PROJECT_AGENT_MAX_TOOL_CALLS = 3;
export const PROJECT_AGENT_MAX_STEPS = 4;
export const PROJECT_AGENT_TIMEOUT_MS = 8_000;
export const PROJECT_AGENT_MAX_OUTPUT_CHARS = 2_048;
export const CROSS_DOMAIN_AGENT_MAX_TOOL_CALLS = 4;
export const CROSS_DOMAIN_AGENT_MAX_STEPS = 5;
export const CROSS_DOMAIN_AGENT_TIMEOUT_MS = 10_000;
export const KNOWLEDGE_AGENT_MAX_TOOL_CALLS = 1;
export const KNOWLEDGE_AGENT_MAX_STEPS = 3;
export const KNOWLEDGE_AGENT_TIMEOUT_MS = 8_000;
export const KNOWLEDGE_AGENT_TOP_K = 3;
export const KNOWLEDGE_AGENT_FTS_CANDIDATES = 20;
export const KNOWLEDGE_AGENT_SEMANTIC_CANDIDATES = 20;
export const KNOWLEDGE_AGENT_MAX_SNIPPET_CHARS = 420;
export const KNOWLEDGE_AGENT_MAX_TOTAL_CONTEXT_CHARS = 1_200;
export const KNOWLEDGE_AGENT_QUERY_MAX_CHARS = 180;

export type ProjectAgentToolName = "getProjects" | "getProject" | "getProjectTasks" | "getGoals";
export type CrossDomainAgentToolName = "getTodayContext" | "getTasksSummary" | "getGoalsSummary" | "getProjectsSummary" | "getHabitsSummary" | "getResultsSummary" | "getMemoryPreferences";
export type KnowledgeAgentToolName = "searchKnowledge";
export type ProjectAgentFallbackReason =
  | "PROVIDER_DISABLED"
  | "MISSING_KEY"
  | "PERMISSION_DENIED"
  | "PROJECT_NOT_FOUND"
  | "TOOL_LIMIT_EXCEEDED"
  | "TIMEOUT"
  | "MODEL_OUTPUT_TOO_LARGE"
  | "PARSER_FAILED"
  | "STRUCTURE_INVALID"
  | "EVIDENCE_CATEGORY_INVALID"
  | "NUMERIC_FACT_INVALID"
  | "ROUTE_INVALID"
  | "FORBIDDEN_CONTENT"
  | "MASTRA_ERROR";

export interface ProjectAgentFact {
  category: Extract<NextronEvidenceCategory, "today" | "tasks" | "habits" | "results" | "goals" | "projects" | "knowledge" | "memory">;
  text: string;
}

export interface ProjectAgentParsedOutput {
  facts: ProjectAgentFact[];
  interpretation: string;
  nextAction: { label: string; href: "/projects" | "/tasks" | "/goals" | "/habits" | "/results" | "/today" | "/coach" | "/nextron" | "/knowledge"; rationale: string };
  sources?: string[];
}

export interface ProjectAgentRunResult {
  response: NextronCoachResponse;
  fallbackReason: ProjectAgentFallbackReason | null;
  toolsUsed: Array<ProjectAgentToolName | CrossDomainAgentToolName | KnowledgeAgentToolName>;
}
