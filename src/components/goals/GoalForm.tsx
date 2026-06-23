"use client";

import { useState } from "react";
import { PulseCard } from "@/components/ui/pulse-card";
import type { GoalFormData } from "@/lib/goals";

interface Props {
  saving: boolean;
  onSave: (data: GoalFormData) => void;
  onCancel: () => void;
  initial?: Partial<GoalFormData>;
  realms?: { id: string; name: string; color: string }[];
}

export function GoalForm({ saving, onSave, onCancel, initial, realms }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [why, setWhy] = useState(initial?.why ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">((initial?.priority as "low" | "medium" | "high") ?? "medium");
  const [realmId, setRealmId] = useState<string>(initial?.realm_id ?? "");
  const [targetDate, setTargetDate] = useState<string>(initial?.target_date ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      why: why.trim() || undefined,
      priority: priority as "low" | "medium" | "high",
      realm_id: realmId || null,
      target_date: targetDate || null,
    });
  };

  return (
    <PulseCard title={initial ? "Edit Goal" : "New Goal"} accent="accent" description="Define what you want to achieve">
      <form onSubmit={handleSubmit} className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Run a half marathon"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does success look like?"
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Why</label>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Why does this matter to you?"
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Life Domain</label>
            <select
              value={realmId}
              onChange={(e) => setRealmId(e.target.value as string)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">None</option>
              {(realms ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Target Date</label>
          <input
            type="date"
            value={targetDate}
              onChange={(e) => setTargetDate(e.target.value as string)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] [color-scheme:dark]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : initial ? "Update Goal" : "Create Goal"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </PulseCard>
  );
}
