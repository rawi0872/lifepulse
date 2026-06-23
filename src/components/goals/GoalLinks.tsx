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
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
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
            className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
          >
            <span className="text-[9px] text-[var(--accent)]">
              {GOAL_LINK_LABELS[link.linked_type]}
            </span>
            {getLabel(link)}
            <button
              onClick={() => onRemove(link.id)}
              disabled={saving}
              className="ml-0.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
            >
              &times;
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={saving}
          className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
        >
          {showForm ? "Cancel" : "+ Link"}
        </button>
      </div>

      {showForm && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <select
            value={linkType}
            onChange={(e) => { setLinkType(e.target.value as GoalLinkType); setLinkId(""); }}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)] outline-none"
          >
            <option value="project">Project</option>
            <option value="task">Task</option>
            <option value="habit">Habit</option>
          </select>
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            className="min-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)] outline-none"
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
            className="rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
