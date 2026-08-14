"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTodayDateString } from "@/lib/utils";
import { groupTasksByDate, hasInvalidTaskDueDate, isValidLocalDateString, timestampToLocalDateString } from "@/lib/tasks";
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
import { recordProductLearningEvent } from "@/lib/product-learning/client";

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

const TASK_STARTERS = [
  "Study 25 minutes",
  "Send one message",
  "Clear one small task",
  "Review one mistake",
  "Prepare gym clothes",
] as const;

function getDueDateLabel(dueDate: string | null, today: string, isDone: boolean): { label: string; className: string } {
  if (isDone) return { label: "Completed", className: "text-[var(--success)]" };
  if (hasInvalidTaskDueDate(dueDate)) return { label: "Date needs review", className: "text-[var(--warning)]" };
  if (!dueDate) return { label: "Unscheduled", className: "text-[var(--text-muted)]" };
  if (dueDate < today) return { label: "Overdue", className: "text-[var(--danger)]" };
  if (dueDate === today) return { label: "Due today", className: "text-[var(--warning)]" };
  return { label: dueDate, className: "text-[var(--text-muted)]" };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskProjects, setTaskProjects] = useState<TaskProjectContext[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<LinkedGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [title, setTitle] = useState("");
  const [realmId, setRealmId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [tasksRes, realmsRes, projectsRes, taskProjectsRes, goalLinksRes, goalsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, description, priority, due_date, status, completed_at, realm_id, project_id, created_at, realms(id, name, color, icon), projects(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("realms")
          .select("id, name, color, icon")
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
      if (tasksRes.data) setTasks(tasksRes.data as unknown as Task[]);
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

  useEffect(() => {
    if (!editingId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`task-edit-panel-${editingId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [editingId]);

  useEffect(() => {
    if (!confirmingDeleteId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`task-delete-panel-${confirmingDeleteId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [confirmingDeleteId]);

  function resetForm() {
    setTitle("");
    setRealmId(realms[0]?.id ?? "");
    setProjectId("");
    setPriority("medium");
    setDueDate("");
    setEditingId(null);
    setConfirmingDeleteId(null);
  }

  function openEdit(t: Task) {
    setEditingId(t.id);
    setConfirmingDeleteId(null);
    setTitle(t.title);
    setRealmId(t.realm_id ?? realms[0]?.id ?? "");
    setProjectId(t.project_id ?? "");
    setPriority(t.priority);
    setDueDate(t.due_date ?? "");
    setShowForm(false);
  }

  function cancelEdit() {
    resetForm();
    setShowForm(false);
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
    };

    if (editingId) {
      const { data: updatedTask, error: err } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (err || !updatedTask) {
        toast({ type: "error", title: "Failed to update task." });
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from("tasks").insert({ ...payload, status: "todo" });

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

  async function quickCreate() {
    const nextTitle = quickTitle.trim();
    if (!nextTitle || quickSaving) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setQuickSaving(true);
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      realm_id: null,
      project_id: null,
      title: nextTitle,
      priority: "medium",
      due_date: getTodayDateString(),
      status: "todo",
    });

    if (error) {
      toast({ type: "error", title: "Failed to create task." });
      setQuickSaving(false);
      return;
    }

    setQuickTitle("");
    setQuickSaving(false);
    toast({ type: "success", title: "Task captured." });
    reloadTasks();
  }

  async function reloadTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [tasksRes, goalLinksRes, goalsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, description, priority, due_date, status, completed_at, realm_id, project_id, created_at, realms(id, name, color, icon), projects(title)")
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

    if (tasksRes.data) setTasks(tasksRes.data as unknown as Task[]);
    if (goalLinksRes.data) setGoalLinks(goalLinksRes.data as GoalLink[]);
    if (goalsRes.data) setLinkedGoals(goalsRes.data as LinkedGoal[]);
  }

  async function remove(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: deletedTask, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !deletedTask) {
      toast({ type: "error", title: "Failed to delete task." });
      return;
    }
    if (editingId === id) cancelEdit();
    setConfirmingDeleteId(null);
    toast({ type: "success", title: "Task deleted." });
    reloadTasks();
  }

  async function toggleDone(task: Task) {
    if (togglingTaskId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setTogglingTaskId(task.id);
    try {
      const result = await toggleTaskCompletion(supabase, user.id, task.id, task.status !== "done");
      if (!result.success) {
        toast({ type: "error", title: result.error ?? "Failed to update task" });
        await reloadTasks();
        return;
      }

      toast({
        type: "success",
        title: task.status !== "done" ? "Visible action logged" : "Task reopened",
        description: task.status !== "done" ? "+25 XP added. This task will appear in your weekly rhythm. Return to Today to reflect." : undefined,
      });
      if (task.status !== "done") void recordProductLearningEvent("task_completed");
      await reloadTasks();
    } finally {
      setTogglingTaskId(null);
    }
  }

  const todayStr = getTodayDateString();

  const taskGroups = useMemo(() => groupTasksByDate(tasks, todayStr), [tasks, todayStr]);
  const activeTaskCount = taskGroups.overdue.length + taskGroups.dueToday.length + taskGroups.upcoming.length + taskGroups.unscheduled.length;
  const completedTaskCount = taskGroups.completedToday.length + taskGroups.olderCompleted.length;
  const dateNeedsReviewCount = taskGroups.unscheduled.filter((task) => hasInvalidTaskDueDate(task.due_date)).length;

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

  const taskFormFields = (
    <>
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
    </>
  );

  const renderTaskCard = (task: Task) => {
    const isDone = task.status === "done";
    const isEditing = editingId === task.id;
    const isConfirmingDelete = confirmingDeleteId === task.id;
    const dueLabel = getDueDateLabel(task.due_date, todayStr, isDone);
    const linkedProjectTitle = task.project_id
      ? taskProjectsById[task.project_id]?.title ?? task.projects?.title
      : null;
    const linkedGoalContext = getTaskGoalContext(task.id);
    const pending = togglingTaskId === task.id;
    const completedLocalDate = timestampToLocalDateString(task.completed_at);

    return (
      <Card
        key={task.id}
        variant={isDone ? "subtle" : "default"}
        className={`overflow-hidden transition-all duration-150 ${isDone ? "border-[var(--success)]/20 bg-[var(--success-soft)]/15" : "hover:border-[var(--border-strong)] hover:bg-[var(--surface-active)]"}`}
      >
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={`rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium ${dueLabel.className}`}>
                {dueLabel.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                task.priority === "high"
                  ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                  : task.priority === "medium"
                    ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)]"
              }`}>
                {task.priority} priority
              </span>
              {task.realms && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: task.realms.color + "20", color: task.realms.color }}>
                  {task.realms.icon} {task.realms.name}
                </span>
              )}
            </div>
            <h3 className={`mt-2 text-pretty text-base font-semibold leading-snug sm:text-sm ${isDone ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
              {task.title}
            </h3>
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {linkedProjectTitle && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Project: {linkedProjectTitle}
                </span>
              )}
              {linkedGoalContext && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                  {linkedGoalContext}
                </span>
              )}
              {isValidLocalDateString(task.due_date) && !isDone && dueLabel.label !== task.due_date && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  Date: {task.due_date}
                </span>
              )}
              {isDone && completedLocalDate && (
                <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] text-[var(--success)]">
                  Completed {completedLocalDate === todayStr ? "today" : completedLocalDate}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 border-t border-[var(--border)] pt-3 sm:w-36 sm:border-t-0 sm:pt-0">
            <button
              type="button"
              onClick={() => toggleDone(task)}
              disabled={pending}
              aria-label={`${isDone ? "Reopen" : "Complete"} task ${task.title}`}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${isDone ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]" : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"}`}
            >
              {pending ? "Saving..." : isDone ? "Reopen" : "Complete"}
            </button>
            <div className="flex min-w-0 gap-1">
              <button type="button" onClick={() => openEdit(task)} className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:min-h-0 sm:py-1.5" aria-expanded={isEditing} aria-controls={`task-edit-panel-${task.id}`}>
                {isEditing ? "Editing" : "Edit"}
              </button>
              <button type="button" onClick={() => { if (isEditing) cancelEdit(); setConfirmingDeleteId(task.id); }} className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:min-h-0 sm:py-1.5" aria-expanded={isConfirmingDelete} aria-controls={`task-delete-panel-${task.id}`}>
                Delete
              </button>
            </div>
          </div>
        </div>

        {isEditing && (
          <div id={`task-edit-panel-${task.id}`} className="border-t border-[var(--border)] bg-[var(--surface-soft)]/60 px-4 py-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[var(--text)]">Edit this task</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Changes apply to this task only. Save or cancel right here.</p>
            </div>
            <div className="flex flex-col gap-4">
              {taskFormFields}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
              </div>
            </div>
          </div>
        )}
        {isConfirmingDelete && (
          <div id={`task-delete-panel-${task.id}`} className="border-t border-[var(--border)] bg-[var(--surface-soft)]/70 px-4 py-4">
            <p className="text-sm font-semibold text-[var(--text)]">Delete this task?</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This removes the task from your list.</p>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)}>Cancel</Button>
              <button type="button" onClick={() => remove(task.id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                Delete
              </button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderTaskSection = (id: string, titleText: string, description: string, items: Task[], emptyText?: string) => (
    <section aria-labelledby={id}>
      <div className="mb-3">
        <h2 id={id} className="text-sm font-semibold text-[var(--text)]">{titleText}</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {items.map(renderTaskCard)}
        </div>
      ) : emptyText ? (
        <Card variant="subtle" className="border-[var(--border)] px-4 py-3">
          <p className="text-sm text-[var(--text-muted)]">{emptyText}</p>
        </Card>
      ) : null}
    </section>
  );

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

        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--text-muted)]">Tasks are one-time actions. NEXTRON can help you choose what matters next.</p>
            <Link href="/nextron?subject=tasks" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/20 px-3 py-2 text-xs font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)]/35 hover:text-[var(--accent-strong)]">
              Ask NEXTRON about my tasks
            </Link>
          </div>
        </div>

        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="flex flex-col gap-3 p-4">
            <label htmlFor="quick-task-title" className="text-xs font-medium text-[var(--text-muted)]">Quick capture</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="quick-task-title"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void quickCreate(); }}
                placeholder="Task to finish today"
                maxLength={200}
                className="min-h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/50"
              />
              <Button onClick={quickCreate} disabled={quickSaving || !quickTitle.trim()} className="w-full sm:w-auto">
                {quickSaving ? "Saving..." : "Capture"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TASK_STARTERS.slice(0, 3).map((starter) => (
                <button key={starter} type="button" onClick={() => { setQuickTitle(starter); }} className="min-h-10 rounded-full bg-[var(--surface-soft)] px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:min-h-0 sm:py-1">
                  {starter}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {showForm && !editingId && (
          <Card className="mb-6">
            <div className="flex flex-col gap-4 p-4">
              {taskFormFields}

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

        {tasks.length > 0 && (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
            <p className="text-xs text-[var(--text-muted)]">
              {activeTaskCount} active &middot; {taskGroups.overdue.length} overdue &middot; {taskGroups.dueToday.length} due today &middot; {completedTaskCount} completed
            </p>
          </div>
        )}

        {tasks.length === 0 ? (
          <EmptyState
            eyebrow="First task"
            title="Start with one visible action."
            message="Add one task you can finish today. Keep it concrete enough that done is obvious."
            description="Starter chips fill Quick Capture. You still choose what to save."
            action={(
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button size="sm" onClick={() => document.getElementById("quick-task-title")?.focus()}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Capture first task
                </Button>
                <Link href="/today#daily-execution" className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
                  Back to Today
                </Link>
              </div>
            )}
            examples={(
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Useful visible actions</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {TASK_STARTERS.map((starter) => (
                    <button key={starter} type="button" onClick={() => setQuickTitle(starter)} className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)] sm:py-1.5">
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {renderTaskSection("overdue-tasks-heading", "Overdue", `${taskGroups.overdue.length} active`, taskGroups.overdue, "No overdue tasks.")}
            {renderTaskSection("due-today-tasks-heading", "Due today", `${taskGroups.dueToday.length} waiting today`, taskGroups.dueToday, "Nothing else is due today.")}
            {taskGroups.upcoming.length > 0 && renderTaskSection("upcoming-tasks-heading", "Upcoming", "Scheduled after today", taskGroups.upcoming)}
            {taskGroups.unscheduled.length > 0 && renderTaskSection("unscheduled-tasks-heading", "Unscheduled", dateNeedsReviewCount > 0 ? `${dateNeedsReviewCount} date${dateNeedsReviewCount === 1 ? "" : "s"} need review` : "No due date yet", taskGroups.unscheduled)}
            {taskGroups.completedToday.length > 0 && renderTaskSection("completed-today-tasks-heading", "Completed today", "Finished on today&apos;s local date", taskGroups.completedToday)}
            {taskGroups.olderCompleted.length > 0 && renderTaskSection("older-completed-tasks-heading", "Older completed", "Previously finished tasks", taskGroups.olderCompleted)}
            <DailyLoopConnector
              activeStep="action"
              note="Tasks are where today&apos;s visible action becomes progress. Add one task you can finish today, check it off, then return to Today."
            />
          </div>
        )}
      </div>
    </DashboardNav>
  );
}
