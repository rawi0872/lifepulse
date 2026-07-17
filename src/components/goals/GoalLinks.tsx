"use client";

import { useState } from "react";
import type { GoalLink, GoalLinkType } from "@/lib/goals";
import { GOAL_LINK_LABELS } from "@/lib/goals";

interface LinkRef {
  id: string;
  title?: string;
  name?: string;
}

interface GoalLinksProps {
  links: GoalLink[];
  projects: LinkRef[];
  tasks: LinkRef[];
  habits: LinkRef[];
  saving: boolean;
  onAdd: (linkedType: GoalLinkType, linkedId: string) => Promise<void>;
  onRemove: (linkId: string) => Promise<void>;
}

export function GoalLinks({ links, projects, tasks, habits, saving, onAdd, onRemove }: GoalLinksProps) {
  const [showForm, setShowForm] = useState(false);
  const [linkType, setLinkType] = useState<GoalLinkType>("project");
  const [linkId, setLinkId] = useState("");

  const refOptions: Record<GoalLinkType, LinkRef[]> = {
    project: projects,
    task: tasks,
    habit: habits,
  };

  const currentOptions = refOptions[linkType].filter(
    (ref) => !links.some((l) => l.linked_type === linkType && l.linked_id === ref.id)
  );

  const getLabel = (link: GoalLink) => {
    const pool = refOptions[link.linked_type];
    const ref = pool.find((r) => r.id === link.linked_id);
    return ref?.title ?? ref?.name ?? link.linked_id.slice(0, 8);
  };

  if (links.length === 0 && !showForm) {
    return (
      <div className="mt-2">
        <button
          onClick={() => setShowForm(true)}
          disabled={saving}
          className="rounded-md py-2 text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] sm:py-0"
        >
          + Link a project, task, or habit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {links.map((link) => (
          <span
            key={link.id}
            className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[10px] text-[var(--text-muted)] sm:py-0.5"
          >
            <span className="text-[9px] text-[var(--accent)]">
              {GOAL_LINK_LABELS[link.linked_type]}
            </span>
            {getLabel(link)}
            <button
              onClick={() => onRemove(link.id)}
              disabled={saving}
              className="ml-0.5 rounded px-1 text-[var(--text-muted)] transition-colors hover:text-red-400"
            >
              &times;
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={saving}
          className="min-h-10 rounded-md py-1 text-[10px] text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:py-0"
        >
          {showForm ? "Cancel" : "+ Link"}
        </button>
      </div>

      {showForm && (
        <div className="mt-1 flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={linkType}
            onChange={(e) => { setLinkType(e.target.value as GoalLinkType); setLinkId(""); }}
            className="min-h-10 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--foreground)] outline-none sm:min-h-0 sm:px-1.5 sm:py-0.5"
          >
            <option value="project">Project</option>
            <option value="task">Task</option>
            <option value="habit">Habit</option>
          </select>
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            className="min-h-10 min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--foreground)] outline-none sm:min-h-0 sm:min-w-[120px] sm:px-1.5 sm:py-0.5"
          >
            <option value="">Select...</option>
            {currentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title ?? opt.name ?? opt.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!linkId) return;
              await onAdd(linkType, linkId);
              setLinkId("");
            }}
            disabled={saving || !linkId}
            className="min-h-10 rounded bg-[var(--accent)] px-2 py-1.5 text-[10px] font-medium text-white disabled:opacity-40 sm:min-h-0 sm:py-0.5"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
