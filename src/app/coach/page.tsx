"use client";

import { useEffect, useRef, useState } from "react";
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

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

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

  return (
    <div className="mx-auto max-w-3xl overflow-x-hidden px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
      <header className="mb-6 min-w-0">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">Life Pulse AI Coach</p>
        <h1 className="break-words text-3xl font-bold tracking-tight text-[var(--text)]">NEXTRON</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          NEXTRON uses permitted Life Pulse evidence, separates facts from interpretation, and recommends one practical next action. This is an early private-beta foundation: AI coaching is server-side and opt-in, with no autonomous actions and no medical, mental-health, legal, or financial professional replacement.
        </p>
      </header>

      <section aria-labelledby="nextron-response" className="mb-6">
        <Card className="border-[var(--accent)]/25 bg-[var(--surface-soft)]/80 p-4 sm:p-5">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="nextron-response" className="text-base font-semibold text-[var(--text)]">Current coaching response</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">One deterministic response from permitted evidence.</p>
            </div>
            {response && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {response.priority}
              </span>
            )}
          </div>

          {loading && <p className="text-sm text-[var(--text-muted)]">Loading permitted context...</p>}
          {!loading && error && <p className="text-sm text-[var(--warning)]">{error}</p>}
          {!loading && !error && response && <ResponseView response={response} />}
        </Card>
      </section>

      <section aria-labelledby="nextron-facts" className="mb-6">
        <h2 id="nextron-facts" className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Facts used</h2>
        <Card variant="subtle" className="p-4">
          {response ? (
            <ul className="space-y-2">
              {response.facts.map((item, index) => (
                <li key={`${item.category}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{item.category}</p>
                  <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{item.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Facts will appear after permitted context loads.</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="ask-nextron" className="mb-6">
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h2 id="ask-nextron" className="text-base font-semibold text-[var(--text)]">Ask NEXTRON</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Ask one practical coaching question. NEXTRON answers from saved permitted evidence only; prompts are not saved.
            </p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void askNextron();
            }}
          >
            <label htmlFor="nextron-question" className="block text-sm font-semibold text-[var(--text)]">Coaching question</label>
            <textarea
              id="nextron-question"
              value={askPrompt}
              onChange={(event) => {
                setAskPrompt(event.target.value.slice(0, NEXTRON_REQUEST_MAX_LENGTH));
                setAskError(null);
                if (askStatus === "error") setAskStatus("idle");
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!askDisabled) void askNextron();
                }
              }}
              maxLength={NEXTRON_REQUEST_MAX_LENGTH}
              rows={3}
              aria-describedby="nextron-question-help nextron-question-status"
              placeholder="What should I focus on today?"
              className="min-h-24 w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]/70 focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="nextron-question-help" className="text-xs text-[var(--text-muted)]">
                {trimmedAskPrompt.length}/{NEXTRON_REQUEST_MAX_LENGTH} characters. Enter asks; Shift+Enter adds a line.
              </p>
              <button
                type="submit"
                disabled={askDisabled}
                className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {askStatus === "asking" ? "Asking NEXTRON..." : "Ask NEXTRON"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {["What should I focus on today?", "What needs my attention?", "What should I do next?", "What patterns can you see?"].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={askStatus === "asking" || !packet}
                  onClick={() => {
                    setAskPrompt(prompt);
                    void askNextron(prompt);
                  }}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <p id="nextron-question-status" className="text-xs leading-relaxed text-[var(--text-muted)]" aria-live="polite">
              {askStatus === "asking"
                ? "NEXTRON is checking the current permitted evidence."
                : askStatus === "unsupported"
                  ? "NEXTRON answered with a private-beta boundary."
                  : askError ?? "No prompt or answer is saved."}
            </p>
          </form>
          {askQuestion && askResponse && (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Question</p>
              <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{askQuestion}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {askSource === "ai" ? "AI coaching" : "NEXTRON coaching"}
              </p>
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Facts</p>
                <FactList facts={askResponse.facts} />
              </div>
              <div className="mt-4">
                <ResponseView response={askResponse} />
              </div>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="nextron-context" className="mb-6">
        <h2 id="nextron-context" className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Context permissions</h2>
        <Card className="p-4 sm:p-5">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
            Saved permissions control what evidence enters NEXTRON. Change checkboxes locally, then save to refresh the coaching response. Text-heavy reflection areas are off by default.
          </p>
          {permissionWarning && (
            <p className="mb-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--warning)]">
              {permissionWarning}
            </p>
          )}
          <PermissionGroup title="Operational context" permissions={operationalPermissions} draftPermissions={draftPermissions} savedPermissions={savedPermissions} onChange={setPermission} />
          <PermissionGroup title="Private text context" permissions={privateTextPermissions} draftPermissions={draftPermissions} savedPermissions={savedPermissions} onChange={setPermission} />
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              {permissionLoading
                ? "Loading saved permissions..."
                : !permissionsAvailable
                  ? "Saved permissions are currently unavailable, so safe defaults are active. Try again after the hosted migration is available."
                : hasUnsavedChanges
                  ? "You have unsaved local permission changes. Evidence will not broaden until saving succeeds."
                  : saveStatus === "saved"
                    ? "Context permissions saved and NEXTRON refreshed."
                    : saveStatus === "error"
                      ? "Context permissions were not saved. Your local choices are still visible; try again when ready."
                      : "Saved permissions are active."}
            </p>
            <button
              type="button"
              onClick={() => void savePermissions()}
              disabled={!permissionsAvailable || !hasUnsavedChanges || saveStatus === "saving" || !userId}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saveStatus === "saving" ? "Saving context permissions..." : "Save context permissions"}
            </button>
          </div>
        </Card>
      </section>

      <section aria-labelledby="nextron-access" className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card variant="subtle" className="p-4">
          <h2 id="nextron-access" className="text-sm font-semibold text-[var(--text)]">What NEXTRON can currently access</h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
            {packet ? Object.entries(packet.permissionSummary).filter(([, status]) => status === "available").map(([domain]) => (
              <li key={domain} className="break-words">{domain}</li>
            )) : <li>Permitted context is loading.</li>}
          </ul>
        </Card>
        <Card variant="subtle" className="p-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">What NEXTRON cannot currently access</h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
            {NEXTRON_UNAVAILABLE_CONTEXT.map((item) => <li key={item} className="break-words">{item}</li>)}
            {packet && Object.entries(packet.permissionSummary).filter(([, status]) => status === "permission_denied").map(([domain]) => (
              <li key={domain} className="break-words">{domain} is not loaded by current permission.</li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="nextron-boundary" className="mb-6">
        <Card variant="subtle" className="p-4">
          <h2 id="nextron-boundary" className="text-sm font-semibold text-[var(--text)]">Future AI boundary</h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
            Server-side AI coaching is available only when explicitly configured. NEXTRON sends bounded permitted evidence, never client-supplied evidence, and falls back to deterministic coaching when AI is unavailable.
          </p>
        </Card>
      </section>

      <p className="text-center text-[10px] leading-relaxed text-[var(--text-muted)]">
        NEXTRON does not diagnose, provide therapy, give legal or financial advice, infer hidden traits, claim certainty, or mutate Life Pulse data. Suggested actions are optional and user-controlled.
      </p>
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

function FactList({ facts }: { facts: NextronCoachResponse["facts"] }) {
  return (
    <ul className="mt-2 space-y-2">
      {facts.map((item, index) => (
        <li key={`${item.category}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{item.category}</p>
          <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

function ResponseView({ response }: { response: NextronCoachResponse }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Interpretation</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{response.interpretation}</p>
      </div>
      {response.sources && response.sources.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Sources</p>
          <ul className="mt-2 space-y-1">
            {response.sources.map((source) => <li key={source} className="break-words text-xs text-[var(--text-secondary)]">{source}</li>)}
          </ul>
        </div>
      )}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Suggested next action</p>
        <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{response.nextAction.rationale}</p>
        <Link href={response.nextAction.href} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          {response.nextAction.label}
        </Link>
      </div>
    </div>
  );
}
