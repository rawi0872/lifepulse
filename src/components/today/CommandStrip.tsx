"use client";

import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { formatMoney } from "@/lib/config";

interface CommandStripProps {
  completedHabitCount: number;
  dueHabitsLength: number;
  doneTaskCount: number;
  tasksLength: number;
  hasJournal: boolean;
  todayXp: number;
  financeNet: number | null;
  financeHasTx: boolean;
}

export function CommandStrip({
  completedHabitCount,
  dueHabitsLength,
  doneTaskCount,
  tasksLength,
  hasJournal,
  todayXp,
  financeNet,
  financeHasTx,
}: CommandStripProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
      <MetricCard
        className="min-w-0 py-3 sm:py-2.5"
        label="Habits"
        value={`${completedHabitCount}/${dueHabitsLength}`}
        active={completedHabitCount === dueHabitsLength && dueHabitsLength > 0}
        icon={
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
      />
      <MetricCard
        className="min-w-0 py-3 sm:py-2.5"
        label="Tasks"
        value={`${doneTaskCount}/${tasksLength}`}
        active={doneTaskCount > 0 && doneTaskCount === tasksLength && tasksLength > 0}
        icon={
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        }
      />
      <MetricCard
        className="min-w-0 py-3 sm:py-2.5"
        label="Reflect"
        value={hasJournal ? "Done" : "\u2014"}
        active={hasJournal}
        icon={
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
      />
      <MetricCard
        className="min-w-0 py-3 sm:py-2.5"
        label="XP Today"
        value={`+${todayXp}`}
        active={todayXp > 0}
        icon={
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />
      <Link href="/finance" className="contents">
        <MetricCard
          className="min-w-0 py-3 sm:py-2.5"
          label="Money"
          value={financeHasTx && financeNet !== null ? formatMoney(financeNet) : "\u2014"}
          active={financeHasTx}
          trend={financeNet !== null && financeNet < 0 ? "down" : financeNet !== null && financeNet >= 0 ? "up" : undefined}
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </Link>
    </div>
  );
}
