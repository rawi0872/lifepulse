"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
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
import { buildNextronEvidencePacket, type NextronEvidencePacket } from "@/lib/nextron/evidence";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

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
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPermissions, setSavedPermissions] = useState<NextronPermissionState>(() => getDefaultNextronPermissions());
  const [draftPermissions, setDraftPermissions] = useState<NextronPermissionState>(() => getDefaultNextronPermissions());
  const [packet, setPacket] = useState<NextronEvidencePacket | null>(null);
  const [response, setResponse] = useState<NextronCoachResponse | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [permissionsAvailable, setPermissionsAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [askPrompt, setAskPrompt] = useState("");
  const [askResponse, setAskResponse] = useState<NextronCoachResponse | null>(null);
  const [askQuestion, setAskQuestion] = useState<string | null>(null);
  const [askSource, setAskSource] = useState<"ai" | "deterministic" | null>(null);
  const [askStatus, setAskStatus] = useState<"idle" | "asking" | "answered" | "unsupported" | "error">("idle");
  const [askError, setAskError] = useState<string | null>(null);

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
      setResponse(null);
      setAskResponse(null);
      setAskQuestion(null);
      setAskSource(null);
      setAskStatus("idle");
      setAskError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || seq !== requestSeq.current) return;
        if (!user) {
          setUserId(null);
          const defaults = getDefaultNextronPermissions();
          setSavedPermissions(defaults);
          setDraftPermissions(defaults);
          setPacket(null);
          setResponse(null);
          setAskResponse(null);
          setAskQuestion(null);
          setAskSource(null);
          setAskStatus("idle");
          setAskError(null);
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

        const nextPacket = await buildNextronEvidencePacket(supabase, user.id, normalized.permissions);
        if (cancelled || seq !== requestSeq.current) return;
        const nextResponse = buildDeterministicNextronResponse(nextPacket);
        if (cancelled || seq !== requestSeq.current) return;
        setPacket(nextPacket);
        setResponse(nextResponse);
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
    };
  }, [router, supabase]);

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
      setResponse(null);
      setAskResponse(null);
      setAskQuestion(null);
      setAskSource(null);
      setAskStatus("idle");
      setAskError(null);
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

    try {
      const nextPacket = await buildNextronEvidencePacket(supabase, user.id, normalized.permissions);
      if (seq !== requestSeq.current) return;
      const nextResponse = buildDeterministicNextronResponse(nextPacket);
      if (seq !== requestSeq.current) return;
      setPacket(nextPacket);
      setResponse(nextResponse);
    } catch {
      setError("NEXTRON saved your permissions, but could not refresh the permitted context right now.");
    }
  }

  async function askNextron(promptOverride?: string) {
    if (askStatus === "asking") return;
    const prompt = promptOverride ?? askPrompt;
    const parsed = parseNextronUserRequest(prompt);
    if (!parsed.ok) {
      setAskError(parsed.message);
      setAskStatus("error");
      return;
    }
    if (!packet || !userId) {
      setAskError("NEXTRON needs permitted context before answering. Try again after the current context loads.");
      setAskStatus("error");
      return;
    }

    const seq = ++requestSeq.current;
    setAskStatus("asking");
    setAskError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (seq !== requestSeq.current) return;
    if (!user || user.id !== userId) {
      const defaults = getDefaultNextronPermissions();
      setUserId(null);
      setSavedPermissions(defaults);
      setDraftPermissions(defaults);
      setPacket(null);
      setResponse(null);
      setAskResponse(null);
      setAskQuestion(null);
      setAskSource(null);
      setAskStatus("error");
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    askAbortController.current?.abort();
    askAbortController.current = controller;

    try {
      const response = await fetch("/api/nextron/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: parsed.request.rawPrompt }),
        signal: controller.signal,
      });
      if (seq !== requestSeq.current) return;

      if (response.status === 401) {
        setAskStatus("error");
        setAskError("Sign in again to ask NEXTRON.");
        router.replace("/login");
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const parsedBody = parseAskResponseBody(body);
      if (!response.ok || !parsedBody) {
        setAskStatus("error");
        setAskError("NEXTRON could not answer that request right now. Try again in a moment.");
        return;
      }

      const nextResponse = parsedBody.response;
      setAskResponse(nextResponse);
      setAskQuestion(parsed.request.rawPrompt);
      setAskSource(parsedBody.source ?? nextResponse.source ?? "deterministic");
      setAskStatus(parsed.request.handlingStatus === "handled" ? "answered" : "unsupported");
      setAskPrompt("");
    } catch (askErrorValue) {
      if (askErrorValue instanceof DOMException && askErrorValue.name === "AbortError") return;
      if (seq === requestSeq.current) {
        setAskStatus("error");
        setAskError("NEXTRON could not answer that request right now. Try again in a moment.");
      }
    } finally {
      if (askAbortController.current === controller) askAbortController.current = null;
    }
  }

  const hasUnsavedChanges = !areNextronPermissionsEqual(savedPermissions, draftPermissions);
  const operationalPermissions = NEXTRON_CONTEXT_PERMISSIONS.filter((permission) => !permission.textHeavy);
  const privateTextPermissions = NEXTRON_CONTEXT_PERMISSIONS.filter((permission) => permission.textHeavy);
  const trimmedAskPrompt = askPrompt.trim();
  const askDisabled = loading || !packet || askStatus === "asking" || trimmedAskPrompt.length === 0 || trimmedAskPrompt.length > NEXTRON_REQUEST_MAX_LENGTH;
  const liveResponse = askResponse ?? response;
  const activeSystems = packet
    ? [
        { domain: "today", status: packet.today.status },
        { domain: "tasks", status: packet.tasks.status },
        { domain: "projects", status: packet.projects.status },
        { domain: "knowledge", status: packet.knowledge.status },
        { domain: "drive", status: savedPermissions.drive === "allowed" ? "available" : "permission_denied" },
        { domain: "calendar", status: packet.calendar.status },
        { domain: "memory", status: packet.memory.status },
      ]
    : [];
  const availableSystems = activeSystems.filter((system) => system.status === "available").length;
  const contextStats = packet ? [
    { label: "Overdue", value: packet.tasks.data?.overdueCount ?? 0, detail: "tasks" },
    { label: "Today", value: packet.tasks.data?.dueTodayCount ?? 0, detail: "due" },
    { label: "Projects", value: packet.projects.data?.activeCount ?? 0, detail: "active" },
    { label: "Memory", value: packet.memory.data?.preferences.length ?? 0, detail: "signals" },
  ] : [];
  const quickPrompts = ["What should I focus on today?", "What needs my attention?", "What's slipping?", "What should I do next?"];

  return (
    <div className="relative mx-auto max-w-7xl overflow-x-hidden px-4 py-5 animate-fade-in sm:px-5 sm:py-7">
      <div className="pointer-events-none absolute inset-x-4 top-4 h-72 rounded-[2rem] bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.16),rgba(15,23,42,0)_64%)]" aria-hidden="true" />
      <header className="relative mb-5 min-w-0 rounded-[2rem] border border-cyan-300/10 bg-[linear-gradient(135deg,rgba(8,18,32,0.92),rgba(10,18,28,0.72)),var(--surface)] p-4 shadow-2xl shadow-cyan-950/20 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Personal Intelligence</p>
            <h1 className="break-words text-3xl font-bold tracking-[-0.04em] text-[var(--text)] sm:text-4xl">NEXTRON</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">
              A permissioned intelligence layer for Life Pulse: coaching, projects, Knowledge, Calendar, Memory, and selected Drive sources, grounded in context you explicitly allow.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[34rem]">
            {contextStats.map((stat) => <ContextStat key={stat.label} {...stat} />)}
          </div>
        </div>
      </header>

      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)_minmax(18rem,0.78fr)]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <NextronPanel title="Live Context" eyebrow="Life Pulse state">
            {loading ? <p className="text-sm text-[var(--text-muted)]">Loading permitted context...</p> : error ? <p className="text-sm text-[var(--warning)]">{error}</p> : (
              <div className="space-y-3">
                <SignalRow label="Task pressure" value={`${packet?.tasks.data?.overdueCount ?? 0} overdue`} detail={`${packet?.tasks.data?.dueTodayCount ?? 0} due today`} tone={(packet?.tasks.data?.overdueCount ?? 0) > 0 ? "attention" : "stable"} />
                <SignalRow label="Projects" value={`${packet?.projects.data?.activeCount ?? 0} active`} detail={`${packet?.projects.data?.activeWithoutOpenTaskCount ?? 0} without open tasks`} tone={(packet?.projects.data?.activeWithoutOpenTaskCount ?? 0) > 0 ? "attention" : "stable"} />
                <SignalRow label="Knowledge" value={packet?.knowledge.status === "available" ? "available" : "not loaded"} detail={savedPermissions.drive === "allowed" ? "Drive sources allowed" : "Drive sources off"} tone={packet?.knowledge.status === "available" ? "active" : "muted"} />
              </div>
            )}
          </NextronPanel>

          <NextronPanel title="Questions" eyebrow="Quick intelligence">
            <div className="grid gap-2">
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" disabled={askStatus === "asking" || !packet} onClick={() => { setAskPrompt(prompt); void askNextron(prompt); }} className="min-h-11 rounded-xl border border-cyan-200/10 bg-cyan-950/10 px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-cyan-300/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50">
                  {prompt}
                </button>
              ))}
            </div>
          </NextronPanel>
        </aside>

        <main className="min-w-0 space-y-4">
          <section aria-labelledby="ask-nextron" className="rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,18,32,0.88),rgba(8,13,23,0.94)),var(--surface)] p-4 shadow-2xl shadow-cyan-950/25 sm:p-5">
            <div className="mb-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Command channel</p>
                <h2 id="ask-nextron" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Ask NEXTRON</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Ask about your Life Pulse context, saved Knowledge, projects, Calendar, or next focus. NEXTRON only uses context currently permitted.</p>
              </div>
              <IntelligenceCore status={askStatus === "asking" ? "thinking" : loading ? "syncing" : "idle"} systems={activeSystems} />
            </div>

            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void askNextron(); }}>
              <label htmlFor="nextron-question" className="sr-only">Ask NEXTRON</label>
              <div className="rounded-2xl border border-cyan-300/20 bg-black/20 p-2 shadow-inner shadow-cyan-950/20 focus-within:border-cyan-300/45 focus-within:ring-2 focus-within:ring-cyan-400/10">
                <textarea id="nextron-question" value={askPrompt} onChange={(event) => { setAskPrompt(event.target.value.slice(0, NEXTRON_REQUEST_MAX_LENGTH)); setAskError(null); if (askStatus === "error") setAskStatus("idle"); }} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!askDisabled) void askNextron(); } }} maxLength={NEXTRON_REQUEST_MAX_LENGTH} rows={3} aria-describedby="nextron-question-help nextron-question-status" placeholder="What should I focus on today?" className="min-h-28 w-full resize-y rounded-xl border-0 bg-transparent px-3 py-3 text-base leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-300/10 px-2 pt-2">
                  <p id="nextron-question-help" className="text-xs text-[var(--text-muted)]">{trimmedAskPrompt.length}/{NEXTRON_REQUEST_MAX_LENGTH}. Enter asks; Shift+Enter adds a line.</p>
                  <button type="submit" disabled={askDisabled} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition-all hover:-translate-y-0.5 hover:bg-cyan-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45">
                    {askStatus === "asking" ? "Analyzing..." : "Send to NEXTRON"}
                  </button>
                </div>
              </div>
              <p id="nextron-question-status" className="text-xs leading-relaxed text-[var(--text-muted)]" aria-live="polite">{askStatus === "asking" ? "NEXTRON is checking permitted evidence." : askStatus === "unsupported" ? "NEXTRON answered with a private-beta boundary." : askError ?? "Prompts are processed for this response and are not saved as memory."}</p>
            </form>
          </section>

          <section aria-labelledby="nextron-answer" className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Main intelligence</p>
                <h2 id="nextron-answer" className="mt-1 text-lg font-semibold text-[var(--text)]">{askQuestion ? "Latest response" : "Current baseline"}</h2>
              </div>
              {liveResponse && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">{liveResponse.priority}</span>}
            </div>
            {askQuestion && <div className="mb-4 rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Question</p><p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{askQuestion}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{askSource === "ai" ? "AI synthesis" : "Deterministic synthesis"}</p></div>}
            {loading && <p className="text-sm text-[var(--text-muted)]">Loading permitted context...</p>}
            {!loading && error && <p className="text-sm text-[var(--warning)]">{error}</p>}
            {!loading && !error && liveResponse && <ResponseView response={liveResponse} />}
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <NextronPanel title="System Awareness" eyebrow={`${availableSystems} systems available`}>
            <div className="space-y-2">
              {activeSystems.map((system) => <SystemStatus key={system.domain} domain={system.domain} status={system.status} />)}
            </div>
          </NextronPanel>

          <NextronPanel title="Boundaries" eyebrow="Safety state">
            <ul className="space-y-2 text-xs leading-relaxed text-[var(--text-muted)]">
              <li>No autonomous actions in Prompt 1.</li>
              <li>External connectors are read-only.</li>
              <li>Drive uses selected imported files only.</li>
              <li>No medical, legal, financial, or therapy guidance.</li>
            </ul>
          </NextronPanel>
        </aside>
      </div>

      <section aria-labelledby="nextron-context" className="relative mt-5">
        <details className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
            Context permissions and access controls
            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">Saved permissions remain the authority.</span>
          </summary>
          <div className="mt-4">
            <p id="nextron-context" className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">Saved permissions control what evidence enters NEXTRON. Change checkboxes locally, then save to refresh the Command Center.</p>
            {permissionWarning && <p className="mb-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--warning)]">{permissionWarning}</p>}
            <PermissionGroup title="Operational context" permissions={operationalPermissions} draftPermissions={draftPermissions} savedPermissions={savedPermissions} onChange={setPermission} />
            <PermissionGroup title="Private text context" permissions={privateTextPermissions} draftPermissions={draftPermissions} savedPermissions={savedPermissions} onChange={setPermission} />
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">{permissionLoading ? "Loading saved permissions..." : !permissionsAvailable ? "Saved permissions are currently unavailable, so safe defaults are active." : hasUnsavedChanges ? "You have unsaved local permission changes. Evidence will not broaden until saving succeeds." : saveStatus === "saved" ? "Context permissions saved and NEXTRON refreshed." : saveStatus === "error" ? "Context permissions were not saved. Try again when ready." : "Saved permissions are active."}</p>
              <button type="button" onClick={() => void savePermissions()} disabled={!permissionsAvailable || !hasUnsavedChanges || saveStatus === "saving" || !userId} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">{saveStatus === "saving" ? "Saving permissions..." : "Save context permissions"}</button>
            </div>
          </div>
        </details>
      </section>

      <section aria-labelledby="nextron-access" className="relative mt-5 grid gap-3 sm:grid-cols-2">
        <Card variant="subtle" className="p-4"><h2 id="nextron-access" className="text-sm font-semibold text-[var(--text)]">Currently available</h2><ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">{packet ? Object.entries(packet.permissionSummary).filter(([, status]) => status === "available").map(([domain]) => <li key={domain} className="break-words">{formatDomainLabel(domain)}</li>) : <li>Permitted context is loading.</li>}</ul></Card>
        <Card variant="subtle" className="p-4"><h2 className="text-sm font-semibold text-[var(--text)]">Not available to NEXTRON</h2><ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">{NEXTRON_UNAVAILABLE_CONTEXT.map((item) => <li key={item} className="break-words">{item}</li>)}{packet && Object.entries(packet.permissionSummary).filter(([, status]) => status === "permission_denied").map(([domain]) => <li key={domain} className="break-words">{formatDomainLabel(domain)} is not loaded by current permission.</li>)}</ul></Card>
      </section>

      <p className="relative mt-5 text-center text-[10px] leading-relaxed text-[var(--text-muted)]">NEXTRON is permissioned, bounded, and user-controlled. It does not mutate Life Pulse data or external services in this phase.</p>
    </div>
  );
}

function parseAskResponseBody(value: unknown): { response: NextronCoachResponse; source?: "ai" | "deterministic" } | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { response?: unknown; source?: unknown };
  if (!isNextronCoachResponse(candidate.response)) return null;
  if (candidate.source !== undefined && candidate.source !== "ai" && candidate.source !== "deterministic") return null;
  return { response: candidate.response, source: candidate.source };
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

function NextronPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,18,32,0.82),rgba(8,13,23,0.9)),var(--surface)] p-4 shadow-xl shadow-cyan-950/10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/60">{eyebrow}</p>
      <h2 className="mt-1 text-sm font-semibold text-[var(--text)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ContextStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">{value}</p>
      <p className="text-[10px] text-cyan-100/55">{detail}</p>
    </div>
  );
}

function IntelligenceCore({ status, systems }: { status: "idle" | "thinking" | "syncing"; systems: Array<{ domain: string; status: string }> }) {
  const activeCount = systems.filter((system) => system.status === "available").length;
  const statusText = status === "thinking" ? "Analyzing" : status === "syncing" ? "Syncing" : "Ready";
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center sm:h-32 sm:w-32" aria-label={`NEXTRON core ${statusText.toLowerCase()}, ${activeCount} systems available`}>
      <div className={`absolute inset-0 rounded-full border border-cyan-300/20 bg-cyan-300/5 shadow-[0_0_42px_rgba(34,211,238,0.14)] ${status === "thinking" ? "animate-pulse" : ""}`} />
      <div className="absolute inset-3 rounded-full border border-dashed border-cyan-200/20" />
      <div className="absolute inset-7 rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle,rgba(125,211,252,0.24),rgba(8,18,32,0.52)_62%)] rotate-45" />
      <div className="relative text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Core</p>
        <p className="mt-1 text-xs text-cyan-100/70">{statusText}</p>
        <p className="text-[10px] text-cyan-100/45">{activeCount} online</p>
      </div>
    </div>
  );
}

function SystemStatus({ domain, status }: { domain: string; status: string }) {
  const active = status === "available";
  const denied = status === "permission_denied";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[var(--text)]">{formatDomainLabel(domain)}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{active ? "Available" : denied ? "Not loaded" : "No signal"}</p>
      </div>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.65)]" : denied ? "bg-[var(--text-muted)]/35" : "bg-[var(--warning)]/70"}`} aria-hidden="true" />
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

function ResponseView({ response }: { response: NextronCoachResponse }) {
  const showNextAction = response.nextAction.href !== "/knowledge" || !response.ruleId.includes("knowledge");
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">NEXTRON answer</p>
        <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text)]">{response.interpretation}</p>
      </div>
      {response.sources && response.sources.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Sources</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {response.sources.map((source) => <li key={source} className="break-words rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">{source}</li>)}
          </ul>
        </div>
      )}
      {response.supportingEvidence.length > 0 && (
        <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Evidence used</summary>
          <ul className="mt-2 space-y-2">
            {response.supportingEvidence.slice(0, 3).map((item, index) => <li key={`${item}-${index}`} className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">{item}</li>)}
          </ul>
        </details>
      )}
      {showNextAction && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Next action</p>
          <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{response.nextAction.rationale}</p>
          <Link href={response.nextAction.href} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            {response.nextAction.label}
          </Link>
        </div>
      )}
    </div>
  );
}
