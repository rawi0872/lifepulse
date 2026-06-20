"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { RealmPicker } from "@/components/RealmPicker";
import { SelectPicker } from "@/components/SelectPicker";

import { HelpPopover } from "@/components/HelpPopover";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Realm {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  progress: number;
  realm_id: string | null;
  created_at: string;
  updated_at: string;
  realms: Realm | null;
}

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-[var(--success-soft)] text-[var(--success)]" },
  paused: { label: "Paused", className: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  completed: { label: "Completed", className: "bg-[var(--accent-soft)] text-[var(--accent)]" },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-[var(--danger)]",
  medium: "text-[var(--warning)]",
  low: "text-[var(--text-muted)]",
};

function getDueLabel(due_date: string | null): string | null {
  if (!due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_date + "T00:00:00");
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return null;
}

const TASK_TEMPLATES: Record<string, string[]> = {
  music: [
    "Define the exact skill or song to improve",
    "Practice for 30 minutes",
    "Record one short progress video",
    "Review weak spots",
    "Schedule the next practice block",
  ],
  body: [
    "Choose workout days",
    "Take starting measurements",
    "Complete first workout",
    "Prepare simple meal plan",
    "Track progress weekly",
  ],
  study: [
    "List topics to revise",
    "Create study blocks",
    "Solve one practice set",
    "Review mistakes",
    "Schedule mock exam",
  ],
  business: [
    "Define the target customer",
    "List the first MVP features",
    "Talk to one potential user",
    "Build first version",
    "Review feedback",
  ],
  generic: [
    "Define the outcome clearly",
    "Break it into first 3 tasks",
    "Set a next action",
    "Review progress this week",
  ],
};

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(guitar|music|singing|piano|drum|song|melody|band|solo|chord)\b/.test(lower)) return "music";
  if (/\b(workout|body|health|weight|gym|exercise|fitness|diet|run|lift|cardio|muscle)\b/.test(lower)) return "body";
  if (/\b(exam|study|physics|school|course|test|class|lesson|university|college|grade|subject)\b/.test(lower)) return "study";
  if (/\b(startup|business|money|client|revenue|launch|sell|market|invest|income|company)\b/.test(lower)) return "business";
  return "generic";
}

function guessRealm(text: string, realms: Realm[]): string {
  const lower = text.toLowerCase();
  for (const r of realms) {
    const rn = r.name.toLowerCase();
    if (/\b(music|guitar|singing|piano|song)\b/.test(lower) && /\b(music|guitar|song|piano|sing)\b/.test(rn)) return r.id;
    if (/\b(body|health|workout|gym|fitness|diet|exercise)\b/.test(lower) && /\b(body|health|fitness|wellness|gym|workout)\b/.test(rn)) return r.id;
    if (/\b(study|exam|school|college|course|learn|education|physics|math)\b/.test(lower) && /\b(mind|study|brain|education|intellect|school)\b/.test(rn)) return r.id;
    if (/\b(business|startup|money|revenue|company|income|finance|invest|career)\b/.test(lower) && /\b(career|business|finance|work|money|entrepreneur)\b/.test(rn)) return r.id;
    if (/\b(faith|prayer|religion|god|spiritual|bible|worship)\b/.test(lower) && /\b(faith|religion|spiritual|prayer)\b/.test(rn)) return r.id;
  }
  return "";
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [realmId, setRealmId] = useState("");
  const [status, setStatus] = useState("active");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [quickInput, setQuickInput] = useState("");
  const [quickDraft, setQuickDraft] = useState<{ title: string; realmId: string; category: string; suggestedTasks: string[] } | null>(null);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState<Set<number>>(new Set());

  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [projectsRes, tasksRes, realmsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("*, realms(name, color, icon)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, project_id")
          .eq("user_id", user.id)
          .not("project_id", "is", null),
        supabase
          .from("realms")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order"),
      ]);

      if (cancelled) return;
      if (projectsRes.data) setProjects(projectsRes.data as Project[]);
      if (tasksRes.data) setLinkedTasks(tasksRes.data as LinkedTask[]);
      if (realmsRes.data) setRealms(realmsRes.data as Realm[]);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tasksByProject = useMemo(() => {
    const map: Record<string, LinkedTask[]> = {};
    for (const t of linkedTasks) {
      if (!map[t.project_id]) map[t.project_id] = [];
      map[t.project_id].push(t);
    }
    return map;
  }, [linkedTasks]);

  function getProjectProgress(projectId: string): { done: number; total: number; percent: number } {
    const tasks = tasksByProject[projectId] ?? [];
    if (tasks.length === 0) {
      const p = projects.find((pr) => pr.id === projectId);
      return { done: 0, total: 0, percent: p?.progress ?? 0 };
    }
    const done = tasks.filter((t) => t.status === "done").length;
    return { done, total: tasks.length, percent: Math.round((done / tasks.length) * 100) };
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setRealmId("");
    setStatus("active");
    setDeadline("");
    setEditingId(null);
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description ?? "");
    setRealmId(p.realm_id ?? "");
    setStatus(p.status);
    setDeadline(p.deadline ?? "");
    setShowForm(true);
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !title.trim()) return;

    setSaving(true);
    setFeedback(null);

    const payload: Record<string, unknown> = {
      user_id: user.id,
      realm_id: realmId || null,
      title: title.trim(),
      description: description.trim() || null,
      deadline: deadline || null,
    };

    if (editingId) {
      payload.status = status;
      const { error: err } = await supabase.from("projects").update(payload).eq("id", editingId);
      if (err) { setFeedback({ type: "error", message: err.message }); setSaving(false); return; }
    } else {
      payload.status = "active";
      const { error: err } = await supabase.from("projects").insert(payload);
      if (err) { setFeedback({ type: "error", message: err.message }); setSaving(false); return; }
    }

    resetForm();
    setShowForm(false);
    setSaving(false);
    setFeedback({ type: "success", message: editingId ? "Project updated." : "Project created." });
    await reloadAll();
    setTimeout(() => setFeedback(null), 3000);
  }

  async function reloadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [projectsRes, tasksRes] = await Promise.all([
      supabase.from("projects").select("*, realms(name, color, icon)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, title, status, priority, due_date, project_id").eq("user_id", user.id).not("project_id", "is", null),
    ]);

    if (projectsRes.data) setProjects(projectsRes.data as Project[]);
    if (tasksRes.data) setLinkedTasks(tasksRes.data as LinkedTask[]);
  }

  async function remove(id: string) {
    if (!confirm("Delete this project? Linked tasks will be unlinked but not deleted.")) return;
    const { error: unlinkErr } = await supabase.from("tasks").update({ project_id: null }).eq("project_id", id);
    if (unlinkErr) { setFeedback({ type: "error", message: "Failed to unlink tasks." }); return; }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { setFeedback({ type: "error", message: error.message }); return; }
    setFeedback({ type: "success", message: "Project deleted." });
    await reloadAll();
    setTimeout(() => setFeedback(null), 3000);
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await toggleTaskCompletion(supabase, user.id, taskId, currentStatus !== "done");
    if (!result.success) {
      setFeedback({ type: "error", message: result.error ?? "Failed to update task" });
      return;
    }

    await reloadAll();
  }

  async function addInlineTask(projectId: string, realmId: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !newTaskTitle.trim()) return;

    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      project_id: projectId,
      realm_id: realmId || null,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      due_date: newTaskDue || null,
      status: "todo",
    });

    if (error) { setFeedback({ type: "error", message: error.message }); return; }

    setNewTaskTitle("");
    setNewTaskDue("");
    setNewTaskPriority("medium");
    setAddingTaskTo(null);
    await reloadAll();
  }

  function handleQuickDraft() {
    if (!quickInput.trim()) return;
    const category = detectCategory(quickInput.trim());
    const detectedRealm = guessRealm(quickInput.trim(), realms);
    const templates = TASK_TEMPLATES[category] ?? TASK_TEMPLATES.generic;

    setQuickDraft({
      title: quickInput.trim(),
      realmId: detectedRealm,
      category,
      suggestedTasks: templates,
    });
    setSelectedTaskIdx(new Set(templates.map((_, i) => i)));
  }

  async function saveQuickDraft() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !quickDraft) return;

    setSaving(true);

    const { data: newProject, error: pErr } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        realm_id: quickDraft.realmId || null,
        title: quickDraft.title,
        status: "active",
      })
      .select()
      .single();

    if (pErr || !newProject) {
      setFeedback({ type: "error", message: pErr?.message ?? "Failed to create project" });
      setSaving(false);
      return;
    }

    const selectedTasks = [...selectedTaskIdx].map((i) => quickDraft.suggestedTasks[i]).filter(Boolean);
    if (selectedTasks.length > 0) {
      const inserts = selectedTasks.map((t) => ({
        user_id: user.id,
        project_id: newProject.id,
        realm_id: quickDraft.realmId || null,
        title: t,
        status: "todo" as const,
        priority: "medium" as const,
      }));
      const { error: tErr } = await supabase.from("tasks").insert(inserts);
      if (tErr) {
        setFeedback({ type: "error", message: "Project created but some tasks failed to save." });
        setSaving(false);
        return;
      }
    }

    setQuickDraft(null);
    setQuickInput("");
    setSaving(false);
    setFeedback({ type: "success", message: "Quick plan created with tasks!" });
    await reloadAll();
    setTimeout(() => setFeedback(null), 3000);
  }

  function cancelQuickDraft() {
    setQuickDraft(null);
    setQuickInput("");
    setSelectedTaskIdx(new Set());
  }

  function toggleSuggestion(i: number) {
    setSelectedTaskIdx((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-36 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3 h-24 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-2xl px-5 py-8 animate-fade-in">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Projects</h1>
            <div className="text-sm text-[var(--text-muted)]">
              Turn bigger goals into visible progress.
              <HelpPopover title="What is a project?">
                <p>Projects are larger outcomes made of tasks. Use them when a goal takes multiple steps.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Tasks are the steps. Habits are the repeated routines that support the project.</p>
              </HelpPopover>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { resetForm(); setShowForm(true); }}>
              Create manually
            </Button>
          </div>
        </div>

        {feedback && (
          <div className={`mb-4 rounded-lg border px-4 py-2 text-sm flex items-center gap-2 ${
            feedback.type === "error"
              ? "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
          }`}>
            {feedback.type === "success" ? (
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            {feedback.message}
          </div>
        )}

        {projects.length > 0 && projects.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--text-muted)]">
              Projects turn bigger goals into next actions. Each task completed moves the project forward.
            </p>
          </div>
        )}

        {/* QUICK PLAN */}
        <Card className="mb-6 border-[var(--border-strong)]">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Quick plan</h2>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Describe what you want to achieve. Life Pulse will turn it into a project draft.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleQuickDraft(); }}
                placeholder="Example: Improve my guitar soloing by September"
                className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
              />
              <Button onClick={handleQuickDraft} disabled={!quickInput.trim()}>
                Create plan
              </Button>
            </div>

            {quickDraft && (
              <div className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-ghost)] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--accent)]">Draft: {quickDraft.title}</h3>
                  {quickDraft.realmId && realms.find((r) => r.id === quickDraft.realmId) && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: realms.find((r) => r.id === quickDraft.realmId)!.color + "20",
                        color: realms.find((r) => r.id === quickDraft.realmId)!.color,
                      }}
                    >
                      {realms.find((r) => r.id === quickDraft.realmId)!.icon}{" "}
                      {realms.find((r) => r.id === quickDraft.realmId)!.name}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Suggested tasks
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {quickDraft.suggestedTasks.map((t, i) => (
                    <label
                      key={i}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-all duration-150"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTaskIdx.has(i)}
                        onChange={() => toggleSuggestion(i)}
                        className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] focus:ring-[var(--accent)]/30 focus:ring-offset-0 hover:border-[var(--accent)]/50"
                      />
                      {t}
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={saveQuickDraft} disabled={saving}>
                    {saving ? "Saving..." : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Save project
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={cancelQuickDraft}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* CREATE / EDIT FORM */}
        {showForm && (
          <Card className="mb-6 border-[var(--border-strong)]">
            <div className="flex flex-col gap-4 p-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {editingId ? "Edit project" : "New project"}
              </h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Project title"
                  maxLength={200}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Life area</label>
                  <RealmPicker
                    realms={realms}
                    value={realmId}
                    onChange={setRealmId}
                    allowNone
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              {editingId && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Status</label>
                    <SelectPicker
                      options={[
                        { value: "active", label: "Active", color: "#34d399" },
                        { value: "paused", label: "Paused", color: "#f59e0b" },
                        { value: "completed", label: "Completed", color: "#6366f1" },
                      ]}
                      value={status}
                      onChange={setStatus}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {projects.length === 0 ? (
          <Card variant="subtle" className="border-dashed border-[var(--border)]">
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--text-muted)]">Projects are bigger outcomes made of tasks.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] transition-all duration-150">Build Life Pulse</span>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] transition-all duration-150">Improve guitar soloing</span>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] transition-all duration-150">Finish Smartocaster</span>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] transition-all duration-150">Prepare for physics exam</span>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] transition-all duration-150">Launch 3D printing business</span>
              </div>
              <div className="mt-6 flex justify-center gap-2">
                <Button size="sm" onClick={() => { const el = document.querySelector("input[placeholder*='Example']"); if (el) (el as HTMLInputElement).focus(); }}>
                  Start with Quick plan
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                  Create manually
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {(["active", "paused", "completed"] as const).map((statusGroup) => {
              const groupProjects = projects.filter((p) => p.status === statusGroup);
              if (groupProjects.length === 0) return null;

              const isPrimary = statusGroup === "active";

              return (
                <section key={statusGroup}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className={`text-sm font-semibold ${isPrimary ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                      {statusGroup === "active" ? "Active projects" : statusGroup === "paused" ? "Paused" : "Completed"}
                    </h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      statusGroup === "active"
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : statusGroup === "paused"
                          ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                          : "bg-[var(--accent-soft)] text-[var(--accent)]"
                    }`}>
                      {groupProjects.length}
                    </span>
                  </div>
                  {isPrimary && projects.length <= 2 && (
                    <p className="mb-3 text-xs text-[var(--text-muted)]">
                      Each project is one outcome. Break it into tasks, then execute them one at a time.
                    </p>
                  )}
                  <div className={`flex flex-col gap-3 ${isPrimary ? "" : "opacity-60 hover:opacity-100 transition-opacity"}`}>
                    {groupProjects.map((project) => {
                      const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;
                      const prog = getProjectProgress(project.id);
                      const tasks = tasksByProject[project.id] ?? [];
                      const sortedTasks = [...tasks].sort((a, b) => {
                        if (a.status === "done" && b.status !== "done") return 1;
                        if (a.status !== "done" && b.status === "done") return -1;
                        return 0;
                      });
                      const visibleTasks = sortedTasks.slice(0, 5);
                      const remaining = sortedTasks.length - 5;

                      return (
                        <Card key={project.id} className={`border-[var(--border-strong)] transition-all duration-150 ${isPrimary ? "" : "border-[var(--border)]"}`}>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className={`text-sm font-semibold truncate ${isPrimary ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                                    {project.title}
                                  </h3>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                {project.description && (
                                  <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">
                                    {project.description}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  {project.realms && (
                                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: project.realms.color + "20", color: project.realms.color }}>
                                      {project.realms.icon} {project.realms.name}
                                    </span>
                                  )}
                                  {project.deadline && (
                                    <span className="text-[10px] text-[var(--text-muted)]">Due {project.deadline}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEdit(project)} className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] transition-colors">Edit</button>
                                <button onClick={() => remove(project.id)} className="rounded-lg px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors">Delete</button>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="my-3 border-t border-[var(--border)]" />

                            {/* Progress */}
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium text-[var(--text-muted)]">Progress</span>
                              {tasks.length > 0 ? (
                                <span className="text-[10px] text-[var(--text-muted)]">{prog.done}/{prog.total} tasks</span>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)]">No tasks yet</span>
                              )}
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-all shadow-sm shadow-[var(--accent)]/10"
                                style={{ width: `${prog.percent}%` }}
                              />
                            </div>
                            {tasks.length > 0 && (
                              <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">{prog.percent}% complete</p>
                            )}

                            {/* Linked tasks */}
                            {sortedTasks.length > 0 && (
                              <div className="mt-3 flex flex-col gap-1">
                                {visibleTasks.map((t, i) => {
                                  const isDone = t.status === "done";
                                  const dueLabel = getDueLabel(t.due_date);
                                  const isNext = !isDone && i === 0;
                                  return (
                                    <div
                                      key={t.id}
                                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                                        isDone ? "opacity-50" : "hover:bg-[var(--surface-raised)]"
                                      } ${isNext ? "ring-1 ring-[var(--accent)]/25 bg-[var(--accent)]/[0.05]" : ""}`}
                                    >
                                      {isNext && (
                                        <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)] shrink-0">Next</span>
                                      )}
                                      <button
                                        onClick={() => toggleTaskStatus(t.id, t.status)}
                                        role="checkbox"
                                        aria-checked={isDone}
                                        aria-label={`Mark "${t.title}" as ${isDone ? "incomplete" : "complete"}`}
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                                          isDone
                                            ? "border-[var(--accent)] bg-[var(--accent)]"
                                            : "border-[var(--border)]"
                                        }`}
                                      >
                                        {isDone && (
                                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                      <span className={`flex-1 text-xs truncate ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>
                                        {t.title}
                                      </span>
                                      <span className={`text-[10px] shrink-0 ${PRIORITY_COLORS[t.priority] ?? "text-[var(--text-muted)]"}`}>
                                        {t.priority}
                                      </span>
                                      {dueLabel && (
                                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">{dueLabel}</span>
                                      )}
                                    </div>
                                  );
                                })}
                                {remaining > 0 && (
                                  <button
                                    onClick={() => router.push(`/tasks`)}
                                    className="text-left text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-1 transition-colors"
                                  >
                                    and {remaining} more linked task{remaining !== 1 ? "s" : ""}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Inline add task */}
                            {addingTaskTo === project.id ? (
                              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                                <div className="flex flex-col gap-2">
                                  <input
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="Task title"
                                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <input
                                      type="date"
                                      value={newTaskDue}
                                      onChange={(e) => setNewTaskDue(e.target.value)}
                                      className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text)] transition-all focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none [color-scheme:dark]"
                                    />
                                    <SelectPicker
                                      options={[
                                        { value: "low", label: "Low", color: "#a1a1aa" },
                                        { value: "medium", label: "Medium", color: "#f59e0b" },
                                        { value: "high", label: "High", color: "#ef4444" },
                                      ]}
                                      value={newTaskPriority}
                                      onChange={setNewTaskPriority}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => { setAddingTaskTo(null); setNewTaskTitle(""); }}
                                      className="rounded-lg px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => addInlineTask(project.id, project.realm_id)}
                                      disabled={!newTaskTitle.trim()}
                                      className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-40"
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingTaskTo(project.id)}
                                className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-raised)] transition-colors"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Add task
                              </button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardNav>
  );
}
