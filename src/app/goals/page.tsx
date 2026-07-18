"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GoalPulseHeader } from "@/components/goals/GoalPulseHeader";
import { GoalForm } from "@/components/goals/GoalForm";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalMilestones } from "@/components/goals/GoalMilestones";
import { GoalLinks } from "@/components/goals/GoalLinks";
import type { Goal, GoalMilestone, GoalFormData, GoalLink, GoalLinkType } from "@/lib/goals";

interface RealmInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface GoalActionLinkCounts {
  projects: number;
  tasks: number;
  habits: number;
  total: number;
}

const emptyActionLinkCounts: GoalActionLinkCounts = {
  projects: 0,
  tasks: 0,
  habits: 0,
  total: 0,
};

function formatActionLinkCount(count: number, singular: string, plural: string) {
  if (count === 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

function GoalsContent() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [realms, setRealms] = useState<RealmInfo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [confirmingDeleteGoalId, setConfirmingDeleteGoalId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [links, setLinks] = useState<GoalLink[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]);
  const [habits, setHabits] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [goalsRes, milestonesRes, realmsRes, linksRes, projectsRes, tasksRes, habitsRes] = await Promise.all([
        supabase
          .from("goals")
          .select("id, user_id, realm_id, title, description, why, status, priority, target_date, completed_at, created_at, updated_at, realms(name, color, icon)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("goal_milestones")
          .select("id, goal_id, user_id, title, description, due_date, completed_at, sort_order, created_at, updated_at")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("realms")
          .select("id, name, color, icon")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("goal_links")
          .select("id, user_id, goal_id, linked_type, linked_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("projects")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("tasks")
          .select("id, title")
          .eq("user_id", user.id)
          .order("title"),
        supabase
          .from("habits")
          .select("id, title")
          .eq("user_id", user.id)
          .order("title"),
      ]);

      if (cancelled) return;
      if (goalsRes.data) setGoals(goalsRes.data as unknown as Goal[]);
      if (milestonesRes.data) setMilestones(milestonesRes.data as GoalMilestone[]);
      if (realmsRes.data) setRealms(realmsRes.data as RealmInfo[]);
      if (linksRes.data) setLinks(linksRes.data as GoalLink[]);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (habitsRes.data) setHabits(habitsRes.data);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [router, supabase]);

  useEffect(() => {
    if (!editingGoal) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`goal-edit-panel-${editingGoal.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [editingGoal]);

  useEffect(() => {
    if (!confirmingDeleteGoalId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`goal-delete-panel-${confirmingDeleteGoalId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [confirmingDeleteGoalId]);

  async function reload() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [goalsRes, milestonesRes, realmsRes, linksRes, projectsRes, tasksRes, habitsRes] = await Promise.all([
      supabase.from("goals").select("id, user_id, realm_id, title, description, why, status, priority, target_date, completed_at, created_at, updated_at, realms(name, color, icon)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("goal_milestones").select("id, goal_id, user_id, title, description, due_date, completed_at, sort_order, created_at, updated_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
      supabase.from("realms").select("id, name, color, icon").eq("user_id", user.id).order("name"),
      supabase.from("goal_links").select("id, user_id, goal_id, linked_type, linked_id, created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("projects").select("id, name").eq("user_id", user.id).order("name"),
      supabase.from("tasks").select("id, title").eq("user_id", user.id).order("title"),
      supabase.from("habits").select("id, title").eq("user_id", user.id).order("title"),
    ]);
    if (goalsRes.data) setGoals(goalsRes.data as unknown as Goal[]);
    if (milestonesRes.data) setMilestones(milestonesRes.data as GoalMilestone[]);
    if (realmsRes.data) setRealms(realmsRes.data as RealmInfo[]);
    if (linksRes.data) setLinks(linksRes.data as GoalLink[]);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (habitsRes.data) setHabits(habitsRes.data);
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const pausedGoals = goals.filter((g) => g.status === "paused");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const archivedGoals = goals.filter((g) => g.status === "archived");
  const activeGoalCount = activeGoals.length;
  const completedGoalCount = completedGoals.length;
  const milestoneDoneCount = milestones.filter((m) => m.completed_at).length;
  const upcomingDates = goals.filter((g) => g.target_date && g.status !== "completed" && g.status !== "archived").length;

  const actionLinksByGoal = useMemo(() => {
    return links.reduce<Record<string, GoalActionLinkCounts>>((map, link) => {
      if (!map[link.goal_id]) map[link.goal_id] = { ...emptyActionLinkCounts };
      const counts = map[link.goal_id];
      counts.total += 1;
      if (link.linked_type === "project") counts.projects += 1;
      if (link.linked_type === "task") counts.tasks += 1;
      if (link.linked_type === "habit") counts.habits += 1;
      return map;
    }, {});
  }, [links]);

  const getMilestonesForGoal = (goalId: string) =>
    milestones.filter((m) => m.goal_id === goalId);

  const getMilestoneProgress = (goalId: string) => {
    const ms = getMilestonesForGoal(goalId);
    if (ms.length === 0) return 0;
    return Math.round((ms.filter((m) => m.completed_at).length / ms.length) * 100);
  };

  const getNextMilestone = (goalId: string) => {
    const ms = getMilestonesForGoal(goalId).filter((m) => !m.completed_at).sort((a, b) => a.sort_order - b.sort_order);
    return ms[0];
  };

  async function handleSave(data: GoalFormData) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }

      if (editingGoal) {
        const updatePayload: Record<string, unknown> = { ...data };
        if (typeof updatePayload.status === "string" && updatePayload.status !== "completed") {
          updatePayload.completed_at = null;
        }
        const { error } = await supabase
          .from("goals")
          .update(updatePayload)
          .eq("id", editingGoal.id)
          .eq("user_id", user.id);
        if (error) { toast({ type: "error", title: "Failed to update goal." }); setSaving(false); return; }
        toast({ type: "success", title: "Goal updated!" });
      } else {
        const { error } = await supabase
          .from("goals")
          .insert({ ...data, user_id: user.id });
        if (error) { toast({ type: "error", title: "Failed to create goal." }); setSaving(false); return; }
        toast({ type: "success", title: "Goal created!" });
      }

      setShowForm(false);
      setEditingGoal(null);
      setConfirmingDeleteGoalId(null);
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong. Try again." });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
      if (error) { toast({ type: "error", title: "Failed to delete goal." }); return; }
      toast({ type: "success", title: "Goal deleted." });
      setMilestones((prev) => prev.filter((m) => m.goal_id !== id));
      if (editingGoal?.id === id) setEditingGoal(null);
      setConfirmingDeleteGoalId(null);
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
  }

  async function handleComplete(id: string) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const { error } = await supabase
        .from("goals")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) { toast({ type: "error", title: "Failed to complete goal." }); setSaving(false); return; }
      toast({ type: "success", title: "Goal completed! Great work." });
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
    setSaving(false);
  }

  async function handleAddLink(goalId: string, linkedType: GoalLinkType, linkedId: string) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const { error } = await supabase
        .from("goal_links")
        .insert({ goal_id: goalId, user_id: user.id, linked_type: linkedType, linked_id: linkedId });
      if (error) { toast({ type: "error", title: "Failed to add link." }); setSaving(false); return; }
      toast({ type: "success", title: "Linked!" });
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
    setSaving(false);
  }

  async function handleRemoveLink(linkId: string) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const { error } = await supabase.from("goal_links").delete().eq("id", linkId).eq("user_id", user.id);
      if (error) { toast({ type: "error", title: "Failed to remove link." }); setSaving(false); return; }
      toast({ type: "success", title: "Link removed." });
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
    setSaving(false);
  }

  async function handleAddMilestone(goalId: string, title: string) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const existing = milestones.filter((m) => m.goal_id === goalId);
      const maxOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.sort_order)) : -1;
      const { error } = await supabase
        .from("goal_milestones")
        .insert({ goal_id: goalId, user_id: user.id, title, sort_order: maxOrder + 1 });
      if (error) { toast({ type: "error", title: "Failed to add milestone." }); setSaving(false); return; }
      toast({ type: "success", title: "Milestone added!" });
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
    setSaving(false);
  }

  async function handleToggleMilestone(id: string, completed: boolean) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const { error } = await supabase
        .from("goal_milestones")
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) { toast({ type: "error", title: "Failed to update milestone." }); setSaving(false); return; }
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
    setSaving(false);
  }

  async function handleDeleteMilestone(id: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("goal_milestones").delete().eq("id", id).eq("user_id", user.id);
      if (error) { toast({ type: "error", title: "Failed to delete milestone." }); return; }
      toast({ type: "success", title: "Milestone deleted." });
      reload();
    } catch {
      toast({ type: "error", title: "Something went wrong." });
    }
  }

  function startEdit(goal: Goal) {
    setEditingGoal(goal);
    setConfirmingDeleteGoalId(null);
    setShowForm(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingGoal(null);
    setConfirmingDeleteGoalId(null);
  }

  function toggleExpand(goalId: string) {
    setExpandedGoalId((prev) => prev === goalId ? null : goalId);
  }

  const renderGoalList = (items: Goal[], label: string) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6 min-w-0">
        <SectionHeader label={label} count={String(items.length)} accent="accent" />
        <div className="space-y-2.5 sm:space-y-2">
          {items.map((goal) => {
            const isExpanded = expandedGoalId === goal.id;
            const isEditing = editingGoal?.id === goal.id;
            const isConfirmingDelete = confirmingDeleteGoalId === goal.id;
            const goalMilestones = getMilestonesForGoal(goal.id);
            const nextMs = getNextMilestone(goal.id);
            const actionLinkCounts = actionLinksByGoal[goal.id] ?? emptyActionLinkCounts;
            const actionLinkSummary = [
              formatActionLinkCount(actionLinkCounts.projects, "project", "projects"),
              formatActionLinkCount(actionLinkCounts.tasks, "task", "tasks"),
              formatActionLinkCount(actionLinkCounts.habits, "habit", "habits"),
            ].filter(Boolean).join(" · ");
            return (
              <div key={goal.id} className="min-w-0">
                <GoalCard
                  goal={goal}
                  milestoneProgress={getMilestoneProgress(goal.id)}
                  nextMilestoneTitle={nextMs?.title}
                  onEdit={startEdit}
                  onDelete={(id) => { if (editingGoal?.id === id) setEditingGoal(null); setShowForm(false); setConfirmingDeleteGoalId(id); }}
                  onComplete={handleComplete}
                />
                {isEditing && (
                  <div id={`goal-edit-panel-${goal.id}`} className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3 sm:p-4">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-[var(--text)]">Edit this goal</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Changes apply to this goal only. Save or cancel right here.</p>
                    </div>
                    <GoalForm
                      key={goal.id}
                      saving={saving}
                      onSave={handleSave}
                      onCancel={cancelForm}
                      initial={{
                        title: goal.title,
                        description: goal.description ?? "",
                        why: goal.why ?? "",
                        priority: goal.priority,
                        realm_id: goal.realm_id ?? "",
                        target_date: goal.target_date ?? "",
                      }}
                      realms={realms}
                    />
                  </div>
                )}
                {isConfirmingDelete && (
                  <div id={`goal-delete-panel-${goal.id}`} className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-4">
                    <p className="text-sm font-semibold text-[var(--text)]">Delete this goal?</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">This removes it from your list.</p>
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button onClick={() => setConfirmingDeleteGoalId(null)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] sm:min-h-0 sm:py-1.5">
                        Cancel
                      </button>
                      <button onClick={() => handleDelete(goal.id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-1 min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[10px] text-[var(--text-muted)] sm:py-2">
                  {actionLinkCounts.total > 0 ? (
                    <span>
                      <span className="font-medium text-[var(--text-secondary)]">Supports:</span> {actionLinkSummary}
                    </span>
                  ) : (
                    <span>No action links yet</span>
                  )}
                </div>
                {(() => {
                  const goalLinks = links.filter((l) => l.goal_id === goal.id);
                  const hasMs = goalMilestones.length > 0;
                  const hasLinks = goalLinks.length > 0;
                  if (!hasMs && !hasLinks) return null;
                  const label = isExpanded ? "Hide details" : [
                    hasMs ? `${goalMilestones.length} milestone${goalMilestones.length !== 1 ? "s" : ""}` : "",
                    hasLinks ? `${goalLinks.length} link${goalLinks.length !== 1 ? "s" : ""}` : "",
                  ].filter(Boolean).join(", ");
                  return (
                    <button
                      onClick={() => toggleExpand(goal.id)}
                      className="mt-1 flex min-h-10 w-full items-center justify-center gap-1 py-1 text-[9px] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] sm:min-h-0"
                    >
                      <svg
                        className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                      {label}
                    </button>
                  );
                })()}
                {isExpanded && (
                  <div className="mt-2 min-w-0 space-y-3">
                    <GoalMilestones
                      milestones={goalMilestones}
                      saving={saving}
                      onAdd={(title) => handleAddMilestone(goal.id, title)}
                      onToggle={handleToggleMilestone}
                      onDelete={handleDeleteMilestone}
                    />
                    <GoalLinks
                      links={links.filter((l) => l.goal_id === goal.id)}
                      projects={projects}
                      tasks={tasks}
                      habits={habits}
                      saving={saving}
                      onAdd={(linkedType, linkedId) => handleAddLink(goal.id, linkedType, linkedId)}
                      onRemove={handleRemoveLink}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return null;

  return (
    <div className="animate-fade-in px-4 py-6 md:p-6">
      <div className="mx-auto max-w-3xl min-w-0">
        <GoalPulseHeader
          activeCount={activeGoalCount}
          completedCount={completedGoalCount}
          milestoneCount={milestoneDoneCount}
          upcomingCount={upcomingDates}
        />

        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => { setEditingGoal(null); setConfirmingDeleteGoalId(null); setShowForm(true); }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:min-h-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add a goal
            </button>
          </div>
        )}

        {showForm && !editingGoal && (
          <div className="mb-6">
            <GoalForm
              saving={saving}
              onSave={handleSave}
              onCancel={cancelForm}
              realms={realms}
            />
          </div>
        )}

        {goals.length === 0 ? (
          <div className="py-12">
            <EmptyState
              message="No goals yet. Create your first goal to start tracking what matters."
              action={
                <button
                  onClick={() => { setConfirmingDeleteGoalId(null); setShowForm(true); }}
                  className="mt-2 inline-flex min-h-10 items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0"
                >
                  Create your first goal &rarr;
                </button>
              }
            />
          </div>
        ) : (
          <>
            {renderGoalList(activeGoals, "Active")}
            {renderGoalList(pausedGoals, "Paused")}
            {renderGoalList(completedGoals, "Completed")}
            {renderGoalList(archivedGoals, "Archived")}
          </>
        )}
      </div>
    </div>
  );
}

export default function GoalsPage() {
  return (
    <DashboardNav>
      <GoalsContent />
    </DashboardNav>
  );
}
