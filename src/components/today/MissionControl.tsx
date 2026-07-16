"use client";

import { Card } from "@/components/ui/card";
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
    <Card className="mb-4 overflow-hidden border-[var(--accent)]/25 bg-[linear-gradient(135deg,rgba(244,247,251,0.075),rgba(122,162,199,0.055)_42%,rgba(11,13,16,0.18)),var(--surface)] shadow-[0_24px_80px_rgba(0,0,0,0.36)] ring-1 ring-white/[0.035] sm:mb-5">
      <div className="relative border-b border-white/[0.07] px-4 py-4 sm:px-5 sm:py-5">
        <div aria-hidden className="absolute right-4 top-4 hidden h-14 w-28 rounded-full border border-[var(--accent)]/10 sm:block" />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Start here / command surface
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-[var(--text)] sm:text-3xl">
              Choose the next useful move.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Set one priority. Park the distractions. Keep the morning pointed at one visible action.
            </p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] shadow-inner shadow-black/30">
            First screen
          </span>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-white/[0.07] bg-black/[0.08] lg:grid-cols-[1.05fr_0.95fr] lg:divide-x lg:divide-y-0">
        <div className="p-4 sm:p-5">
          <label className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-secondary)]">
            One priority
          </label>
          {priorities.length === 0 ? (
            <div className="mt-2 flex min-w-0 flex-col gap-2.5 sm:flex-row">
              <input
                value={priorityInput}
                onChange={(e) => onPriorityInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onAddPriority(); }}
                placeholder={focusPrompt}
                maxLength={200}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-[var(--text)] placeholder-[var(--text-muted)] shadow-inner shadow-black/20 transition-all duration-150 focus:border-[var(--accent)]/55 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-2.5"
              />
              <Button onClick={onAddPriority} disabled={!priorityInput.trim()} className="w-full bg-[linear-gradient(180deg,var(--accent-strong),var(--accent))] text-[#071018] shadow-lg shadow-[var(--accent)]/15 hover:brightness-110 sm:w-auto">
                Set priority
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {priorities.map((p) => (
                <div key={p.id} className="group flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 shadow-inner shadow-black/10 transition-all duration-200 sm:items-center sm:py-2.5">
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
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--success)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Priorities complete
                </div>
              )}
              {priorities.length < 3 && (
                <div className="mt-1">
                  {addingPriority ? (
                    <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row">
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
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/55 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-2"
                      />
                      <button
                        onClick={onAddPriority}
                        disabled={!priorityInput.trim()}
                        className="rounded-lg px-3 py-2 text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] disabled:text-[var(--text-muted)] sm:px-0 sm:py-0"
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
          <label className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-secondary)]">
            Quick capture
          </label>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Park tasks, habits, or projects without leaving Today.
          </p>
          <div className="mt-2 flex min-w-0 flex-col gap-2.5 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <input
                value={quickCapture}
                onChange={(e) => onQuickCaptureChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onQuickCapture(); }}
                placeholder="Capture something before it gets lost..."
                maxLength={200}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 pr-24 text-sm text-[var(--text)] placeholder-[var(--text-muted)] shadow-inner shadow-black/20 transition-all duration-150 focus:border-[var(--accent)]/55 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-2.5"
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
            <Button onClick={onQuickCapture} disabled={!quickCapture.trim() || quickSaving} className="w-full bg-[linear-gradient(180deg,var(--accent-strong),var(--accent))] text-[#071018] shadow-lg shadow-[var(--accent)]/15 hover:brightness-110 sm:w-auto">
              {quickSaving ? "..." : "Add"}
            </Button>
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
