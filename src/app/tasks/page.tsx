"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTodayDateString } from "@/lib/utils";
import { DashboardNav } from "@/components/DashboardNav";
import { DailyLoopConnector } from "@/components/DailyLoopConnector";
import { RealmPicker } from "@/components/RealmPicker";
import { SelectPicker } from "@/components/SelectPicker";
import { ProjectPicker } from "@/components/ProjectPicker";

import { HelpPopover } from "@/components/HelpPopover";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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

interface TaskProjectContext {
  id: string;
  title: string;
  status: string | null;
}

interface GoalLink {
  goal_id: string;
  linked_type: string;
  linked_id: string;
}

interface LinkedGoal {
  id: string;
  title: string;
  status: string | null;
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
  const [taskProjects, setTaskProjects] = useState<TaskProjectContext[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<LinkedGoal[]>([]);
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

      const [tasksRes, realmsRes, projectsRes, taskProjectsRes, goalLinksRes, goalsRes] = await Promise.all([
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
        supabase
          .from("projects")
          .select("id, title, status")
          .eq("user_id", user.id),
        supabase
          .from("goal_links")
          .select("goal_id, linked_type, linked_id")
          .eq("user_id", user.id)
          .eq("linked_type", "task"),
        supabase
          .from("goals")
          .select("id, title, status")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
      if (realmsRes.data) setRealms(realmsRes.data as Realm[]);
      if (projectsRes.data) setProjects(projectsRes.data as Project[]);
      if (taskProjectsRes.data) setTaskProjects(taskProjectsRes.data as TaskProjectContext[]);
      if (goalLinksRes.data) setGoalLinks(goalLinksRes.data as GoalLink[]);
      if (goalsRes.data) setLinkedGoals(goalsRes.data as LinkedGoal[]);
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

    const [tasksRes, goalLinksRes, goalsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, realms(name, color, icon), projects(title)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_links")
        .select("goal_id, linked_type, linked_id")
        .eq("user_id", user.id)
        .eq("linked_type", "task"),
      supabase
        .from("goals")
        .select("id, title, status")
        .eq("user_id", user.id),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (goalLinksRes.data) setGoalLinks(goalLinksRes.data as GoalLink[]);
    if (goalsRes.data) setLinkedGoals(goalsRes.data as LinkedGoal[]);
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

    toast({
      type: "success",
      title: task.status !== "done" ? "Task completed" : "Task reopened",
      description: task.status !== "done" ? "+25 XP added to today's momentum." : undefined,
    });
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

  const taskProjectsById = useMemo(() => {
    return taskProjects.reduce<Record<string, TaskProjectContext>>((map, project) => {
      map[project.id] = project;
      return map;
    }, {});
  }, [taskProjects]);

  const goalsById = useMemo(() => {
    return linkedGoals.reduce<Record<string, LinkedGoal>>((map, goal) => {
      map[goal.id] = goal;
      return map;
    }, {});
  }, [linkedGoals]);

  const goalsByTaskId = useMemo(() => {
    return goalLinks.reduce<Record<string, LinkedGoal[]>>((map, link) => {
      if (link.linked_type !== "task") return map;
      const goal = goalsById[link.goal_id];
      if (!goal) return map;
      if (!map[link.linked_id]) map[link.linked_id] = [];
      map[link.linked_id].push(goal);
      return map;
    }, {});
  }, [goalLinks, goalsById]);

  const getTaskGoalContext = (taskId: string) => {
    const goals = goalsByTaskId[taskId] ?? [];
    if (goals.length === 0) return null;

    const activeGoals = goals.filter((goal) => goal.status === "active");
    const displayGoals = activeGoals.length > 0 ? activeGoals : goals;
    const goalTitles = displayGoals.slice(0, 2).map((goal) => goal.title).join(" · ");
    const remainingCount = displayGoals.length - 2;

    if (displayGoals.length === 1) return `Goal: ${goalTitles}`;
    if (goalTitles) return `Supports goals: ${goalTitles}${remainingCount > 0 ? ` +${remainingCount}` : ""}`;
    return `Supports ${goals.length} goals`;
  };

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
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text)]">Tasks</h1>
            <div className="text-pretty text-sm text-[var(--text-muted)]">
              Create or complete one visible action, then return to Today to close the loop.
              <HelpPopover title="What is a task?">
                <p>Tasks are one-time actions with a clear finish.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Examples: Submit project booklet, Buy guitar strings, Finish physics revision</p>
                <p className="mt-1.5">Use tasks for things you complete once. Use habits for repeated routines.</p>
              </HelpPopover>
            </div>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => { resetForm(); setShowForm(true); }}>
            Add task
          </Button>
        </div>

        <DailyLoopConnector
          activeStep="action"
          note="Tasks are where today&apos;s visible actions become progress. Keep one task concrete enough to finish today."
        />

        {tasks.length > 0 && tasks.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 hover:border-[var(--accent)]/20 transition-all duration-150">
            <p className="text-xs text-[var(--text-muted)]">
              Good task lists stay short. Add one clear next action, complete it, then reflect tonight.
            </p>
            <div className="mt-2">
              <span className="text-[9px] font-medium text-[var(--text-muted)]">Examples</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { resetForm(); setTitle("Review project scope"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)] sm:py-0.5">Review project scope</button>
                <button type="button" onClick={() => { resetForm(); setTitle("Send follow-up email"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)] sm:py-0.5">Send follow-up email</button>
                <button type="button" onClick={() => { resetForm(); setTitle("Complete one deep-work block"); setShowForm(true); }} className="cursor-pointer rounded-md border border-dashed border-[var(--border-strong)] bg-transparent px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]/40 hover:text-[var(--text-secondary)] sm:py-0.5">Complete one deep-work block</button>
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

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 sm:min-h-0 ${
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
          <EmptyState
            eyebrow={filter === "all" ? "First task" : undefined}
            title={filter === "all" ? "Start with one visible action." : "No tasks match this filter."}
            message={filter === "all" ? "Add one task you can finish today. It becomes part of today&apos;s loop when you check it off and reflect." : "Try another view or clear the filter to see the rest of your task list."}
            action={filter === "all" ? (
              <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add first task
              </Button>
            ) : undefined}
            examples={filter === "all" ? (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Calm examples</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => { resetForm(); setTitle("Submit project booklet"); setShowForm(true); }} className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)] sm:py-1.5">Submit project booklet</button>
                  <button type="button" onClick={() => { resetForm(); setTitle("Practice one physics problem set"); setShowForm(true); }} className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)] sm:py-1.5">Practice one problem set</button>
                  <button type="button" onClick={() => { resetForm(); setTitle("Call the printer"); setShowForm(true); }} className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)] sm:py-1.5">Call the printer</button>
                </div>
              </div>
            ) : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2.5 sm:gap-2">
            {filteredTasks.map((task) => {
              const isDone = task.status === "done";
              const dueLabel = getDueDateLabel(task.due_date);
              const linkedProjectTitle = task.project_id
                ? taskProjectsById[task.project_id]?.title ?? task.projects?.title
                : null;
              const linkedGoalContext = getTaskGoalContext(task.id);
              return (
                <Card
                  key={task.id}
                  variant={isDone ? "subtle" : "default"}
                  className={`overflow-hidden transition-all duration-150 ${isDone ? "border-[var(--success)]/20 bg-[var(--success-soft)]/15" : "hover:border-[var(--border-strong)] hover:bg-[var(--surface-active)] hover:shadow-md hover:shadow-black/10"}`}
                >
                  <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:py-3">
                    <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                      <button
                        onClick={() => toggleDone(task)}
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={`Mark "${task.title}" as ${isDone ? "incomplete" : "complete"}`}
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 sm:h-7 sm:w-7 ${
                          isDone
                            ? "border-[var(--success)] bg-[var(--success)] shadow-sm shadow-[var(--success)]/15"
                            : "border-[var(--text-muted)]/40 hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)]"
                        }`}
                      >
                        {isDone && (
                          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                          <p className={`min-w-0 flex-1 text-pretty text-sm font-semibold leading-snug ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                            {task.title}
                          </p>
                          {isDone && (
                            <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                              Done
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                      {task.realms && (
                        <span className="inline-block rounded-full px-2 py-1 text-[10px] font-medium sm:py-0.5" style={{ backgroundColor: task.realms.color + "20", color: task.realms.color }}>
                          {task.realms.icon} {task.realms.name}
                        </span>
                      )}
                      {linkedProjectTitle && (
                        <span className="inline-block rounded-full bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-muted)] sm:py-0.5">
                          Project: {linkedProjectTitle}
                        </span>
                      )}
                      {linkedGoalContext && (
                        <span className="inline-block rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] text-[var(--accent)] sm:py-0.5">
                          {linkedGoalContext}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
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
                  </div>

                    <div className="flex shrink-0 justify-end gap-1 border-t border-[var(--border)] pt-2 sm:border-t-0 sm:pt-0">
                    <button onClick={() => openEdit(task)} className="rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:px-2 sm:py-1">
                      Edit
                    </button>
                    <button onClick={() => remove(task.id)} className="rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] sm:px-2 sm:py-1">
                      Delete
                    </button>
                    </div>
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
