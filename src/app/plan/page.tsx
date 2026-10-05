"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getLocalTodayDateString } from "@lifepulse/domain";
import {
  MAX_WEEKLY_OUTCOMES,
  getCurrentPlanWeekRange,
  nextOutcomePosition,
  orderOutcomes,
  summarizePlanEvidence,
  type WeeklyOutcome,
  type WeeklyPlanLink,
  type WeeklyPlanSnapshot,
} from "@lifepulse/domain";
import {
  addPlanLink,
  addWeeklyOutcome,
  createWeeklyPlan,
  deleteWeeklyOutcome,
  loadPlanLinkOptions,
  loadWeeklyPlan,
  removePlanLink,
  setMustWin,
  updatePlanIntention,
  updateWeeklyOutcome,
  type PlanOption,
} from "@/lib/plan";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";

interface EvidenceState {
  tasks: { id: string; status: string }[];
  habitLogs: { habit_id: string; completed_date: string }[];
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

function PlanContent() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { toast } = useToast();
  const requestSeq = useRef(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WeeklyPlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<{ goals: PlanOption[]; projects: PlanOption[]; tasks: PlanOption[]; habits: PlanOption[] } | null>(null);
  const [evidence, setEvidence] = useState<EvidenceState>({ tasks: [], habitLogs: [] });
  const [outcomeInput, setOutcomeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingIntention, setEditingIntention] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState("");
  const [linkingOutcomeId, setLinkingOutcomeId] = useState<string | null>(null);

  const week = useMemo(() => getCurrentPlanWeekRange(getLocalTodayDateString()), []);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(!snapshot);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (seq !== requestSeq.current) return;
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      const loaded = await loadWeeklyPlan(supabase, user.id, week.weekStart);
      if (seq !== requestSeq.current) return;
      setSnapshot(loaded);
      if (loaded) {
        const [opts, tasksRes, logsRes] = await Promise.all([
          loadPlanLinkOptions(supabase, user.id),
          supabase.from("tasks").select("id, status").eq("user_id", user.id).in("id", loaded.links.filter((l) => l.linked_type === "task").map((l) => l.linked_id)),
          supabase.from("habit_logs").select("habit_id, completed_date").eq("user_id", user.id).gte("completed_date", week.weekStart).lte("completed_date", week.weekEnd),
        ]);
        if (seq !== requestSeq.current) return;
        setOptions(opts);
        setEvidence({
          tasks: ((tasksRes.data ?? []) as { id: string; status: string }[]),
          habitLogs: ((logsRes.data ?? []) as { habit_id: string; completed_date: string }[]),
        });
      }
    } catch {
      if (seq !== requestSeq.current) return;
      setLoadError("Couldn't load your plan.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router, week.weekStart, week.weekEnd]);

  useEffect(() => {
    void refresh();
    return () => {
      requestSeq.current += 1;
    };
  }, [refresh]);

  async function handleStartPlan() {
    if (!userId || saving) return;
    setSaving(true);
    const plan = await createWeeklyPlan(supabase, userId, week.weekStart);
    if (!plan) {
      toast({ type: "error", title: "Couldn't start your plan." });
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
  }

  async function handleAddOutcome() {
    if (!snapshot || !outcomeInput.trim() || saving) return;
    setSaving(true);
    const created = await addWeeklyOutcome(supabase, snapshot, outcomeInput.trim());
    if (!created) {
      toast({ type: "error", title: "Couldn't add that outcome." });
    } else {
      setOutcomeInput("");
    }
    await refresh();
    setSaving(false);
  }

  async function handleToggleDone(outcome: WeeklyOutcome) {
    if (!userId) return;
    await updateWeeklyOutcome(supabase, userId, outcome, { done: !outcome.done });
    await refresh();
  }

  async function handleMustWin(outcome: WeeklyOutcome) {
    if (!snapshot || !userId) return;
    const next = outcome.must_win ? null : outcome.id;
    const ok = await setMustWin(supabase, userId, snapshot.plan.id, next, snapshot.outcomes);
    if (!ok) toast({ type: "error", title: "Couldn't update Must Win." });
    await refresh();
  }

  async function handleDeleteOutcome(outcome: WeeklyOutcome) {
    if (!userId) return;
    await deleteWeeklyOutcome(supabase, userId, outcome.id);
    await refresh();
  }

  async function handleLinkGoal(outcome: WeeklyOutcome, goalId: string) {
    if (!userId) return;
    await updateWeeklyOutcome(supabase, userId, outcome, { goal_id: goalId || null });
    await refresh();
  }

  async function handleLinkProject(outcome: WeeklyOutcome, projectId: string) {
    if (!userId) return;
    await updateWeeklyOutcome(supabase, userId, outcome, { project_id: projectId || null });
    await refresh();
  }

  async function handleToggleLink(type: "task" | "habit", id: string) {
    if (!snapshot || !userId) return;
    const existing = snapshot.links.find((l) => l.linked_type === type && l.linked_id === id);
    if (existing) {
      await removePlanLink(supabase, userId, existing.id);
    } else {
      await addPlanLink(supabase, userId, snapshot.plan.id, type, id);
    }
    await refresh();
  }

  async function handleSaveIntention() {
    if (!snapshot || !userId) return;
    await updatePlanIntention(supabase, userId, snapshot.plan.id, intentionDraft);
    setEditingIntention(false);
    await refresh();
  }

  const outcomes = useMemo(
    () => (snapshot ? orderOutcomes(snapshot.outcomes) : []),
    [snapshot],
  );
  const mustWin = outcomes.find((o) => o.must_win) ?? null;
  const planEvidence = useMemo(
    () => (snapshot ? summarizePlanEvidence(snapshot, evidence.tasks, evidence.habitLogs) : null),
    [snapshot, evidence],
  );
  const canAddMore = snapshot !== null && nextOutcomePosition(outcomes) !== null;
  const linkedTaskIds = useMemo(() => new Set(snapshot?.links.filter((l) => l.linked_type === "task").map((l) => l.linked_id) ?? []), [snapshot]);
  const linkedHabitIds = useMemo(() => new Set(snapshot?.links.filter((l) => l.linked_type === "habit").map((l) => l.linked_id) ?? []), [snapshot]);

  const goalTitle = (id: string | null) => options?.goals.find((g) => g.id === id)?.title ?? null;
  const projectTitle = (id: string | null) => options?.projects.find((p) => p.id === id)?.title ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-fade-in sm:px-6 sm:py-9">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Plan</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[var(--text)] sm:text-5xl">This week</h1>
          <p className="text-sm text-[var(--text-muted)]">{formatWeekRange(week.weekStart, week.weekEnd)}</p>
        </div>
      </header>

      {loading && !snapshot && (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">Loading your plan...</p>
      )}

      {loadError && !snapshot && (
        <Card variant="subtle" className="border-[var(--danger)]/30 px-4 py-6 text-center">
          <p className="text-sm text-[var(--danger)]">{loadError}</p>
          <Button size="sm" className="mt-3" onClick={() => void refresh()}>Retry</Button>
        </Card>
      )}

      {!loading && !snapshot && !loadError && (
        <EmptyState
          eyebrow="Weekly plan"
          title="Plan your week"
          message="Decide what would make this week count. You can start with just one outcome."
          action={<Button onClick={() => void handleStartPlan()} disabled={saving}>{saving ? "Starting..." : "Plan this week"}</Button>}
          examples={
            <div className="mx-auto grid max-w-xl gap-2 text-left sm:grid-cols-3">
              {["Finish SAT geometry review", "Publish first outreach", "Complete 3 gym sessions"].map((example) => (
                <div key={example} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">{example}</div>
              ))}
            </div>
          }
        />
      )}

      {snapshot && (
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Weekly intention</p>
            {editingIntention ? (
              <div className="mt-2 flex gap-2">
                <Input value={intentionDraft} onChange={(e) => setIntentionDraft(e.target.value.slice(0, 120))} placeholder="One line for the week (optional)" />
                <Button size="sm" onClick={() => void handleSaveIntention()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingIntention(false)}>Cancel</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setIntentionDraft(snapshot.plan.intention ?? ""); setEditingIntention(true); }}
                className="mt-1 block w-full text-left text-lg text-[var(--text)]"
              >
                {snapshot.plan.intention || <span className="text-[var(--text-muted)]">Add an intention for the week (optional)</span>}
              </button>
            )}
          </Card>

          {mustWin && (
            <Card variant="elevated" className="border-[var(--accent)]/30 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Must win</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">{mustWin.text}</p>
            </Card>
          )}

          <section aria-labelledby="weekly-outcomes-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="weekly-outcomes-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Weekly outcomes</h2>
              <span className="text-xs text-[var(--text-muted)]">{outcomes.length}/{MAX_WEEKLY_OUTCOMES}</span>
            </div>
            <div className="space-y-3">
              {outcomes.map((outcome, index) => (
                <Card key={outcome.id} className="p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleDone(outcome)}
                      aria-label={`Mark outcome ${index + 1} ${outcome.done ? "not done" : "done"}`}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${outcome.done ? "border-[var(--success)] bg-[var(--success)]" : "border-[var(--text-muted)]/50 hover:border-[var(--accent)]"}`}
                    >
                      {outcome.done && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`break-words text-base font-medium ${outcome.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
                        <span className="mr-2 text-xs text-[var(--text-muted)]">{index + 1}</span>{outcome.text}
                      </p>
                      {(goalTitle(outcome.goal_id) || projectTitle(outcome.project_id)) && (
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                          {[goalTitle(outcome.goal_id), projectTitle(outcome.project_id)].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleMustWin(outcome)}
                          aria-pressed={outcome.must_win}
                          className={`inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors ${outcome.must_win ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                        >
                          {outcome.must_win ? "★ Must Win" : "Make Must Win"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkingOutcomeId(linkingOutcomeId === outcome.id ? null : outcome.id)}
                          className="inline-flex min-h-9 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        >
                          {linkingOutcomeId === outcome.id ? "Hide links" : "Goal / Project"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOutcome(outcome)}
                          className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--danger)]"
                        >
                          Remove
                        </button>
                      </div>
                      {linkingOutcomeId === outcome.id && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Goal</span>
                            <select
                              value={outcome.goal_id ?? ""}
                              onChange={(e) => void handleLinkGoal(outcome, e.target.value)}
                              className="min-h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text)]"
                            >
                              <option value="">No goal linked</option>
                              {(options?.goals ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Project</span>
                            <select
                              value={outcome.project_id ?? ""}
                              onChange={(e) => void handleLinkProject(outcome, e.target.value)}
                              className="min-h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text)]"
                            >
                              <option value="">No project linked</option>
                              {(options?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {canAddMore ? (
                <div className="flex gap-2">
                  <Input
                    value={outcomeInput}
                    onChange={(e) => setOutcomeInput(e.target.value.slice(0, 120))}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAddOutcome(); }}
                    placeholder={outcomes.length === 0 ? "What would make this week a win?" : "Add another outcome (optional)"}
                  />
                  <Button onClick={() => void handleAddOutcome()} disabled={!outcomeInput.trim() || saving}>Add</Button>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Three outcomes is the weekly maximum — depth beats breadth.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="supporting-heading">
            <h2 id="supporting-heading" className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Supporting</h2>
            {planEvidence && (
              <p className="mb-3 text-xs text-[var(--text-muted)]">
                {planEvidence.linkedTasksDone} of {planEvidence.linkedTasksTotal} linked tasks done
                {planEvidence.supportingHabitLogDays > 0 ? ` · habits logged ${planEvidence.supportingHabitLogDays} day${planEvidence.supportingHabitLogDays === 1 ? "" : "s"} this week` : ""}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Card variant="subtle" className="p-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Tasks</p>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {(options?.tasks ?? []).map((task) => {
                    const linked = linkedTaskIds.has(task.id);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => void handleToggleLink("task", task.id)}
                        aria-pressed={linked}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm ${linked ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--text)]" : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)]"}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${linked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-muted)]/50"}`}>
                          {linked && <span className="h-1 w-1 rounded-full bg-white" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      </button>
                    );
                  })}
                  {(options?.tasks ?? []).length === 0 && <p className="text-xs text-[var(--text-muted)]">No open tasks.</p>}
                </div>
              </Card>
              <Card variant="subtle" className="p-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Habits</p>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {(options?.habits ?? []).map((habit) => {
                    const linked = linkedHabitIds.has(habit.id);
                    return (
                      <button
                        key={habit.id}
                        type="button"
                        onClick={() => void handleToggleLink("habit", habit.id)}
                        aria-pressed={linked}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm ${linked ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--text)]" : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)]"}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${linked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-muted)]/50"}`}>
                          {linked && <span className="h-1 w-1 rounded-full bg-white" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{habit.title}</span>
                      </button>
                    );
                  })}
                  {(options?.habits ?? []).length === 0 && <p className="text-xs text-[var(--text-muted)]">No habits yet.</p>}
                </div>
              </Card>
            </div>
          </section>

          <Card variant="subtle" className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Next</p>
              <p className="text-sm text-[var(--text-secondary)]">Carry this week into today.</p>
            </div>
            <Link href="/today" prefetch className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-strong)]">
              Prepare today
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function PlanPage() {
  return (
    <DashboardNav>
      <PlanContent />
    </DashboardNav>
  );
}
