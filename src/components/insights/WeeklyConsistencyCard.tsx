"use client";

import { Card } from "@/components/ui/card";

interface WeeklyConsistencyCardProps {
  habitCount: number;
  weekHabitLogs: number;
  weekDueHabits: number;
  weekHabitRate: number | null;
}

export function WeeklyConsistencyCard({
  habitCount,
  weekHabitLogs,
  weekDueHabits,
  weekHabitRate,
}: WeeklyConsistencyCardProps) {
  if (habitCount === 0) {
    return (
      <Card variant="subtle" className="mb-6 border-dashed border-[var(--border)]">
        <div className="p-4 text-center">
          <p className="text-sm text-[var(--text-muted)]">No habits yet.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Create habits to track your weekly consistency.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-[var(--border-strong)]">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Habit consistency</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {weekHabitLogs} of {weekDueHabits} expected check-ins this week
            </p>
          </div>
          <span className="text-3xl font-bold tabular-nums text-[var(--accent)]">
            {weekHabitRate ?? 0}%
          </span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-all shadow-sm shadow-[var(--accent)]/10"
            style={{ width: `${weekHabitRate ?? 0}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Daily habits counted 7&times;/week. Weekly habits count based on their target.
        </p>
      </div>
    </Card>
  );
}
