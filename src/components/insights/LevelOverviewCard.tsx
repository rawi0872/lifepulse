"use client";

import { Card } from "@/components/ui/card";

interface LevelOverviewCardProps {
  level: number;
  overallTitle: string;
  progressPercent: number;
  xpNeededForNext: number;
  totalXp: number;
}

export function LevelOverviewCard({
  level,
  overallTitle,
  progressPercent,
  xpNeededForNext,
  totalXp,
}: LevelOverviewCardProps) {
  return (
    <Card variant="subtle" className="mb-6 border-[var(--border)]">
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent-ghost)] ring-1 ring-[var(--accent)]/20">
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--accent)]">{level}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)] truncate">{overallTitle}</p>
            <p className="text-[10px] text-[var(--text-muted)] shrink-0">{xpNeededForNext} XP to next</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] shadow-sm shadow-[var(--accent)]/10 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">{totalXp} total XP</p>
        </div>
      </div>
    </Card>
  );
}
