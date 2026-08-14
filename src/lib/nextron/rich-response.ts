import type { NextronCoachResponse, NextronCoachingIntent, NextronEvidenceCategory, NextronUserRequest } from "@/lib/nextron/coach";
import type { NextronEvidencePacket } from "@/lib/nextron/evidence";

export const NEXTRON_RICH_RESPONSE_VERSION = "nextron-rich-response-v1" as const;

export type NextronRichBlockType = "metric_strip" | "priority_list" | "entity_list" | "evidence" | "empty_state";

export interface NextronRichMetric {
  label: string;
  value: string;
  detail?: string;
  tone: "neutral" | "positive" | "attention";
}

export interface NextronRichListItem {
  title: string;
  detail?: string;
  source: NextronEvidenceCategory;
  href?: string;
  tone?: "neutral" | "positive" | "attention";
}

export type NextronRichBlock =
  | { type: "metric_strip"; title: string; metrics: NextronRichMetric[] }
  | { type: "priority_list"; title: string; items: NextronRichListItem[] }
  | { type: "entity_list"; title: string; items: NextronRichListItem[] }
  | { type: "evidence"; title: string; items: NextronRichListItem[] }
  | { type: "empty_state"; title: string; message: string; href?: string; actionLabel?: string };

export interface NextronRichResponse {
  version: typeof NEXTRON_RICH_RESPONSE_VERSION;
  generatedForLocalDate: string;
  intent: NextronCoachingIntent;
  modelCalls: 0;
  groundedIn: NextronEvidenceCategory[];
  blocks: NextronRichBlock[];
}

const MAX_BLOCKS = 4;
const MAX_ITEMS = 5;
const MAX_METRICS = 6;
const SAFE_HREFS = new Set(["/today", "/tasks", "/habits", "/results", "/journal", "/weekly-review", "/goals", "/life-map", "/projects", "/insights", "/nextron"]);
const CATEGORIES: NextronEvidenceCategory[] = ["today", "tasks", "habits", "results", "journal", "eveningShutdown", "weeklyReview", "goals", "projects", "knowledge", "calendar", "profile", "memory"];

function clean(value: string | null | undefined, max = 120): string | null {
  const trimmed = value?.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>]/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return trimmed ? trimmed.slice(0, max) : null;
}

function metric(label: string, value: number | string, detail: string | undefined, tone: NextronRichMetric["tone"]): NextronRichMetric | null {
  const safeLabel = clean(label, 40);
  const safeValue = clean(String(value), 24);
  const safeDetail = clean(detail, 80) ?? undefined;
  return safeLabel && safeValue ? { label: safeLabel, value: safeValue, detail: safeDetail, tone } : null;
}

function item(title: string | null | undefined, source: NextronEvidenceCategory, detail?: string, href?: string, tone: NextronRichListItem["tone"] = "neutral"): NextronRichListItem | null {
  const safeTitle = clean(title, 90);
  if (!safeTitle) return null;
  const safeDetail = clean(detail, 140) ?? undefined;
  const safeHref = href && SAFE_HREFS.has(href) ? href : undefined;
  return { title: safeTitle, source, detail: safeDetail, href: safeHref, tone };
}

function pushBlock(blocks: NextronRichBlock[], block: NextronRichBlock | null) {
  if (block && blocks.length < MAX_BLOCKS) blocks.push(block);
}

type RichViewIntent = "today" | "tasks" | "habits" | "goals" | "projects" | "results" | "life_map" | "attention" | "why" | "summary";

function selectRichViewIntent(request: NextronUserRequest): RichViewIntent | null {
  if (request.handlingStatus !== "handled") return null;
  const prompt = request.normalizedPrompt;
  if (/\b(why|evidence|source|sources|telling me this)\b/.test(prompt)) return "why";
  if (/\b(open tasks?|tasks?|todo|to do)\b/.test(prompt)) return "tasks";
  if (/\b(habits?|routine|routines)\b/.test(prompt)) return "habits";
  if (/\b(life map|map|graph|relationships?|connected|links?)\b/.test(prompt)) return "life_map";
  if (/\b(goals?)\b/.test(prompt)) return "goals";
  if (/\b(projects?)\b/.test(prompt)) return "projects";
  if (/\b(results?|metrics?|measurements?)\b/.test(prompt)) return "results";
  if (/\b(attention|slipping|behind|stuck|blocked|holding me back)\b/.test(prompt)) return "attention";
  if (/\b(today|focus|do next|next action|priority|plan)\b/.test(prompt)) return "today";
  if (/\b(summarize|summary|current life pulse|everything going on|how am i)\b/.test(prompt)) return "summary";
  if (["TODAY_FOCUS", "NEXT_ACTION", "ATTENTION", "WEEK_PROGRESS", "PROGRESS", "NEGLECT", "PLANNING", "REVIEW", "PATTERN", "STUCK", "PROJECT_AGENT", "CROSS_DOMAIN_AGENT"].includes(request.intent)) return "summary";
  return null;
}

export function buildNextronRichResponse(response: NextronCoachResponse, packet: NextronEvidencePacket, request: NextronUserRequest): NextronRichResponse | null {
  const viewIntent = selectRichViewIntent(request);
  if (!viewIntent) return null;
  const blocks: NextronRichBlock[] = [];
  const today = packet.today.data;
  const tasks = packet.tasks.data;
  const habits = packet.habits.data;
  const results = packet.results.data;
  const projects = packet.projects.data;
  const goals = packet.goals.data;
  const relationships = packet.relationships.data;

  const wantsOverview = viewIntent === "today" || viewIntent === "summary" || viewIntent === "attention";
  const metrics = [
    tasks ? metric("Overdue", tasks.overdueCount, "open tasks", tasks.overdueCount > 0 ? "attention" : "neutral") : null,
    tasks ? metric("Due today", tasks.dueTodayCount, "open tasks", tasks.dueTodayCount > 0 ? "attention" : "neutral") : null,
    today ? metric("Completed", today.completedTodayTaskCount, "tasks today", today.completedTodayTaskCount > 0 ? "positive" : "neutral") : null,
    habits ? metric("Habits", `${habits.completedTodayCount}/${habits.dueTodayCount}`, "completed today", habits.completedTodayCount < habits.dueTodayCount ? "attention" : "positive") : null,
    results ? metric("Results", results.recentEntryCount, "entries this week", results.recentEntryCount > 0 ? "positive" : "neutral") : null,
    projects ? metric("Projects", projects.activeCount, "active", "neutral") : null,
    relationships ? metric("Links", relationships.explicitLinks, "explicit only", relationships.explicitLinks > 0 ? "positive" : "neutral") : null,
  ].filter((entry): entry is NextronRichMetric => Boolean(entry)).slice(0, MAX_METRICS);
  pushBlock(blocks, (wantsOverview || viewIntent === "life_map") && metrics.length > 0 ? { type: "metric_strip", title: viewIntent === "life_map" ? "Life Map Snapshot" : "Grounded Snapshot", metrics } : null);

  const priorityItems = [
    ...(tasks?.overdueCount ? [item(`${tasks.overdueCount} overdue open task${tasks.overdueCount === 1 ? "" : "s"}`, "tasks", "Review before adding new work.", "/tasks", "attention")] : []),
    ...(tasks?.dueTodayCount ? [item(`${tasks.dueTodayCount} task${tasks.dueTodayCount === 1 ? "" : "s"} due today`, "tasks", "Choose one visible next step.", "/today", "attention")] : []),
    ...(habits && habits.dueTodayCount > habits.completedTodayCount ? [item(`${habits.dueTodayCount - habits.completedTodayCount} due habit${habits.dueTodayCount - habits.completedTodayCount === 1 ? "" : "s"} incomplete`, "habits", "Only mark complete if it actually happened.", "/habits", "attention")] : []),
    ...(results && results.activeMetricCount > 0 && results.recentEntryCount === 0 ? [item("Results metrics have no recent entries", "results", "Add real measurements only if available.", "/results", "neutral")] : []),
    ...(projects?.activeWithoutOpenTaskCount ? [item(`${projects.activeWithoutOpenTaskCount} active project${projects.activeWithoutOpenTaskCount === 1 ? "" : "s"} without an open task`, "projects", "Inspect manually before deciding it is blocked.", "/projects", "neutral")] : []),
    ...(relationships?.unlinkedActiveGoals ? [item(`${relationships.unlinkedActiveGoals} active goal${relationships.unlinkedActiveGoals === 1 ? "" : "s"} without explicit support`, "goals", "Open Life Map before creating any new connection.", "/life-map", "attention")] : []),
  ].filter((entry): entry is NextronRichListItem => Boolean(entry)).slice(0, MAX_ITEMS);
  pushBlock(blocks, (viewIntent === "today" || viewIntent === "attention" || viewIntent === "summary" || viewIntent === "life_map") && priorityItems.length > 0 ? { type: "priority_list", title: "What Deserves Attention", items: priorityItems } : null);

  const taskItems = (tasks?.nextOpenTitles ?? []).map((title) => item(title, "tasks", "Next open task from Life Pulse.", "/tasks"));
  const projectItems = (projects?.sampleNames ?? []).map((title) => item(title, "projects", "Active project visible to NEXTRON.", "/projects"));
  const goalItems = (goals?.sampleNames ?? []).map((title) => item(title, "goals", "Active goal visible to NEXTRON.", "/goals"));
  const habitItems = habits ? [item(`${habits.completedTodayCount} of ${habits.dueTodayCount} due habits completed`, "habits", `${habits.weeklyCompletedCount} habit completions logged this week.`, "/habits", habits.completedTodayCount < habits.dueTodayCount ? "attention" : "positive")] : [];
  const resultItems = (results?.latestValues ?? []).map((title) => item(title, "results", "Latest bounded Results value.", "/results", "positive"));
  const entityItems = [
    ...(viewIntent === "tasks" || viewIntent === "today" || viewIntent === "summary" ? taskItems : []),
    ...(viewIntent === "projects" || viewIntent === "summary" ? projectItems : []),
    ...(viewIntent === "goals" || viewIntent === "summary" ? goalItems : []),
    ...(viewIntent === "habits" || viewIntent === "summary" ? habitItems : []),
    ...(viewIntent === "results" || viewIntent === "summary" ? resultItems : []),
  ].filter((entry): entry is NextronRichListItem => Boolean(entry)).slice(0, MAX_ITEMS);
  pushBlock(blocks, entityItems.length > 0 ? { type: "entity_list", title: viewIntent === "summary" ? "Visible Items" : "Grounded View", items: entityItems } : null);

  const evidenceItems = response.supportingEvidence.map((text) => {
    const fact = response.facts.find((entry) => entry.text === text);
    return item(text, fact?.category ?? "today", undefined, undefined, "neutral");
  }).filter((entry): entry is NextronRichListItem => Boolean(entry)).slice(0, MAX_ITEMS);
  pushBlock(blocks, (viewIntent === "why" || viewIntent === "attention" || viewIntent === "summary") && evidenceItems.length > 0 ? { type: "evidence", title: "Evidence Used", items: evidenceItems } : null);

  pushBlock(blocks, blocks.length === 0 ? { type: "empty_state", title: "Not Enough Permitted Evidence", message: "NEXTRON did not find enough allowed Life Pulse data to build a richer view for this answer.", href: "/nextron", actionLabel: "Review permissions" } : null);

  const groundedIn = Array.from(new Set(blocks.flatMap((block) => "items" in block ? block.items.map((entry) => entry.source) : []))).filter((source) => CATEGORIES.includes(source));
  return {
    version: NEXTRON_RICH_RESPONSE_VERSION,
    generatedForLocalDate: packet.generatedForLocalDate,
    intent: request.intent,
    modelCalls: 0,
    groundedIn,
    blocks,
  };
}

export function isNextronRichResponse(value: unknown): value is NextronRichResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronRichResponse>;
  return candidate.version === NEXTRON_RICH_RESPONSE_VERSION
    && typeof candidate.generatedForLocalDate === "string"
    && typeof candidate.intent === "string"
    && candidate.modelCalls === 0
    && Array.isArray(candidate.groundedIn)
    && candidate.groundedIn.every((source) => typeof source === "string" && CATEGORIES.includes(source as NextronEvidenceCategory))
    && Array.isArray(candidate.blocks)
    && candidate.blocks.length <= MAX_BLOCKS
    && candidate.blocks.every(isNextronRichBlock);
}

function isNextronRichBlock(value: unknown): value is NextronRichBlock {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronRichBlock>;
  if (typeof candidate.type !== "string" || typeof candidate.title !== "string" || !clean(candidate.title, 80)) return false;
  if (candidate.type === "metric_strip") return Array.isArray(candidate.metrics) && candidate.metrics.length <= MAX_METRICS && candidate.metrics.every(isNextronRichMetric);
  if (candidate.type === "priority_list" || candidate.type === "entity_list" || candidate.type === "evidence") return Array.isArray(candidate.items) && candidate.items.length <= MAX_ITEMS && candidate.items.every(isNextronRichListItem);
  if (candidate.type === "empty_state") return typeof candidate.message === "string" && (!candidate.href || SAFE_HREFS.has(candidate.href)) && (!candidate.actionLabel || typeof candidate.actionLabel === "string");
  return false;
}

function isNextronRichMetric(value: unknown): value is NextronRichMetric {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronRichMetric>;
  return typeof candidate.label === "string" && typeof candidate.value === "string" && (!candidate.detail || typeof candidate.detail === "string") && (candidate.tone === "neutral" || candidate.tone === "positive" || candidate.tone === "attention");
}

function isNextronRichListItem(value: unknown): value is NextronRichListItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronRichListItem>;
  return typeof candidate.title === "string"
    && (!candidate.detail || typeof candidate.detail === "string")
    && typeof candidate.source === "string"
    && CATEGORIES.includes(candidate.source as NextronEvidenceCategory)
    && (!candidate.href || SAFE_HREFS.has(candidate.href))
    && (!candidate.tone || candidate.tone === "neutral" || candidate.tone === "positive" || candidate.tone === "attention");
}
