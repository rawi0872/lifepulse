"use client";

import { Card } from "@/components/ui/card";

interface HabitStreaksCardProps {
  habitCount: number;
  longestStreak: number;
  activeStreaks: number;
  bestEverStreak: number;
}

export function HabitStreaksCard({
  habitCount,
  longestStreak,
  activeStreaks,
  bestEverStreak,
}: HabitStreaksCardProps) {
  if (habitCount === 0) {
    return (
      <Card variant="subtle" className="mb-6 border-dashed border-[var(--border)]">
        <div className="p-4 text-center">
          <p className="text-sm text-[var(--text-muted)]">No habits yet.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Build a streak by completing habits consistently.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-[var(--border-strong)]">
      <div className="grid min-w-0 grid-cols-3 gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="min-w-0 text-center">
          <p className="break-words text-2xl font-bold text-[var(--accent)] sm:text-3xl">{longestStreak}</p>
          <p className="mt-1 break-words text-xs text-[var(--text-muted)]">Longest current</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words text-2xl font-bold text-[var(--text)] sm:text-3xl">{activeStreaks}</p>
          <p className="mt-1 break-words text-xs text-[var(--text-muted)]">Active {activeStreaks === 1 ? "streak" : "streaks"}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="break-words text-2xl font-bold text-[var(--text)] sm:text-3xl">{bestEverStreak}</p>
          <p className="mt-1 break-words text-xs text-[var(--text-muted)]">Best ever</p>
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-5 py-3">
        <p className="break-words text-xs text-[var(--text-muted)]">
          Streaks count expected habit days. Rest days do not break streaks.
        </p>
      </div>
    </Card>
  );
}
