"use client";

import Link from "next/link";
import { HabitCard } from "@/components/HabitCard";
import { EmptyState } from "@/components/ui/empty-state";

interface RealmInfo {
  name: string;
  color: string;
  icon: string;
}

interface Habit {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  days_of_week: number[] | null;
  times_per_week: number | null;
  realms: RealmInfo | null;
}

interface BodyPulseSectionProps {
  dueHabits: Habit[];
  completedHabitIds: Set<string>;
  completedHabitCount: number;
  dueHabitsLength: number;
  streakMap: Record<string, number>;
  weeklyProgressMap: Record<string, { completed: number; target: number } | null>;
  onToggleHabit: (habitId: string, isCompleted: boolean) => void;
}

export function BodyPulseSection({
  dueHabits,
  completedHabitIds,
  completedHabitCount,
  dueHabitsLength,
  streakMap,
  weeklyProgressMap,
  onToggleHabit,
}: BodyPulseSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--text)]">Body Pulse</h2>
          <span className="text-xs text-[var(--text-muted)]">{completedHabitCount}/{dueHabitsLength}</span>
        </div>
        <Link href="/habits" className="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
          Manage
        </Link>
      </div>
      {dueHabits.length === 0 ? (
        <EmptyState
          eyebrow="Habits"
          title="No habits due today."
          message="When you are ready, add one small repeatable action you can actually keep."
          compact
          action={
            <Link href="/habits" className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:bg-transparent sm:px-0">
              Add one habit &rarr;
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {dueHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              isCompleted={completedHabitIds.has(habit.id)}
              onToggle={onToggleHabit}
              streak={streakMap[habit.id]}
              weeklyProgress={weeklyProgressMap[habit.id] ?? null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
