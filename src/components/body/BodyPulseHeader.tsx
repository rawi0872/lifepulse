"use client";

import { LifePulseLogo } from "@/components/LifePulseLogo";
import { cn } from "@/lib/utils";

interface BodyPulseHeaderProps {
  habitCount: number;
  taskCount: number;
  journalCount: number;
}

export function BodyPulseHeader({ habitCount, taskCount, journalCount }: BodyPulseHeaderProps) {
  return (
    <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[radial-gradient(circle_at_top_left,var(--success-soft),transparent_34%),var(--surface-soft)] px-4 py-4 shadow-sm shadow-black/10 sm:px-5">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--success)]/20 to-[var(--success)]/5 ring-1 ring-[var(--success)]/10">
          <LifePulseLogo variant="mark" size="sm" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">Body check-in</p>
          <h1 className="break-words text-xl font-bold tracking-tight text-[var(--text)]">Body Pulse</h1>
          <p className="mt-1 max-w-xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
            Track what you log. Notice patterns over time. This is not medical advice or a body score.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Start with today&apos;s weight, food, water, or energy.</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
        <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--success)]">
          {habitCount} habits
        </span>
        <span className="rounded-full bg-[var(--surface-active)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
          {taskCount} tasks
        </span>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-medium",
          journalCount > 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-active)] text-[var(--text-muted)]",
        )}>
          {journalCount} journal entries
        </span>
      </div>
      </div>
    </div>
  );
}
