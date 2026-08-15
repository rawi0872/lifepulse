"use client";

import { startTransition, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { recordProductLearningEvent } from "@/lib/product-learning/client";
import {
  buildDeterministicNextronResponse,
  NEXTRON_REQUEST_MAX_LENGTH,
  parseNextronUserRequest,
  type NextronCoachResponse,
} from "@/lib/nextron/coach";
import {
  areNextronPermissionsEqual,
  buildNextronPreferenceUpsert,
  getDefaultNextronPermissions,
  NEXTRON_CONTEXT_PERMISSIONS,
  NEXTRON_UNAVAILABLE_CONTEXT,
  normalizeNextronPreferences,
  type NextronContextDomain,
  type NextronPreferenceRow,
  type NextronPermissionState,
} from "@/lib/nextron/context";
import type { NextronEvidencePacket } from "@/lib/nextron/evidence";
import { isNextronRichResponse, type NextronRichBlock, type NextronRichListItem, type NextronRichMetric } from "@/lib/nextron/rich-response";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_task_actions, allow_goal_actions, allow_habit_actions, allow_project_actions, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

interface ConversationSummary { id: string; title: string; created_at: string; updated_at: string }
interface ConversationMessage { id: string; conversation_id: string; role: "user" | "assistant"; content: string; response: NextronCoachResponse | null; metadata: Record<string, unknown>; created_at: string }
interface LiveContextPanels {
  today: { localDate: string; tasksRemaining: number; completedToday: number; overdue: number; habitsDue: number; habitsCompleted: number; status: string };
  projects: { status: string; activeCount: number; items: Array<{ title: string; openTaskCount: number }>; limit: number };
  calendar: { status: string; events: Array<{ title: string; startsAt: string; endsAt: string | null; allDay: boolean }>; moreTodayCount: number; readOnly: true };
  systems: {
    knowledge: { status: string; count: number | null };
    memory: { status: string; count: number | null };
    drive: { status: string; count: number | null };
    calendar: { status: string };
    weeklyReview: { status: string; existsThisWeek: boolean };
  };
}
type DailyBriefSource = "Today" | "Tasks" | "Habits" | "Projects" | "Goals" | "Calendar" | "Weekly Review" | "Profile";
interface DailyBriefPriority { title: string; reason: string; sourceRefs: DailyBriefSource[] }
interface DailyBriefOpenLoop { label: string; detail: string; sourceRefs: DailyBriefSource[] }
interface DailyBrief {
  date: string;
  headline: string;
  summary: string;
  priorities: DailyBriefPriority[];
  scheduleSummary: string | null;
  openLoops: DailyBriefOpenLoop[];
  recommendedApproach: string;
  generatedAt: string;
  sources: DailyBriefSource[];
  source: "ai" | "deterministic";
  fallbackReason?: string | null;
}
interface DailyBriefMeta { maxPriorities: number; cache: string; persisted: boolean; modelCalls: number; provider: string; knowledgeAutomaticRetrieval: boolean; memoryAutomaticUse: boolean }

type NextronSignalSeverity = "info" | "attention" | "important";
interface NextronSignal {
  id: string;
  type: string;
  severity: NextronSignalSeverity;
  title: string;
  summary: string;
  evidence: string[];
  sourceTypes: string[];
  observedAt: string;
  validForLocalDate: string;
  route: string;
  bridgePrompt: string;
}
interface NextronSignalMeta { localDate: string; observedAt: string; maxVisible: number; persisted: boolean; modelCalls: number; provider: string; knowledgeAutomaticScan: boolean; driveAutomaticScan: boolean; memoryAutomaticMonitoring: boolean }

interface NextronAttentionItem { id: string; domain: string; severity: NextronSignalSeverity; title: string; explanation: string; evidence: string[]; route: string; bridgePrompt: string }
interface NextronAttentionSummary {
  version: "nextron-attention-v1";
  status: "active" | "calm" | "partial";
  generatedAt: string;
  localDate: string;
  primary: NextronAttentionItem | null;
  secondary: NextronAttentionItem[];
  calmMessage: string;
  currentFocus: { title: string; detail: string; route: string; bridgePrompt: string } | null;
  meta: { maxPrimary: 1; maxSecondary: 4; modelCalls: 0; provider: "deterministic"; persisted: false; source: "signals" };
}

interface NextronActionPreviewField { label: string; before?: string | null; after: string }
interface NextronActionPreview { heading: string; subheading: string; fields: NextronActionPreviewField[]; approvalLabel: string }
interface NextronActionProposal {
  id: string;
  actionType: string;
  title: string;
  description: string;
  parameters: Record<string, unknown>;
  preview: NextronActionPreview;
  riskLevel: "low" | "sensitive" | "external";
  requiresApproval: true;
  status: "pending" | "approved_execution_disabled" | "completed" | "partially_failed" | "failed" | "stale" | "canceled" | "expired" | "invalidated";
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  canceledAt: string | null;
  executedAt: string | null;
  finalReason: string | null;
  executionResult: Record<string, unknown> | null;
}

type IntelligenceCoreState = "idle" | "thinking" | "syncing" | "ready" | "error";
type DailyBriefStatus = "idle" | "generating" | "ready" | "error";
type SignalStatus = "idle" | "loading" | "ready" | "error";
type ActionProposalStatus = "idle" | "loading" | "ready" | "saving" | "error";
type AskFailureCode = "validation" | "context" | "auth" | "network" | "timeout" | "api" | "render" | "busy";

const NEXTRON_ASK_CLIENT_TIMEOUT_MS = 35_000;

function readInitialNextronBridgePrompt(): string {
  if (typeof window === "undefined") return "";
  const subject = new URLSearchParams(window.location.search).get("subject");
  if (!subject) return "";

  try {
    const stored = sessionStorage.getItem("lifepulse:nextron-bridge");
    if (stored) {
      const bridge = JSON.parse(stored) as { subject?: string; prompt?: string; createdAt?: number };
      sessionStorage.removeItem("lifepulse:nextron-bridge");
      if (bridge.subject === subject && typeof bridge.prompt === "string" && Date.now() - Number(bridge.createdAt ?? 0) < 5 * 60_000) return bridge.prompt.slice(0, NEXTRON_REQUEST_MAX_LENGTH);
    }
  } catch {}

  return getNextronBridgePrompt(subject);
}

export default function CoachPage() {
  return (
    <DashboardNav>
      <NextronContent />
    </DashboardNav>
  );
}

function NextronContent() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const requestSeq = useRef(0);
  const askAbortController = useRef<AbortController | null>(null);
  const askSectionRef = useRef<HTMLElement | null>(null);
  const answerSectionRef = useRef<HTMLElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const dailyBriefAbortController = useRef<AbortController | null>(null);
  const dailyBriefSessionCache = useRef<Map<string, { brief: DailyBrief; meta: DailyBriefMeta }>>(new Map());
  const bridgeInitialized = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPermissions, setSavedPermissions] = useState<NextronPermissionState>(() => getDefaultNextronPermissions());
  const [draftPermissions, setDraftPermissions] = useState<NextronPermissionState>(() => getDefaultNextronPermissions());
  const [packet, setPacket] = useState<NextronEvidencePacket | null>(null);
  const [livePanels, setLivePanels] = useState<LiveContextPanels | null>(null);
  const [response, setResponse] = useState<NextronCoachResponse | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [permissionsAvailable, setPermissionsAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [askPrompt, setAskPrompt] = useState(readInitialNextronBridgePrompt);
  const [askResponse, setAskResponse] = useState<NextronCoachResponse | null>(null);
  const [askStatus, setAskStatus] = useState<"idle" | "asking" | "answered" | "unsupported" | "error">("idle");
  const [askError, setAskError] = useState<string | null>(null);
  const [askFailureCode, setAskFailureCode] = useState<AskFailureCode | null>(null);
  const [pendingUserPrompt, setPendingUserPrompt] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState<"idle" | "loading" | "saving" | "error">("loading");
  const [threadError, setThreadError] = useState<string | null>(null);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [dailyBriefMeta, setDailyBriefMeta] = useState<DailyBriefMeta | null>(null);
  const [dailyBriefStatus, setDailyBriefStatus] = useState<DailyBriefStatus>("idle");
  const [dailyBriefError, setDailyBriefError] = useState<string | null>(null);
  const [signals, setSignals] = useState<NextronSignal[]>([]);
  const [attention, setAttention] = useState<NextronAttentionSummary | null>(null);
  const [signalMeta, setSignalMeta] = useState<NextronSignalMeta | null>(null);
  const [signalStatus, setSignalStatus] = useState<SignalStatus>("idle");
  const [signalError, setSignalError] = useState<string | null>(null);
  const [actionProposals, setActionProposals] = useState<NextronActionProposal[]>([]);
  const [actionStatus, setActionStatus] = useState<ActionProposalStatus>("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (bridgeInitialized.current) return;
    bridgeInitialized.current = true;

    const timeoutId = window.setTimeout(() => {
      const prompt = readInitialNextronBridgePrompt();
      if (!prompt) return;
      startTransition(() => {
        setAskPrompt((current) => current.trim() ? current : prompt);
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setThreadStatus("loading");
    setThreadError(null);
    const result = await fetch(`/api/nextron/conversations/${id}`).then((res) => res.ok ? res.json() : null).catch(() => null) as { conversation?: ConversationSummary; messages?: ConversationMessage[] } | null;
    if (!result?.conversation) {
      setThreadStatus("error");
      setThreadError("That conversation could not be opened.");
      return;
    }
    setCurrentConversation(result.conversation);
    setMessages(result.messages ?? []);
    setConversations((current) => current.some((item) => item.id === result.conversation?.id) ? current : [result.conversation!, ...current]);
    setThreadStatus("idle");
  }, []);

  const loadConversations = useCallback(async (selectId?: string | null) => {
    setThreadStatus("loading");
    setThreadError(null);
    const result = await fetch("/api/nextron/conversations").then((res) => res.ok ? res.json() : null).catch(() => null) as { conversations?: ConversationSummary[] } | null;
    if (!result) setThreadError("Conversation history could not be loaded.");
    const list = result?.conversations ?? [];
    setConversations(list);
    const targetId = selectId ?? null;
    if (targetId) await openConversation(targetId);
    else {
      setThreadStatus("idle");
    }
  }, [openConversation]);

  const loadLiveContext = useCallback(async () => {
    const result = await fetch("/api/nextron/context").then((res) => res.ok ? res.json() : null).catch(() => null) as { packet?: unknown; panels?: unknown } | null;
    if (!result || !isNextronEvidencePacket(result.packet) || !isLiveContextPanels(result.panels)) throw new Error("NEXTRON context unavailable");
    setPacket(result.packet);
    setLivePanels(result.panels);
    setResponse(buildDeterministicNextronResponse(result.packet));
  }, []);

  const loadSignals = useCallback(async () => {
    setSignalStatus("loading");
    setSignalError(null);
    const result = await fetch("/api/nextron/signals").then((res) => res.ok ? res.json() : null).catch(() => null) as { signals?: unknown; attention?: unknown; meta?: unknown } | null;
    if (!result || !Array.isArray(result.signals) || !isNextronSignalMeta(result.meta)) {
      setSignalStatus("error");
      setSignalError("NEXTRON signals could not be loaded.");
      return;
    }
    const safeSignals = result.signals.filter(isNextronSignal).slice(0, result.meta.maxVisible);
    setSignals(safeSignals);
    setAttention(isNextronAttentionSummary(result.attention) ? result.attention : null);
    setSignalMeta(result.meta);
    setSignalStatus("ready");
  }, []);

  const loadActionProposals = useCallback(async () => {
    setActionStatus("loading");
    setActionError(null);
    const result = await fetch("/api/nextron/actions").then((res) => res.ok ? res.json() : null).catch(() => null) as { proposals?: unknown } | null;
    if (!result || !Array.isArray(result.proposals)) {
      setActionStatus("error");
      setActionError("NEXTRON action proposals could not be loaded.");
      return;
    }
    setActionProposals(result.proposals.filter(isNextronActionProposal).slice(0, 6));
    setActionStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const seq = ++requestSeq.current;
      setPermissionLoading(true);
      setLoading(true);
      setError(null);
      setPermissionWarning(null);
      setPermissionsAvailable(true);
      setSaveStatus("idle");
      setPacket(null);
      setLivePanels(null);
      setResponse(null);
      setAskResponse(null);
      setAskStatus("idle");
      setAskError(null);
      setAskFailureCode(null);
      setPendingUserPrompt(null);
      setFailedPrompt(null);
      setDailyBrief(null);
      setDailyBriefMeta(null);
      setDailyBriefStatus("idle");
      setDailyBriefError(null);
      setSignals([]);
      setAttention(null);
      setSignalMeta(null);
      setSignalStatus("idle");
      setSignalError(null);
      setActionProposals([]);
      setActionStatus("idle");
      setActionError(null);
      setThreadStatus("loading");
      setThreadError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || seq !== requestSeq.current) return;
        if (!user) {
          setUserId(null);
          const defaults = getDefaultNextronPermissions();
          setSavedPermissions(defaults);
          setDraftPermissions(defaults);
          setPacket(null);
          setLivePanels(null);
          setResponse(null);
          setAskResponse(null);
          setAskStatus("idle");
          setAskError(null);
          setAskFailureCode(null);
          setPendingUserPrompt(null);
          setFailedPrompt(null);
          setDailyBrief(null);
          setDailyBriefMeta(null);
          setDailyBriefStatus("idle");
          setDailyBriefError(null);
          setSignals([]);
          setAttention(null);
          setSignalMeta(null);
          setSignalStatus("idle");
          setSignalError(null);
          setActionProposals([]);
          setActionStatus("idle");
          setActionError(null);
          setConversations([]);
          setCurrentConversation(null);
          setMessages([]);
          router.replace("/login");
          return;
        }

        setUserId(user.id);
        const { data, error: preferencesError } = await supabase
          .from("nextron_context_preferences")
          .select(PREFERENCE_COLUMNS)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled || seq !== requestSeq.current) return;

        const normalized = preferencesError
          ? { permissions: getDefaultNextronPermissions(), warning: "Saved NEXTRON permissions could not be loaded, so safe defaults are active." }
          : normalizeNextronPreferences(data as NextronPreferenceRow | null);

        setPermissionsAvailable(!preferencesError);
        setSavedPermissions(normalized.permissions);
        setDraftPermissions(normalized.permissions);
        setPermissionWarning(normalized.warning);
        setPermissionLoading(false);

        await loadLiveContext();
        if (cancelled || seq !== requestSeq.current) return;
        setLoading(false);

        void Promise.allSettled([
          loadSignals(),
          loadActionProposals(),
          loadConversations(),
        ]).then(() => undefined);
      } catch {
        if (!cancelled && seq === requestSeq.current) setError("NEXTRON could not load the permitted context right now.");
      } finally {
        if (!cancelled && seq === requestSeq.current) {
          setPermissionLoading(false);
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      requestSeq.current += 1;
      askAbortController.current?.abort();
      dailyBriefAbortController.current?.abort();
    };
  }, [loadActionProposals, loadConversations, loadLiveContext, loadSignals, router, supabase]);

  useEffect(() => {
    if (!userId) return;
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void loadLiveContext().catch(() => undefined);
        void loadSignals().catch(() => undefined);
        void loadActionProposals().catch(() => undefined);
      }
    }
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [loadActionProposals, loadLiveContext, loadSignals, userId]);

  async function startNewConversation() {
    setThreadError(null);
    setCurrentConversation(null);
    setMessages([]);
    setAskResponse(null);
    setAskPrompt("");
    setAskStatus("idle");
    setAskError(null);
    setAskFailureCode(null);
    setPendingUserPrompt(null);
    setFailedPrompt(null);
    setThreadStatus("idle");
  }

  async function deleteConversation(id: string) {
    setThreadStatus("saving");
    setThreadError(null);
    const ok = await fetch(`/api/nextron/conversations/${id}`, { method: "DELETE" }).then((res) => res.ok).catch(() => false);
    if (!ok) {
      setThreadStatus("error");
      setThreadError("Conversation could not be deleted.");
      return;
    }
    const nextList = conversations.filter((item) => item.id !== id);
    setConversations(nextList);
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setMessages([]);
      setAskResponse(null);
      setPendingUserPrompt(null);
      setFailedPrompt(null);
    }
    setThreadStatus("idle");
  }

  function setPermission(domain: NextronContextDomain, allowed: boolean) {
    setDraftPermissions((current) => ({ ...current, [domain]: allowed ? "allowed" : "denied" }));
    setSaveStatus("idle");
  }

  async function savePermissions() {
    if (!userId || saveStatus === "saving" || areNextronPermissionsEqual(savedPermissions, draftPermissions)) return;

    const seq = ++requestSeq.current;
    setSaveStatus("saving");
    setError(null);
    setPermissionWarning(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (seq !== requestSeq.current) return;
    if (!user || user.id !== userId) {
      const defaults = getDefaultNextronPermissions();
      setUserId(null);
      setSavedPermissions(defaults);
      setDraftPermissions(defaults);
      setPacket(null);
      setLivePanels(null);
      setResponse(null);
      setAskResponse(null);
      setAskStatus("idle");
      setAskError(null);
      setAskFailureCode(null);
      setPendingUserPrompt(null);
      setFailedPrompt(null);
      setSaveStatus("error");
      router.replace("/login");
      return;
    }

    const { data, error: saveError } = await supabase
      .from("nextron_context_preferences")
      .upsert(buildNextronPreferenceUpsert(user.id, draftPermissions), { onConflict: "user_id" })
      .select(PREFERENCE_COLUMNS)
      .single();

    if (seq !== requestSeq.current) return;

    if (saveError || !data) {
      setSaveStatus("error");
      return;
    }

    const normalized = normalizeNextronPreferences(data as NextronPreferenceRow);
    setSavedPermissions(normalized.permissions);
    setDraftPermissions(normalized.permissions);
    setPermissionWarning(normalized.warning);
    setPermissionsAvailable(true);
    setSaveStatus("saved");
    setDailyBrief(null);
    setDailyBriefMeta(null);
    setDailyBriefStatus("idle");
    setDailyBriefError("Daily Brief hidden until you refresh it with the newly saved permissions.");

    try {
      await loadLiveContext();
      if (seq !== requestSeq.current) return;
      await loadSignals();
      if (seq !== requestSeq.current) return;
    } catch {
      setError("NEXTRON saved your permissions, but could not refresh the permitted context right now.");
    }
  }

  function dailyBriefCacheKey() {
    if (!userId || !packet) return null;
    return `${userId}:${packet.generatedForLocalDate}:${JSON.stringify(savedPermissions)}`;
  }

  async function generateDailyBriefAction(forceRefresh = false) {
    if (!userId || !packet || dailyBriefStatus === "generating") return;
    const key = dailyBriefCacheKey();
    if (!key) return;
    const cached = dailyBriefSessionCache.current.get(key);
    if (!forceRefresh && cached) {
      setDailyBrief(cached.brief);
      setDailyBriefMeta({ ...cached.meta, modelCalls: 0, cache: "client-session-hit" });
      setDailyBriefStatus("ready");
      setDailyBriefError(null);
      return;
    }

    setDailyBriefStatus("generating");
    setDailyBriefError(null);
    const controller = new AbortController();
    dailyBriefAbortController.current?.abort();
    dailyBriefAbortController.current = controller;

    try {
      const response = await fetch("/api/nextron/daily-brief", { method: "POST", signal: controller.signal });
      if (response.status === 401) {
        setDailyBriefStatus("error");
        setDailyBriefError("Sign in again to generate the Daily Brief.");
        router.replace("/login");
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      const parsed = parseDailyBriefResponseBody(body);
      if (!response.ok || !parsed) {
        setDailyBriefStatus("error");
        setDailyBriefError("NEXTRON could not generate the Daily Brief right now.");
        return;
      }
      setDailyBrief(parsed.brief);
      setDailyBriefMeta(parsed.meta);
      setDailyBriefStatus("ready");
      dailyBriefSessionCache.current.set(key, parsed);
      void loadSignals().catch(() => undefined);
    } catch (errorValue) {
      if (errorValue instanceof DOMException && errorValue.name === "AbortError") return;
      setDailyBriefStatus("error");
      setDailyBriefError("NEXTRON could not generate the Daily Brief right now.");
    } finally {
      if (dailyBriefAbortController.current === controller) dailyBriefAbortController.current = null;
    }
  }

  function looksLikeActionIntent(prompt: string): boolean {
    return /\b(create|add|make|remind me|reminder|move|update|change|pause|complete|connect|link|attach|disconnect|unlink|detach|remove)\b/i.test(prompt) && /\b(task|reminder|due|deadline|goal|habit|project|calendar|delete|from|to|with)\b/i.test(prompt);
  }

  async function proposeNextronAction(prompt: string): Promise<boolean> {
    if (!looksLikeActionIntent(prompt)) return false;
    setActionStatus("saving");
    setActionError(null);
    const result = await fetch("/api/nextron/actions/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, conversationId: currentConversation?.id ?? null }),
    }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    if (!result || result.status === 404) {
      setActionStatus("idle");
      return false;
    }
    const candidate = typeof result.body === "object" && result.body !== null ? result.body as { proposal?: unknown; error?: unknown } : null;
    if (!result.ok || !isNextronActionProposal(candidate?.proposal)) {
      setActionStatus("error");
      setActionError(typeof candidate?.error === "string" ? candidate.error : "NEXTRON could not prepare that action proposal.");
      return true;
    }
    const proposal = candidate.proposal;
    setActionProposals((current) => [proposal, ...current.filter((item) => item.id !== proposal.id)].slice(0, 6));
    setActionStatus("ready");
    setAskPrompt("");
    setAskStatus("answered");
    setAskError(null);
    setAskFailureCode(null);
    setPendingUserPrompt(null);
    setFailedPrompt(null);
    return true;
  }

  async function transitionActionProposal(id: string, transition: "approve" | "cancel") {
    setActionStatus("saving");
    setActionError(null);
    const result = await fetch(`/api/nextron/actions/${id}/${transition}`, { method: "POST" }).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    const candidate = typeof result?.body === "object" && result.body !== null ? result.body as { proposal?: unknown; error?: unknown } : null;
    if (!result?.ok || !isNextronActionProposal(candidate?.proposal)) {
      setActionStatus("error");
      setActionError(typeof candidate?.error === "string" ? candidate.error : "NEXTRON could not update that proposal.");
      return;
    }
    const proposal = candidate.proposal;
    setActionProposals((current) => [proposal, ...current.filter((item) => item.id !== proposal.id)].slice(0, 6));
    if (proposal.status === "completed") {
      void loadLiveContext().catch(() => undefined);
      void loadSignals().catch(() => undefined);
    }
    setActionStatus("ready");
  }

  async function askNextron(promptOverride?: string) {
    if (askStatus === "asking") {
      setAskError("NEXTRON is already answering. Wait for this response, then ask again.");
      setAskFailureCode("busy");
      return;
    }
    const prompt = promptOverride ?? askPrompt;
    if (await proposeNextronAction(prompt)) return;
    const parsed = parseNextronUserRequest(prompt);
    if (!parsed.ok) {
      setAskError(parsed.message);
      setAskFailureCode("validation");
      setAskStatus("error");
      void recordProductLearningEvent("nextron_ask_failed", { reason: "invalid_request" });
      setPendingUserPrompt(null);
      setFailedPrompt(prompt.trim() || null);
      return;
    }
    if (!packet || !userId) {
      setAskError("NEXTRON needs permitted context before answering. Try again after the current context loads.");
      setAskFailureCode("context");
      setAskStatus("error");
      void recordProductLearningEvent("nextron_ask_failed", { reason: "unknown" });
      setPendingUserPrompt(parsed.request.rawPrompt);
      setFailedPrompt(parsed.request.rawPrompt);
      return;
    }

    const seq = ++requestSeq.current;
    setAskStatus("asking");
    setAskError(null);
    setAskFailureCode(null);
    setPendingUserPrompt(parsed.request.rawPrompt);
    setFailedPrompt(null);
    window.setTimeout(() => answerSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);

    const { data: { user } } = await supabase.auth.getUser();
    if (seq !== requestSeq.current) return;
    if (!user || user.id !== userId) {
      const defaults = getDefaultNextronPermissions();
      setUserId(null);
      setSavedPermissions(defaults);
      setDraftPermissions(defaults);
      setPacket(null);
      setLivePanels(null);
      setResponse(null);
      setAskResponse(null);
      setAskStatus("error");
      setAskError("Sign in again to ask NEXTRON.");
      setAskFailureCode("auth");
      void recordProductLearningEvent("nextron_ask_failed", { reason: "auth_required" });
      setFailedPrompt(parsed.request.rawPrompt);
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    askAbortController.current?.abort();
    askAbortController.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), NEXTRON_ASK_CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/nextron/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: parsed.request.rawPrompt, conversationId: currentConversation?.id ?? null, clientMessageId: crypto.randomUUID() }),
        signal: controller.signal,
      });
      if (seq !== requestSeq.current) return;

      if (response.status === 401) {
        setAskStatus("error");
        setAskError("Sign in again to ask NEXTRON.");
        setAskFailureCode("auth");
        void recordProductLearningEvent("nextron_ask_failed", { reason: "auth_required" });
        setFailedPrompt(parsed.request.rawPrompt);
        router.replace("/login");
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const parsedBody = parseAskResponseBody(body);
      if (!response.ok || !parsedBody) {
        setAskStatus("error");
        const candidate = typeof body === "object" && body !== null ? body as { error?: unknown } : null;
        setAskError(typeof candidate?.error === "string" ? candidate.error : "NEXTRON could not answer that request right now. Try again in a moment.");
        setAskFailureCode(!response.ok ? "api" : "render");
        void recordProductLearningEvent("nextron_ask_failed", { reason: !response.ok ? "api_error" : "render_error" });
        setFailedPrompt(parsed.request.rawPrompt);
        return;
      }

      const nextResponse = parsedBody.response;
      setAskResponse(nextResponse);
      setPendingUserPrompt(null);
      setFailedPrompt(null);
      setAskFailureCode(null);
      if (parsedBody.conversation) {
        setCurrentConversation(parsedBody.conversation);
        setConversations((current) => [parsedBody.conversation!, ...current.filter((item) => item.id !== parsedBody.conversation!.id)]);
      }
      if (parsedBody.messages) setMessages(parsedBody.messages);
      setAskStatus(parsed.request.handlingStatus === "handled" ? "answered" : "unsupported");
      void recordProductLearningEvent("nextron_ask_succeeded");
      setAskPrompt("");
      void loadLiveContext().catch(() => undefined);
      void loadSignals().catch(() => undefined);
    } catch (askErrorValue) {
      if (askErrorValue instanceof DOMException && askErrorValue.name === "AbortError") {
        if (seq === requestSeq.current) {
          setAskStatus("error");
          setAskError("NEXTRON received your message, but the response took too long. Try again when ready.");
          setAskFailureCode("timeout");
          void recordProductLearningEvent("nextron_ask_failed", { reason: "timeout" });
          setFailedPrompt(parsed.request.rawPrompt);
        }
        return;
      }
      if (seq === requestSeq.current) {
        setAskStatus("error");
        setAskError("NEXTRON could not answer that request right now. Try again in a moment.");
        setAskFailureCode("network");
        void recordProductLearningEvent("nextron_ask_failed", { reason: "network_error" });
        setFailedPrompt(parsed.request.rawPrompt);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (askAbortController.current === controller) askAbortController.current = null;
    }
  }

  function retryAsk() {
    const prompt = failedPrompt ?? pendingUserPrompt;
    if (!prompt) return;
    setAskPrompt(prompt);
    void askNextron(prompt);
  }

  function focusComposerWithPrompt(prompt: string) {
    setAskPrompt(prompt);
    setAskError("Review the prepared prompt, then press Send to NEXTRON.");
    setAskFailureCode(null);
    setAskStatus("idle");
    window.setTimeout(() => {
      askSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      composerRef.current?.focus();
    }, 0);
  }

  const hasUnsavedChanges = !areNextronPermissionsEqual(savedPermissions, draftPermissions);
  const operationalPermissions = NEXTRON_CONTEXT_PERMISSIONS.filter((permission) => !permission.textHeavy);
  const privateTextPermissions = NEXTRON_CONTEXT_PERMISSIONS.filter((permission) => permission.textHeavy);
  const trimmedAskPrompt = askPrompt.trim();
  const askDisabled = loading || !packet || askStatus === "asking" || trimmedAskPrompt.length === 0 || trimmedAskPrompt.length > NEXTRON_REQUEST_MAX_LENGTH;
  const askStatusCopy = askStatus === "asking"
    ? `NEXTRON received your message and is thinking.${askError ? ` ${askError}` : ""}`
    : askStatus === "unsupported"
      ? "NEXTRON answered with a private-beta boundary."
    : askError ?? (loading || !packet
        ? "NEXTRON is getting ready before it can answer."
        : "Successful turns are saved to this private conversation, not to Memory unless you explicitly ask NEXTRON to remember something.");
  const quietAskStatus = askStatus === "idle" && !askError && !loading && Boolean(packet);
  const liveResponse = askResponse ?? response;
  const activeSystems = packet
    ? [
        { domain: "today", status: packet.today.status },
        { domain: "tasks", status: packet.tasks.status },
        { domain: "projects", status: packet.projects.status },
        { domain: "knowledge", status: packet.knowledge.status },
        { domain: "drive", status: livePanels?.systems.drive.status ?? (savedPermissions.drive === "allowed" ? "available" : "permission_denied") },
        { domain: "calendar", status: livePanels?.systems.calendar.status ?? packet.calendar.status },
        { domain: "memory", status: livePanels?.systems.memory.status ?? packet.memory.status },
      ]
    : [];
  const coreState: IntelligenceCoreState = askStatus === "asking" || dailyBriefStatus === "generating" ? "thinking" : error || askStatus === "error" || dailyBriefStatus === "error" || signalStatus === "error" ? "error" : askStatus === "answered" || dailyBriefStatus === "ready" || signalStatus === "ready" ? "ready" : loading || signalStatus === "loading" ? "syncing" : "idle";
  const activeSourceNames = liveResponse ? inferActiveSourceNames(liveResponse) : [];
  const contextStats = packet ? [
    { label: "Overdue", value: packet.tasks.data?.overdueCount ?? 0, detail: "tasks" },
    { label: "Today", value: packet.tasks.data?.dueTodayCount ?? 0, detail: "due" },
    { label: "Projects", value: packet.projects.data?.activeCount ?? 0, detail: "active" },
    { label: "Memory", value: livePanels?.systems.memory.count ?? 0, detail: "confirmed" },
  ] : [];
  const quickPrompts = ["What should I focus on today?", "Help me plan tomorrow.", "What am I falling behind on?"];
  const showInlineActionProposals = messages.length > 0 || Boolean(pendingUserPrompt) || askStatus === "answered" || actionStatus === "saving";

  return (
    <div className="nextron-shell relative min-h-screen overflow-x-hidden animate-fade-in">
      <div className="nextron-shell-grid pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
<header className="relative border-b border-white/[0.08] px-4 py-5 sm:px-8 sm:py-7 xl:px-10">
        <div className="flex max-w-5xl min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold tracking-[-0.055em] text-[var(--text)] sm:text-4xl">NEXTRON</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{loading || !packet ? "Preparing context" : "Ready"}</p>
          </div>
          <button type="button" onClick={() => setContextOpen(true)} className="inline-flex min-h-10 items-center rounded-lg border border-white/[0.10] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)]">Context</button>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-8 sm:py-7 xl:px-10">
        <section ref={answerSectionRef} aria-labelledby="nextron-answer" className="relative min-h-[52vh] px-1 sm:min-h-[56vh]">
          <h2 id="nextron-answer" className="sr-only">Conversation</h2>
          {loading && (
            <div className="mx-auto flex min-h-[38vh] max-w-2xl flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.025]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              </div>
              <p className="text-xl font-semibold tracking-[-0.04em] text-[var(--text)]">Preparing context.</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">The composer will be ready in a moment.</p>
            </div>
          )}
          {!loading && error && <p className="text-sm text-[var(--warning)]">{error}</p>}
          {!loading && !error && (
            <div className="space-y-5">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-[38vh] max-w-2xl flex-col items-center justify-center py-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.025]">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  </div>
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-3xl">Good afternoon.</p>
                  <p className="mt-2 text-xl tracking-[-0.03em] text-[var(--text-secondary)] sm:text-2xl">What&apos;s on your mind?</p>
                  <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                    {quickPrompts.map((prompt) => (
                      <button key={prompt} type="button" disabled={askStatus === "asking" || !packet} onClick={() => { setAskPrompt(prompt); void askNextron(prompt); }} className="min-h-10 rounded-lg border border-white/[0.09] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/30 hover:bg-white/[0.025] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50">
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : messages.map((message) => <ConversationTurn key={message.id} message={message} />)}
              {pendingUserPrompt && <PendingConversationTurn role="user" content={pendingUserPrompt} />}
              {askStatus === "asking" && <PendingConversationTurn role="assistant" content="NEXTRON is thinking..." pending />}
              {askStatus === "error" && askError && <AskFailureNotice message={askError} code={askFailureCode} canRetry={Boolean(failedPrompt ?? pendingUserPrompt)} onRetry={retryAsk} />}
            </div>
          )}
        </section>

        <section ref={askSectionRef} aria-labelledby="ask-nextron" className={`sticky bottom-3 z-10 ${askStatus === "asking" ? "animate-pulse" : ""}`}>
          <h2 id="ask-nextron" className="sr-only">Ask NEXTRON</h2>
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void askNextron(); }}>
            <label htmlFor="nextron-question" className="sr-only">Ask NEXTRON</label>
            <div className="rounded-2xl border border-white/[0.10] bg-[rgba(13,17,24,0.92)] p-2 shadow-xl shadow-black/24 backdrop-blur-md transition-colors duration-200 focus-within:border-[var(--accent)]/45">
              <textarea ref={composerRef} id="nextron-question" value={askPrompt} onChange={(event) => { setAskPrompt(event.target.value.slice(0, NEXTRON_REQUEST_MAX_LENGTH)); setAskError(null); setAskFailureCode(null); if (askStatus === "error") setAskStatus("idle"); }} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!askDisabled) void askNextron(); } }} maxLength={NEXTRON_REQUEST_MAX_LENGTH} rows={1} aria-describedby="nextron-question-help nextron-question-status" placeholder="Ask NEXTRON..." className="max-h-36 min-h-11 w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2.5 text-base leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-2 pt-2">
                <p id="nextron-question-help" className="text-xs text-[var(--text-muted)]">Enter sends<span className="hidden sm:inline">; Shift+Enter adds a line</span>.</p>
                <button type="submit" aria-label="Send to NEXTRON" disabled={askDisabled} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#071018] transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45">
                  {askStatus === "asking" ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
            <p id="nextron-question-status" className={`${quietAskStatus ? "hidden sm:block" : "block"} px-2 text-xs leading-relaxed text-[var(--text-muted)]`} aria-live="polite">{askStatusCopy}</p>
          </form>
        </section>

        {showInlineActionProposals && (
          <NextronActionProposalsView
            proposals={actionProposals}
            status={actionStatus}
            error={actionError}
            onRefresh={() => void loadActionProposals()}
            onApprove={(id) => void transitionActionProposal(id, "approve")}
            onCancel={(id) => void transitionActionProposal(id, "cancel")}
            onChange={focusComposerWithPrompt}
          />
        )}

        {contextOpen && (
          <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setContextOpen(false)} />
            <section id="nextron-context-panel" aria-labelledby="nextron-context-heading" className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.10] bg-[linear-gradient(180deg,rgba(13,17,24,0.99),rgba(8,11,16,0.99))] p-4 shadow-2xl shadow-black/45 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Setup / inspection</p>
                  <h2 id="nextron-context-heading" className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Context</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">Sources, permissions, brief, actions, and diagnostics.</p>
                </div>
                <button type="button" onClick={() => setContextOpen(false)} className="rounded-lg border border-white/[0.10] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)]">Close</button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <CompactAttentionView attention={attention} status={signalStatus} error={signalError} onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }} />
            </div>

            <div className="lg:col-span-2">
              <DailyBriefView
                brief={dailyBrief}
                meta={dailyBriefMeta}
                status={dailyBriefStatus}
                error={dailyBriefError}
                disabled={loading || !packet}
                onGenerate={() => void generateDailyBriefAction(false)}
                onRefresh={() => void generateDailyBriefAction(true)}
                onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }}
              />
            </div>
            <NextronPanel title="Conversations" eyebrow="Thread history">
            <div className="space-y-3">
              <button type="button" onClick={() => void startNewConversation()} disabled={threadStatus === "saving"} className="min-h-11 w-full rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)] disabled:opacity-50">New conversation</button>
              <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">Conversations are saved privately to your Life Pulse account. Memory still requires explicit remember commands.</p>
              {threadError && <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-2 py-1.5"><p className="text-[10px] text-[var(--warning)]">{threadError}</p><button type="button" onClick={() => void loadConversations(currentConversation?.id ?? null)} className="mt-1 text-[10px] font-semibold text-[var(--warning)] underline underline-offset-2">Retry history</button></div>}
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {threadStatus === "loading" && <p className="text-xs text-[var(--text-muted)]">Loading conversations...</p>}
                {conversations.length === 0 && <p className="text-xs text-[var(--text-muted)]">No saved conversations yet.</p>}
                {conversations.map((conversation) => (
                  <div key={conversation.id} className={`relative overflow-hidden rounded-xl border px-2 py-2 transition-colors duration-150 ${currentConversation?.id === conversation.id ? "border-cyan-300/40 bg-cyan-300/10 shadow-[inset_2px_0_0_rgba(103,232,249,0.55)]" : "border-cyan-300/10 bg-black/15 hover:border-cyan-300/22"}`}>
                    <button type="button" onClick={() => void openConversation(conversation.id)} className="block w-full truncate text-left text-xs font-medium text-[var(--text)]">{conversation.title}</button>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[var(--text-muted)]">{conversation.updated_at.slice(0, 10)}</span>
                      <button type="button" onClick={() => void deleteConversation(conversation.id)} className="rounded-md px-1.5 py-1 text-[10px] text-[var(--danger)] hover:bg-[var(--danger-soft)]">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </NextronPanel>

            <NextronPanel title="Today" eyebrow="Current context">
            {loading ? <p className="text-sm text-[var(--text-muted)]">Loading today...</p> : error ? <p className="text-sm text-[var(--warning)]">{error}</p> : <TodayPanel panels={livePanels} onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }} />}
            </NextronPanel>

            <NextronPanel title="Active Projects" eyebrow="Current work">
              <ProjectsPanel panels={livePanels} onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }} />
            </NextronPanel>

            <NextronPanel title="Calendar" eyebrow="Read-only schedule">
            {loading ? <p className="text-sm text-[var(--text-muted)]">Checking Calendar...</p> : <CalendarPanel panels={livePanels} onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }} />}
            </NextronPanel>

            <NextronPanel title="What NEXTRON can use" eyebrow="Access">
              <SourceContextPanel panels={livePanels} systems={activeSystems} />
            </NextronPanel>

            <details className="nextron-surface relative overflow-hidden rounded-[1.5rem] p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">Diagnostics</summary>
              <div className="mt-4">
                <IntelligenceCore status={coreState} systems={activeSystems} activeSources={activeSourceNames} />
                <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                  {contextStats.map((stat) => <ContextStat key={stat.label} {...stat} />)}
                </div>
              </div>
            </details>

            <div className="lg:col-span-2">
              <NextronAttentionView attention={attention} status={signalStatus} error={signalError} onRefresh={() => void loadSignals()} onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }} />
            </div>

            <NextronSignalsView
              signals={signals}
              meta={signalMeta}
              status={signalStatus}
              error={signalError}
              onRefresh={() => void loadSignals()}
              onAsk={(prompt) => { setAskPrompt(prompt); void askNextron(prompt); }}
            />

            <NextronActionProposalsView
              proposals={actionProposals}
              status={actionStatus}
              error={actionError}
              onRefresh={() => void loadActionProposals()}
              onApprove={(id) => void transitionActionProposal(id, "approve")}
              onCancel={(id) => void transitionActionProposal(id, "cancel")}
              onChange={focusComposerWithPrompt}
            />

            <NextronPanel title="Boundaries" eyebrow="Safety state">
              <ul className="space-y-2 text-xs leading-relaxed text-[var(--text-muted)]">
                <li>No autonomous actions in this phase.</li>
                <li>External connectors are read-only.</li>
                <li>Drive uses selected imported files only.</li>
                <li>No medical, legal, financial, or therapy guidance.</li>
              </ul>
            </NextronPanel>

            <section aria-labelledby="nextron-context" className="lg:col-span-2">
              <details className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
                  NEXTRON access
                  <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">Saved permissions remain the authority.</span>
                </summary>
                <div className="mt-4">
                  <p id="nextron-context" className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">Choose what NEXTRON may use. Creating or changing work still requires approval every time.</p>
                  {permissionWarning && <p className="mb-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--warning)]">{permissionWarning}</p>}
                  <PermissionGroup title="Operational context" permissions={operationalPermissions} draftPermissions={draftPermissions} savedPermissions={savedPermissions} onChange={setPermission} />
                  <PermissionGroup title="Private text context" permissions={privateTextPermissions} draftPermissions={draftPermissions} savedPermissions={savedPermissions} onChange={setPermission} />
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                    <p className="text-xs leading-relaxed text-[var(--text-muted)]">{permissionLoading ? "Loading saved permissions..." : !permissionsAvailable ? "Saved permissions are currently unavailable, so safe defaults are active." : hasUnsavedChanges ? "You have unsaved local permission changes. Evidence will not broaden until saving succeeds." : saveStatus === "saved" ? "Context permissions saved and NEXTRON refreshed." : saveStatus === "error" ? "Context permissions were not saved. Try again when ready." : "Saved permissions are active."}</p>
                    <button type="button" onClick={() => void savePermissions()} disabled={!permissionsAvailable || !hasUnsavedChanges || saveStatus === "saving" || !userId} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">{saveStatus === "saving" ? "Saving..." : "Save access"}</button>
                  </div>
                </div>
              </details>
            </section>

            <section aria-labelledby="nextron-access" className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <Card variant="subtle" className="p-4"><h2 id="nextron-access" className="text-sm font-semibold text-[var(--text)]">Currently available</h2><ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">{packet ? Object.entries(packet.permissionSummary).filter(([, status]) => status === "available").map(([domain]) => <li key={domain} className="break-words">{formatDomainLabel(domain)}</li>) : <li>Permitted context is loading.</li>}</ul></Card>
              <Card variant="subtle" className="p-4"><h2 className="text-sm font-semibold text-[var(--text)]">Not available to NEXTRON</h2><ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">{NEXTRON_UNAVAILABLE_CONTEXT.map((item) => <li key={item} className="break-words">{item}</li>)}{packet && Object.entries(packet.permissionSummary).filter(([, status]) => status === "permission_denied").map(([domain]) => <li key={domain} className="break-words">{formatDomainLabel(domain)} is not loaded by current permission.</li>)}</ul></Card>
            </section>
              </div>
            </section>
          </div>
        )}

        <p className="relative hidden text-center text-[10px] leading-relaxed text-[var(--text-muted)] sm:block">NEXTRON is user-controlled. Changes require approval; external connectors remain read-only.</p>
      </main>
    </div>
  );
}

function parseAskResponseBody(value: unknown): { response: NextronCoachResponse; source?: "ai" | "deterministic"; conversation?: ConversationSummary; messages?: ConversationMessage[] } | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { response?: unknown; source?: unknown; conversation?: unknown; messages?: unknown };
  if (!isNextronCoachResponse(candidate.response)) return null;
  if (candidate.source !== undefined && candidate.source !== "ai" && candidate.source !== "deterministic") return null;
  const conversation = isConversationSummary(candidate.conversation) ? candidate.conversation : undefined;
  const messages = Array.isArray(candidate.messages) ? candidate.messages.filter(isConversationMessage) : undefined;
  return { response: candidate.response, source: candidate.source, conversation, messages };
}

function getNextronBridgePrompt(subject: string): string {
  if (subject === "today") return "Help me understand today using current Life Pulse context. Keep Today focused on execution and use NEXTRON for synthesis.";
  if (subject === "tasks") return "Review my current Tasks using permitted Life Pulse context. Help me choose what deserves attention next.";
  if (subject === "habits") return "Review my current Habits using permitted Life Pulse context. Help me understand what rhythm needs attention without changing habits.";
  if (subject === "goals") return "Review my current Goals using permitted Life Pulse context. Help me connect direction to next visible actions without changing goals.";
  if (subject === "project") return "Discuss my active project using current Projects, Tasks, and Goals context. Do not write to Projects.";
  if (subject === "knowledge") return "Search my permitted Knowledge for what is relevant right now, and cite only retrieved Life Pulse sources.";
  if (subject === "weekly-review") return "Discuss this Weekly Review using current permitted weekly evidence. Help me decide what deserves attention next week.";
  return "";
}

function parseDailyBriefResponseBody(value: unknown): { brief: DailyBrief; meta: DailyBriefMeta } | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { brief?: unknown; meta?: unknown };
  if (!isDailyBrief(candidate.brief) || !isDailyBriefMeta(candidate.meta)) return null;
  return { brief: candidate.brief, meta: candidate.meta };
}

function isDailyBrief(value: unknown): value is DailyBrief {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DailyBrief>;
  return typeof candidate.date === "string"
    && typeof candidate.headline === "string"
    && typeof candidate.summary === "string"
    && Array.isArray(candidate.priorities)
    && candidate.priorities.length <= 3
    && candidate.priorities.every((item) => typeof item.title === "string" && typeof item.reason === "string" && Array.isArray(item.sourceRefs))
    && (candidate.scheduleSummary === null || typeof candidate.scheduleSummary === "string")
    && Array.isArray(candidate.openLoops)
    && typeof candidate.recommendedApproach === "string"
    && typeof candidate.generatedAt === "string"
    && Array.isArray(candidate.sources)
    && (candidate.source === "ai" || candidate.source === "deterministic");
}

function isDailyBriefMeta(value: unknown): value is DailyBriefMeta {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DailyBriefMeta>;
  return typeof candidate.maxPriorities === "number"
    && typeof candidate.cache === "string"
    && typeof candidate.persisted === "boolean"
    && typeof candidate.modelCalls === "number"
    && typeof candidate.provider === "string"
    && typeof candidate.knowledgeAutomaticRetrieval === "boolean"
    && typeof candidate.memoryAutomaticUse === "boolean";
}

function isNextronSignal(value: unknown): value is NextronSignal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronSignal>;
  return typeof candidate.id === "string"
    && typeof candidate.type === "string"
    && (candidate.severity === "info" || candidate.severity === "attention" || candidate.severity === "important")
    && typeof candidate.title === "string"
    && typeof candidate.summary === "string"
    && Array.isArray(candidate.evidence)
    && candidate.evidence.every((item) => typeof item === "string")
    && Array.isArray(candidate.sourceTypes)
    && candidate.sourceTypes.every((item) => typeof item === "string")
    && typeof candidate.observedAt === "string"
    && typeof candidate.validForLocalDate === "string"
    && typeof candidate.route === "string"
    && typeof candidate.bridgePrompt === "string";
}

function isNextronSignalMeta(value: unknown): value is NextronSignalMeta {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronSignalMeta>;
  return typeof candidate.localDate === "string"
    && typeof candidate.observedAt === "string"
    && typeof candidate.maxVisible === "number"
    && typeof candidate.persisted === "boolean"
    && typeof candidate.modelCalls === "number"
    && typeof candidate.provider === "string"
    && typeof candidate.knowledgeAutomaticScan === "boolean"
    && typeof candidate.driveAutomaticScan === "boolean"
    && typeof candidate.memoryAutomaticMonitoring === "boolean";
}

function isNextronActionProposal(value: unknown): value is NextronActionProposal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronActionProposal>;
  return typeof candidate.id === "string"
    && typeof candidate.actionType === "string"
    && typeof candidate.title === "string"
    && typeof candidate.description === "string"
    && typeof candidate.parameters === "object" && candidate.parameters !== null
    && isNextronActionPreview(candidate.preview)
    && (candidate.riskLevel === "low" || candidate.riskLevel === "sensitive" || candidate.riskLevel === "external")
    && candidate.requiresApproval === true
    && ["pending", "approved_execution_disabled", "completed", "partially_failed", "failed", "stale", "canceled", "expired", "invalidated"].includes(candidate.status ?? "")
    && typeof candidate.createdAt === "string"
    && typeof candidate.expiresAt === "string"
    && (candidate.executedAt === undefined || candidate.executedAt === null || typeof candidate.executedAt === "string")
    && (candidate.executionResult === undefined || candidate.executionResult === null || typeof candidate.executionResult === "object");
}

function isNextronActionPreview(value: unknown): value is NextronActionPreview {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronActionPreview>;
  return typeof candidate.heading === "string"
    && typeof candidate.subheading === "string"
    && Array.isArray(candidate.fields)
    && candidate.fields.every((field) => typeof field.label === "string" && typeof field.after === "string" && (field.before === undefined || field.before === null || typeof field.before === "string"))
    && typeof candidate.approvalLabel === "string";
}

function isConversationSummary(value: unknown): value is ConversationSummary {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ConversationSummary>;
  return typeof candidate.id === "string" && typeof candidate.title === "string" && typeof candidate.created_at === "string" && typeof candidate.updated_at === "string";
}

function isConversationMessage(value: unknown): value is ConversationMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ConversationMessage>;
  return typeof candidate.id === "string"
    && typeof candidate.conversation_id === "string"
    && (candidate.role === "user" || candidate.role === "assistant")
    && typeof candidate.content === "string"
    && typeof candidate.created_at === "string";
}

function isNextronEvidencePacket(value: unknown): value is NextronEvidencePacket {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronEvidencePacket>;
  return candidate.version === "nextron-evidence-v1"
    && typeof candidate.generatedForLocalDate === "string"
    && typeof candidate.permissionSummary === "object"
    && candidate.permissionSummary !== null
    && typeof candidate.today === "object"
    && typeof candidate.tasks === "object"
    && typeof candidate.projects === "object"
    && typeof candidate.calendar === "object";
}

function isLiveContextPanels(value: unknown): value is LiveContextPanels {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LiveContextPanels>;
  return isLiveToday(candidate.today)
    && isLiveProjects(candidate.projects)
    && isLiveCalendar(candidate.calendar)
    && isLiveSystems(candidate.systems);
}

function isLiveToday(value: unknown): value is LiveContextPanels["today"] {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LiveContextPanels["today"]>;
  return typeof candidate.localDate === "string"
    && typeof candidate.tasksRemaining === "number"
    && typeof candidate.completedToday === "number"
    && typeof candidate.overdue === "number"
    && typeof candidate.habitsDue === "number"
    && typeof candidate.habitsCompleted === "number"
    && typeof candidate.status === "string";
}

function isLiveProjects(value: unknown): value is LiveContextPanels["projects"] {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LiveContextPanels["projects"]>;
  return typeof candidate.status === "string"
    && typeof candidate.activeCount === "number"
    && typeof candidate.limit === "number"
    && Array.isArray(candidate.items)
    && candidate.items.every((item) => typeof item.title === "string" && typeof item.openTaskCount === "number");
}

function isLiveCalendar(value: unknown): value is LiveContextPanels["calendar"] {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LiveContextPanels["calendar"]>;
  return typeof candidate.status === "string"
    && typeof candidate.moreTodayCount === "number"
    && candidate.readOnly === true
    && Array.isArray(candidate.events)
    && candidate.events.every((event) => typeof event.title === "string" && typeof event.startsAt === "string" && (event.endsAt === null || typeof event.endsAt === "string") && typeof event.allDay === "boolean");
}

function isLiveSystems(value: unknown): value is LiveContextPanels["systems"] {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LiveContextPanels["systems"]>;
  return isSourceMetric(candidate.knowledge)
    && isSourceMetric(candidate.memory)
    && isSourceMetric(candidate.drive)
    && typeof candidate.calendar?.status === "string"
    && typeof candidate.weeklyReview?.status === "string"
    && typeof candidate.weeklyReview.existsThisWeek === "boolean";
}

function isSourceMetric(value: unknown): value is { status: string; count: number | null } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { status?: unknown; count?: unknown };
  return typeof candidate.status === "string" && (candidate.count === null || typeof candidate.count === "number");
}

function isNextronCoachResponse(value: unknown): value is NextronCoachResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronCoachResponse>;
  return Array.isArray(candidate.facts)
    && candidate.facts.length > 0
    && candidate.facts.every((fact) => typeof fact.category === "string" && typeof fact.text === "string" && fact.text.trim().length > 0)
    && typeof candidate.interpretation === "string"
    && candidate.interpretation.trim().length > 0
    && typeof candidate.nextAction?.label === "string"
    && typeof candidate.nextAction.href === "string"
    && typeof candidate.nextAction.rationale === "string"
    && typeof candidate.priority === "string"
    && typeof candidate.ruleId === "string"
    && Array.isArray(candidate.supportingEvidence);
}

function isNextronAttentionSummary(value: unknown): value is NextronAttentionSummary {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronAttentionSummary>;
  return candidate.version === "nextron-attention-v1"
    && (candidate.status === "active" || candidate.status === "calm" || candidate.status === "partial")
    && typeof candidate.generatedAt === "string"
    && typeof candidate.localDate === "string"
    && (candidate.primary === null || isNextronAttentionItem(candidate.primary))
    && Array.isArray(candidate.secondary)
    && candidate.secondary.length <= 4
    && candidate.secondary.every(isNextronAttentionItem)
    && typeof candidate.calmMessage === "string"
    && (candidate.currentFocus === null || isNextronAttentionFocus(candidate.currentFocus))
    && candidate.meta?.modelCalls === 0
    && candidate.meta.provider === "deterministic"
    && candidate.meta.persisted === false;
}

function isNextronAttentionItem(value: unknown): value is NextronAttentionItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronAttentionItem>;
  return typeof candidate.id === "string"
    && typeof candidate.domain === "string"
    && (candidate.severity === "info" || candidate.severity === "attention" || candidate.severity === "important")
    && typeof candidate.title === "string"
    && typeof candidate.explanation === "string"
    && Array.isArray(candidate.evidence)
    && candidate.evidence.every((item) => typeof item === "string")
    && typeof candidate.route === "string"
    && isSafeNextronRoute(candidate.route)
    && typeof candidate.bridgePrompt === "string";
}

function isNextronAttentionFocus(value: unknown): value is NonNullable<NextronAttentionSummary["currentFocus"]> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NonNullable<NextronAttentionSummary["currentFocus"]>>;
  return typeof candidate.title === "string" && typeof candidate.detail === "string" && typeof candidate.route === "string" && isSafeNextronRoute(candidate.route) && typeof candidate.bridgePrompt === "string";
}

function isSafeNextronRoute(value: string): boolean {
  return ["/today", "/tasks", "/habits", "/projects", "/weekly-review", "/settings"].includes(value);
}

function formatDomainLabel(value: string): string {
  const labels: Record<string, string> = {
    eveningShutdown: "Evening Shutdown",
    weeklyReview: "Weekly Review",
    today: "Today",
    tasks: "Tasks",
    habits: "Habits",
    results: "Results",
    goals: "Goals",
    projects: "Projects",
    knowledge: "Knowledge",
    drive: "Drive",
    calendar: "Calendar",
    profile: "Profile",
    memory: "Memory",
    journal: "Journal",
  };
  return labels[value] ?? value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function inferActiveSourceNames(response: NextronCoachResponse): string[] {
  const text = [response.ruleId, ...(response.sources ?? []), ...response.facts.map((fact) => `${fact.category} ${fact.text}`)].join(" ").toLowerCase();
  const sources: string[] = [];
  const add = (label: string, patterns: string[]) => {
    if (patterns.some((pattern) => text.includes(pattern.toLowerCase())) && !sources.includes(label)) sources.push(label);
  };
  add("Tasks", ["task", "overdue", "today"]);
  add("Projects", ["project"]);
  add("Calendar", ["calendar", "event"]);
  add("Knowledge", ["knowledge", "note"]);
  add("Drive", ["drive", "atlas"]);
  add("Memory", ["memory", "preference"]);
  return sources.slice(0, 3);
}

function CompactAttentionView({ attention, status, error, onAsk }: { attention: NextronAttentionSummary | null; status: SignalStatus; error: string | null; onAsk: (prompt: string) => void }) {
  const items = [attention?.primary, ...(attention?.secondary ?? [])].filter((item): item is NextronAttentionItem => Boolean(item)).slice(0, 3);
  if (items.length === 0 && status !== "error") return null;
  return (
    <section aria-labelledby="nextron-noticed-heading" data-nextron-attention="true" className="nextron-surface relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">NEXTRON noticed</p>
          <h2 id="nextron-noticed-heading" className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">What may deserve attention</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Only meaningful current items surface here. Detailed signals remain under Context.</p>
        </div>
      </div>
      {status === "error" && <p className="mt-4 rounded-2xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">{error ?? "NEXTRON attention is partially unavailable right now."}</p>}
      {items.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/[0.08] bg-black/12 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{formatDomainLabel(item.domain)} · {item.severity}</p>
              <h3 className="mt-1 break-words text-sm font-semibold text-[var(--text)]">{item.title}</h3>
              <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">{item.explanation}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <PanelLink href={item.route}>Open</PanelLink>
                <PanelButton onClick={() => onAsk(item.bridgePrompt)}>Ask NEXTRON</PanelButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DailyBriefView({ brief, meta, status, error, disabled, onGenerate, onRefresh, onAsk }: { brief: DailyBrief | null; meta: DailyBriefMeta | null; status: DailyBriefStatus; error: string | null; disabled: boolean; onGenerate: () => void; onRefresh: () => void; onAsk: (prompt: string) => void }) {
  const generating = status === "generating";
  return (
    <section aria-labelledby="daily-brief-heading" data-nextron-daily-brief="true" className={`nextron-surface relative overflow-hidden rounded-2xl p-4 sm:p-5 ${generating ? "border-[var(--accent)]/30" : ""}`}>
      {generating && <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(122,162,199,0.08),transparent)] [animation:nextron-scan_1.7s_ease-in-out_infinite]" aria-hidden="true" />}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Daily Brief</p>
          <h2 id="daily-brief-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">What to know and protect today</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">A short brief from what NEXTRON can use. It updates only when you ask.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={brief ? onRefresh : onGenerate} disabled={disabled || generating} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#071018] transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45">
            {generating ? "Generating..." : brief ? "Refresh brief" : "Generate brief"}
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        {!brief && status !== "generating" && (
          <div className="rounded-xl border border-white/[0.08] bg-black/12 p-4">
            <p className="text-sm font-semibold text-[var(--text)]">NEXTRON can prepare today&apos;s brief.</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">Use this when you want a compact read on today.</p>
            {error && <p className="mt-2 text-xs text-[var(--warning)]">{error}</p>}
          </div>
        )}

        {generating && <p className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-sm text-[var(--text-secondary)]">Reviewing Today, Tasks, Projects, Calendar, and other allowed context...</p>}

        {brief && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-black/12 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">{brief.headline}</h3>
                  <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{brief.summary}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${brief.source === "ai" ? "border-white/[0.10] bg-white/[0.03] text-[var(--text-secondary)]" : "border-[var(--warning)]/25 bg-[var(--warning-soft)] text-[var(--warning)]"}`}>{brief.source === "ai" ? "AI brief" : "Fallback"}</span>
              </div>
              <p className="mt-3 text-[10px] text-[var(--text-muted)]">Updated {formatTime(brief.generatedAt)}. Cached only in this page session; live panels remain current truth.</p>
            </div>

            {brief.priorities.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">What matters</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {brief.priorities.slice(0, 3).map((priority, index) => (
                    <div key={`${priority.title}-${index}`} data-nextron-daily-brief-priority="true" className="rounded-xl border border-white/[0.08] bg-black/12 p-3">
                      <p className="text-[10px] font-semibold text-[var(--accent)]">0{index + 1}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-[var(--text)]">{priority.title}</p>
                      <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-muted)]">{priority.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(brief.scheduleSummary || brief.openLoops.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {brief.scheduleSummary && <DailyBriefMiniBlock title="Schedule" text={brief.scheduleSummary} />}
                {brief.openLoops.length > 0 && <DailyBriefMiniBlock title="Open loops" text={brief.openLoops.map((loop) => `${loop.label}: ${loop.detail}`).join(" ")} />}
              </div>
            )}

            <DailyBriefMiniBlock title="Recommended approach" text={brief.recommendedApproach} />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/12 p-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Sources used</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {brief.sources.map((source) => <span key={source} className="rounded-full border border-white/[0.10] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">{source}</span>)}
                </div>
                {meta && <details className="mt-2"><summary className="cursor-pointer text-[10px] text-[var(--text-muted)]">Diagnostics</summary><p className="mt-1 text-[10px] text-[var(--text-muted)]">Model calls this load: {meta.modelCalls}. State: {meta.persisted ? "Saved" : "Session only"}.</p></details>}
              </div>
              <PanelButton onClick={() => onAsk("Help me use this Daily Brief without changing anything.")}>Ask about this brief</PanelButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DailyBriefMiniBlock({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/12 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">{title}</p><p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p></div>;
}

function NextronAttentionView({ attention, status, error, onRefresh, onAsk }: { attention: NextronAttentionSummary | null; status: SignalStatus; error: string | null; onRefresh: () => void; onAsk: (prompt: string) => void }) {
  const loading = status === "loading" && !attention;
  const primary = attention?.primary ?? null;
  const secondary = attention?.secondary ?? [];
  const active = Boolean(primary);
  return (
    <section aria-labelledby="nextron-attention-heading" data-nextron-attention="true" className="nextron-surface relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">NEXTRON noticed</p>
          <h2 id="nextron-attention-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">What deserves attention right now</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Current items worth noticing. No notifications or autonomous action.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={status === "loading"} className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-white/[0.10] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)] disabled:opacity-50">{status === "loading" ? "Checking..." : "Refresh"}</button>
      </div>

      <div className="mt-4 space-y-3">
        {loading && <div className="rounded-xl border border-white/[0.08] bg-black/12 p-4 text-sm text-[var(--text-muted)]">Checking what matters right now...</div>}
        {status === "error" && <div className="rounded-2xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)]">{error ?? "NEXTRON attention is partially unavailable right now."}</div>}
        {!loading && !active && attention && <AttentionCalmState attention={attention} onAsk={onAsk} />}
        {primary && <AttentionPrimaryCard item={primary} onAsk={onAsk} />}
        {secondary.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {secondary.map((item) => <AttentionMiniCard key={item.id} item={item} onAsk={onAsk} />)}
          </div>
        )}
      </div>
      {attention && <details className="mt-3"><summary className="cursor-pointer text-[10px] text-[var(--text-muted)]">Diagnostics</summary><p className="mt-1 text-[10px] text-[var(--text-muted)]">Based on current Life Pulse for {attention.localDate}. Model calls: {attention.meta.modelCalls}. State: derived on load.</p></details>}
    </section>
  );
}

function AttentionCalmState({ attention, onAsk }: { attention: NextronAttentionSummary; onAsk: (prompt: string) => void }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/12 p-4"><p className="text-sm font-semibold text-[var(--text)]">{attention.calmMessage}</p>{attention.currentFocus && <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">Next meaningful item: {attention.currentFocus.title}. {attention.currentFocus.detail}</p>}{attention.currentFocus && <div className="mt-3 flex flex-wrap gap-2"><PanelLink href={attention.currentFocus.route}>Open</PanelLink><PanelButton onClick={() => onAsk(attention.currentFocus!.bridgePrompt)}>Ask NEXTRON</PanelButton></div>}</div>;
}

function AttentionPrimaryCard({ item, onAsk }: { item: NextronAttentionItem; onAsk: (prompt: string) => void }) {
  const tone = item.severity === "important" ? "border-[var(--warning)]/35 bg-[var(--warning-soft)]" : "border-white/[0.10] bg-white/[0.025]";
  return (
    <article data-nextron-attention-primary="true" className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">{formatDomainLabel(item.domain)}</p>
          <h3 className="mt-1 break-words text-lg font-semibold text-[var(--text)]">{item.title}</h3>
          <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{item.explanation}</p>
        </div>
        <PanelLink href={item.route}>Open</PanelLink>
      </div>
      <AttentionEvidence item={item} />
      <div className="mt-3 flex flex-wrap gap-2"><PanelButton onClick={() => onAsk(item.bridgePrompt)}>Ask NEXTRON</PanelButton><PanelButton onClick={() => onAsk(`What should I do about this attention item: ${item.title}?`)}>What should I do?</PanelButton></div>
    </article>
  );
}

function AttentionMiniCard({ item, onAsk }: { item: NextronAttentionItem; onAsk: (prompt: string) => void }) {
  return <article data-nextron-attention-secondary="true" className="rounded-xl border border-white/[0.08] bg-black/12 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{formatDomainLabel(item.domain)}</p><h3 className="mt-1 break-words text-sm font-semibold text-[var(--text)]">{item.title}</h3><p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">{item.explanation}</p><AttentionEvidence item={item} compact /><div className="mt-2 flex flex-wrap gap-2"><PanelLink href={item.route}>Open</PanelLink><PanelButton onClick={() => onAsk(item.bridgePrompt)}>Ask</PanelButton></div></article>;
}

function AttentionEvidence({ item, compact = false }: { item: NextronAttentionItem; compact?: boolean }) {
  return <details className={`mt-3 rounded-lg border border-white/[0.08] bg-black/10 p-2 ${compact ? "text-xs" : ""}`}><summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Why this surfaced</summary><ul className="mt-2 space-y-1.5">{item.evidence.slice(0, 3).map((fact, index) => <li key={`${item.id}-${index}`} className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">{fact}</li>)}</ul></details>;
}

function NextronSignalsView({ signals, meta, status, error, onRefresh, onAsk }: { signals: NextronSignal[]; meta: NextronSignalMeta | null; status: SignalStatus; error: string | null; onRefresh: () => void; onAsk: (prompt: string) => void }) {
  const loading = status === "loading";
  return (
    <section aria-labelledby="nextron-signals-heading" data-nextron-signals="true" className="nextron-surface relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Patterns</p>
          <h2 id="nextron-signals-heading" className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">What changed or deserves attention</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Items NEXTRON noticed from allowed Life Pulse context.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-white/[0.10] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)] disabled:opacity-50">
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading && signals.length === 0 && <p className="rounded-xl border border-white/[0.08] bg-black/12 p-3 text-sm text-[var(--text-muted)]">Checking current patterns...</p>}
        {status === "error" && <p className="rounded-2xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">{error ?? "Patterns are unavailable right now."}</p>}
        {status !== "loading" && status !== "error" && signals.length === 0 && <p className="rounded-xl border border-white/[0.08] bg-black/12 p-3 text-sm text-[var(--text-muted)]">Nothing meaningful to surface right now.</p>}
        {signals.length > 0 && (
          <div className="grid gap-2">
            {signals.slice(0, 5).map((signal) => <SignalCard key={signal.id} signal={signal} onAsk={onAsk} />)}
          </div>
        )}
      </div>
      {meta && <details className="mt-3"><summary className="cursor-pointer text-[10px] text-[var(--text-muted)]">Diagnostics</summary><p className="mt-1 text-[10px] text-[var(--text-muted)]">Observed {formatTime(meta.observedAt)}. Max visible: {meta.maxVisible}. Model calls: {meta.modelCalls}. State: {meta.persisted ? "Saved" : "Derived only"}.</p></details>}
    </section>
  );
}

function SignalCard({ signal, onAsk }: { signal: NextronSignal; onAsk: (prompt: string) => void }) {
  const tone = signal.severity === "important" ? "border-[var(--warning)]/30 bg-[var(--warning-soft)]" : signal.severity === "attention" ? "border-white/[0.10] bg-white/[0.025]" : "border-white/[0.08] bg-black/12";
  const marker = signal.severity === "important" ? "Important" : signal.severity === "attention" ? "Attention" : "Info";
  return (
    <article data-nextron-signal="true" className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">{marker}</p>
          <h3 className="mt-1 break-words text-sm font-semibold text-[var(--text)]">{signal.title}</h3>
          <p className="mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{signal.summary}</p>
        </div>
        <Link href={signal.route} className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-white/[0.10] bg-black/12 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)]">Open</Link>
      </div>
      <details className="mt-3 rounded-lg border border-white/[0.08] bg-black/10 p-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Why this matters</summary>
        <ul className="mt-2 space-y-1.5">
          {signal.evidence.slice(0, 3).map((item, index) => <li key={`${signal.id}-${index}`} className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">{item}</li>)}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          {signal.sourceTypes.map((source) => <span key={source} className="rounded-full border border-white/[0.10] bg-white/[0.025] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{source}</span>)}
        </div>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        <PanelButton onClick={() => onAsk(signal.bridgePrompt)}>Why does this matter?</PanelButton>
        <PanelButton onClick={() => onAsk(`What should I do about this: ${signal.title}?`)}>What should I do?</PanelButton>
      </div>
    </article>
  );
}

function NextronActionProposalsView({ proposals, status, error, onRefresh, onApprove, onCancel, onChange }: { proposals: NextronActionProposal[]; status: ActionProposalStatus; error: string | null; onRefresh: () => void; onApprove: (id: string) => void; onCancel: (id: string) => void; onChange: (prompt: string) => void }) {
  const loading = status === "loading";
  return (
    <section aria-labelledby="nextron-actions-heading" data-nextron-actions="true" className="nextron-surface relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">NEXTRON Actions</p>
          <h2 id="nextron-actions-heading" className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">Approval framework</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">NEXTRON can prepare approved Goals, Habits, Projects, and Tasks. Write permission and exact proposal approval are separate; neither allows autonomous changes.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || status === "saving"} className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-white/[0.10] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)] disabled:opacity-50">{loading ? "Loading..." : "Refresh proposals"}</button>
      </div>
      {error && <p className="mt-3 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">{error}</p>}
      <div className="mt-4 space-y-3">
        {proposals.length === 0 ? <p className="rounded-xl border border-white/[0.08] bg-black/12 p-3 text-sm text-[var(--text-muted)]">No pending action proposals. Try: Create a habit for reading before bed, or connect a project to an exact goal.</p> : proposals.map((proposal) => <ActionProposalCard key={proposal.id} proposal={proposal} busy={status === "saving"} onApprove={onApprove} onCancel={onCancel} onChange={onChange} />)}
      </div>
    </section>
  );
}

function ActionProposalCard({ proposal, busy, onApprove, onCancel, onChange }: { proposal: NextronActionProposal; busy: boolean; onApprove: (id: string) => void; onCancel: (id: string) => void; onChange: (prompt: string) => void }) {
  const pending = proposal.status === "pending";
  const statusCopy = proposal.status === "completed" ? "Approved and completed. Life Pulse was updated and verified by the server." : proposal.status === "partially_failed" ? "Most changes completed, but at least one needs attention. Successful changes will not be repeated." : proposal.status === "failed" ? "No changes were applied. Check permissions or regenerate the proposal." : proposal.status === "stale" ? "This changed since NEXTRON prepared the preview. Regenerate it before applying." : proposal.status === "approved_execution_disabled" ? "Approval recorded. Execution is not enabled for this action type." : proposal.status === "canceled" ? "Canceled. This proposal can no longer be approved." : proposal.status === "expired" ? "Expired. Regenerate the proposal to approve it." : proposal.status === "invalidated" ? "Invalidated because its conversation or source context changed." : `Requires explicit approval. Expires ${formatTime(proposal.expiresAt)}.`;
  return (
    <article data-nextron-action-proposal="true" className="rounded-xl border border-white/[0.10] bg-black/12 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Operation ready · Requires approval</p>
          <h3 className="mt-1 break-words text-base font-semibold text-[var(--text)]">{proposal.preview.heading}</h3>
          <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{proposal.preview.subheading}</p>
        </div>
        <span className="w-fit rounded-full border border-white/[0.10] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{proposal.riskLevel} risk</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {proposal.preview.fields.map((field) => <div key={field.label} className="rounded-lg border border-white/[0.08] bg-black/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{field.label}</p>{field.before && <p className="mt-1 text-xs text-[var(--text-muted)]">Before: {field.before}</p>}<p className="mt-1 break-words text-sm text-[var(--text)]">{field.after}</p></div>)}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{statusCopy}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!pending || busy} onClick={() => onApprove(proposal.id)} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#071018] transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45">{proposal.preview.approvalLabel}</button>
        <button type="button" disabled={!pending || busy} onClick={() => { onChange(`Change this action proposal: ${proposal.preview.subheading}`); }} className="inline-flex min-h-11 items-center rounded-lg border border-white/[0.10] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)] disabled:opacity-45">Change</button>
        <button type="button" disabled={!pending || busy} onClick={() => onCancel(proposal.id)} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)] transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45">Cancel</button>
        {proposal.status === "completed" && <Link href="/nextron" className="inline-flex min-h-11 items-center rounded-lg border border-white/[0.10] bg-black/12 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)]">Review in NEXTRON</Link>}
      </div>
    </article>
  );
}

function NextronPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="nextron-surface relative overflow-hidden rounded-2xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h2 className="mt-1 text-sm font-semibold text-[var(--text)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ContextStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/12 px-3 py-2">
      <p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function IntelligenceCore({ status, systems, activeSources }: { status: IntelligenceCoreState; systems: Array<{ domain: string; status: string }>; activeSources: string[] }) {
  const activeCount = systems.filter((system) => system.status === "available").length;
  const statusLabel = status === "thinking" ? "Analyzing" : status === "syncing" ? "Syncing" : status === "error" ? "Degraded" : status === "ready" ? "Response ready" : "Ready";
  const activeSourceSet = new Set(activeSources.map((source) => source.toLowerCase()));
  const coreMotion = status === "thinking" ? "nextron-core-analyzing" : status === "ready" ? "nextron-core-ready" : "nextron-core-idle";
  return (
    <div className="relative flex w-full shrink-0 items-center justify-center gap-3 sm:w-auto" aria-label={`NEXTRON core ${statusLabel.toLowerCase()}, ${activeCount} systems available`}>
      <div className="relative flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36">
        <div className={`absolute inset-0 rounded-full border ${status === "error" ? "border-[var(--warning)]/40 bg-[var(--warning-soft)]" : "border-cyan-300/25 bg-cyan-300/5"} shadow-[0_0_54px_rgba(34,211,238,0.16)] ${coreMotion}`} />
        <div className={`nextron-orbit-slow absolute inset-2 rounded-full border border-dashed ${status === "thinking" ? "border-cyan-100/50" : "border-cyan-200/20"}`} />
        <div className="nextron-counter-orbit absolute inset-5 rounded-full border border-cyan-300/10" />
        <div className={`absolute inset-8 rounded-2xl border ${status === "error" ? "border-[var(--warning)]/40" : "border-cyan-300/30"} bg-[radial-gradient(circle,rgba(125,211,252,0.30),rgba(8,18,32,0.50)_62%)] rotate-45 ${status === "thinking" ? "nextron-orbit-fast" : ""}`} />
        <div className="absolute h-3 w-3 rounded-full bg-cyan-100 shadow-[0_0_28px_rgba(103,232,249,0.95)]" />
        {systems.slice(0, 8).map((system, index) => {
          const angle = (index / Math.max(1, Math.min(8, systems.length))) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * 48;
          const y = Math.sin(angle) * 48;
          const active = system.status === "available";
          const sourceActive = activeSourceSet.has(system.domain.toLowerCase()) || activeSourceSet.has(formatDomainLabel(system.domain).toLowerCase());
          return <span key={system.domain} className={`absolute h-2.5 w-2.5 rounded-full border ${sourceActive ? "border-cyan-100 bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.85)]" : active ? "border-cyan-300/50 bg-cyan-300/40" : "border-slate-500/30 bg-slate-600/25"}`} style={{ transform: `translate(${x}px, ${y}px)` }} title={`${formatDomainLabel(system.domain)} ${statusText(system.status)}`} aria-hidden="true" />;
        })}
      </div>
      <div className="hidden min-w-24 text-left sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">Core</p>
        <p className="mt-1 text-sm font-semibold text-cyan-50">{statusLabel}</p>
        <p className="mt-1 text-[10px] text-cyan-100/50">{activeCount} systems ready</p>
        {activeSources.length > 0 && <p className="mt-2 text-[10px] text-cyan-100/70">Used: {activeSources.slice(0, 2).join(" + ")}</p>}
      </div>
    </div>
  );
}

function SignalRow({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "active" | "attention" | "stable" | "muted" }) {
  const toneClass = tone === "attention" ? "border-[var(--warning)]/25 bg-[var(--warning-soft)]" : tone === "active" ? "border-cyan-300/20 bg-cyan-300/10" : "border-cyan-300/10 bg-black/15";
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[var(--text)]">{label}</p>
        <p className="text-xs font-semibold text-[var(--text)]">{value}</p>
      </div>
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function TodayPanel({ panels, onAsk }: { panels: LiveContextPanels | null; onAsk: (prompt: string) => void }) {
  const today = panels?.today;
  if (!today) return <p className="text-sm text-[var(--text-muted)]">Today context is loading.</p>;
  if (today.status === "permission_denied") return <LockedState label="Today permission is off." href="/nextron" />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <PanelNumber label="Remaining" value={today.tasksRemaining} tone={today.tasksRemaining > 0 ? "active" : "stable"} />
        <PanelNumber label="Overdue" value={today.overdue} tone={today.overdue > 0 ? "attention" : "stable"} />
        <PanelNumber label="Done" value={today.completedToday} tone="stable" />
      </div>
      <SignalRow label="Habits" value={`${today.habitsCompleted}/${today.habitsDue}`} detail={today.habitsDue === 0 ? "none due today" : "completed today"} tone={today.habitsDue > today.habitsCompleted ? "active" : "stable"} />
      <div className="flex flex-wrap gap-2">
        <PanelLink href="/today">View Today</PanelLink>
        <PanelLink href="/tasks">View Tasks</PanelLink>
        <PanelButton onClick={() => onAsk("What should I focus on today?")}>Ask about today</PanelButton>
      </div>
    </div>
  );
}

function CalendarPanel({ panels, onAsk }: { panels: LiveContextPanels | null; onAsk: (prompt: string) => void }) {
  const calendar = panels?.calendar;
  if (!calendar) return <p className="text-sm text-[var(--text-muted)]">Calendar context is loading.</p>;
  if (calendar.status === "permission_denied") return <LockedState label="Calendar permission is off." href="/settings" />;
  if (calendar.status === "disconnected") return <LockedState label="Google Calendar is disconnected." href="/settings" />;
  if (calendar.status === "reconnect_required") return <LockedState label="Calendar needs reconnect." href="/settings" />;
  if (calendar.status !== "available") return <p className="text-sm text-[var(--text-muted)]">Calendar is unavailable right now.</p>;
  const [nextEvent, ...rest] = calendar.events;
  return (
    <div className="space-y-3">
      {nextEvent ? (
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Next</p>
          <p className="mt-1 break-words text-sm font-semibold text-[var(--text)]">{nextEvent.title}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{formatCalendarEventTime(nextEvent)}</p>
        </div>
      ) : <p className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2 text-sm text-[var(--text-muted)]">No more events today.</p>}
      {rest.length > 0 && <p className="text-xs text-[var(--text-muted)]">{rest.length + calendar.moreTodayCount} more today</p>}
      <div className="flex flex-wrap gap-2">
        <PanelLink href="/settings">Calendar settings</PanelLink>
        <PanelButton onClick={() => onAsk("What do I have today?")}>Ask about today</PanelButton>
      </div>
    </div>
  );
}

function ProjectsPanel({ panels, onAsk }: { panels: LiveContextPanels | null; onAsk: (prompt: string) => void }) {
  const projects = panels?.projects;
  if (!projects) return <p className="text-sm text-[var(--text-muted)]">Project context is loading.</p>;
  if (projects.status === "permission_denied") return <LockedState label="Projects permission is off." href="/nextron" />;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2">
        <p className="text-xs text-[var(--text-muted)]">Active projects</p>
        <p className="text-2xl font-semibold text-[var(--text)]">{projects.activeCount}</p>
      </div>
      <div className="space-y-2">
        {projects.items.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No active projects.</p> : projects.items.map((project, index) => (
          <div key={`${project.title}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2">
            <p className="min-w-0 truncate text-xs font-medium text-[var(--text)]">{project.title}</p>
            <p className="shrink-0 text-[10px] text-[var(--text-muted)]">{project.openTaskCount} open</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <PanelLink href="/projects">View Projects</PanelLink>
        <PanelButton onClick={() => onAsk("What project needs attention?")}>Ask about projects</PanelButton>
      </div>
    </div>
  );
}

function SourceContextPanel({ panels, systems }: { panels: LiveContextPanels | null; systems: Array<{ domain: string; status: string }> }) {
  const sourceRows = panels ? [
    { label: "Knowledge", status: panels.systems.knowledge.status, detail: panels.systems.knowledge.count === null ? "permission gated" : `${panels.systems.knowledge.count} items` },
    { label: "Memory", status: panels.systems.memory.status, detail: panels.systems.memory.count === null ? "confirmed prefs" : `${panels.systems.memory.count} confirmed` },
    { label: "Drive", status: panels.systems.drive.status, detail: panels.systems.drive.count === null ? "selected files gated" : `${panels.systems.drive.count} imports` },
    { label: "Calendar", status: panels.systems.calendar.status, detail: calendarStatusLabel(panels.systems.calendar.status) },
    { label: "Weekly Review", status: panels.systems.weeklyReview.status, detail: panels.systems.weeklyReview.existsThisWeek ? "completed this week" : "not completed this week" },
  ] : systems.map((system) => ({ label: formatDomainLabel(system.domain), status: system.status, detail: statusText(system.status) }));
  return (
    <div className="space-y-2">
      {sourceRows.map((row) => <SourceStatus key={row.label} {...row} />)}
    </div>
  );
}

function PanelNumber({ label, value, tone }: { label: string; value: number; tone: "active" | "attention" | "stable" }) {
  const toneClass = tone === "attention" ? "border-[var(--warning)]/30 bg-[var(--warning-soft)]" : tone === "active" ? "border-cyan-300/25 bg-cyan-300/10" : "border-cyan-300/10 bg-black/15";
  return <div className={`rounded-xl border px-2 py-2 shadow-inner shadow-cyan-950/10 transition-colors duration-200 ${toneClass}`}><p className="text-[10px] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">{value}</p></div>;
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-9 items-center rounded-lg border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-xs font-medium text-cyan-50/85 transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-cyan-300/15">{children}</Link>;
}

function PanelButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-9 items-center rounded-lg border border-cyan-300/15 bg-black/15 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-cyan-300/10">{children}</button>;
}

function LockedState({ label, href }: { label: string; href: string }) {
  return <div className="space-y-3"><p className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2 text-sm text-[var(--text-muted)]">{label}</p><PanelLink href={href}>Manage access</PanelLink></div>;
}

function SourceStatus({ label, status, detail }: { label: string; status: string; detail: string }) {
  const active = status === "available";
  const denied = status === "permission_denied";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[var(--text)]">{label}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{detail}</p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{active ? "Ready" : denied ? "Off" : statusText(status)}</span>
    </div>
  );
}

function formatCalendarEventTime(event: { startsAt: string; endsAt: string | null; allDay: boolean }): string {
  if (event.allDay) return "All day";
  const start = formatTime(event.startsAt);
  const end = event.endsAt ? formatTime(event.endsAt) : null;
  return end ? `${start}-${end}` : start;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusText(status: string): string {
  return status === "available" ? "Ready" : status === "permission_denied" ? "Off" : status === "disconnected" ? "Disconnected" : status === "reconnect_required" ? "Reconnect" : status === "missing" ? "Empty" : "Unavailable";
}

function calendarStatusLabel(status: string): string {
  return status === "available" ? "read-only connected" : statusText(status);
}

function ConversationTurn({ message }: { message: ConversationMessage }) {
  const isAssistant = message.role === "assistant";
  const response = isAssistant && message.response ? message.response : null;
  const richResponse = response && isNextronRichResponse(response.richResponse) ? response.richResponse : null;
  return (
    <article className={`relative max-w-3xl ${isAssistant ? "mr-auto" : "ml-auto rounded-2xl bg-cyan-300/8 px-4 py-3"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isAssistant ? "text-cyan-200/75" : "text-[var(--text-muted)]"}`}>{isAssistant ? "NEXTRON" : "You"}</p>
      {response ? (
        <div className="mt-2">
          <p className="break-words text-base leading-7 text-[var(--text)]">{response.interpretation}</p>
          {richResponse && <RichResponseView richResponse={richResponse} compact />}
          {response.sources && response.sources.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {response.sources.map((source) => <li key={source} className="break-words rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-medium text-cyan-50/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">{source}</li>)}
            </ul>
          )}
          {response.supportingEvidence.length > 0 && (
            <details className="mt-3 rounded-xl border border-[var(--border)] bg-black/15 p-2">
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Evidence used</summary>
              <ul className="mt-2 space-y-1.5">
                {response.supportingEvidence.slice(0, 3).map((item, index) => <li key={`${item}-${index}`} className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">{item}</li>)}
              </ul>
            </details>
          )}
        </div>
      ) : <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{message.content}</p>}
    </article>
  );
}

function PendingConversationTurn({ role, content, pending = false }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  const isAssistant = role === "assistant";
  return (
    <article data-nextron-pending-turn={pending ? "true" : undefined} className={`relative max-w-3xl ${isAssistant ? "mr-auto" : "ml-auto rounded-2xl bg-cyan-300/8 px-4 py-3"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isAssistant ? "text-cyan-200/75" : "text-[var(--text-muted)]"}`}>{isAssistant ? "NEXTRON" : "You"}</p>
      <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{content}</p>
      {pending && <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/70" aria-live="polite">Sending...</p>}
    </article>
  );
}

function AskFailureNotice({ message, code, canRetry, onRetry }: { message: string; code: AskFailureCode | null; canRetry: boolean; onRetry: () => void }) {
  return (
    <div data-nextron-ask-error="true" className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--warning)]">NEXTRON did not finish that answer.</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canRetry && <button type="button" onClick={onRetry} className="inline-flex min-h-10 items-center rounded-xl border border-[var(--warning)]/35 bg-black/15 px-3 py-2 text-xs font-semibold text-[var(--warning)] transition-colors hover:bg-[var(--warning-soft)]">Try again</button>}
        {code && <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Status: {code}</span>}
      </div>
    </div>
  );
}

function RichResponseView({ richResponse, compact = false }: { richResponse: NonNullable<NextronCoachResponse["richResponse"]>; compact?: boolean }) {
  return (
    <div data-nextron-rich-response="true" className={`${compact ? "mt-3" : ""} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/70">Generated UI</p>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-100/65">Grounded view</span>
      </div>
      <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        {richResponse.blocks.map((block, index) => <RichBlockView key={`${block.type}-${index}`} block={block} compact={compact} />)}
      </div>
    </div>
  );
}

function RichBlockView({ block, compact }: { block: NextronRichBlock; compact: boolean }) {
  if (block.type === "metric_strip") {
    return (
      <div className="rounded-2xl border border-cyan-300/14 bg-black/15 p-3">
        <p className="text-xs font-semibold text-[var(--text)]">{block.title}</p>
        <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {block.metrics.map((metricValue) => <RichMetricView key={`${metricValue.label}-${metricValue.value}`} metric={metricValue} />)}
        </div>
      </div>
    );
  }

  if (block.type === "empty_state") {
    return (
      <div className="rounded-2xl border border-cyan-300/14 bg-black/15 p-3">
        <p className="text-xs font-semibold text-[var(--text)]">{block.title}</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{block.message}</p>
        {block.href && block.actionLabel && <PanelLink href={block.href}>{block.actionLabel}</PanelLink>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-300/14 bg-black/15 p-3">
      <p className="text-xs font-semibold text-[var(--text)]">{block.title}</p>
      <ul className="mt-3 space-y-2">
        {block.items.map((entry, index) => <RichListItemView key={`${entry.source}-${entry.title}-${index}`} item={entry} />)}
      </ul>
    </div>
  );
}

function RichMetricView({ metric }: { metric: NextronRichMetric }) {
  const toneClass = metric.tone === "attention" ? "border-[var(--warning)]/30 bg-[var(--warning-soft)]" : metric.tone === "positive" ? "border-emerald-300/25 bg-emerald-400/10" : "border-cyan-300/10 bg-cyan-950/12";
  return <div className={`rounded-xl border px-2.5 py-2 ${toneClass}`}><p className="text-[10px] text-[var(--text-muted)]">{metric.label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text)]">{metric.value}</p>{metric.detail && <p className="text-[10px] text-[var(--text-muted)]">{metric.detail}</p>}</div>;
}

function RichListItemView({ item }: { item: NextronRichListItem }) {
  const markerClass = item.tone === "attention" ? "bg-[var(--warning)]" : item.tone === "positive" ? "bg-emerald-300" : "bg-cyan-300/65";
  const content = <><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${markerClass}`} aria-hidden="true" /><span className="min-w-0"><span className="block break-words text-xs font-medium text-[var(--text)]">{item.title}</span>{item.detail && <span className="mt-0.5 block break-words text-[10px] leading-relaxed text-[var(--text-muted)]">{item.detail}</span>}<span className="mt-0.5 block text-[9px] uppercase tracking-[0.1em] text-cyan-100/45">{formatDomainLabel(item.source)}</span></span></>;
  return <li>{item.href ? <Link href={item.href} className="flex gap-2 rounded-xl border border-transparent p-2 transition-colors hover:border-cyan-300/16 hover:bg-cyan-300/8">{content}</Link> : <div className="flex gap-2 p-2">{content}</div>}</li>;
}

function PermissionGroup({
  title,
  permissions,
  draftPermissions,
  savedPermissions,
  onChange,
}: {
  title: string;
  permissions: typeof NEXTRON_CONTEXT_PERMISSIONS;
  draftPermissions: NextronPermissionState;
  savedPermissions: NextronPermissionState;
  onChange: (domain: NextronContextDomain, allowed: boolean) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</h3>
      {permissions.map((permission) => {
        const checked = draftPermissions[permission.domain] === "allowed";
        const saved = savedPermissions[permission.domain] === "allowed";
        return (
          <label key={permission.domain} className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onChange(permission.domain, event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text)]">
                {permission.label}
                {permission.textHeavy && <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--warning)]">text</span>}
              </span>
              <span className="mt-1 block break-words text-xs leading-relaxed text-[var(--text-muted)]">{permission.description}</span>
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                Saved: {saved ? "allowed" : "not loaded"}. Current local choice: {checked ? "allowed" : "not loaded"}.
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
