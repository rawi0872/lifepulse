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
  const { toast } = useToast();

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
    if (unlinkErr) { toast({ type: "error", title: "Failed to unlink tasks." }); return; }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete project." }); return; }
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

        {projects.length > 0 && projects.length <= 2 && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--text-muted)]">
              Projects turn bigger goals into next actions. Each task completed moves the project forward.
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
          show={showForm}
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
            onCreateManual={() => { resetForm(); setShowForm(true); }}
          />
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
                      const tasks = tasksByProject[project.id] ?? [];

                      return (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          isPrimary={isPrimary}
                          tasks={tasks}
                          tasksByProject={tasksByProject}
                          projects={projects}
                          addingTaskTo={addingTaskTo}
                          newTaskTitle={newTaskTitle}
                          newTaskDue={newTaskDue}
                          newTaskPriority={newTaskPriority}
                          onEdit={openEdit}
                          onDelete={remove}
                          onToggleTask={toggleTaskStatus}
                          onStartAddTask={setAddingTaskTo}
                          onCancelAddTask={() => { setAddingTaskTo(null); setNewTaskTitle(""); }}
                          onNewTaskTitleChange={setNewTaskTitle}
                          onNewTaskDueChange={setNewTaskDue}
                          onNewTaskPriorityChange={setNewTaskPriority}
                          onAddTask={addInlineTask}
                        />
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
