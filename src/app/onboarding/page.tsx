"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LifePulseLogo } from "@/components/LifePulseLogo";

type OnboardingStatus = "not_started" | "in_progress" | "draft_ready" | "completed" | "skipped";

interface Understanding {
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

interface LifeSetupDraft {
  currentFocus: string[];
  goals: Array<{ title: string; why: string; horizon: string; priority: "high" | "medium" | "low" }>;
  starterHabits: Array<{ title: string; why: string; frequency: string; supports: string }>;
  initialTasks: Array<{ title: string; why: string; related: string }>;
  projects: Array<{ title: string; desiredOutcome: string; nextMilestone: string }>;
  routines: Array<{ title: string; cadence: string; description: string }>;
  importantDates: Array<{ label: string; timing: string; why: string }>;
  deliberatelyLeftOut: Array<{ item: string; reason: string }>;
}

interface OnboardingMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface OnboardingState {
  id: string;
  status: OnboardingStatus;
  understanding: Understanding;
  setup_draft: LifeSetupDraft | null;
  last_error: string | null;
  updated_at: string;
  profile?: { onboardingCompleted: boolean; intendedUse: string | null };
}

interface OnboardingResponse { state: OnboardingState; messages: OnboardingMessage[] }

interface ActionProposalPreviewField { label: string; before?: string | null; after: string }
interface ActionProposalPreview { heading: string; subheading: string; fields: ActionProposalPreviewField[]; approvalLabel: string }
interface ActionProposal {
  id: string;
  actionType: string;
  title: string;
  description: string;
  preview: ActionProposalPreview;
  status: "pending" | "approved_execution_disabled" | "completed" | "partially_failed" | "failed" | "stale" | "canceled" | "expired" | "invalidated";
  executionResult: Record<string, unknown> | null;
}

const EMPTY_UNDERSTANDING: Understanding = {
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

const EXAMPLES = [
  "I'm preparing for university and want my evenings under control.",
  "I want to get in shape, study consistently, and stop overcommitting.",
  "I'm trying to take my freelance work seriously without burning out.",
];

function isOnboardingResponse(value: unknown): value is OnboardingResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<OnboardingResponse>;
  return typeof candidate.state === "object" && candidate.state !== null && Array.isArray(candidate.messages);
}

function isActionProposal(value: unknown): value is ActionProposal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ActionProposal>;
  return typeof candidate.id === "string"
    && typeof candidate.actionType === "string"
    && typeof candidate.title === "string"
    && typeof candidate.description === "string"
    && typeof candidate.preview === "object" && candidate.preview !== null
    && typeof candidate.preview.heading === "string"
    && typeof candidate.preview.subheading === "string"
    && Array.isArray(candidate.preview.fields)
    && ["pending", "approved_execution_disabled", "completed", "partially_failed", "failed", "stale", "canceled", "expired", "invalidated"].includes(candidate.status ?? "")
    && (candidate.executionResult === null || typeof candidate.executionResult === "object" || candidate.executionResult === undefined);
}

function sectionCount(understanding: Understanding): number {
  return Object.values(understanding).reduce((count, items) => count + items.length, 0);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [transitioning, setTransitioning] = useState<"skip" | "complete" | "resume" | null>(null);
  const [proposal, setProposal] = useState<ActionProposal | null>(null);
  const [setupPermissionsGranted, setSetupPermissionsGranted] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<"idle" | "building" | "granting" | "approving" | "cancelling" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setError(null);
    const result = await fetch("/api/nextron/onboarding", { method: "GET" }).then((res) => res.ok ? res.json() : null).catch(() => null) as unknown;
    if (!isOnboardingResponse(result)) {
      setError("NEXTRON onboarding could not be loaded. Refresh and try again.");
      setLoading(false);
      return;
    }
    setState(result.state);
    setMessages(result.messages);
    setLoading(false);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, sending]);

  async function send(nextPrompt = prompt) {
    const value = nextPrompt.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    const result = await fetch("/api/nextron/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: value, clientMessageId: crypto.randomUUID() }),
    }).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    setSending(false);
    if (!result?.ok || !isOnboardingResponse(result.body)) {
      const body = typeof result?.body === "object" && result.body !== null ? result.body as { error?: unknown } : null;
      setError(typeof body?.error === "string" ? body.error : "NEXTRON could not process that. Your conversation is still saved up to the last turn.");
      return;
    }
    setPrompt("");
    setState(result.body.state);
    setMessages(result.body.messages);
  }

  async function transition(action: "skip" | "complete" | "resume") {
    setTransitioning(action);
    setError(null);
    const result = await fetch("/api/nextron/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    setTransitioning(null);
    if (!result?.ok || !isOnboardingResponse(result.body)) {
      const body = typeof result?.body === "object" && result.body !== null ? result.body as { error?: unknown } : null;
      setError(typeof body?.error === "string" ? body.error : "NEXTRON could not update onboarding state.");
      return;
    }
    setState(result.body.state);
    setMessages(result.body.messages);
    if (action === "skip" || action === "complete") router.push("/today");
  }

  async function buildSetupPlan() {
    setProposalStatus("building");
    setError(null);
    const result = await fetch("/api/nextron/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "build_plan" }) }).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    const body = typeof result?.body === "object" && result.body !== null ? result.body as { proposal?: unknown; error?: unknown } : null;
    if (!result?.ok || !isActionProposal(body?.proposal)) {
      setProposalStatus("error");
      setError(typeof body?.error === "string" ? body.error : "NEXTRON could not prepare the setup action plan.");
      return;
    }
    setProposal(body.proposal);
    setSetupPermissionsGranted(false);
    setProposalStatus("idle");
  }

  async function grantSetupPermissions() {
    setProposalStatus("granting");
    const ok = await fetch("/api/nextron/action-permissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant: ["goalActions", "habitActions", "projectActions", "taskActions"] }) }).then((res) => res.ok).catch(() => false);
    if (ok) setSetupPermissionsGranted(true);
    setProposalStatus(ok ? "idle" : "error");
    if (!ok) setError("NEXTRON action permissions could not be saved.");
  }

  async function approveSetupPlan() {
    if (!proposal) return;
    setProposalStatus("approving");
    const result = await fetch(`/api/nextron/actions/${proposal.id}/approve`, { method: "POST" }).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    const body = typeof result?.body === "object" && result.body !== null ? result.body as { proposal?: unknown; error?: unknown } : null;
    if (!result?.ok || !isActionProposal(body?.proposal)) {
      setProposalStatus("error");
      setError(typeof body?.error === "string" ? body.error : "NEXTRON could not apply the setup plan.");
      return;
    }
    setProposal(body.proposal);
    setProposalStatus("idle");
  }

  async function cancelSetupPlan() {
    if (!proposal) return;
    setProposalStatus("cancelling");
    const result = await fetch(`/api/nextron/actions/${proposal.id}/cancel`, { method: "POST" }).then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) as unknown })).catch(() => null);
    const body = typeof result?.body === "object" && result.body !== null ? result.body as { proposal?: unknown; error?: unknown } : null;
    if (result?.ok && isActionProposal(body?.proposal)) setProposal(body.proposal);
    setProposalStatus(result?.ok ? "idle" : "error");
  }

  if (loading) {
    return <div className="command-shell flex min-h-screen items-center justify-center"><div className="flex flex-col items-center gap-4"><LifePulseLogo /><p className="text-sm text-[var(--text-muted)]">Opening NEXTRON onboarding...</p></div></div>;
  }

  const understanding = state?.understanding ?? EMPTY_UNDERSTANDING;
  const draft = state?.setup_draft ?? null;
  const hasConversation = messages.length > 0;
  const assistantGreeting = "Before I organize anything, I want to understand what you're trying to change. Tell me what's going on in your life right now.";
  const insightCount = sectionCount(understanding);
  const skipped = state?.status === "skipped";

  return (
    <main className="nextron-shell relative min-h-screen overflow-x-hidden px-3 py-4 animate-fade-in sm:px-5 sm:py-6 lg:px-8">
      <div className="nextron-shell-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[92rem] gap-4 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.5fr)_minmax(20rem,0.9fr)]">
        <aside className="nextron-surface relative overflow-hidden rounded-[2rem] p-4 sm:p-5 xl:sticky xl:top-5 xl:self-start">
          <div className="nextron-precision-edge pointer-events-none absolute inset-x-6 top-0 h-px" aria-hidden="true" />
          <LifePulseLogo />
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">First session</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text)] sm:text-4xl">Build Life Pulse around your actual life.</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Start by talking to NEXTRON. No goals, habits, tasks, or projects are created in this step. You are shaping a setup draft.</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat label="Status" value={state?.status === "draft_ready" ? "Draft" : skipped ? "Skipped" : "Learning"} />
            <MiniStat label="Signals" value={String(insightCount)} />
            <MiniStat label="Writes" value="0" />
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-black/15 p-3">
            <p className="text-xs font-semibold text-[var(--text)]">Privacy boundary</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This onboarding understanding is not Memory. NEXTRON will not permanently remember statements unless you later use explicit Memory behavior.</p>
          </div>
          <button type="button" onClick={() => void transition("skip")} disabled={transitioning !== null} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-cyan-300/15 bg-black/15 px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-cyan-200/30 hover:bg-cyan-300/10 disabled:opacity-50">
            {transitioning === "skip" ? "Skipping..." : "Skip for now"}
          </button>
          {skipped && <button type="button" onClick={() => void transition("resume")} disabled={transitioning !== null} className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:opacity-50">Resume onboarding</button>}
        </aside>

        <section className="nextron-surface nextron-scanline relative flex min-h-[72vh] flex-col overflow-hidden rounded-[2rem] p-4 sm:p-5">
          {sending && <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(103,232,249,0.10),transparent)] [animation:nextron-scan_1.7s_ease-in-out_infinite]" aria-hidden="true" />}
          <div className="mb-4 flex flex-col gap-3 border-b border-cyan-300/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">NEXTRON onboarding</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Tell me what is changing.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">NEXTRON will ask only for what changes the setup. Corrections are part of the conversation.</p>
            </div>
            <span className="w-fit rounded-full border border-cyan-300/18 bg-cyan-300/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/75">{sending ? "Analyzing" : draft ? "Draft ready" : "Listening"}</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {!hasConversation && <OnboardingTurn role="assistant" content={assistantGreeting} />}
            {messages.map((message) => <OnboardingTurn key={message.id} role={message.role} content={message.content} />)}
            {sending && <OnboardingTurn role="assistant" content="NEXTRON is updating the setup draft from this turn..." pending />}
            <div ref={bottomRef} />
          </div>

          {!hasConversation && (
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => <button key={example} type="button" onClick={() => { setPrompt(example); composerRef.current?.focus(); }} className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-50/80 transition-colors hover:border-cyan-200/35">{example}</button>)}
            </div>
          )}

          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <label htmlFor="nextron-onboarding-composer" className="sr-only">Talk to NEXTRON</label>
            <div className="rounded-2xl border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(2,6,23,0.44),rgba(2,6,23,0.24))] p-2 shadow-inner shadow-cyan-950/20 transition-all duration-200 focus-within:border-cyan-200/55 focus-within:shadow-[0_0_0_1px_rgba(103,232,249,0.12),0_0_42px_rgba(8,145,178,0.12)]">
              <textarea ref={composerRef} id="nextron-onboarding-composer" value={prompt} onChange={(event) => { setPrompt(event.target.value.slice(0, 1500)); setError(null); }} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={3} maxLength={1500} placeholder="Tell NEXTRON what is happening right now..." className="min-h-24 w-full resize-y rounded-xl border-0 bg-transparent px-3 py-3 text-base leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-300/10 px-2 pt-2">
                <p className="text-xs text-[var(--text-muted)]">{prompt.trim().length}/1500. Enter sends; Shift+Enter adds a line.</p>
                <button type="submit" disabled={sending || !prompt.trim()} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition-all hover:-translate-y-0.5 hover:bg-cyan-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45">{sending ? "Analyzing..." : "Send to NEXTRON"}</button>
              </div>
            </div>
            {error && <p className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">{error}</p>}
          </form>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <UnderstandingPanel understanding={understanding} />
          {draft ? <DraftPanel draft={draft} proposal={proposal} proposalStatus={proposalStatus} setupPermissionsGranted={setupPermissionsGranted} onComplete={() => void transition("complete")} onBuildPlan={() => void buildSetupPlan()} onGrantPermissions={() => void grantSetupPermissions()} onApprovePlan={() => void approveSetupPlan()} onCancelPlan={() => void cancelSetupPlan()} busy={transitioning === "complete"} /> : <DraftWaitingPanel />}
        </aside>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-cyan-300/12 bg-black/18 px-3 py-2"><p className="text-[10px] text-[var(--text-muted)]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{value}</p></div>;
}

function OnboardingTurn({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  const assistant = role === "assistant";
  return (
    <article className={`relative overflow-hidden rounded-2xl border p-4 pl-5 ${assistant ? "border-cyan-300/18 bg-[linear-gradient(180deg,rgba(8,18,32,0.78),rgba(4,9,18,0.90))]" : "border-cyan-300/8 bg-black/12"}`}>
      <div className={`absolute inset-y-4 left-0 w-px ${assistant ? "bg-gradient-to-b from-cyan-200/20 via-cyan-200/70 to-transparent" : "bg-slate-400/18"}`} aria-hidden="true" />
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${assistant ? "text-cyan-200/75" : "text-[var(--text-muted)]"}`}>{assistant ? "NEXTRON" : "You"}</p>
      <p className={`mt-2 break-words text-sm leading-relaxed ${pending ? "text-cyan-50/75" : assistant ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}`}>{content}</p>
    </article>
  );
}

function UnderstandingPanel({ understanding }: { understanding: Understanding }) {
  return (
    <section className="nextron-surface rounded-[1.5rem] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/60">What I understand</p>
      <h2 className="mt-1 text-sm font-semibold text-[var(--text)]">Current picture</h2>
      <div className="mt-4 space-y-3">
        <UnderstandingSection title="Right now" items={understanding.currentSituation} empty="Waiting for your first context." />
        <UnderstandingSection title="What matters most" items={[...understanding.priorities, ...understanding.goals].slice(0, 4)} empty="NEXTRON has not identified priorities yet." />
        <UnderstandingSection title="Constraints" items={[...understanding.constraints, ...understanding.deadlines].slice(0, 4)} empty="No constraints identified yet." />
        <UnderstandingSection title="Friction" items={understanding.frictionPoints} empty="No friction points identified yet." />
      </div>
    </section>
  );
}

function UnderstandingSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{title}</p>{items.length > 0 ? <ul className="mt-2 space-y-1.5">{items.map((item) => <li key={item} className="break-words rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">{item}</li>)}</ul> : <p className="mt-2 rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-2 text-xs text-[var(--text-muted)]">{empty}</p>}</div>;
}

function DraftWaitingPanel() {
  return <section className="nextron-surface rounded-[1.5rem] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/60">Life Setup Draft</p><h2 className="mt-1 text-sm font-semibold text-[var(--text)]">Not ready yet</h2><p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">NEXTRON will propose a compact setup once it understands your outcomes, near-term priorities, and real constraints. Unknown nonessential details will be left out instead of forcing questions.</p></section>;
}

function DraftPanel({
  draft,
  proposal,
  proposalStatus,
  setupPermissionsGranted,
  onComplete,
  onBuildPlan,
  onGrantPermissions,
  onApprovePlan,
  onCancelPlan,
  busy,
}: {
  draft: LifeSetupDraft;
  proposal: ActionProposal | null;
  proposalStatus: "idle" | "building" | "granting" | "approving" | "cancelling" | "error";
  setupPermissionsGranted: boolean;
  onComplete: () => void;
  onBuildPlan: () => void;
  onGrantPermissions: () => void;
  onApprovePlan: () => void;
  onCancelPlan: () => void;
  busy: boolean;
}) {
  const pending = proposal?.status === "pending";
  const completed = proposal?.status === "completed" || proposal?.status === "partially_failed";
  return (
    <section className="nextron-surface rounded-[1.5rem] p-4" data-nextron-onboarding-draft="true">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/60">Life Setup Draft</p>
      <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">Your plan is ready to build.</h2>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">Marking this ready does not create goals, habits, tasks, projects, or calendar events. It confirms the draft for the next step.</p>
      <div className="mt-4 space-y-4">
        <DraftList title="Current focus" items={draft.currentFocus} />
        <DraftCards title="Recommended goals" items={draft.goals.map((goal) => `${goal.title} — ${goal.why} (${goal.horizon}, ${goal.priority})`)} />
        <DraftCards title="Starter habits" items={draft.starterHabits.map((habit) => `${habit.title} — ${habit.frequency}. ${habit.why}`)} />
        <DraftCards title="Initial tasks" items={draft.initialTasks.map((task) => `${task.title} — ${task.why}`)} />
        {draft.projects.length > 0 && <DraftCards title="Projects" items={draft.projects.map((project) => `${project.title} — ${project.desiredOutcome}. Next: ${project.nextMilestone}`)} />}
        <DraftCards title="Routines" items={draft.routines.map((routine) => `${routine.title} — ${routine.cadence}. ${routine.description}`)} />
        {draft.importantDates.length > 0 && <DraftCards title="Important dates / constraints" items={draft.importantDates.map((date) => `${date.label} — ${date.timing}. ${date.why}`)} />}
        <DraftCards title="Deliberately left out" items={draft.deliberatelyLeftOut.map((item) => `${item.item} — ${item.reason}`)} muted />
      </div>
      {!proposal && <div className="mt-4 flex flex-col gap-2">
        <button type="button" onClick={onComplete} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50/85 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">{busy ? "Marking ready..." : "Looks right - setup ready"}</button>
        <button type="button" onClick={onBuildPlan} disabled={proposalStatus === "building"} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-cyan-200 disabled:translate-y-0 disabled:opacity-50">{proposalStatus === "building" ? "Preparing preview..." : "Build my Life Pulse"}</button>
      </div>}
      {proposal && <div className="mt-5 rounded-2xl border border-cyan-300/18 bg-black/18 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Action Plan Preview</p>
        <h3 className="mt-1 text-base font-semibold text-[var(--text)]">{proposal.preview.heading}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{proposal.description}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {proposal.preview.fields.map((field) => <div key={field.label} className="rounded-xl border border-cyan-300/10 bg-cyan-300/8 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{field.label}</p><p className="mt-1 text-sm font-semibold text-[var(--text)]">{field.after}</p></div>)}
        </div>
        {!completed && <div className="mt-4 rounded-xl border border-cyan-300/12 bg-black/15 p-3">
          <p className="text-xs font-semibold text-[var(--text)]">Permission review</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">To build this setup, NEXTRON needs permission to make approved changes to Goals, Habits, Projects, and Tasks. This does not allow autonomous changes; the preview still requires approval.</p>
          <button type="button" onClick={onGrantPermissions} disabled={proposalStatus === "granting"} className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50/85 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">{proposalStatus === "granting" ? "Saving permissions..." : "Grant approved-write permissions"}</button>
        </div>}
        <p className="mt-3 text-xs text-[var(--text-muted)]">Status: {proposal.status.replace(/_/g, " ")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onApprovePlan} disabled={!pending || !setupPermissionsGranted || proposalStatus === "approving"} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-cyan-200 disabled:translate-y-0 disabled:opacity-50">{proposalStatus === "approving" ? "Applying..." : setupPermissionsGranted ? proposal.preview.approvalLabel : "Grant permissions first"}</button>
          <button type="button" onClick={onCancelPlan} disabled={!pending || proposalStatus === "cancelling"} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)] transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">Cancel</button>
        </div>
        {completed && <div className="mt-4 space-y-3 rounded-xl border border-[var(--success)]/25 bg-[var(--success-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--success)]">
          <p>Your Life Pulse is ready. Enter the app to review the created structure and ask NEXTRON what to do today.</p>
          <button type="button" onClick={onComplete} disabled={busy} className="inline-flex min-h-10 items-center rounded-xl bg-[var(--success)] px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">{busy ? "Entering..." : "Enter Life Pulse"}</button>
        </div>}
      </div>}
    </section>
  );
}

function DraftList({ title, items }: { title: string; items: string[] }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/65">{title}</p><ol className="mt-2 space-y-1.5">{items.map((item, index) => <li key={`${item}-${index}`} className="break-words rounded-xl border border-cyan-300/10 bg-cyan-300/8 px-3 py-2 text-xs leading-relaxed text-[var(--text)]">{index + 1}. {item}</li>)}</ol></div>;
}

function DraftCards({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/65">{title}</p><div className="mt-2 grid gap-2">{items.map((item) => <div key={item} className={`break-words rounded-xl border px-3 py-2 text-xs leading-relaxed ${muted ? "border-[var(--border)] bg-black/12 text-[var(--text-muted)]" : "border-cyan-300/10 bg-black/15 text-[var(--text-secondary)]"}`}>{item}</div>)}</div></div>;
}
