"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTodayDateString } from "@/lib/utils";
import { DashboardNav } from "@/components/DashboardNav";
import { RealmPicker } from "@/components/RealmPicker";
import { SelectPicker } from "@/components/SelectPicker";
import { ProjectPicker } from "@/components/ProjectPicker";

import { HelpPopover } from "@/components/HelpPopover";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Realm {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Project {
  id: string;
  title: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  realm_id: string | null;
  project_id: string | null;
  created_at: string;
  realms: Realm | null;
  projects: Project | null;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getDueDateLabel(due_date: string | null): { label: string; className: string } | null {
  if (!due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_date + "T00:00:00");
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: `${Math.abs(diff)} day${Math.abs(diff) > 1 ? "s" : ""} overdue`, className: "text-[var(--danger)]" };
  if (diff === 0) return { label: "Due today", className: "text-[var(--warning)]" };
  if (diff === 1) return { label: "Due tomorrow", className: "text-[var(--text-muted)]" };
  return { label: due_date, className: "text-[var(--text-muted)]" };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<"today" | "upcoming" | "all" | "done">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [realmId, setRealmId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [tasksRes, realmsRes, projectsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, realms(name, color, icon), projects(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("realms")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order"),
        supabase
          .from("projects")
          .select("id, title")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
      if (realmsRes.data) setRealms(realmsRes.data as Realm[]);
      if (projectsRes.data) setProjects(projectsRes.data as Project[]);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setTitle("");
    setRealmId(realms[0]?.id ?? "");
    setProjectId("");
    setPriority("medium");
    setDueDate("");
    setEditingId(null);
  }

  function openEdit(t: Task) {
    setEditingId(t.id);
    setTitle(t.title);
    setRealmId(t.realm_id ?? realms[0]?.id ?? "");
    setProjectId(t.project_id ?? "");
    setPriority(t.priority);
    setDueDate(t.due_date ?? "");
    setShowForm(true);
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!title.trim()) {
      toast({ type: "error", title: "Title is required." });
      return;
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      realm_id: realmId || null,
      project_id: projectId || null,
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      status: "todo" as const,
    };

    if (editingId) {
      const { error: err } = await supabase.from("tasks").update(payload).eq("id", editingId);

      if (err) {
        toast({ type: "error", title: "Failed to update task." });
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from("tasks").insert(payload);

      if (err) {
        toast({ type: "error", title: "Failed to create task." });
        setSaving(false);
        return;
      }
    }

    resetForm();
    setShowForm(false);
    setSaving(false);
    toast({ type: "success", title: editingId ? "Task updated." : "Task created." });
    reloadTasks();
  }

  async function reloadTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("tasks")
      .select("*, realms(name, color, icon), projects(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setTasks(data as Task[]);
  }

  async function remove(id: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast({ type: "error", title: "Failed to delete task." });
      return;
    }
    toast({ type: "success", title: "Task deleted." });
    reloadTasks();
  }

  async function toggleDone(task: Task) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await toggleTaskCompletion(supabase, user.id, task.id, task.status !== "done");
    if (!result.success) {
      toast({ type: "error", title: result.error ?? "Failed to update task" });
      return;
    }

    toast({ type: "success", title: task.status !== "done" ? "Task completed" : "Task reopened" });
    reloadTasks();
  }

  const todayStr = getTodayDateString();

  const filterCounts = useMemo(() => {
    const td = todayStr;
    return {
      today: tasks.filter((t) => t.due_date === td || (t.due_date === null && t.status === "todo")).length,
      upcoming: tasks.filter((t) => t.due_date !== null && t.due_date > td).length,
      all: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks, todayStr]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aOrder = a.status === "todo" ? 0 : 1;
      const bOrder = b.status === "todo" ? 0 : 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const ap = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 1;
      const bp = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 1;
      if (ap !== bp) return ap - bp;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }, [tasks]);

  const filteredTasks = sortedTasks.filter((t) => {
    const td = todayStr;
    if (filter === "today") return t.due_date === td || (t.due_date === null && t.status === "todo");
    if (filter === "upcoming") return t.due_date !== null && t.due_date > td;
    if (filter === "done") return t.status === "done";
    return true;
  });

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-28 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-52 animate-pulse rounded-lg bg-[var(--surface)]" />
          </div>
          <div className="mb-4 flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 w-16 animate-pulse rounded-lg bg-[var(--surface)]" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-2 h-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
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
            <h1 className="text-2xl font-bold text-[var(--text)]">Tasks</h1>
            <div className="text-sm text-[var(--text-muted)]">
              Clear the actions that move life forward.
              <HelpPopover title="What is a task?">
                <p>Tasks are one-time actions with a clear finish.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Examples: Submit project booklet, Buy guitar strings, Finish physics revision</p>
                <p className="mt-1.5">Use tasks for things you complete once. Use habits for repeated routines.</p>
              </HelpPopover>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            Add task
          </Button>
        </div>

        {tasks.length > 0 && tasks.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 hover:border-[var(--accent)]/20 transition-all duration-150">
            <p className="text-xs text-[var(--text-muted)]">
              💡 Good task lists stay short. Add one clear next action.
            </p>
            <div className="mt-2">
              <span className="text-[9px] font-medium text-[var(--text-muted)]">Examples</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { resetForm(); setTitle("Review project scope"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)]">Review project scope</button>
                <button type="button" onClick={() => { resetForm(); setTitle("Send follow-up email"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)]">Send follow-up email</button>
                <button type="button" onClick={() => { resetForm(); setTitle("Complete one deep-work block"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)]">Complete one deep-work block</button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <Card className="mb-6">
            <div className="flex flex-col gap-4 p-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                maxLength={200}
              />

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Realm</label>
                <RealmPicker
                  realms={realms}
                  value={realmId}
                  onChange={setRealmId}
                  allowNone
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Project</label>
                <ProjectPicker
                  projects={projects}
                  value={projectId}
                  onChange={setProjectId}
                  allowNone
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Priority</label>
                  <SelectPicker
                    options={[
                      { value: "low", label: "Low", color: "#a1a1aa" },
                      { value: "medium", label: "Medium", color: "#b8944a" },
                      { value: "high", label: "High", color: "#c45a5a" },
                    ]}
                    value={priority}
                    onChange={setPriority}
                  />
                </div>

                <div className="flex-1">
                  <Input
                    label="Due date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

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

        <div className="mb-4 flex flex-wrap gap-2">
          {(["today", "upcoming", "all", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                filter === f
                  ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                  : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              {f === "today" ? "Today" : f === "upcoming" ? "Upcoming" : f === "all" ? "All" : "Done"}
              {filterCounts[f] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  filter === f
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                }`}>
                  {filterCounts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {tasks.length > 0 && (
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            {tasks.filter((t) => t.status === "todo").length} remaining &middot; {tasks.filter((t) => t.status === "done").length} completed
          </p>
        )}

        {filteredTasks.length === 0 ? (
          <Card variant="subtle" className="border-dashed border-[var(--border)]">
            <div className="px-4 py-10 text-center">
              {filter === "all" ? (
                <>
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--text-muted)]">Clear your mind</span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">No tasks for now. Add one clear next action.</p>
                  <div className="mt-3">
                    <span className="text-[9px] font-medium text-[var(--text-muted)]">Examples</span>
                    <div className="mt-1 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={() => { resetForm(); setTitle("Submit project booklet"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--accent)]">Submit project booklet</button>
                      <button type="button" onClick={() => { resetForm(); setTitle("Practice one physics problem set"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--accent)]">Practice one physics problem set</button>
                      <button type="button" onClick={() => { resetForm(); setTitle("Call the printer"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--accent)]">Call the printer</button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-6"
                    onClick={() => { resetForm(); setShowForm(true); }}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add task
                  </Button>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No tasks match this filter.</p>
              )}
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredTasks.map((task) => {
              const isDone = task.status === "done";
              const dueLabel = getDueDateLabel(task.due_date);
              return (
                <Card
                  key={task.id}
                  variant={isDone ? "subtle" : "default"}
                  className={`flex items-center gap-3 px-4 py-3 ${isDone ? "opacity-40" : "hover:bg-[var(--surface-active)]"}`}
                >
                  <button
                    onClick={() => toggleDone(task)}
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={`Mark "${task.title}" as ${isDone ? "incomplete" : "complete"}`}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                      isDone
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--text-muted)]/40 hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)]"
                    }`}
                  >
                    {isDone && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.realms && (
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: task.realms.color + "20", color: task.realms.color }}>
                          {task.realms.icon} {task.realms.name}
                        </span>
                      )}
                      {task.projects && (
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[var(--surface)] text-[var(--text-muted)]">
                          {task.projects.title}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        task.priority === "high"
                          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                          : task.priority === "medium"
                            ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                            : "bg-[var(--surface)] text-[var(--text-muted)]"
                      }`}>
                        {task.priority}
                      </span>
                      {dueLabel && (
                        <span className={`text-[10px] ${dueLabel.className}`}>
                          {dueLabel.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(task)} className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-active)] transition-colors">
                      Edit
                    </button>
                    <button onClick={() => remove(task.id)} className="rounded-lg px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors">
                      Delete
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardNav>
  );
}
