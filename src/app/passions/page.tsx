"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { useToast } from "@/hooks/use-toast";
import { PulseCard } from "@/components/ui/pulse-card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  Passion, PassionFormData,
  PassionSession, SessionFormData,
  PassionMilestone, MilestoneFormData,
} from "@/lib/passions";
import { PASSION_CATEGORIES, SKILL_LEVELS, getWeekStart } from "@/lib/passions";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "passions", label: "My Passions" },
  { id: "sessions", label: "Sessions" },
  { id: "milestones", label: "Milestones" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PassionContent() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const [passions, setPassions] = useState<Passion[]>([]);
  const [sessions, setSessions] = useState<PassionSession[]>([]);
  const [milestones, setMilestones] = useState<PassionMilestone[]>([]);
  const [passionMap, setPassionMap] = useState<Record<string, Passion>>({});

  // Overview stats
  const activePassions = passions.filter((p) => p.status === "active");
  const weekStart = getWeekStart();
  const weekSessions = sessions.filter((s) => s.session_date >= weekStart);
  const weekMinutes = weekSessions.reduce((s, se) => s + (se.duration_minutes ?? 0), 0);
  const completedMilestones = milestones.filter((m) => m.completed_at);

  // Forms
  const [passionForm, setPassionForm] = useState<PassionFormData>({
    name: "", category: "Other", description: "", skill_level: "Beginner", target_hours_per_week: null,
  });
  const [sessionForm, setSessionForm] = useState<SessionFormData>({
    passion_id: "", duration_minutes: null, focus: "", notes: "", enjoyment: null, difficulty: null,
  });
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormData>({
    passion_id: "", title: "", description: "", target_date: "",
  });
  const [editPassionId, setEditPassionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PassionFormData>({
    name: "", category: "Other", description: "", skill_level: "Beginner", target_hours_per_week: null,
  });

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setCurrentUser(user);

    const [pRes, sRes, mRes] = await Promise.all([
      supabase.from("passions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("passion_sessions").select("*").eq("user_id", user.id).order("session_date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
      supabase.from("passion_milestones").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const pData = (pRes.data ?? []) as Passion[];
    const sData = (sRes.data ?? []) as PassionSession[];
    const mData = (mRes.data ?? []) as PassionMilestone[];

    setPassions(pData);
    setSessions(sData);
    setMilestones(mData);
    setPassionMap(Object.fromEntries(pData.map((p) => [p.id, p])));
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await loadAll();
      if (cancelled) return;
    };
    init();
    return () => { cancelled = true; };
  }, [loadAll]);

  // ── Passion CRUD ─────────────────────────────────────────────────────────────

  const handleSavePassion = async () => {
    if (!passionForm.name.trim() || !currentUser) return;
    setSaving(true);
    const { error } = await supabase.from("passions").insert({
      user_id: currentUser.id,
      name: passionForm.name,
      category: passionForm.category || null,
      description: passionForm.description || null,
      skill_level: passionForm.skill_level || null,
      target_hours_per_week: passionForm.target_hours_per_week,
    });
    if (error) { console.error("Failed to save passion", error); toast({ type: "error", title: "Failed to save passion" }); setSaving(false); return; }
    toast({ type: "success", title: "Passion added!" });
    setPassionForm({ name: "", category: "Other", description: "", skill_level: "Beginner", target_hours_per_week: null });
    loadAll();
    setSaving(false);
  };

  const handleStartEdit = (p: Passion) => {
    setEditPassionId(p.id);
    setEditForm({
      name: p.name, category: p.category ?? "Other", description: p.description ?? "",
      skill_level: p.skill_level ?? "Beginner", target_hours_per_week: p.target_hours_per_week,
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editPassionId) return;
    setSaving(true);
    const { error } = await supabase.from("passions").update({
      name: editForm.name, category: editForm.category || null, description: editForm.description || null,
      skill_level: editForm.skill_level || null, target_hours_per_week: editForm.target_hours_per_week,
    }).eq("id", editPassionId);
    if (error) { toast({ type: "error", title: "Failed to update" }); setSaving(false); return; }
    toast({ type: "success", title: "Passion updated!" });
    setEditPassionId(null);
    loadAll();
    setSaving(false);
  };

  const handleDeletePassion = async (id: string) => {
    const { error } = await supabase.from("passions").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Passion deleted" });
    setPassions((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Session CRUD ─────────────────────────────────────────────────────────────

  const handleSaveSession = async () => {
    if (!sessionForm.passion_id || !currentUser) return;
    setSaving(true);
    const { error } = await supabase.from("passion_sessions").insert({
      user_id: currentUser.id,
      passion_id: sessionForm.passion_id, duration_minutes: sessionForm.duration_minutes,
      focus: sessionForm.focus || null, notes: sessionForm.notes || null,
      enjoyment: sessionForm.enjoyment, difficulty: sessionForm.difficulty,
    });
    if (error) { console.error("Failed to log session", error); toast({ type: "error", title: "Failed to log session" }); setSaving(false); return; }
    toast({ type: "success", title: "Session logged!" });
    setSessionForm({ passion_id: "", duration_minutes: null, focus: "", notes: "", enjoyment: null, difficulty: null });
    loadAll();
    setSaving(false);
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await supabase.from("passion_sessions").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Session deleted" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Milestone CRUD ───────────────────────────────────────────────────────────

  const handleSaveMilestone = async () => {
    if (!milestoneForm.passion_id || !milestoneForm.title.trim() || !currentUser) return;
    setSaving(true);
    const { error } = await supabase.from("passion_milestones").insert({
      user_id: currentUser.id,
      passion_id: milestoneForm.passion_id, title: milestoneForm.title,
      description: milestoneForm.description || null, target_date: milestoneForm.target_date || null,
    });
    if (error) { console.error("Failed to add milestone", error); toast({ type: "error", title: "Failed to add milestone" }); setSaving(false); return; }
    toast({ type: "success", title: "Milestone added!" });
    setMilestoneForm({ passion_id: "", title: "", description: "", target_date: "" });
    loadAll();
    setSaving(false);
  };

  const handleCompleteMilestone = async (id: string) => {
    const { error } = await supabase.from("passion_milestones").update({ completed_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to update" }); return; }
    toast({ type: "success", title: "Milestone completed!" });
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, completed_at: new Date().toISOString() } : m));
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return null;

  return (
    <div className="animate-fade-in overflow-x-hidden px-4 py-5 md:p-6">
      <div className="mx-auto max-w-5xl min-w-0">
        <div className="mb-6 min-w-0">
          <h1 className="break-words text-2xl font-bold text-[var(--text)]">Passions</h1>
          <p className="break-words text-sm text-[var(--text-muted)]">Your hobbies, skills, and creative pursuits.</p>
        </div>

        {/* Tab Bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-soft)] p-1 [-webkit-overflow-scrolling:touch]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs font-medium transition-all sm:min-h-0 sm:flex-1 ${
                activeTab === tab.id
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════ OVERVIEW ════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
             <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="relative min-w-0 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg-elevated)] p-3">
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]" />
                <MetricCard label="Active Passions" value={activePassions.length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              } trend={activePassions.length > 0 ? "up" : "neutral"} active={activePassions.length > 0} />
              </div>
              <div className="relative min-w-0 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg-elevated)] p-3">
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]" />
                <MetricCard label="Sessions / Week" value={weekSessions.length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              } trend={weekSessions.length > 0 ? "up" : "neutral"} active={weekSessions.length > 0} />
              </div>
              <div className="relative min-w-0 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg-elevated)] p-3">
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]" />
                <MetricCard label="Practice Min" value={weekMinutes} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              } trend={weekMinutes > 0 ? "up" : "neutral"} active={weekMinutes > 0} />
              </div>
              <div className="relative min-w-0 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg-elevated)] p-3">
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]" />
                <MetricCard label="Milestones" value={completedMilestones.length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              } trend={completedMilestones.length > 0 ? "up" : "neutral"} active={completedMilestones.length > 0} />
              </div>
            </div>

            {activePassions.length === 0 && (
              <PulseCard title="Passions" accent="accent">
                <EmptyState title="Passions" message="No passions yet. Hobbies and skills you actively practice — music, sports, coding, art, or anything you want to grow in." action={<Link href="/passions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add your first passion &rarr;</Link>} />
              </PulseCard>
            )}

            {activePassions.length > 0 && (
              <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
                <PulseCard title="Active Passions" accent="accent" description={`${activePassions.length} total`}>
                  <div className="divide-y divide-[var(--border)]">
                    {activePassions.map((p) => {
                      const pSessions = sessions.filter((s) => s.passion_id === p.id);
                      const pWeekSessions = pSessions.filter((s) => s.session_date >= weekStart);
                      const pWeekMin = pWeekSessions.reduce((s, se) => s + (se.duration_minutes ?? 0), 0);
                      return (
                         <div key={p.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <span className="break-words text-xs font-medium text-[var(--text)]">{p.name}</span>
                            <span className="break-words text-[10px] text-[var(--text-muted)]">
                              {p.category ?? "Uncategorized"} &middot; {p.skill_level ?? "N/A"}
                            </span>
                          </div>
                          <div className="shrink-0 sm:text-right">
                            <span className="text-xs font-medium text-[var(--text)]">{pWeekMin} min</span>
                            <p className="text-[9px] text-[var(--text-muted)]">{pSessions.length} total sessions</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </PulseCard>

                {weekSessions.length > 0 && (
                  <PulseCard title="This Week" accent="accent">
                    <div className="divide-y divide-[var(--border)]">
                      {weekSessions.slice(0, 5).map((s) => {
                        const p = passionMap[s.passion_id];
                        return (
                          <div key={s.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex flex-col gap-0.5">
                              <span className="break-words text-xs text-[var(--text)]">{p?.name ?? "Unknown"}</span>
                              {s.focus && <span className="break-words text-[10px] text-[var(--text-muted)]">{s.focus}</span>}
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">
                              {s.duration_minutes !== null ? `${s.duration_minutes} min` : "\u2014"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </PulseCard>
                )}

                {completedMilestones.length > 0 && (
                  <PulseCard title="Completed Milestones" accent="success">
                    <div className="divide-y divide-[var(--border)]">
                      {completedMilestones.slice(0, 5).map((m) => {
                        const p = passionMap[m.passion_id];
                        return (
                          <div key={m.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="min-w-0 break-words text-xs text-[var(--text)]">{p?.name ?? "Unknown"} &rarr; {m.title}</span>
                            <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                              {m.completed_at ? new Date(m.completed_at).toLocaleDateString() : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </PulseCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ MY PASSIONS ════════════════ */}
        {activeTab === "passions" && (
          <div className="space-y-6">
            <PulseCard title="Add Passion" accent="accent">
              <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4">
                <input type="text" placeholder="Passion name" value={passionForm.name}
                  onChange={(e) => setPassionForm((f) => ({ ...f, name: e.target.value }))}
                  className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] sm:col-span-2 sm:min-h-0 sm:py-2" />
                <div className="min-w-0 flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[var(--text-muted)]">Category</label>
                  <select value={passionForm.category} onChange={(e) => setPassionForm((f) => ({ ...f, category: e.target.value }))}
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                    {PASSION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[var(--text-muted)]">Skill Level</label>
                  <select value={passionForm.skill_level} onChange={(e) => setPassionForm((f) => ({ ...f, skill_level: e.target.value }))}
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                    {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[var(--text-muted)]">Target hrs/week</label>
                  <input type="number" min={0} step={0.5} placeholder="hrs"
                    value={passionForm.target_hours_per_week ?? ""}
                    onChange={(e) => setPassionForm((f) => ({ ...f, target_hours_per_week: e.target.value ? Number(e.target.value) : null }))}
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2" />
                </div>
                <textarea placeholder="Description" value={passionForm.description}
                  onChange={(e) => setPassionForm((f) => ({ ...f, description: e.target.value }))}
                  className="min-h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2" rows={2} />
                <div className="flex justify-stretch sm:col-span-2 sm:justify-end">
                  <button onClick={handleSavePassion} disabled={saving || !passionForm.name.trim()}
                    className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2">
                    {saving ? "Saving..." : "Save Passion"}
                  </button>
                </div>
              </div>
            </PulseCard>

            {passions.length === 0 && (
              <PulseCard title="Your Passions" accent="accent">
                <EmptyState title="My Passions" message="No passions created yet." action={<Link href="/passions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add a passion &rarr;</Link>} />
              </PulseCard>
            )}

            {passions.length > 0 && (
              <PulseCard title="Your Passions" accent="accent" description={`${passions.length} total`}>
                <div className="divide-y divide-[var(--border)]">
                  {passions.map((p) => (
                    <div key={p.id}>
                      <div className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 break-words text-xs font-medium text-[var(--text)]">{p.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.status === "active" ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-soft)] text-[var(--text-muted)]"
                            }`}>
                              {p.status ?? "active"}
                            </span>
                          </div>
                          <span className="break-words text-[10px] text-[var(--text-muted)]">
                            {p.category ?? "Uncategorized"} &middot; {p.skill_level ?? "N/A"}
                            {p.target_hours_per_week !== null && ` \u00b7 target ${p.target_hours_per_week}h/wk`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          {editPassionId === p.id ? (
                            <button onClick={handleSaveEdit} disabled={saving}
                              className="min-h-8 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--accent)] hover:underline sm:min-h-0 sm:px-0 sm:py-0">Save</button>
                          ) : (
                            <button onClick={() => handleStartEdit(p)}
                              className="min-h-8 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] sm:min-h-0 sm:px-0 sm:py-0">Edit</button>
                          )}
                          {editPassionId !== p.id && (
                            <button onClick={() => handleDeletePassion(p.id)}
                              className="min-h-8 rounded-md px-2 py-1 text-[10px] text-[var(--danger)] hover:underline sm:min-h-0 sm:px-0 sm:py-0">Delete</button>
                          )}
                        </div>
                      </div>
                      {editPassionId === p.id && (
                        <div className="border-t border-[var(--border)] p-4">
                          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                            <input type="text" placeholder="Name" value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2" />
                            <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                              {PASSION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={editForm.skill_level} onChange={(e) => setEditForm((f) => ({ ...f, skill_level: e.target.value }))}
                              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                            <input type="number" min={0} step={0.5} placeholder="Target hrs/week" value={editForm.target_hours_per_week ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, target_hours_per_week: e.target.value ? Number(e.target.value) : null }))}
                              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2" />
                            <textarea placeholder="Description" value={editForm.description}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                              className="min-h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2" rows={2} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </PulseCard>
            )}
          </div>
        )}

        {/* ════════════════ SESSIONS ════════════════ */}
        {activeTab === "sessions" && (
          <div className="space-y-6">
            {passions.length === 0 ? (
              <PulseCard title="Log Session" accent="accent">
                <EmptyState title="No passions yet" message="Create a passion first, then log sessions to track your practice time and progress." action={<Link href="/passions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add a passion &rarr;</Link>} />
              </PulseCard>
            ) : (
              <PulseCard title="Log Session" accent="accent">
                <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4">
                  <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] font-medium text-[var(--text-muted)]">Passion</label>
                    <select value={sessionForm.passion_id} onChange={(e) => setSessionForm((f) => ({ ...f, passion_id: e.target.value }))}
                      className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                      <option value="">Select...</option>
                      {activePassions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <input type="number" min={0} placeholder="Duration (min)" value={sessionForm.duration_minutes ?? ""}
                    onChange={(e) => setSessionForm((f) => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : null }))}
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2" />
                  <input type="text" placeholder="Focus area" value={sessionForm.focus}
                    onChange={(e) => setSessionForm((f) => ({ ...f, focus: e.target.value }))}
                    data-testid="passion-session-focus-input"
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2" />
                  <div className="min-w-0 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[var(--text-muted)]">Enjoyment (1-5)</label>
                    <select value={sessionForm.enjoyment ?? ""} onChange={(e) => setSessionForm((f) => ({ ...f, enjoyment: e.target.value ? Number(e.target.value) : null }))}
                      className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                      <option value="">--</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-[var(--text-muted)]">Difficulty (1-5)</label>
                    <select value={sessionForm.difficulty ?? ""} onChange={(e) => setSessionForm((f) => ({ ...f, difficulty: e.target.value ? Number(e.target.value) : null }))}
                      className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                      <option value="">--</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <textarea placeholder="Notes" value={sessionForm.notes}
                    onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))}
                    className="min-h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2" rows={2} />
                  <div className="flex justify-stretch sm:col-span-2 sm:justify-end">
                    <button onClick={handleSaveSession} disabled={saving || !sessionForm.passion_id}
                      className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2">
                      {saving ? "Saving..." : "Log Session"}
                    </button>
                  </div>
                </div>
              </PulseCard>
            )}

            {sessions.length === 0 && (
              <PulseCard title="Recent Sessions" accent="accent">
                <EmptyState title="Recent Sessions" message="No sessions logged yet. Log your first practice session to start tracking time spent on your passions." action={<Link href="/passions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Log a session &rarr;</Link>} />
              </PulseCard>
            )}

            {sessions.length > 0 && (
              <PulseCard title="Recent Sessions" accent="accent" description={`${sessions.length} total`}>
                <div data-testid="passion-sessions-list" className="divide-y divide-[var(--border)]">
                  {sessions.map((s) => {
                    const p = passionMap[s.passion_id];
                    return (
                      <div key={s.id} className="group flex min-w-0 flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 break-words text-xs font-medium text-[var(--text)]">{p?.name ?? "Unknown"}</span>
                            {s.focus && <span className="break-words text-[10px] text-[var(--text-muted)]">{s.focus}</span>}
                          </div>
                          <span className="break-words text-[10px] text-[var(--text-muted)]">
                            {new Date(s.session_date).toLocaleDateString()}
                            {s.enjoyment !== null && ` \u00b7 Enjoyment ${s.enjoyment}/5`}
                            {s.difficulty !== null && ` \u00b7 Difficulty ${s.difficulty}/5`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {s.duration_minutes !== null ? `${s.duration_minutes} min` : ""}
                          </span>
                          <button onClick={() => handleDeleteSession(s.id)}
                            className="min-h-8 rounded-md px-2 py-1 text-[10px] text-[var(--danger)] opacity-100 transition-opacity sm:min-h-0 sm:px-0 sm:py-0 sm:opacity-0 sm:group-hover:opacity-100">Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PulseCard>
            )}
          </div>
        )}

        {/* ════════════════ MILESTONES ════════════════ */}
        {activeTab === "milestones" && (
          <div className="space-y-6">
            {passions.length === 0 ? (
              <PulseCard title="Add Milestone" accent="success">
                <EmptyState title="No passions yet" message="Create a passion first, then set milestones to mark progress on your journey." action={<Link href="/passions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add a passion &rarr;</Link>} />
              </PulseCard>
            ) : (
              <PulseCard title="Add Milestone" accent="success">
                <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4">
                  <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] font-medium text-[var(--text-muted)]">Passion</label>
                    <select value={milestoneForm.passion_id} onChange={(e) => setMilestoneForm((f) => ({ ...f, passion_id: e.target.value }))}
                      className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2">
                      <option value="">Select...</option>
                      {activePassions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <input type="text" placeholder="Title" value={milestoneForm.title}
                    onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2" />
                  <input type="date" placeholder="Target date" value={milestoneForm.target_date}
                    onChange={(e) => setMilestoneForm((f) => ({ ...f, target_date: e.target.value }))}
                    className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2" />
                  <textarea placeholder="Description" value={milestoneForm.description}
                    onChange={(e) => setMilestoneForm((f) => ({ ...f, description: e.target.value }))}
                    className="min-h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2" rows={2} />
                  <div className="flex justify-stretch sm:col-span-2 sm:justify-end">
                    <button onClick={handleSaveMilestone} disabled={saving || !milestoneForm.passion_id || !milestoneForm.title.trim()}
                      className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2">
                      {saving ? "Saving..." : "Add Milestone"}
                    </button>
                  </div>
                </div>
              </PulseCard>
            )}

            {milestones.length === 0 && (
              <PulseCard title="Milestones" accent="success">
                <EmptyState title="Milestones" message="No milestones yet. Set your first milestone to mark an achievement on your journey." action={<Link href="/passions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add a milestone &rarr;</Link>} />
              </PulseCard>
            )}

            {milestones.length > 0 && (
              <PulseCard title="Milestones" accent="success" description={`${completedMilestones.length}/${milestones.length} completed`}>
                <div className="divide-y divide-[var(--border)]">
                  {milestones.map((m) => {
                    const p = passionMap[m.passion_id];
                    const isDone = !!m.completed_at;
                    return (
                      <div key={m.id} className="group flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          {!isDone ? (
                            <button onClick={() => handleCompleteMilestone(m.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[var(--text-muted)]/40 transition-all hover:border-[var(--success)] hover:bg-[var(--success-soft)] sm:h-5 sm:w-5">
                              <svg className="h-3 w-3 text-transparent group-hover:text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] sm:h-5 sm:w-5">
                              <svg className="h-3 w-3 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <span className={`text-xs font-medium ${isDone ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
                              {m.title}
                            </span>
                            <span className="break-words text-[10px] text-[var(--text-muted)]">
                              {p?.name ?? "Unknown"}
                              {m.target_date && ` \u00b7 by ${new Date(m.target_date).toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>
                        {m.description && !isDone && (
                          <span className="break-words text-[10px] text-[var(--text-muted)] sm:max-w-[200px] sm:truncate">{m.description}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </PulseCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PassionsPage() {
  return (
    <DashboardNav>
      <PassionContent />
    </DashboardNav>
  );
}
