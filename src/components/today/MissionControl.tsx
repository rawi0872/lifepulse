"use client";

import { PulseCard } from "@/components/ui/pulse-card";
import { Button } from "@/components/ui/button";

interface Priority {
  id: string;
  text: string;
  done: boolean;
}

interface MissionControlProps {
  priorities: Priority[];
  priorityInput: string;
  addingPriority: boolean;
  quickCapture: string;
  quickType: "task" | "habit" | "project";
  quickSaving: boolean;
  focusPrompt: string;
  onPriorityInputChange: (value: string) => void;
  onAddPriority: () => void;
  onTogglePriority: (id: string) => void;
  onRemovePriority: (id: string) => void;
  onAddingPriorityChange: (value: boolean) => void;
  onQuickCaptureChange: (value: string) => void;
  onQuickTypeChange: (value: "task" | "habit" | "project") => void;
  onQuickCapture: () => void;
}

export function MissionControl({
  priorities,
  priorityInput,
  addingPriority,
  quickCapture,
  quickType,
  quickSaving,
  focusPrompt,
  onPriorityInputChange,
  onAddPriority,
  onTogglePriority,
  onRemovePriority,
  onAddingPriorityChange,
  onQuickCaptureChange,
  onQuickTypeChange,
  onQuickCapture,
}: MissionControlProps) {
  return (
    <PulseCard accent="accent" title="Mission Control" className="mb-6">
      <div className="p-4">
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            What matters today
          </label>
          {priorities.length === 0 ? (
            <div className="mt-2 flex gap-2">
              <input
                value={priorityInput}
                onChange={(e) => onPriorityInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onAddPriority(); }}
                placeholder={focusPrompt}
                maxLength={200}
                className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
              />
              <Button onClick={onAddPriority} disabled={!priorityInput.trim()} size="sm">
                Set
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {priorities.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 group transition-all duration-200">
                  <button
                    onClick={() => onTogglePriority(p.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                      p.done
                        ? "border-[var(--success)]/70 bg-[var(--success)]/80 shadow-sm shadow-[var(--success)]/15"
                        : "border-[var(--text-muted)]/40 hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)]"
                    }`}
                  >
                    {p.done && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${p.done ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                    {p.text}
                  </span>
                  <button
                    onClick={() => onRemovePriority(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all text-xs"
                    aria-label={`Remove "${p.text}"`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {priorities.length > 0 && priorities.every(p => p.done) && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--success)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Daily priorities complete
                </div>
              )}
              {priorities.length < 3 && (
                <div className="mt-1">
                  {addingPriority ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={priorityInput}
                        onChange={(e) => onPriorityInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onAddPriority();
                          if (e.key === "Escape") { onAddingPriorityChange(false); onPriorityInputChange(""); }
                        }}
                        placeholder={focusPrompt}
                        maxLength={200}
                        className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                      />
                      <button
                        onClick={onAddPriority}
                        disabled={!priorityInput.trim()}
                        className="text-xs text-[var(--accent)] hover:text-[var(--accent-strong)] disabled:text-[var(--text-muted)] transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddingPriorityChange(true)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      + Add priority
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="my-4 border-t border-[var(--border)]" />

        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Quick capture
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <input
                value={quickCapture}
                onChange={(e) => onQuickCaptureChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onQuickCapture(); }}
                placeholder="Capture a task, habit, or project before it gets lost..."
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 pr-20 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  quickType === "task"
                    ? "bg-[var(--surface)] text-[var(--text-secondary)]"
                    : quickType === "habit"
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--accent-soft)] text-[var(--accent)]"
                }`}>
                  {quickType === "task" ? "Task" : quickType === "habit" ? "Habit" : "Project"}
                </span>
              </div>
            </div>
            <Button onClick={onQuickCapture} disabled={!quickCapture.trim() || quickSaving}>
              {quickSaving ? "..." : "Add"}
            </Button>
          </div>
          {quickCapture.trim() && (
            <div className="mt-1.5 flex gap-2">
              {(["task", "habit", "project"] as const).map((t) => (
                t !== quickType && (
                  <button
                    key={t}
                    onClick={() => onQuickTypeChange(t)}
                    className="rounded-md px-2 py-0.5 border border-[var(--border)] hover:border-[var(--border-strong)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    Save as {t}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </PulseCard>
  );
}
