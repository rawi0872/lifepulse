import type { NextronEvidencePacket } from "@/lib/nextron/evidence";
import type { NextronRichResponse } from "@/lib/nextron/rich-response";

export type NextronEvidenceCategory = keyof Pick<NextronEvidencePacket, "today" | "tasks" | "habits" | "results" | "journal" | "eveningShutdown" | "weeklyReview" | "goals" | "projects" | "knowledge" | "calendar" | "profile" | "memory">;

export interface NextronFact {
  category: NextronEvidenceCategory;
  text: string;
}

export interface NextronNextAction {
  label: string;
  href: string;
  rationale: string;
}

export interface NextronCoachResponse {
  facts: NextronFact[];
  interpretation: string;
  nextAction: NextronNextAction;
  priority: "high" | "medium" | "low" | "calm";
  ruleId: string;
  supportingEvidence: string[];
  sources?: string[];
  source?: "ai" | "deterministic";
  richResponse?: NextronRichResponse;
}

export const NEXTRON_REQUEST_MAX_LENGTH = 500;

export type NextronCoachingIntent =
  | "TODAY_FOCUS"
  | "PROJECT_AGENT"
  | "CROSS_DOMAIN_AGENT"
  | "KNOWLEDGE_QUERY"
  | "CALENDAR_QUERY"
  | "NEXT_ACTION"
  | "ATTENTION"
  | "WEEK_PROGRESS"
  | "PROGRESS"
  | "NEGLECT"
  | "PLANNING"
  | "REVIEW"
  | "PATTERN"
  | "STUCK"
  | "GENERAL_SUPPORTED"
  | "UNSUPPORTED"
  | "MEDICAL"
  | "MENTAL_HEALTH_CRISIS"
  | "FINANCIAL_ADVICE"
  | "LEGAL_ADVICE"
  | "AUTONOMOUS_ACTION"
  | "OUT_OF_SCOPE_GENERAL_KNOWLEDGE";

export interface NextronUserRequest {
  rawPrompt: string;
  normalizedPrompt: string;
  intent: NextronCoachingIntent;
  handlingStatus: "handled" | "unsupported" | "boundary";
  confidence: "high" | "medium" | "low";
}

export type NextronPromptValidation =
  | { ok: true; request: NextronUserRequest }
  | { ok: false; reason: "empty" | "too_long" | "invalid_type"; message: string };

function fact(category: NextronEvidenceCategory, text: string): NextronFact {
  return { category, text };
}

function response(
  ruleId: string,
  priority: NextronCoachResponse["priority"],
  facts: NextronFact[],
  interpretation: string,
  label: string,
  href: string,
  rationale: string,
): NextronCoachResponse {
  return {
    ruleId,
    priority,
    facts,
    interpretation,
    nextAction: { label, href, rationale },
    supportingEvidence: facts.map((item) => item.text).slice(0, 4),
  };
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(value: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => value.includes(phrase));
}

function isFinancialAdviceRequest(value: string): boolean {
  if (includesAny(value, ["invest more time", "invest time"])) return false;
  return includesAny(value, ["invest", "stock", "crypto", "trade", "portfolio", "debt strategy", "financial advice"]);
}

function classifyPrompt(normalizedPrompt: string): Pick<NextronUserRequest, "intent" | "handlingStatus" | "confidence"> {
  const crisisTerms = ["kill myself", "end my life", "self harm", "hurt myself", "suicide", "immediate danger"];
  if (includesAny(normalizedPrompt, crisisTerms)) return { intent: "MENTAL_HEALTH_CRISIS", handlingStatus: "boundary", confidence: "high" };

  if (includesAny(normalizedPrompt, ["diagnose", "medication", "medicine", "symptom", "disease", "medical advice"])) return { intent: "MEDICAL", handlingStatus: "boundary", confidence: "high" };
  if (isFinancialAdviceRequest(normalizedPrompt)) return { intent: "FINANCIAL_ADVICE", handlingStatus: "boundary", confidence: "high" };
  if (includesAny(normalizedPrompt, ["legal advice", "lawsuit", "contract", "sue", "attorney", "lawyer"])) return { intent: "LEGAL_ADVICE", handlingStatus: "boundary", confidence: "high" };
  const calendarTerms = ["calendar", "meeting", "meetings", "event", "events", "free", "busy", "availability", "available", "tomorrow", "this afternoon", "wednesday"];
  if (includesAny(normalizedPrompt, calendarTerms) && includesAny(normalizedPrompt, ["what do i have", "what's on my", "whats on my", "when am i free", "am i free", "calendar", "meeting", "meetings", "event", "events", "availability"])) return { intent: "CALENDAR_QUERY", handlingStatus: "handled", confidence: "high" };

  if (includesAny(normalizedPrompt, ["create a task", "delete", "complete this", "send", "schedule", "do this for me", "make a reminder", "email", "create a meeting", "add a meeting", "schedule a meeting", "cancel my meeting", "delete an event", "respond to event"])) return { intent: "AUTONOMOUS_ACTION", handlingStatus: "boundary", confidence: "high" };
  if (includesAny(normalizedPrompt, ["weather", "news", "who is", "what is the capital", "search the web", "latest", "recipe"])) return { intent: "OUT_OF_SCOPE_GENERAL_KNOWLEDGE", handlingStatus: "unsupported", confidence: "high" };

  const projectTerms = ["project", "projects"];
  const projectFocusTerms = ["blocking", "blocked", "stuck", "next step", "do next", "should i do next", "next action", "why is"];
  if (includesAny(normalizedPrompt, projectTerms) && includesAny(normalizedPrompt, projectFocusTerms)) return { intent: "PROJECT_AGENT", handlingStatus: "handled", confidence: "high" };

  const personalDataViewTerms = ["show me my", "show my", "list my", "summarize my", "how are my", "tell me about my", "tell me about the", "current life pulse"];
  const personalDataDomains = ["task", "tasks", "todo", "to do", "habit", "habits", "goal", "goals", "project", "projects", "result", "results", "metric", "metrics", "life pulse"];
  if (includesAny(normalizedPrompt, personalDataViewTerms) && includesAny(normalizedPrompt, personalDataDomains)) return { intent: "GENERAL_SUPPORTED", handlingStatus: "handled", confidence: "medium" };

  const knowledgeTerms = ["my notes", "my note", "knowledge", "what did i write", "what did i note", "what does my", "notes say", "note say", "note says", "pasted note", "did i decide", "did we decide", "in my notes", "in my note", "what do my notes", "my launch document", "my document", "that document", "the document", "saved note", "saved document"];
  if (includesAny(normalizedPrompt, knowledgeTerms)) return { intent: "KNOWLEDGE_QUERY", handlingStatus: "handled", confidence: "high" };
  const asksStoredPhrase = includesAny(normalizedPrompt, ["verification phrase", "phrase in", "phrase from", "phrase was", "what was the phrase", "what is the phrase"]);
  const hasNamedSubject = /\b(atlas|orion|launch|pricing|document|note|plan)\b/.test(normalizedPrompt);
  if (asksStoredPhrase && hasNamedSubject) return { intent: "KNOWLEDGE_QUERY", handlingStatus: "handled", confidence: "medium" };

  if (includesAny(normalizedPrompt, ["holding me back", "deserves my attention", "everything going on", "where am i making progress", "where am i progressing", "where am i slipping", "progressing and where", "part of my life needs attention", "based on everything", "prioritize based on everything"])) return { intent: "CROSS_DOMAIN_AGENT", handlingStatus: "handled", confidence: "high" };

  if (includesAny(normalizedPrompt, ["focus", "do today", "matters most", "right now", "priority"])) return { intent: "TODAY_FOCUS", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["next step", "do next", "should i do next", "next action"])) return { intent: "NEXT_ACTION", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["attention", "falling behind", "behind on", "needs attention"])) return { intent: "ATTENTION", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["why are you telling me this", "why this", "evidence", "sources"])) return { intent: "GENERAL_SUPPORTED", handlingStatus: "handled", confidence: "medium" };
  if (includesAny(normalizedPrompt, ["this week", "week gone", "doing this week", "weekly progress"])) return { intent: "WEEK_PROGRESS", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["making progress", "going well", "progress", "good"])) return { intent: "PROGRESS", handlingStatus: "handled", confidence: "medium" };
  if (includesAny(normalizedPrompt, ["neglect", "not keeping up", "haven t", "have not", "missing"])) return { intent: "NEGLECT", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["plan", "structure today", "rest of today"])) return { intent: "PLANNING", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["review", "reflect", "look over", "journal", "evening shutdown", "weekly review"])) return { intent: "REVIEW", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["pattern", "patterns", "trend", "trends"])) return { intent: "PATTERN", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["stuck", "friction", "blocked", "stalling"])) return { intent: "STUCK", handlingStatus: "handled", confidence: "high" };
  if (includesAny(normalizedPrompt, ["coach", "help", "what should", "how am i", "what needs", "what can i"])) return { intent: "GENERAL_SUPPORTED", handlingStatus: "handled", confidence: "low" };

  return { intent: "UNSUPPORTED", handlingStatus: "unsupported", confidence: "high" };
}

export function isNextronProviderEligibleRequest(request: NextronUserRequest): boolean {
  return request.handlingStatus === "handled";
}

export function parseNextronUserRequest(prompt: unknown): NextronPromptValidation {
  if (typeof prompt !== "string") return { ok: false, reason: "invalid_type", message: "Ask NEXTRON with a text question." };
  const trimmed = prompt.trim();
  if (!trimmed) return { ok: false, reason: "empty", message: "Ask NEXTRON a practical Life Pulse question first." };
  if (trimmed.length > NEXTRON_REQUEST_MAX_LENGTH) return { ok: false, reason: "too_long", message: `Keep requests under ${NEXTRON_REQUEST_MAX_LENGTH} characters.` };
  const normalizedPrompt = normalizePrompt(trimmed);
  const classification = classifyPrompt(normalizedPrompt);
  return { ok: true, request: { rawPrompt: trimmed, normalizedPrompt, ...classification } };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function availableFact(category: NextronEvidenceCategory, text: string | null | undefined): NextronFact[] {
  return text ? [fact(category, text)] : [];
}

function attentionFacts(packet: NextronEvidencePacket): NextronFact[] {
  const facts: NextronFact[] = [];
  const tasks = packet.tasks.data;
  const habits = packet.habits.data;
  const results = packet.results.data;
  const projects = packet.projects.data;
  if (tasks?.overdueCount) facts.push(fact("tasks", `${plural(tasks.overdueCount, "open task")} overdue.`));
  if (tasks?.dueTodayCount) facts.push(fact("tasks", `${plural(tasks.dueTodayCount, "open task")} due today.`));
  if (habits && habits.dueTodayCount > habits.completedTodayCount) facts.push(fact("habits", `${plural(habits.dueTodayCount - habits.completedTodayCount, "due habit")} not completed today.`));
  if (results && results.activeMetricCount > 0 && results.recentEntryCount === 0) facts.push(fact("results", `${plural(results.activeMetricCount, "active Results metric")} with no recent entry this week.`));
  if (projects?.activeWithoutOpenTaskCount) facts.push(fact("projects", `${plural(projects.activeWithoutOpenTaskCount, "active project")} without an open task in the bounded check.`));
  return facts.slice(0, 4);
}

function positiveFacts(packet: NextronEvidencePacket): NextronFact[] {
  const facts: NextronFact[] = [];
  const today = packet.today.data;
  const habits = packet.habits.data;
  const results = packet.results.data;
  const goals = packet.goals.data;
  if (today?.completedTodayTaskCount) facts.push(fact("today", `${plural(today.completedTodayTaskCount, "task")} completed today.`));
  if (habits?.weeklyCompletedCount) facts.push(fact("habits", `${plural(habits.weeklyCompletedCount, "habit completion")} logged this week.`));
  if (results?.recentEntryCount) facts.push(fact("results", `${plural(results.recentEntryCount, "Results entry")} logged this week.`));
  if (goals?.activeCount) facts.push(fact("goals", `${plural(goals.activeCount, "active goal")} visible.`));
  return facts.slice(0, 3);
}

function memoryPreferenceFacts(packet: NextronEvidencePacket): NextronFact[] {
  return (packet.memory.data?.preferences ?? [])
    .map((preference) => fact("memory", `Confirmed preference: ${preference}`))
    .slice(0, 2);
}

function noEvidenceResponse(intent: NextronCoachingIntent): NextronCoachResponse {
  return response(
    `interactive_${intent.toLowerCase()}_limited_evidence`,
    "calm",
    [fact("today", "Permitted evidence is limited for this request right now.")],
    "NEXTRON cannot make a stronger recommendation without more permitted Life Pulse evidence.",
    "Open Today",
    "/today",
    "Use Today to log one real priority or completion, then ask again.",
  );
}

function boundaryResponse(request: NextronUserRequest): NextronCoachResponse {
  if (request.intent === "MENTAL_HEALTH_CRISIS") {
    return response("interactive_crisis_boundary", "high", [fact("today", "This request may involve immediate safety or self-harm risk.")], "NEXTRON is not a crisis or therapy service and cannot handle immediate-danger situations.", "Open Today", "/today", "If you may be in immediate danger, contact local emergency services or a trusted person now.");
  }
  const label = request.intent === "AUTONOMOUS_ACTION" ? "NEXTRON cannot take autonomous actions for you." : "This request needs expertise outside Life Pulse.";
  return response("interactive_boundary", "calm", [fact("today", label)], "NEXTRON can answer practical Life Pulse questions from permitted evidence, but it will not provide medical, legal, financial, or autonomous-action handling.", "Open Today", "/today", "Ask about focus, next action, attention, progress, planning, review, patterns, or friction instead.");
}

function unsupportedResponse(): NextronCoachResponse {
  return response("interactive_unsupported", "calm", [fact("today", "The request is not a supported deterministic Life Pulse question yet.")], "NEXTRON can currently answer practical questions about focus, next action, attention, progress, planning, review, patterns, and friction from permitted Life Pulse evidence.", "Open Today", "/today", "Try asking: What should I focus on today? What needs my attention? Or what should I do next?");
}

function reflectionRequestResponse(packet: NextronEvidencePacket, request: NextronUserRequest): NextronCoachResponse | null {
  const wantsJournal = request.normalizedPrompt.includes("journal") || request.normalizedPrompt.includes("wrote") || request.normalizedPrompt.includes("write");
  const wantsEvening = request.normalizedPrompt.includes("evening shutdown");
  const wantsWeekly = request.normalizedPrompt.includes("weekly review");
  if (!wantsJournal && !wantsEvening && !wantsWeekly) return null;

  if (wantsJournal && packet.journal.status === "permission_denied") {
    return response("interactive_journal_permission_denied", "calm", [fact("journal", "Journal text is not loaded by the current saved permissions.")], "NEXTRON cannot inspect or summarize Journal content unless that context is explicitly allowed.", "Review context permissions", "/nextron", "If you want Journal text included, enable it in Context permissions and save first.");
  }
  if (wantsEvening && packet.eveningShutdown.status === "permission_denied") {
    return response("interactive_evening_permission_denied", "calm", [fact("eveningShutdown", "Evening Shutdown reflection is not loaded by the current saved permissions.")], "NEXTRON cannot inspect that reflection unless the saved permission allows it.", "Review context permissions", "/nextron", "Enable Evening Shutdown reflection only if you want it included, then save permissions.");
  }
  if (wantsWeekly && packet.weeklyReview.status === "permission_denied") {
    return response("interactive_weekly_permission_denied", "calm", [fact("weeklyReview", "Weekly Review reflection is not loaded by the current saved permissions.")], "NEXTRON cannot inspect that reflection unless the saved permission allows it.", "Review context permissions", "/nextron", "Enable Weekly Review reflection only if you want it included, then save permissions.");
  }

  const facts = [
    ...availableFact("journal", wantsJournal && packet.journal.data?.recentReflectionSnippet ? "A bounded recent Journal snippet is available under current permissions." : null),
    ...availableFact("eveningShutdown", wantsEvening && packet.eveningShutdown.data?.existsToday ? "An Evening Shutdown reflection exists today under current permissions." : null),
    ...availableFact("weeklyReview", wantsWeekly && packet.weeklyReview.data?.existsThisWeek ? "A Weekly Review reflection exists this week under current permissions." : null),
  ];
  return facts.length > 0
    ? response("interactive_reflection_review", "low", facts, "Reflection context is available, but NEXTRON only uses bounded summaries rather than dumping private text.", "Open Journal", "/journal", "Open the relevant reflection surface if you want to read or edit the source text yourself.")
    : response("interactive_reflection_missing", "calm", [fact("journal", "No matching reflection evidence is available in the current permitted packet.")], "NEXTRON will not infer or invent private reflection content.", "Open Journal", "/journal", "Use Journal or Review surfaces directly if you want to add a real reflection.");
}

export function buildInteractiveNextronResponse(packet: NextronEvidencePacket, request: NextronUserRequest): NextronCoachResponse {
  if (request.handlingStatus === "boundary") return boundaryResponse(request);
  const reflectionResponse = reflectionRequestResponse(packet, request);
  if (reflectionResponse) return reflectionResponse;
  if (request.handlingStatus === "unsupported") return unsupportedResponse();

  const fallback = buildDeterministicNextronResponse(packet);
  const facts = attentionFacts(packet);
  const positives = positiveFacts(packet);

  switch (request.intent) {
    case "TODAY_FOCUS":
      return facts.length > 0 ? response("interactive_today_focus", "medium", facts.slice(0, 3), "The clearest focus is the visible item with the most immediate date or loop impact.", fallback.nextAction.label, fallback.nextAction.href, fallback.nextAction.rationale) : noEvidenceResponse(request.intent);
    case "PROJECT_AGENT": {
      if (packet.projects.status === "permission_denied") {
        return response("interactive_project_agent_projects_denied", "calm", [fact("projects", "Project context is not loaded by the current saved permissions.")], "NEXTRON cannot inspect project blockers unless Projects context is allowed.", "Review context permissions", "/nextron", "Enable Projects context if you want project-specific analysis.");
      }
      if (packet.tasks.status === "permission_denied") {
        return response("interactive_project_agent_tasks_denied", "calm", [fact("tasks", "Task context is not loaded by the current saved permissions.")], "NEXTRON cannot inspect project blockers unless Tasks context is allowed.", "Review context permissions", "/nextron", "Enable Tasks context if you want blocker analysis.");
      }
      return packet.projects.data
        ? response("interactive_project_agent_fallback", "medium", [fact("projects", `${plural(packet.projects.data.activeCount, "active project")} visible.`)], "Use the Projects surface to inspect linked open tasks and choose the next manual step.", "Open Projects", "/projects", "Review the project and its tasks directly; NEXTRON will not create or edit anything.")
        : noEvidenceResponse(request.intent);
    }
    case "CROSS_DOMAIN_AGENT":
      return facts.length > 0
        ? response("interactive_cross_domain_fallback", "medium", facts, "These are the clearest cross-domain attention signals in permitted evidence. NEXTRON is using deterministic fallback rather than agent synthesis right now.", fallback.nextAction.label, fallback.nextAction.href, fallback.nextAction.rationale)
        : noEvidenceResponse(request.intent);
    case "KNOWLEDGE_QUERY":
      return packet.knowledge.status === "permission_denied"
        ? response("interactive_knowledge_permission_denied", "calm", [fact("knowledge", "Knowledge notes are not loaded by the current saved permissions.")], "NEXTRON cannot inspect Knowledge notes unless that context is explicitly allowed.", "Review context permissions", "/nextron", "Enable Knowledge notes only if you want NEXTRON to search your saved notes, then save permissions.")
        : response("interactive_knowledge_fallback", "calm", [fact("knowledge", "No relevant Knowledge note evidence was found in the bounded check.")], "NEXTRON will not invent a note match or cite a source it did not retrieve.", "Open Knowledge", "/knowledge", "Use Knowledge to inspect or add the note manually.");
    case "NEXT_ACTION":
    case "GENERAL_SUPPORTED":
      return { ...fallback, ruleId: `interactive_${fallback.ruleId}` };
    case "ATTENTION":
    case "NEGLECT":
    case "STUCK":
      return facts.length > 0 ? response(`interactive_${request.intent.toLowerCase()}`, "medium", facts, request.intent === "STUCK" ? "These are factual friction signals, not proof of a personal cause." : "These are the clearest attention signals in permitted evidence.", fallback.nextAction.label, fallback.nextAction.href, fallback.nextAction.rationale) : noEvidenceResponse(request.intent);
    case "WEEK_PROGRESS": {
      const weeklyFacts = [
        ...availableFact("tasks", packet.tasks.data ? `${plural(packet.tasks.data.completedTodayCount, "task")} completed today.` : null),
        ...availableFact("habits", packet.habits.data ? `${plural(packet.habits.data.weeklyCompletedCount, "habit completion")} logged this week${packet.habits.data.weeklyTargetCount === null ? "." : ` against ${packet.habits.data.weeklyTargetCount} due completions.`}` : null),
        ...availableFact("results", packet.results.data ? `${plural(packet.results.data.recentEntryCount, "Results entry")} logged this week.` : null),
        ...availableFact("weeklyReview", packet.weeklyReview.data?.existsThisWeek ? "A Weekly Review reflection exists this week." : null),
      ].slice(0, 4);
      return weeklyFacts.length > 0 ? response("interactive_week_progress", "low", weeklyFacts, "This is a factual weekly snapshot, not a score or trend prediction.", "Open Weekly Review", "/weekly-review", "Review the week if you want to turn these facts into a short reflection.") : noEvidenceResponse(request.intent);
    }
    case "PROGRESS":
      return positives.length > 0 ? response("interactive_progress", "low", positives, "These are the strongest positive signals currently visible in permitted evidence.", "Open Today", "/today", "Keep the loop small: continue one thing that is already moving.") : noEvidenceResponse(request.intent);
    case "PLANNING":
      return response("interactive_planning", "medium", [...memoryPreferenceFacts(packet), ...(facts.length > 0 ? facts.slice(0, 2) : [fact("today", "NEXTRON does not see a strong urgent signal in permitted evidence.")])].slice(0, 3), "A safe plan is bounded: choose one immediate item, then one follow-up, then close the day with a review only if useful. Confirmed preferences can shape style, but current Life Pulse facts stay authoritative.", "Open Today", "/today", "Use Today to pick the first step; avoid inventing calendar times that are not already in Life Pulse.");
    case "REVIEW":
      return [...facts.slice(0, 2), ...positives.slice(0, 2)].length > 0
        ? response("interactive_review", "low", [...facts.slice(0, 2), ...positives.slice(0, 2)].slice(0, 4), "The best review target is the area with either unfinished work or recent activity.", "Open Weekly Review", "/weekly-review", "Review factual summaries first, then save a reflection only if it adds something real.")
        : noEvidenceResponse(request.intent);
    case "PATTERN": {
      const repeated = positives.filter((item) => item.text.includes("week") || item.text.includes("logged"));
      return repeated.length >= 2 ? response("interactive_pattern", "low", repeated, "There is enough repeated logged activity to name a small pattern, but not enough to claim a trend.", "Open Insights", "/insights", "Use Insights to compare this with other logged signals.") : response("interactive_pattern_insufficient", "calm", [fact("today", "There is not enough repeated permitted evidence to name a reliable pattern yet.")], "NEXTRON will not invent a trend from one-off or missing data.", "Open Today", "/today", "Keep logging normally, then ask again after more repeated evidence exists.");
    }
    default:
      return unsupportedResponse();
  }
}

export function buildDeterministicNextronResponse(packet: NextronEvidencePacket): NextronCoachResponse {
  if (packet.warnings.length > 0) {
    return response(
      "partial_context_loaded",
      "medium",
      [fact("today", "Some optional NEXTRON context could not be loaded."), ...packet.warnings.slice(0, 2).map((warning) => fact("today", warning))],
      "NEXTRON can still use the context that loaded, but this response should be treated as partial.",
      "Open Today",
      "/today",
      "Use Today as the stable manual command center while optional context recovers.",
    );
  }

  const today = packet.today.data;
  const tasks = packet.tasks.data;
  const habits = packet.habits.data;
  const results = packet.results.data;
  const evening = packet.eveningShutdown.data;
  const weekly = packet.weeklyReview.data;
  const projects = packet.projects.data;

  if (tasks && tasks.overdueCount > 0) {
    return response(
      "overdue_task",
      "high",
      [
        fact("tasks", `You have ${tasks.overdueCount} overdue open task${tasks.overdueCount === 1 ? "" : "s"}.`),
        fact("tasks", `${tasks.dueTodayCount} task${tasks.dueTodayCount === 1 ? " is" : "s are"} due today.`),
      ],
      "The immediate workload appears to have at least one carryover item. It may be worth deciding manually whether it still matters today.",
      "Review overdue tasks",
      "/tasks",
      "Open Tasks and choose whether the overdue item should be completed, rescheduled manually, or removed.",
    );
  }

  if (tasks && tasks.dueTodayCount > 0) {
    return response(
      "due_today_task",
      "medium",
      [
        fact("tasks", `You have ${tasks.dueTodayCount} open task${tasks.dueTodayCount === 1 ? "" : "s"} due today.`),
        fact("tasks", `${tasks.completedTodayCount} task${tasks.completedTodayCount === 1 ? " has" : "s have"} been completed today.`),
      ],
      "There is a clear next execution surface today. Keeping the next step small can preserve momentum.",
      "Open Today",
      "/today",
      "Use Today to pick one visible action instead of scanning every task.",
    );
  }

  if (habits && habits.dueTodayCount > habits.completedTodayCount) {
    const remaining = habits.dueTodayCount - habits.completedTodayCount;
    return response(
      "incomplete_due_habit",
      "medium",
      [
        fact("habits", `${remaining} due habit${remaining === 1 ? " is" : "s are"} still waiting today.`),
        fact("habits", `${habits.completedTodayCount} of ${habits.dueTodayCount} due habit${habits.dueTodayCount === 1 ? "" : "s"} are completed.`),
      ],
      "Your task load may not be the only useful signal. A small habit can be the lowest-friction way to keep the loop alive.",
      "Open Habits",
      "/habits",
      "Check the due habit list and complete one only if it actually happened.",
    );
  }

  if (today && !today.hasMorningPlan && today.completedTodayTaskCount === 0 && today.completedHabitCount === 0) {
    return response(
      "missing_morning_plan",
      "medium",
      [fact("today", "NEXTRON does not see a clear priority, completed task, or completed due habit for today.")],
      "Evidence is limited for today. The safest move is to define one realistic priority before adding more context.",
      "Set today's priority",
      "/today",
      "Open Today and choose one priority that would make the day count.",
    );
  }

  if (results && results.activeMetricCount > 0 && results.recentEntryCount === 0) {
    return response(
      "configured_results_without_entries",
      "low",
      [fact("results", `You have ${results.activeMetricCount} active Results metric${results.activeMetricCount === 1 ? "" : "s"} and no recent entries this week.`)],
      "If those metrics still matter, a manual check-in could make this week's review more factual.",
      "Open Results",
      "/results",
      "Record a value only if you have a real measurement to enter.",
    );
  }

  const hour = new Date().getHours();
  if (hour >= 18 && today && (today.completedTodayTaskCount > 0 || today.completedHabitCount > 0) && (!evening || !evening.existsToday)) {
    return response(
      "late_day_shutdown",
      "low",
      [fact("today", `${today.completedTodayTaskCount} task${today.completedTodayTaskCount === 1 ? "" : "s"} and ${today.completedHabitCount} habit${today.completedHabitCount === 1 ? "" : "s"} are completed today.`)],
      "There is enough activity to make a short end-of-day reflection useful, but it should stay optional.",
      "Inspect Evening Shutdown",
      "/today#evening-reflection",
      "Open Today and write a brief shutdown only if you are ready to save a real reflection.",
    );
  }

  const day = new Date().getDay();
  if ((day === 0 || day >= 5) && (!weekly || !weekly.existsThisWeek)) {
    return response(
      "weekly_review_handoff",
      "low",
      [fact("weeklyReview", "The calendar is near a natural weekly review window."), fact("today", `Current week starts ${packet.weekStart}.`)],
      "A weekly review may be useful if you have enough logged evidence. If not, there is no need to force it.",
      "Open Weekly Review",
      "/weekly-review",
      "Review the factual summary first, then save only if you have a real reflection.",
    );
  }

  if (projects && projects.activeWithoutOpenTaskCount > 0) {
    return response(
      "project_without_open_task",
      "low",
      [fact("projects", `${projects.activeWithoutOpenTaskCount} active project${projects.activeWithoutOpenTaskCount === 1 ? " has" : "s have"} no open task in the bounded check.`)],
      "One active project may not have a visible next action. This is only a prompt to inspect, not proof that the project is stuck.",
      "Review Projects",
      "/projects",
      "Open Projects and decide whether one project needs a next task.",
    );
  }

  return response(
    "calm_no_pressure",
    "calm",
    [
      fact("today", today ? `${today.completedTodayTaskCount} task${today.completedTodayTaskCount === 1 ? "" : "s"} and ${today.completedHabitCount} habit${today.completedHabitCount === 1 ? "" : "s"} completed today.` : "Today context is limited or denied."),
      fact("tasks", tasks ? `${tasks.boundedOpenTaskCount} bounded open task${tasks.boundedOpenTaskCount === 1 ? "" : "s"} are visible.` : "Task context is limited or denied."),
    ],
    "Nothing in the permitted evidence requires urgency. Keep the loop simple and avoid adding work just to satisfy the system.",
    "Open Today",
    "/today",
    "Use Today if you want to choose one small next step; otherwise keep logging normally.",
  );
}
