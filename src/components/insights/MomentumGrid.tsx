"use client";

import { Card } from "@/components/ui/card";

interface MomentumGridProps {
  todayXp: number;
  today: string;
  activeProjectCount: number;
  taskCount: number;
  doneTaskCount: number;
  taskCompletionRate: number;
  journalCount: number;
}

export function MomentumGrid({
  todayXp,
  today,
  activeProjectCount,
  taskCount,
  doneTaskCount,
  taskCompletionRate,
  journalCount,
}: MomentumGridProps) {
  return (
    <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
      <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
        <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">XP today</p>
        <p className="mt-2 break-words text-2xl font-bold text-[var(--accent)]">+{todayXp}</p>
        <p className="mt-auto break-words pt-2 text-[10px] text-[var(--text-muted)]">{today}</p>
      </Card>
      <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
        <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Active projects</p>
        <p className="mt-2 break-words text-2xl font-bold text-[var(--success)]">{activeProjectCount}</p>
        <p className="mt-auto break-words pt-2 text-[10px] text-[var(--text-muted)]">{activeProjectCount === 1 ? "Project in progress" : "Projects in progress"}</p>
      </Card>
      <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
        <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Task completion</p>
        <p className="mt-2 break-words text-2xl font-bold text-[var(--text)]">
          {taskCount > 0 ? `${taskCompletionRate}%` : "\u2014"}
        </p>
        <p className="mt-auto break-words pt-2 text-[10px] text-[var(--text-muted)]">
          {taskCount > 0 ? `${doneTaskCount} of ${taskCount} done` : "No tasks yet"}
        </p>
      </Card>
      <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
        <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Journal</p>
        <p className="mt-2 break-words text-2xl font-bold text-[var(--text)]">{journalCount}</p>
        <p className="mt-auto break-words pt-2 text-[10px] text-[var(--text-muted)]">{journalCount === 1 ? "Entry written" : "Entries written"}</p>
      </Card>
    </div>
  );
}
