"use client";

import { Card } from "@/components/ui/card";
import type { CSSProperties } from "react";

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
  visibleActionDone: boolean;
  hasJournal: boolean;
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
  visibleActionDone,
  hasJournal,
  onPriorityInputChange,
  onAddPriority,
  onTogglePriority,
  onRemovePriority,
  onAddingPriorityChange,
  onQuickCaptureChange,
  onQuickTypeChange,
  onQuickCapture,
}: MissionControlProps) {
  const inputClassName = "min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-[rgba(8,11,15,0.72)] px-3.5 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/80 shadow-inner shadow-black/20 transition-all duration-150 focus:border-[var(--accent-strong)]/50 focus:bg-[rgba(10,14,19,0.9)] focus:ring-2 focus:ring-[var(--accent)]/12 focus:outline-none sm:py-2.5";
  const actionButtonBaseClassName = "inline-flex min-h-[3rem] items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all duration-150 focus:ring-2 focus:ring-[var(--accent)]/18 focus:outline-none sm:min-h-[2.625rem] sm:w-auto";
  const enabledActionClassName = "shadow-sm shadow-black/25 hover:brightness-105 active:scale-[0.99]";
  const disabledActionClassName = "cursor-not-allowed shadow-none";
  const actionButtonClassName = (disabled: boolean) => `${actionButtonBaseClassName} ${disabled ? disabledActionClassName : enabledActionClassName}`;
  const actionButtonStyle = (disabled: boolean): CSSProperties => ({
    background: disabled
      ? "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.018))"
      : "linear-gradient(180deg, rgba(132,180,217,0.95), rgba(95,145,185,0.95))",
    borderColor: disabled ? "rgba(255,255,255,0.07)" : "rgba(132,180,217,0.35)",
    color: disabled ? "rgba(135,149,171,0.55)" : "#071018",
  });

  return (
    <Card className="mb-4 overflow-hidden border-white/[0.09] bg-[linear-gradient(180deg,rgba(244,247,251,0.032),rgba(244,247,251,0.008)),var(--surface)] shadow-lg shadow-black/15 sm:mb-5">
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--accent-strong)]">
              Daily focus
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--text)] sm:text-2xl">
              Start with one priority.
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Add the one thing that would make today count. Capture anything else before it becomes noise.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-[var(--border)] lg:grid-cols-[1.05fr_0.95fr] lg:divide-x lg:divide-y-0">
        <div className="p-4 sm:p-5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            One priority
          </label>
          {priorities.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-white/[0.06] bg-black/[0.12] p-2.5 sm:p-3">
              <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row">
                <input
                  value={priorityInput}
                  onChange={(e) => onPriorityInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onAddPriority(); }}
                  placeholder={focusPrompt}
                  maxLength={200}
                  className={inputClassName}
                />
                <button
                  onClick={onAddPriority}
                  disabled={!priorityInput.trim()}
                  className={`${actionButtonClassName(!priorityInput.trim())} w-full`}
                  style={actionButtonStyle(!priorityInput.trim())}
                >
                  Set priority
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {priorities.map((p) => (
                <div key={p.id} className="group flex min-w-0 items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 transition-all duration-200 sm:items-center sm:py-2.5">
                  <button
                    onClick={() => onTogglePriority(p.id)}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
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
                  <span className={`min-w-0 flex-1 break-words pt-1 text-sm font-medium sm:pt-0 ${p.done ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                    {p.text}
                  </span>
                  <button
                    onClick={() => onRemovePriority(p.id)}
                    className="rounded-md p-1 text-xs text-[var(--text-muted)] opacity-100 transition-all hover:text-[var(--text-secondary)] sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Remove "${p.text}"`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {priorities.length > 0 && priorities.every(p => p.done) && (
                <div className="mt-2 rounded-lg border border-[var(--success)]/20 bg-[var(--success-soft)]/10 px-3 py-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--success)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Priorities complete
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    {visibleActionDone
                      ? hasJournal
                        ? "First loop complete. Come back tomorrow with one more data point."
                        : "Good. Capture what changed tonight so Weekly Review has context."
                      : "Priority complete. Next: complete one visible action."}
                  </p>
                </div>
              )}
              {priorities.length < 3 && (
                <div className="mt-1">
                  {addingPriority ? (
                    <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-black/[0.12] p-2.5 sm:flex-row sm:p-3">
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
                        className={inputClassName}
                      />
                      <button
                        onClick={onAddPriority}
                        disabled={!priorityInput.trim()}
                        className={`${actionButtonClassName(!priorityInput.trim())} w-full sm:min-h-[2.5rem] sm:w-auto`}
                        style={actionButtonStyle(!priorityInput.trim())}
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddingPriorityChange(true)}
                      className="rounded-lg py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                    >
                      + Add priority
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Quick capture
          </label>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Park tasks, habits, or projects without leaving Today.
          </p>
          <div className="mt-2 rounded-2xl border border-white/[0.06] bg-black/[0.12] p-2.5 sm:p-3">
            <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <input
                  value={quickCapture}
                  onChange={(e) => onQuickCaptureChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onQuickCapture(); }}
                  placeholder="Capture something before it gets lost..."
                  maxLength={200}
                  className={`${inputClassName} w-full pr-24`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium shadow-sm shadow-black/10 ${
                    quickType === "task"
                      ? "border-white/[0.07] bg-[var(--surface)] text-[var(--text-secondary)]"
                      : quickType === "habit"
                        ? "border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]"
                        : "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]"
                  }`}>
                    {quickType === "task" ? "Task" : quickType === "habit" ? "Habit" : "Project"}
                  </span>
                </div>
              </div>
              <button
                onClick={onQuickCapture}
                disabled={!quickCapture.trim() || quickSaving}
                className={`${actionButtonClassName(!quickCapture.trim() || quickSaving)} w-full`}
                style={actionButtonStyle(!quickCapture.trim() || quickSaving)}
              >
                {quickSaving ? "..." : "Add"}
              </button>
            </div>
          </div>
          {quickCapture.trim() && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(["task", "habit", "project"] as const).map((t) => (
                t !== quickType && (
                  <button
                    key={t}
                    onClick={() => onQuickTypeChange(t)}
                    className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] sm:py-0.5"
                  >
                    Save as {t}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
