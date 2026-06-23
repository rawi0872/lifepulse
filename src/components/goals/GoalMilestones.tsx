"use client";

import { useState } from "react";
import { PulseCard } from "@/components/ui/pulse-card";
import type { GoalMilestone } from "@/lib/goals";

interface Props {
  milestones: GoalMilestone[];
  saving: boolean;
  onAdd: (title: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function GoalMilestones({ milestones, saving, onAdd, onToggle, onDelete }: Props) {
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim());
    setNewTitle("");
  };

  const completedCount = milestones.filter((m) => m.completed_at).length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <PulseCard title="Milestones" accent="accent" description={`${completedCount}/${milestones.length} complete`}>
      {milestones.length > 0 && (
        <div className="px-4 pt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">{progress}%</p>
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {milestones.length === 0 ? (
          <div className="px-4 py-4 text-center text-xs text-[var(--text-muted)]">
            No milestones yet. Add one below.
          </div>
        ) : (
          milestones
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m) => {
              const done = !!m.completed_at;
              return (
                <div key={m.id} className="flex items-center gap-2 px-4 py-2.5">
                  <button
                    onClick={() => onToggle(m.id, !done)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      done
                        ? "border-[var(--success)] bg-[var(--success)] text-white"
                        : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {done && (
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
                      {m.title}
                    </p>
                    {m.due_date && (
                      <p className="text-[9px] text-[var(--text-muted)]">{m.due_date}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(m.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    title="Delete milestone"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })
        )}
      </div>

      <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add milestone..."
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newTitle.trim()}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </PulseCard>
  );
}
