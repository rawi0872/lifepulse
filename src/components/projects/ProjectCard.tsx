"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SelectPicker } from "@/components/SelectPicker";

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

interface ProjectCardProps {
  project: Project;
  isPrimary: boolean;
  isLinked?: boolean;
  tasks: LinkedTask[];
  tasksByProject: Record<string, LinkedTask[]>;
  projects: Project[];
  addingTaskTo: string | null;
  newTaskTitle: string;
  newTaskDue: string;
  newTaskPriority: string;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onStartAddTask: (projectId: string) => void;
  onCancelAddTask: () => void;
  onNewTaskTitleChange: (value: string) => void;
  onNewTaskDueChange: (value: string) => void;
  onNewTaskPriorityChange: (value: string) => void;
  onAddTask: (projectId: string, realmId: string | null) => void;
}

function getProjectProgress(projectId: string, tasksByProject: Record<string, LinkedTask[]>, projects: Project[]): { done: number; total: number; percent: number } {
  const tasks = tasksByProject[projectId] ?? [];
  if (tasks.length === 0) {
    const p = projects.find((pr) => pr.id === projectId);
    return { done: 0, total: 0, percent: p?.progress ?? 0 };
  }
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length, percent: Math.round((done / tasks.length) * 100) };
}

export function ProjectCard({
  project,
  isPrimary,
  isLinked,
  tasks,
  tasksByProject,
  projects,
  addingTaskTo,
  newTaskTitle,
  newTaskDue,
  newTaskPriority,
  onEdit,
  onDelete,
  onToggleTask,
  onStartAddTask,
  onCancelAddTask,
  onNewTaskTitleChange,
  onNewTaskDueChange,
  onNewTaskPriorityChange,
  onAddTask,
}: ProjectCardProps) {
  const router = useRouter();
  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;
  const prog = getProjectProgress(project.id, tasksByProject, projects);
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return 0;
  });
  const visibleTasks = sortedTasks.slice(0, 5);
  const remaining = sortedTasks.length - 5;

  return (
    <Card className={`border-[var(--border-strong)] transition-all duration-150 ${isPrimary ? "" : "border-[var(--border)]"}`}>
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className={`min-w-0 text-pretty text-sm font-semibold ${isPrimary ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
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
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              {isLinked && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.297a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Goal
                </span>
              )}
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
          <div className="flex shrink-0 justify-end gap-1 sm:justify-start">
            <button onClick={() => onEdit(project)} className="rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:px-2 sm:py-1">Edit</button>
            <button onClick={() => onDelete(project.id)} className="rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:px-2 sm:py-1">Delete</button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-[var(--border)]" />

        {/* Progress */}
        <div className="mb-1 flex min-w-0 items-center justify-between gap-3">
          <span className="text-[10px] font-medium text-[var(--text-muted)]">Progress</span>
          {tasks.length > 0 ? (
            <span className="text-[10px] text-[var(--text-muted)]">{prog.done}/{prog.total} tasks</span>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]">No tasks yet</span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] shadow-sm shadow-[var(--accent)]/10 transition-all"
            style={{ width: `${prog.percent}%` }}
          />
        </div>
        {tasks.length > 0 && (
          <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">{prog.percent}% complete</p>
        )}

        {/* Linked tasks */}
        {sortedTasks.length > 0 && (
          <div className="mt-3 flex min-w-0 flex-col gap-1.5 sm:gap-1">
            {visibleTasks.map((t, i) => {
              const isDone = t.status === "done";
              const dueLabel = getDueLabel(t.due_date);
              const isNext = !isDone && i === 0;
              return (
                <div
                  key={t.id}
                  className={`flex min-w-0 flex-wrap items-center gap-2 rounded-md px-2 py-2 transition-colors sm:flex-nowrap sm:py-1.5 ${
                    isDone ? "opacity-50" : "hover:bg-[var(--surface-raised)]"
                  } ${isNext ? "ring-1 ring-[var(--accent)]/25 bg-[var(--accent)]/[0.05]" : ""}`}
                >
                  {isNext && (
                    <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)] shrink-0">Next</span>
                  )}
                  <button
                    onClick={() => onToggleTask(t.id, t.status)}
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
                  <span className={`min-w-[140px] flex-1 text-pretty text-xs sm:min-w-0 sm:truncate ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>
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
                onChange={(e) => onNewTaskTitleChange(e.target.value)}
                placeholder="Task title"
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-1.5"
                />
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => onNewTaskDueChange(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text)] transition-all focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none [color-scheme:dark] sm:py-1.5"
                />
                <SelectPicker
                  options={[
                    { value: "low", label: "Low", color: "#a1a1aa" },
                    { value: "medium", label: "Medium", color: "#f59e0b" },
                    { value: "high", label: "High", color: "#ef4444" },
                  ]}
                  value={newTaskPriority}
                  onChange={onNewTaskPriorityChange}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={onCancelAddTask}
                  className="rounded-lg px-3 py-2 text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] sm:px-2 sm:py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onAddTask(project.id, project.realm_id)}
                  disabled={!newTaskTitle.trim()}
                  className="rounded-lg px-3 py-2 text-[10px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40 sm:px-2 sm:py-1"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onStartAddTask(project.id)}
            className="mt-2 flex min-h-8 items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--accent)] sm:min-h-0"
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
}
