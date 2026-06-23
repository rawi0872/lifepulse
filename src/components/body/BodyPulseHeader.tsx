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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--success)]/20 to-[var(--success)]/5 ring-1 ring-[var(--success)]/10">
          <LifePulseLogo variant="mark" size="sm" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">Body Pulse</h1>
          <p className="text-xs text-[var(--text-muted)]">Physical health, fitness, and recovery signals</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--success)]">
          {habitCount} habits
        </span>
        <span className="rounded-full bg-[var(--surface-active)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          {taskCount} tasks
        </span>
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
          journalCount > 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-active)] text-[var(--text-muted)]",
        )}>
          {journalCount} journal entries
        </span>
      </div>
    </div>
  );
}
