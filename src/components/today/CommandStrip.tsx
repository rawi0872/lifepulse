"use client";

import Link from "next/link";
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
    <div className="mb-5 border-y border-[var(--border)] py-2">
      <div className="grid grid-cols-5 divide-x divide-[var(--border)]">
        <InstrumentCell label="Habits" value={`${completedHabitCount}/${dueHabitsLength}`} active={completedHabitCount === dueHabitsLength && dueHabitsLength > 0} />
        <InstrumentCell label="Tasks" value={`${doneTaskCount}/${tasksLength}`} active={doneTaskCount > 0 && doneTaskCount === tasksLength && tasksLength > 0} />
        <InstrumentCell label="Reflect" value={hasJournal ? "Done" : "\u2014"} active={hasJournal} />
        <InstrumentCell label="XP Today" value={`+${todayXp}`} active={todayXp > 0} />
        <Link href="/finance" className="min-w-0 transition-colors hover:bg-white/[0.035]">
          <InstrumentCell label="Money" value={financeHasTx && financeNet !== null ? formatMoney(financeNet) : "\u2014"} active={financeHasTx} />
        </Link>
      </div>
    </div>
  );
}

function InstrumentCell({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="min-w-0 px-1.5 py-1.5 text-center sm:px-4 sm:py-2 sm:text-left">
      <p className={`truncate text-sm font-semibold tracking-[-0.02em] sm:text-base ${active ? "text-[var(--accent-strong)]" : "text-[var(--text)]"}`}>{value}</p>
      <p className="mt-0.5 truncate text-[9px] text-[var(--text-muted)] sm:text-[10px]">{label}</p>
    </div>
  );
}
