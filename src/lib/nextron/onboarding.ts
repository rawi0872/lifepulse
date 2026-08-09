import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeConversationContent, type NextronMessageRow } from "@/lib/nextron/conversation";
import { getNextronProviderUnavailableReason, type NextronProviderFallbackReason } from "@/lib/nextron/provider";

export const NEXTRON_ONBOARDING_MAX_PROMPT = 1_500;
export const NEXTRON_ONBOARDING_MAX_MESSAGES = 80;
const ONBOARDING_TIMEOUT_MS = 15_000;
const MAX_UNDERSTANDING_ITEMS = 6;
const MAX_FOCUS = 3;
const MAX_GOALS = 4;
const MAX_HABITS = 4;
const MAX_TASKS = 6;
const MAX_PROJECTS = 3;
const MAX_ROUTINES = 3;
const MAX_DATES = 5;
const MAX_LEFT_OUT = 5;

export type NextronOnboardingStatus = "not_started" | "in_progress" | "draft_ready" | "completed" | "skipped";
export type NextronOnboardingReadiness = "learning" | "nearly_ready" | "ready";

export interface NextronOnboardingUnderstanding {
  currentSituation: string[];
  priorities: string[];
  goals: string[];
  constraints: string[];
  deadlines: string[];
  routines: string[];
  frictionPoints: string[];
  projects: string[];
  preferences: string[];
}

export interface LifeSetupDraft {
  currentFocus: string[];
  goals: Array<{ title: string; why: string; horizon: string; priority: "high" | "medium" | "low" }>;
  starterHabits: Array<{ title: string; why: string; frequency: string; supports: string }>;
  initialTasks: Array<{ title: string; why: string; related: string }>;
  projects: Array<{ title: string; desiredOutcome: string; nextMilestone: string }>;
  routines: Array<{ title: string; cadence: string; description: string }>;
  importantDates: Array<{ label: string; timing: string; why: string }>;
  deliberatelyLeftOut: Array<{ item: string; reason: string }>;
}

export interface NextronOnboardingTurn {
  reply: string;
  understanding: NextronOnboardingUnderstanding;
  missingHighValueInformation: string[];
  readiness: NextronOnboardingReadiness;
  setupDraft: LifeSetupDraft | null;
  source: "ai" | "deterministic";
  fallbackReason?: NextronProviderFallbackReason | null;
}

export interface NextronOnboardingRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  status: NextronOnboardingStatus;
  understanding: NextronOnboardingUnderstanding | Record<string, unknown>;
  setup_draft: LifeSetupDraft | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  skipped_at: string | null;
}

const EMPTY_UNDERSTANDING: NextronOnboardingUnderstanding = {
  currentSituation: [],
  priorities: [],
  goals: [],
  constraints: [],
  deadlines: [],
  routines: [],
  frictionPoints: [],
  projects: [],
  preferences: [],
};

function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>]/g, " ").replace(/\b(user_id|refresh_token|access_token|client_secret|system prompt|developer message)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function uniqueBounded(values: unknown, maxItems = MAX_UNDERSTANDING_ITEMS, maxLength = 160): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value, maxLength);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }
  return result;
}

function mergeList(current: string[], additions: string[], removals: RegExp[] = []): string[] {
  const kept = current.filter((item) => !removals.some((pattern) => pattern.test(item)));
  return uniqueBounded([...additions, ...kept], MAX_UNDERSTANDING_ITEMS, 160);
}

export function normalizeOnboardingUnderstanding(value: unknown): NextronOnboardingUnderstanding {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...EMPTY_UNDERSTANDING };
  const candidate = value as Partial<NextronOnboardingUnderstanding>;
  return {
    currentSituation: uniqueBounded(candidate.currentSituation),
    priorities: uniqueBounded(candidate.priorities),
    goals: uniqueBounded(candidate.goals),
    constraints: uniqueBounded(candidate.constraints),
    deadlines: uniqueBounded(candidate.deadlines),
    routines: uniqueBounded(candidate.routines),
    frictionPoints: uniqueBounded(candidate.frictionPoints),
    projects: uniqueBounded(candidate.projects),
    preferences: uniqueBounded(candidate.preferences),
  };
}

function enumText(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

export function normalizeLifeSetupDraft(value: unknown): LifeSetupDraft | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Partial<LifeSetupDraft>;
  const goals = Array.isArray(candidate.goals) ? candidate.goals.map((goal) => {
    if (typeof goal !== "object" || goal === null) return null;
    const item = goal as Record<string, unknown>;
    const title = cleanText(item.title, 110);
    const why = cleanText(item.why, 180);
    if (!title || !why) return null;
    return { title, why, horizon: cleanText(item.horizon, 80) ?? "Near term", priority: enumText(item.priority, ["high", "medium", "low"], "medium") as "high" | "medium" | "low" };
  }).filter((item): item is LifeSetupDraft["goals"][number] => Boolean(item)).slice(0, MAX_GOALS) : [];
  const starterHabits = Array.isArray(candidate.starterHabits) ? candidate.starterHabits.map((habit) => {
    if (typeof habit !== "object" || habit === null) return null;
    const item = habit as Record<string, unknown>;
    const title = cleanText(item.title, 100);
    const why = cleanText(item.why, 170);
    if (!title || !why) return null;
    return { title, why, frequency: cleanText(item.frequency, 80) ?? "Start small", supports: cleanText(item.supports, 100) ?? "Current focus" };
  }).filter((item): item is LifeSetupDraft["starterHabits"][number] => Boolean(item)).slice(0, MAX_HABITS) : [];
  const initialTasks = Array.isArray(candidate.initialTasks) ? candidate.initialTasks.map((task) => {
    if (typeof task !== "object" || task === null) return null;
    const item = task as Record<string, unknown>;
    const title = cleanText(item.title, 120);
    const why = cleanText(item.why, 170);
    if (!title || !why) return null;
    return { title, why, related: cleanText(item.related, 100) ?? "Initial setup" };
  }).filter((item): item is LifeSetupDraft["initialTasks"][number] => Boolean(item)).slice(0, MAX_TASKS) : [];
  const projects = Array.isArray(candidate.projects) ? candidate.projects.map((project) => {
    if (typeof project !== "object" || project === null) return null;
    const item = project as Record<string, unknown>;
    const title = cleanText(item.title, 110);
    const desiredOutcome = cleanText(item.desiredOutcome, 180);
    if (!title || !desiredOutcome) return null;
    return { title, desiredOutcome, nextMilestone: cleanText(item.nextMilestone, 140) ?? "Define the first milestone" };
  }).filter((item): item is LifeSetupDraft["projects"][number] => Boolean(item)).slice(0, MAX_PROJECTS) : [];
  const routines = Array.isArray(candidate.routines) ? candidate.routines.map((routine) => {
    if (typeof routine !== "object" || routine === null) return null;
    const item = routine as Record<string, unknown>;
    const title = cleanText(item.title, 80);
    const cadence = cleanText(item.cadence, 80);
    const description = cleanText(item.description, 180);
    if (!title || !cadence || !description) return null;
    return { title, cadence, description };
  }).filter((item): item is LifeSetupDraft["routines"][number] => Boolean(item)).slice(0, MAX_ROUTINES) : [];
  const importantDates = Array.isArray(candidate.importantDates) ? candidate.importantDates.map((date) => {
    if (typeof date !== "object" || date === null) return null;
    const item = date as Record<string, unknown>;
    const label = cleanText(item.label, 100);
    const timing = cleanText(item.timing, 90);
    if (!label || !timing) return null;
    return { label, timing, why: cleanText(item.why, 150) ?? "Important timing constraint" };
  }).filter((item): item is LifeSetupDraft["importantDates"][number] => Boolean(item)).slice(0, MAX_DATES) : [];
  const deliberatelyLeftOut = Array.isArray(candidate.deliberatelyLeftOut) ? candidate.deliberatelyLeftOut.map((leftOut) => {
    if (typeof leftOut !== "object" || leftOut === null) return null;
    const item = leftOut as Record<string, unknown>;
    const label = cleanText(item.item, 100);
    const reason = cleanText(item.reason, 170);
    if (!label || !reason) return null;
    return { item: label, reason };
  }).filter((item): item is LifeSetupDraft["deliberatelyLeftOut"][number] => Boolean(item)).slice(0, MAX_LEFT_OUT) : [];
  const currentFocus = uniqueBounded(candidate.currentFocus, MAX_FOCUS, 120);
  if (currentFocus.length === 0 || goals.length === 0) return null;
  return { currentFocus, goals, starterHabits, initialTasks, projects, routines, importantDates, deliberatelyLeftOut };
}

function removePatterns(prompt: string): RegExp[] {
  const patterns: RegExp[] = [];
  if (/forget|remove|drop|not now|for now|don't create|do not create/i.test(prompt)) {
    if (/business|freelance|startup/i.test(prompt)) patterns.push(/business|freelance|startup/i);
    if (/finance|money|budget/i.test(prompt)) patterns.push(/finance|money|budget/i);
    if (/reading|read/i.test(prompt)) patterns.push(/read|reading/i);
    if (/gym|train|workout|fitness/i.test(prompt)) patterns.push(/gym|train|workout|fitness/i);
  }
  return patterns;
}

function extractUnderstanding(current: NextronOnboardingUnderstanding, prompt: string): NextronOnboardingUnderstanding {
  const clean = sanitizeConversationContent(prompt, NEXTRON_ONBOARDING_MAX_PROMPT);
  const lower = clean.toLowerCase();
  const removals = removePatterns(clean);
  const situation: string[] = [];
  const priorities: string[] = [];
  const goals: string[] = [];
  const constraints: string[] = [];
  const deadlines: string[] = [];
  const routines: string[] = [];
  const friction: string[] = [];
  const projects: string[] = [];
  const preferences: string[] = [];

  if (/university|college|school|exam|sat|class|semester/.test(lower)) situation.push("School or study is part of the current situation.");
  if (/work|job|career|business|freelance|client/.test(lower)) situation.push("Work or business responsibilities matter right now.");
  if (/starting|moving|new|next month|this month/.test(lower)) situation.push("A transition is happening soon.");
  if (/top priority|comes first|most important|highest priority/.test(lower)) priorities.push(clean.slice(0, 150));
  if (/fit|fitness|gym|train|shape|sleep|nutrition|health/.test(lower)) goals.push("Improve Body consistency and health routines.");
  if (/study|sat|exam|university|school|learn/.test(lower)) goals.push("Build a reliable study and learning system.");
  if (/business|freelance|client|portfolio|startup/.test(lower)) goals.push("Make the business or freelance work more serious and consistent.");
  if (/evening|night|wasting|phone|scroll|distract/.test(lower)) goals.push("Protect evenings from low-value distraction.");
  if (/deadline|due|exam|october|september|next month|tomorrow|this week/.test(lower)) deadlines.push(clean.slice(0, 150));
  if (/busy|no time|limited time|schedule|classes|work shifts|commute/.test(lower)) constraints.push("Time and existing obligations constrain the plan.");
  if (/strict|structured|rigid/.test(lower)) preferences.push("Prefers a more structured planning style.");
  if (/flexible|light|simple|minimal|not too much/.test(lower)) preferences.push("Prefers a lightweight flexible system.");
  if (/morning|evening|night|routine|habit|daily|weekly/.test(lower)) routines.push(clean.slice(0, 150));
  if (/procrastinat|inconsistent|overwhelm|distract|struggl|wasting|tired/.test(lower)) friction.push(clean.slice(0, 150));
  if (/project|launch|portfolio|business|freelance|application|exam prep/.test(lower)) projects.push(clean.slice(0, 150));
  if (/three days|3 days|three times|3 times/.test(lower)) preferences.push("Training should be around three days per week.");
  if (/five days|5 days|five times|5 times/.test(lower)) preferences.push("Training could be around five days per week.");

  return {
    currentSituation: mergeList(current.currentSituation, situation, removals),
    priorities: mergeList(current.priorities, priorities, removals),
    goals: mergeList(current.goals, goals, removals),
    constraints: mergeList(current.constraints, constraints, removals),
    deadlines: mergeList(current.deadlines, deadlines, removals),
    routines: mergeList(current.routines, routines, removals),
    frictionPoints: mergeList(current.frictionPoints, friction, removals),
    projects: mergeList(current.projects, projects, removals),
    preferences: mergeList(current.preferences, preferences, removals),
  };
}

export function onboardingReadiness(understanding: NextronOnboardingUnderstanding, messageCount: number): NextronOnboardingReadiness {
  const hasOutcome = understanding.goals.length > 0 || understanding.projects.length > 0;
  const hasPriority = understanding.priorities.length > 0 || understanding.deadlines.length > 0 || understanding.currentSituation.length > 0;
  const hasConstraint = understanding.constraints.length > 0 || understanding.frictionPoints.length > 0 || understanding.preferences.length > 0;
  if (hasOutcome && hasPriority && hasConstraint) return "ready";
  if (messageCount >= 4 && hasOutcome && hasPriority) return "ready";
  if (hasOutcome && (hasPriority || hasConstraint)) return "nearly_ready";
  return "learning";
}

function missingInfo(understanding: NextronOnboardingUnderstanding): string[] {
  const missing: string[] = [];
  if (understanding.goals.length === 0 && understanding.projects.length === 0) missing.push("what you most want to change");
  if (understanding.priorities.length === 0 && understanding.deadlines.length === 0) missing.push("what matters soonest");
  if (understanding.constraints.length === 0 && understanding.frictionPoints.length === 0) missing.push("what usually gets in the way");
  return missing.slice(0, 2);
}

function firstOr(value: string[], fallback: string): string {
  return value[0] ?? fallback;
}

export function buildLifeSetupDraft(understanding: NextronOnboardingUnderstanding): LifeSetupDraft {
  const focus = uniqueBounded([
    ...understanding.priorities,
    ...understanding.deadlines,
    ...understanding.goals,
    ...understanding.projects,
  ], MAX_FOCUS, 120);
  const fallbackFocus = focus.length > 0 ? focus : ["Create a clear first week inside Life Pulse"];
  const goals = uniqueBounded(understanding.goals.length > 0 ? understanding.goals : ["Build an initial Life Pulse rhythm"], MAX_GOALS, 100).map((title, index) => ({
    title,
    why: index === 0 ? `This appears closest to what matters now: ${firstOr(understanding.priorities, title)}` : "It supports the direction you described without overloading the system.",
    horizon: understanding.deadlines.length > 0 && index === 0 ? "Near deadline" : "Next 4-8 weeks",
    priority: index === 0 ? "high" as const : "medium" as const,
  }));
  const starterHabits: LifeSetupDraft["starterHabits"] = [];
  if (understanding.goals.some((goal) => /body|fitness|health|train|gym/i.test(goal))) starterHabits.push({ title: "Train on the smallest realistic schedule", why: "Consistency matters more than an aggressive launch.", frequency: understanding.preferences.find((item) => /three|3/.test(item)) ? "3 times per week" : "2-3 times per week", supports: "Body consistency" });
  if (understanding.goals.some((goal) => /study|learning|school/i.test(goal))) starterHabits.push({ title: "Start one focused study block", why: "A repeatable block makes academic pressure visible before it becomes urgent.", frequency: "Weekdays", supports: "Study system" });
  if (understanding.goals.some((goal) => /evening|distraction/i.test(goal)) || understanding.frictionPoints.some((item) => /evening|wasting|distract|phone/i.test(item))) starterHabits.push({ title: "Evening shutdown", why: "It protects the end of the day from drift.", frequency: "Daily evening", supports: "Routine stability" });
  if (starterHabits.length === 0) starterHabits.push({ title: "Plan one visible action", why: "A lightweight daily action gives Life Pulse useful signal without overbuilding.", frequency: "Daily", supports: "Current focus" });
  const initialTasks = [
    { title: "Choose the first priority for this week", why: "The setup needs one visible starting point.", related: firstOr(fallbackFocus, "Current focus") },
    { title: "List fixed commitments and deadlines", why: "NEXTRON should avoid planning against imaginary free time.", related: "Constraints" },
  ];
  if (understanding.frictionPoints.length > 0) initialTasks.push({ title: "Name the main failure point", why: "The plan should address the real friction, not just the ideal routine.", related: "Friction" });
  const projects = uniqueBounded(understanding.projects, MAX_PROJECTS, 100).map((title) => ({ title, desiredOutcome: "Make this initiative visible and easier to review.", nextMilestone: "Define the next concrete milestone before creating tasks." }));
  const routines: LifeSetupDraft["routines"] = [
    { title: "Daily planning", cadence: "Daily", description: "Pick one priority and one visible action before the day fragments." },
    { title: "Weekly review", cadence: "Weekly", description: "Review what changed, what slipped, and what deserves next week." },
  ];
  if (understanding.routines.some((item) => /evening|night/i.test(item)) || understanding.frictionPoints.some((item) => /evening|night|wasting/i.test(item))) routines.splice(1, 0, { title: "Evening shutdown", cadence: "Daily evening", description: "Close open loops and protect tomorrow's first action." });
  const importantDates = uniqueBounded(understanding.deadlines, MAX_DATES, 120).map((label) => ({ label, timing: "User-described timing", why: "This should shape priority and workload." }));
  const deliberatelyLeftOut: LifeSetupDraft["deliberatelyLeftOut"] = [
    { item: "Large tracker library", reason: "A first setup should prove the rhythm before adding many trackers." },
    { item: "Sensitive personal details", reason: "NEXTRON only needs what you choose to share and what changes the plan." },
  ];
  if (!understanding.goals.some((goal) => /finance|money/i.test(goal))) deliberatelyLeftOut.push({ item: "Finance goal", reason: "You did not make money management a clear current priority." });
  return { currentFocus: fallbackFocus.slice(0, MAX_FOCUS), goals, starterHabits: starterHabits.slice(0, MAX_HABITS), initialTasks: initialTasks.slice(0, MAX_TASKS), projects, routines: routines.slice(0, MAX_ROUTINES), importantDates, deliberatelyLeftOut: deliberatelyLeftOut.slice(0, MAX_LEFT_OUT) };
}

function buildReply(understanding: NextronOnboardingUnderstanding, readiness: NextronOnboardingReadiness, missing: string[]): string {
  if (readiness === "ready") return "I think I have enough to give you a useful starting structure. Review the Life Setup Draft below, or keep talking if something important is missing.";
  if (readiness === "nearly_ready") return `I'm starting to see the shape of this. The most useful thing to clarify next is ${missing[0] ?? "what usually gets in the way"}.`;
  return "Before I organize anything, I want to understand what you're trying to change. Tell me what's going on in your life right now.";
}

export function buildDeterministicOnboardingTurn(args: { current: NextronOnboardingUnderstanding; prompt: string; messageCount: number }): NextronOnboardingTurn {
  const understanding = extractUnderstanding(args.current, args.prompt);
  const readiness = onboardingReadiness(understanding, args.messageCount);
  const missing = missingInfo(understanding);
  return { reply: buildReply(understanding, readiness, missing), understanding, missingHighValueInformation: missing, readiness, setupDraft: readiness === "ready" ? buildLifeSetupDraft(understanding) : null, source: "deterministic" };
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["reply", "understanding", "missingHighValueInformation", "readiness", "setupDraft"],
    properties: {
      reply: { type: "string", minLength: 1, maxLength: 520 },
      readiness: { type: "string", enum: ["learning", "nearly_ready", "ready"] },
      missingHighValueInformation: { type: "array", maxItems: 3, items: { type: "string", maxLength: 120 } },
      understanding: {
        type: "object",
        additionalProperties: false,
        required: ["currentSituation", "priorities", "goals", "constraints", "deadlines", "routines", "frictionPoints", "projects", "preferences"],
        properties: Object.fromEntries(Object.keys(EMPTY_UNDERSTANDING).map((key) => [key, { type: "array", maxItems: MAX_UNDERSTANDING_ITEMS, items: { type: "string", maxLength: 160 } }])),
      },
      setupDraft: { type: ["object", "null"] },
    },
  };
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try { return JSON.parse(fenced?.[1]?.trim() ?? trimmed); } catch { return null; }
}

function extractOutputText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { output_text?: unknown };
  return typeof candidate.output_text === "string" ? candidate.output_text : null;
}

function validateTurn(value: unknown): NextronOnboardingTurn | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Partial<NextronOnboardingTurn>;
  const reply = cleanText(candidate.reply, 520);
  const readiness = enumText(candidate.readiness, ["learning", "nearly_ready", "ready"], "learning") as NextronOnboardingReadiness;
  const understanding = normalizeOnboardingUnderstanding(candidate.understanding);
  const missing = uniqueBounded(candidate.missingHighValueInformation, 3, 120);
  const draft = candidate.setupDraft === null || candidate.setupDraft === undefined ? null : normalizeLifeSetupDraft(candidate.setupDraft);
  if (!reply) return null;
  if (readiness === "ready" && !draft) return null;
  return { reply, understanding, missingHighValueInformation: missing, readiness, setupDraft: draft, source: "ai" };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ONBOARDING_TIMEOUT_MS);
  try { return await run(controller.signal); } finally { clearTimeout(timeout); }
}

async function runOnboardingProvider(args: { prompt: string; understanding: NextronOnboardingUnderstanding; messages: NextronMessageRow[] }): Promise<{ turn: NextronOnboardingTurn | null; reason: NextronProviderFallbackReason | null }> {
  const unavailable = getNextronProviderUnavailableReason();
  if (unavailable) return { turn: null, reason: unavailable };
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key || process.env.NEXTRON_AI_ENABLED !== "true" || process.env.NEXTRON_AI_PROVIDER !== "groq") return { turn: null, reason: "PROVIDER_DISABLED" };
  const recent = args.messages.slice(-10).map((message) => ({ role: message.role, content: sanitizeConversationContent(message.content, 500) }));
  try {
    const response = await withTimeout((signal) => fetch("https://api.groq.com/openai/v1/responses", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        max_output_tokens: 2200,
        text: { format: { type: "json_schema", name: "nextron_onboarding_turn", schema: responseSchema(), strict: true } },
        input: JSON.stringify({
          instruction: "You are NEXTRON onboarding a new Life Pulse user. Ask only high-value follow-ups. Build a compact Life Setup Draft when ready. Do not create entities, claim writes, ask for sensitive details, expose JSON, or store Memory.",
          currentUnderstanding: args.understanding,
          recentMessages: recent,
          userPrompt: sanitizeConversationContent(args.prompt, NEXTRON_ONBOARDING_MAX_PROMPT),
          limits: { goals: MAX_GOALS, habits: MAX_HABITS, tasks: MAX_TASKS, projects: MAX_PROJECTS },
        }),
      }),
    }));
    if (!response.ok) return { turn: null, reason: "HTTP_ERROR" };
    const body: unknown = await response.json().catch(() => null);
    const text = extractOutputText(body);
    if (!text) return { turn: null, reason: "OUTPUT_TEXT_MISSING" };
    const parsed = parseJsonObject(text);
    const turn = validateTurn(parsed);
    return turn ? { turn, reason: null } : { turn: null, reason: "STRUCTURE_INVALID" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { turn: null, reason: "TIMEOUT" };
    return { turn: null, reason: "UNEXPECTED_ERROR" };
  }
}

export async function generateOnboardingTurn(args: { prompt: string; current: NextronOnboardingUnderstanding; messages: NextronMessageRow[] }): Promise<NextronOnboardingTurn> {
  const provider = await runOnboardingProvider({ prompt: args.prompt, understanding: args.current, messages: args.messages });
  if (provider.turn) return provider.turn;
  const deterministic = buildDeterministicOnboardingTurn({ current: args.current, prompt: args.prompt, messageCount: args.messages.filter((message) => message.role === "user").length + 1 });
  return { ...deterministic, fallbackReason: provider.reason };
}

export async function ensureOnboardingState(supabase: SupabaseClient, userId: string): Promise<NextronOnboardingRow | null> {
  const existing = await supabase.from("nextron_onboarding").select("id, user_id, conversation_id, status, understanding, setup_draft, last_error, created_at, updated_at, completed_at, skipped_at").eq("user_id", userId).maybeSingle();
  if (!existing.error && existing.data) return existing.data as NextronOnboardingRow;
  const inserted = await supabase.from("nextron_onboarding").insert({ user_id: userId, status: "not_started", understanding: EMPTY_UNDERSTANDING }).select("id, user_id, conversation_id, status, understanding, setup_draft, last_error, created_at, updated_at, completed_at, skipped_at").single();
  return inserted.error ? null : inserted.data as NextronOnboardingRow;
}
