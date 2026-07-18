"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";

import { HelpPopover } from "@/components/HelpPopover";
import { toggleTaskCompletion } from "@/lib/taskCompletion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QuickDraftWizard, TASK_TEMPLATES, detectCategory, guessRealm } from "@/components/projects/QuickDraftWizard";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyProjectState } from "@/components/projects/EmptyProjectState";

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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<LinkedGoal[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [realmId, setRealmId] = useState("");
  const [status, setStatus] = useState("active");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkedProjectIds, setLinkedProjectIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [quickInput, setQuickInput] = useState("");
  const [quickDraft, setQuickDraft] = useState<{ title: string; realmId: string; category: string; suggestedTasks: string[] } | null>(null);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState<Set<number>>(new Set());

  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [projectsRes, tasksRes, realmsRes, linksRes, goalsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, title, description, status, deadline, progress, realm_id, created_at, updated_at, realms(id, name, color, icon)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, project_id")
          .eq("user_id", user.id)
          .not("project_id", "is", null),
        supabase
          .from("realms")
          .select("id, name, color, icon")
          .eq("user_id", user.id)
          .order("sort_order"),
        supabase
          .from("goal_links")
          .select("goal_id, linked_type, linked_id")
          .eq("user_id", user.id)
          .eq("linked_type", "project"),
        supabase
          .from("goals")
          .select("id, title, status")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;
      if (projectsRes.data) setProjects(projectsRes.data as unknown as Project[]);
      if (tasksRes.data) setLinkedTasks(tasksRes.data as LinkedTask[]);
      if (realmsRes.data) setRealms(realmsRes.data as Realm[]);
      if (linksRes.data) {
        setGoalLinks(linksRes.data as GoalLink[]);
        setLinkedProjectIds(new Set(linksRes.data.map((l: { linked_id: string }) => l.linked_id)));
      }
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
      document.getElementById(`project-edit-panel-${editingId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [editingId]);

  useEffect(() => {
    if (!confirmingDeleteId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`project-delete-panel-${confirmingDeleteId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [confirmingDeleteId]);

  const tasksByProject = useMemo(() => {
    const map: Record<string, LinkedTask[]> = {};
    for (const t of linkedTasks) {
      if (!map[t.project_id]) map[t.project_id] = [];
      map[t.project_id].push(t);
    }
    return map;
  }, [linkedTasks]);

  const goalsById = useMemo(() => {
    return linkedGoals.reduce<Record<string, LinkedGoal>>((map, goal) => {
      map[goal.id] = goal;
      return map;
    }, {});
  }, [linkedGoals]);

  const goalsByProjectId = useMemo(() => {
    return goalLinks.reduce<Record<string, LinkedGoal[]>>((map, link) => {
      if (link.linked_type !== "project") return map;
      const goal = goalsById[link.goal_id];
      if (!goal) return map;
      if (!map[link.linked_id]) map[link.linked_id] = [];
      map[link.linked_id].push(goal);
      return map;
    }, {});
  }, [goalLinks, goalsById]);

  function getTaskContext(tasks: LinkedTask[]) {
    const openTasks = tasks.filter((task) => task.status !== "done");
    const completedTasks = tasks.filter((task) => task.status === "done");
    const nextTask = [...openTasks].sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })[0] ?? null;

    return {
      totalTasks: tasks.length,
      openTasks: openTasks.length,
      completedTasks: completedTasks.length,
      nextTask,
    };
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setRealmId("");
    setStatus("active");
    setDeadline("");
    setEditingId(null);
    setConfirmingDeleteId(null);
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    setConfirmingDeleteId(null);
    setTitle(p.title);
    setDescription(p.description ?? "");
    setRealmId(p.realm_id ?? "");
    setStatus(p.status);
    setDeadline(p.deadline ?? "");
    setShowForm(false);
  }

  function cancelEdit() {
    resetForm();
    setShowForm(false);
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !title.trim()) return;

    setSaving(true);

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
      if (err) { toast({ type: "error", title: "Failed to update project." }); setSaving(false); return; }
    } else {
      payload.status = "active";
      const { error: err } = await supabase.from("projects").insert(payload);
      if (err) { toast({ type: "error", title: "Failed to create project." }); setSaving(false); return; }
    }

    resetForm();
    setShowForm(false);
    setSaving(false);
    toast({ type: "success", title: editingId ? "Project updated." : "Project created." });
    await reloadAll();
  }

  async function reloadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [projectsRes, tasksRes, linksRes, goalsRes] = await Promise.all([
      supabase.from("projects").select("id, title, description, status, deadline, progress, realm_id, created_at, updated_at, realms(id, name, color, icon)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, title, status, priority, due_date, project_id").eq("user_id", user.id).not("project_id", "is", null),
      supabase.from("goal_links").select("goal_id, linked_type, linked_id").eq("user_id", user.id).eq("linked_type", "project"),
      supabase.from("goals").select("id, title, status").eq("user_id", user.id),
    ]);

    if (projectsRes.data) setProjects(projectsRes.data as unknown as Project[]);
    if (tasksRes.data) setLinkedTasks(tasksRes.data as LinkedTask[]);
    if (linksRes.data) {
      setGoalLinks(linksRes.data as GoalLink[]);
      setLinkedProjectIds(new Set(linksRes.data.map((l: { linked_id: string }) => l.linked_id)));
    }
    if (goalsRes.data) setLinkedGoals(goalsRes.data as LinkedGoal[]);
  }

  async function remove(id: string) {
    const { error: unlinkErr } = await supabase.from("tasks").update({ project_id: null }).eq("project_id", id);
    if (unlinkErr) { toast({ type: "error", title: "Failed to unlink tasks." }); return; }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete project." }); return; }
    if (editingId === id) cancelEdit();
    setConfirmingDeleteId(null);
    toast({ type: "success", title: "Project deleted." });
    await reloadAll();
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await toggleTaskCompletion(supabase, user.id, taskId, currentStatus !== "done");
    if (!result.success) {
      toast({ type: "error", title: result.error ?? "Failed to update task" });
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

    if (error) { toast({ type: "error", title: "Failed to add task." }); return; }

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
      toast({ type: "error", title: "Failed to create project." });
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
        toast({ type: "error", title: "Project created but some tasks failed to save." });
        setSaving(false);
        return;
      }
    }

    setQuickDraft(null);
    setQuickInput("");
    setSaving(false);
    toast({ type: "success", title: "Quick plan created with tasks!" });
    await reloadAll();
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
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text)]">Projects</h1>
            <div className="text-pretty text-sm text-[var(--text-muted)]">
              Turn bigger goals into visible progress.
              <HelpPopover title="What is a project?">
                <p>Projects are larger outcomes made of tasks. Use them when a goal takes multiple steps.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Tasks are the steps. Habits are the repeated routines that support the project.</p>
              </HelpPopover>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <Button variant="secondary" onClick={() => { resetForm(); setConfirmingDeleteId(null); setShowForm(true); }}>
              Create manually
            </Button>
          </div>
        </div>

        {projects.length > 0 && projects.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--text-muted)]">
              Projects turn bigger goals into next visible actions. Add or complete one linked task, then review the movement in Weekly Review.
            </p>
          </div>
        )}

        <QuickDraftWizard
          realms={realms}
          quickInput={quickInput}
          onQuickInputChange={setQuickInput}
          onQuickDraft={handleQuickDraft}
          quickDraft={quickDraft}
          selectedTaskIdx={selectedTaskIdx}
          onToggleSuggestion={toggleSuggestion}
          saving={saving}
          onSaveQuickDraft={saveQuickDraft}
          onCancelQuickDraft={cancelQuickDraft}
        />

        <ProjectForm
          show={showForm && !editingId}
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          realmId={realmId}
          onRealmChange={setRealmId}
          deadline={deadline}
          onDeadlineChange={setDeadline}
          editingId={editingId}
          status={status}
          onStatusChange={setStatus}
          saving={saving}
          realms={realms}
          onSave={save}
          onCancel={() => { resetForm(); setShowForm(false); }}
        />

        {projects.length === 0 ? (
          <EmptyProjectState
            onFocusQuickPlan={() => { const el = document.querySelector("input[placeholder*='Example']"); if (el) (el as HTMLInputElement).focus(); }}
            onCreateManual={() => { resetForm(); setConfirmingDeleteId(null); setShowForm(true); }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {(["active", "paused", "completed"] as const).map((statusGroup) => {
              const groupProjects = projects.filter((p) => p.status === statusGroup);
              if (groupProjects.length === 0) return null;

              const isPrimary = statusGroup === "active";

              return (
                <section key={statusGroup}>
                  <div className="mb-3 flex min-w-0 items-center gap-2">
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
                      Each project is one outcome. Break it into tasks, then make one step visible in Today.
                    </p>
                  )}
                  <div className={`flex min-w-0 flex-col gap-3 ${isPrimary ? "" : "opacity-60 hover:opacity-100 transition-opacity"}`}>
                    {groupProjects.map((project) => {
                      const tasks = tasksByProject[project.id] ?? [];
                      const taskContext = getTaskContext(tasks);
                      const linkedProjectGoals = goalsByProjectId[project.id] ?? [];
                      const isEditing = editingId === project.id;
                      const isConfirmingDelete = confirmingDeleteId === project.id;

                      return (
                        <div key={project.id} className="min-w-0 space-y-2">
                          <ProjectGoalContext goals={linkedProjectGoals} />
                          <ProjectTaskContext context={taskContext} />
                          <ProjectCard
                            project={project}
                            isPrimary={isPrimary}
                            isLinked={linkedProjectIds.has(project.id)}
                            tasks={tasks}
                            tasksByProject={tasksByProject}
                            projects={projects}
                            addingTaskTo={addingTaskTo}
                            newTaskTitle={newTaskTitle}
                            newTaskDue={newTaskDue}
                            newTaskPriority={newTaskPriority}
                            onEdit={openEdit}
                            onDelete={(id) => { if (editingId === id) cancelEdit(); setConfirmingDeleteId(id); }}
                            onToggleTask={toggleTaskStatus}
                            onStartAddTask={setAddingTaskTo}
                            onCancelAddTask={() => { setAddingTaskTo(null); setNewTaskTitle(""); }}
                            onNewTaskTitleChange={setNewTaskTitle}
                            onNewTaskDueChange={setNewTaskDue}
                            onNewTaskPriorityChange={setNewTaskPriority}
                            onAddTask={addInlineTask}
                          />
                          {isEditing && (
                            <div id={`project-edit-panel-${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3 sm:p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-[var(--text)]">Edit this project</p>
                                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Changes apply to this project only. Save or cancel right here.</p>
                              </div>
                              <ProjectForm
                                show
                                title={title}
                                onTitleChange={setTitle}
                                description={description}
                                onDescriptionChange={setDescription}
                                realmId={realmId}
                                onRealmChange={setRealmId}
                                deadline={deadline}
                                onDeadlineChange={setDeadline}
                                editingId={editingId}
                                status={status}
                                onStatusChange={setStatus}
                                saving={saving}
                                realms={realms}
                                onSave={save}
                                onCancel={cancelEdit}
                              />
                            </div>
                          )}
                          {isConfirmingDelete && (
                            <div id={`project-delete-panel-${project.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-4">
                              <p className="text-sm font-semibold text-[var(--text)]">Delete this project?</p>
                              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This removes it from your list.</p>
                              <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Linked tasks stay in Tasks and are unlinked from this project.</p>
                              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                                  Cancel
                                </Button>
                                <button onClick={() => remove(project.id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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

function ProjectTaskContext({
  context,
}: {
  context: {
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    nextTask: LinkedTask | null;
  };
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 sm:py-2.5">
      {context.totalTasks === 0 ? (
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-secondary)]">No next action yet</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Add one task to make this project visible in Today and Weekly Review.</p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
            <span>Linked tasks: {context.totalTasks}</span>
            <span>Open tasks: {context.openTasks}</span>
            <span>Completed tasks: {context.completedTasks}</span>
          </div>
          <div className="min-w-0 text-pretty text-xs text-[var(--text-muted)] sm:max-w-[55%]">
            <span className="font-medium text-[var(--text-secondary)]">Next action: </span>
            {context.nextTask ? (
              <span className="min-w-0">
                <span className="text-[var(--text)]">{context.nextTask.title}</span>
                {context.nextTask.due_date && <span> &middot; due {context.nextTask.due_date}</span>}
              </span>
            ) : (
              <span>No open tasks. Add one task if this project still needs a visible step.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectGoalContext({ goals }: { goals: LinkedGoal[] }) {
  if (goals.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 sm:py-2.5">
        <p className="text-xs font-medium text-[var(--text-secondary)]">No linked goal yet</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Link a goal when this project supports a larger outcome. Quiet projects still count.</p>
      </div>
    );
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const displayGoals = activeGoals.length > 0 ? activeGoals : goals;
  const goalTitles = displayGoals.slice(0, 2).map((goal) => goal.title).join(" · ");
  const remainingCount = displayGoals.length - 2;
  const label = displayGoals.length === 1
    ? `Goal: ${goalTitles}`
    : `Supports goals: ${goalTitles}${remainingCount > 0 ? ` +${remainingCount}` : ""}`;

  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 sm:py-2.5">
      <p className="text-pretty text-xs text-[var(--text-muted)]"><span className="font-medium text-[var(--text-secondary)]">Linked goal:</span> {label.replace(/^Goal: /, "").replace(/^Supports goals: /, "")}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Based on links you created. Project actions can appear in Today and Weekly Review.</p>
    </div>
  );
}
