"use client";

import type { Goal } from "@/lib/goals";

interface Props {
  goal: Goal;
  milestoneProgress: number;
  nextMilestoneTitle?: string;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

const priorityColors: Record<string, string> = {
  high: "var(--danger)",
  medium: "var(--warning)",
  low: "var(--success)",
};

const statusStyles: Record<string, string> = {
  active: "bg-[var(--accent-soft)] text-[var(--accent)]",
  paused: "bg-[var(--warning-soft)] text-[var(--warning)]",
  completed: "bg-[var(--success-soft)] text-[var(--success)]",
  archived: "bg-[var(--surface)] text-[var(--text-muted)]",
};

export function GoalCard({ goal, milestoneProgress, nextMilestoneTitle, onEdit, onDelete, onComplete }: Props) {
  const isComplete = goal.status === "completed";

  return (
    <div className={`min-w-0 rounded-lg border ${isComplete ? "border-[var(--success-soft)]" : "border-[var(--border)]"} bg-[var(--surface)] p-4 transition-all hover:border-[var(--border-strong)]`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className={`min-w-0 text-pretty text-sm font-semibold tracking-tight ${isComplete ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
              {goal.title}
            </h3>
            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusStyles[goal.status] ?? ""}`}>
              {goal.status}
            </span>
          </div>

          {goal.realms && (
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]" style={{ color: goal.realms.color ?? undefined }}>
              {goal.realms.name}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
          {!isComplete && (
            <button
              onClick={() => onComplete(goal.id)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--success)] sm:min-h-0 sm:py-1"
              title="Mark complete"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Complete</span>
            </button>
          )}
          <button
            onClick={() => onEdit(goal)}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--accent)] sm:min-h-0 sm:py-1"
            title="Edit goal"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            <span>Edit</span>
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text)] sm:min-h-0 sm:py-1"
            title="Delete goal"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <span>Delete</span>
          </button>
        </div>
      </div>

      {goal.description && (
        <p className="mt-1 text-pretty text-xs text-[var(--text-muted)] line-clamp-2">{goal.description}</p>
      )}

      {goal.why && !isComplete && (
        <p className="mt-1 text-[10px] italic text-[var(--text-muted)]">
          &ldquo;{goal.why}&rdquo;
        </p>
      )}

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
        {goal.priority && (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityColors[goal.priority] ?? "var(--text-muted)" }} />
            {goal.priority}
          </span>
        )}
        {goal.target_date && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {goal.target_date}
          </span>
        )}

        {milestoneProgress > 0 && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            {milestoneProgress}%
          </span>
        )}

        {nextMilestoneTitle && !isComplete && (
          <span className="min-w-0 max-w-full text-pretty sm:ml-auto sm:max-w-[120px] sm:truncate" title={nextMilestoneTitle}>
            Next: {nextMilestoneTitle}
          </span>
        )}
      </div>
    </div>
  );
}
