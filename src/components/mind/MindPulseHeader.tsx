"use client";

import { LifePulseLogo } from "@/components/LifePulseLogo";
import { cn } from "@/lib/utils";

interface MindPulseHeaderProps {
  journalCount: number;
  journalStreak: number;
  avgMood: number | null;
}

export function MindPulseHeader({ journalCount, journalStreak, avgMood }: MindPulseHeaderProps) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 ring-1 ring-[var(--accent)]/10">
          <LifePulseLogo variant="mark" size="sm" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Private mind check-in</p>
          <h1 className="break-words text-xl font-bold tracking-tight text-[var(--text)]">Mind Pulse</h1>
          <p className="mt-1 max-w-xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
            Log what affected today with simple mood, energy, stress, focus, and note tracking. Manual context only, not clinical or medical guidance.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">One honest note is enough. Leave anything blank.</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-medium",
          journalCount > 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-active)] text-[var(--text-muted)]",
        )}>
          {journalCount} entries
        </span>
        {journalStreak > 0 && (
          <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--success)]">
            {journalStreak} day streak
          </span>
        )}
        {avgMood !== null && (
          <span className="rounded-full bg-[var(--surface-active)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
            Mood {avgMood.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
