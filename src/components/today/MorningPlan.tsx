"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { TodayModel } from "@/lib/today/types";
import {
  getMorningPlanAttentionItems,
  selectMorningPlanFirstAction,
  type TodayLocalPriority,
} from "@/lib/today/morning-plan";

interface MorningPlanProps {
  model: TodayModel;
  priorities: TodayLocalPriority[];
  intent: string;
  timePeriod: "morning" | "day" | "evening";
  onIntentChange: (value: string) => void;
  onToggleTask: (taskId: string, isDone: boolean) => Promise<void> | void;
  onToggleHabit: (habitId: string, isCompleted: boolean) => Promise<void> | void;
}

export function MorningPlan({
  model,
  priorities,
  intent,
  timePeriod,
  onIntentChange,
  onToggleTask,
  onToggleHabit,
}: MorningPlanProps) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const firstAction = selectMorningPlanFirstAction(model, priorities);
  const attentionItems = getMorningPlanAttentionItems(model, 5);
  const activePriorities = priorities.slice(0, 3);
  const isMorning = timePeriod === "morning";

  async function completeFirstAction() {
    if (!firstAction || pendingActionId) return;
    setPendingActionId(`${firstAction.type}:${firstAction.id}`);
    try {
      if (firstAction.type === "task") {
        await onToggleTask(firstAction.id, true);
      } else {
        await onToggleHabit(firstAction.id, true);
      }
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <section id="morning-plan" className="mb-5 scroll-mt-24 sm:mb-6" aria-labelledby="morning-plan-heading">
      <Card className={`overflow-hidden ${isMorning ? "border-[var(--accent)]/28 bg-[linear-gradient(135deg,rgba(122,162,199,0.12),rgba(244,247,251,0.035)),var(--surface)] shadow-xl shadow-black/20" : "border-white/[0.08] bg-[linear-gradient(180deg,rgba(244,247,251,0.026),rgba(244,247,251,0.006)),var(--surface)]"}`}>
        <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
                Morning plan
              </p>
              <h2 id="morning-plan-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                Start the day without sorting everything.
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
                A short local plan from today&apos;s tasks, due habits, and your local priorities.
              </p>
            </div>
            <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-medium ${isMorning ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)]"}`}>
              {isMorning ? "Morning emphasis" : timePeriod === "day" ? "Available for today" : "Still available"}
            </span>
          </div>
        </div>

        <div className="grid min-w-0 gap-0 divide-y divide-[var(--border)] lg:grid-cols-[1.1fr_0.9fr] lg:divide-x lg:divide-y-0">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="rounded-2xl border border-[var(--accent)]/20 bg-black/[0.12] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Start here</p>
              {firstAction ? (
                <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                        {firstAction.reason}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                        {firstAction.type === "task" ? "Task" : "Habit"}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-lg font-semibold leading-snug text-[var(--text)]">
                      {firstAction.title}
                    </p>
                    {firstAction.type === "task" && (firstAction.context?.projectTitle || firstAction.context?.goalContext) && (
                      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 text-[10px] text-[var(--text-muted)]">
                        {firstAction.context.projectTitle && <span className="rounded-full bg-[var(--surface)] px-2 py-1">Project: {firstAction.context.projectTitle}</span>}
                        {firstAction.context.goalContext && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">{firstAction.context.goalContext}</span>}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={completeFirstAction}
                    disabled={Boolean(pendingActionId)}
                    aria-label={`Mark "${firstAction.title}" as complete`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)] px-4 text-sm font-semibold text-[#071018] transition-all hover:bg-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingActionId ? "Saving..." : "Mark complete"}
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm font-medium text-[var(--text)]">Nothing urgent is waiting.</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    Choose one useful action or add a task when something needs to become concrete.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <a href="#quick-capture" className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-2 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
                      Use quick capture
                    </a>
                    <Link href="/tasks" className="rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">
                      Open tasks
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="morning-intent" className="text-xs font-medium text-[var(--text-secondary)]">
                What would make today count?
              </label>
              <input
                id="morning-intent"
                value={intent}
                onChange={(event) => onIntentChange(event.target.value)}
                maxLength={160}
                placeholder="One sentence for this device, today only."
                aria-describedby="morning-intent-note"
                className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.09] bg-[rgba(8,11,15,0.72)] px-3.5 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/80 shadow-inner shadow-black/20 transition-all focus:border-[var(--accent-strong)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/12"
              />
              <p id="morning-intent-note" className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                Saved on this device for today. Not synced.
              </p>
            </div>
          </div>

          <div className="min-w-0 divide-y divide-[var(--border)]">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--text)]">Today&apos;s priorities</h3>
                <a href="#daily-focus" className="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">Manage</a>
              </div>
              {activePriorities.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {activePriorities.map((priority) => (
                    <div key={priority.id} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                      <p className={`break-words text-sm font-medium ${priority.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
                        {priority.text}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {priority.done ? "Completed priority" : "Local priority"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-black/[0.08] px-3 py-3 text-xs text-[var(--text-muted)]">
                  Choose up to three priorities for today.
                </p>
              )}
              {activePriorities.length < 3 && (
                <a href="#daily-focus" className="mt-3 inline-flex min-h-10 items-center rounded-lg text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
                  Add priority below &rarr;
                </a>
              )}
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--text)]">Needs attention</h3>
                <a href="#daily-execution" className="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">See all</a>
              </div>
              {attentionItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {attentionItems.map((item) => (
                    <div key={`${item.type}:${item.id}`} className="flex min-w-0 items-start gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2.5">
                      <span className="mt-0.5 shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                        {item.label}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-xs font-medium leading-relaxed text-[var(--text-secondary)]">
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-black/[0.08] px-3 py-3 text-xs text-[var(--text-muted)]">
                  No overdue tasks, due-today tasks, or incomplete due habits.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
