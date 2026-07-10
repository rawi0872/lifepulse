"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RealmPicker } from "@/components/RealmPicker";
import { SelectPicker } from "@/components/SelectPicker";

interface Realm {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface ProjectFormProps {
  show: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  realmId: string;
  onRealmChange: (value: string) => void;
  deadline: string;
  onDeadlineChange: (value: string) => void;
  editingId: string | null;
  status: string;
  onStatusChange: (value: string) => void;
  saving: boolean;
  realms: Realm[];
  onSave: () => void;
  onCancel: () => void;
}

export function ProjectForm({
  show,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  realmId,
  onRealmChange,
  deadline,
  onDeadlineChange,
  editingId,
  status,
  onStatusChange,
  saving,
  realms,
  onSave,
  onCancel,
}: ProjectFormProps) {
  if (!show) return null;

  return (
    <Card className="mb-6 border-[var(--border-strong)]">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          {editingId ? "Edit project" : "New project"}
        </h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Title</label>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Project title"
            maxLength={200}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-2"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Optional description"
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-2"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Life area</label>
            <RealmPicker
              realms={realms}
              value={realmId}
              onChange={onRealmChange}
              allowNone
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => onDeadlineChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none [color-scheme:dark] sm:py-2"
            />
          </div>
        </div>

        {editingId && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Status</label>
              <SelectPicker
                options={[
                  { value: "active", label: "Active", color: "#34d399" },
                  { value: "paused", label: "Paused", color: "#f59e0b" },
                  { value: "completed", label: "Completed", color: "#6366f1" },
                ]}
                value={status}
                onChange={onStatusChange}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
