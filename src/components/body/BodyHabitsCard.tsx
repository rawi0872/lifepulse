"use client";

import Link from "next/link";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";

interface HabitInfo {
  id: string;
  title: string;
  streak: number;
  completionRate: number;
}

interface BodyHabitsCardProps {
  habits: HabitInfo[];
}

export function BodyHabitsCard({ habits }: BodyHabitsCardProps) {
  return (
    <PulseCard title="Body Habits" accent="success" description="Health and fitness habits" action={
      <Link href="/habits" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
        Manage
      </Link>
    }>
      {habits.length === 0 ? (
        <div className="p-4">
          <EmptyState
            message="No body-related habits yet."
            action={
              <Link href="/habits" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Create a habit &rarr;
              </Link>
            }
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {habits.map((habit) => (
            <div key={habit.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--text)]">{habit.title}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--text-muted)]">{habit.completionRate}%</span>
                {habit.streak > 0 && (
                  <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                    {habit.streak} streak
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PulseCard>
  );
}
