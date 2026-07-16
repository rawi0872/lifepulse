"use client";

import { HelpPopover } from "@/components/HelpPopover";
import { formatDate } from "@/lib/utils";
import { getLevelInfo } from "@/lib/levels";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

interface TodaysPulseHeaderProps {
  totalXp: number;
  todayXp: number;
  subtitle: string;
}

export function TodaysPulseHeader({ totalXp, todayXp, subtitle }: TodaysPulseHeaderProps) {
  const { level, xpNeededForNext, progressPercent } = getLevelInfo(totalXp);

  return (
    <header className="mb-5 sm:mb-6">
      <span className="sr-only">Today Command Center</span>
      <div className="flex min-w-0 items-start justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Today
            </span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="min-w-0 text-xs text-[var(--text-muted)]">
              {subtitle}
            </span>
          </div>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.045em] text-[var(--text)] sm:text-4xl">
            Good {getGreeting()}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-muted)]">
            {formatDate(new Date())}
            <HelpPopover title="Today">
              <p>Use Today to choose one priority, capture loose work, complete visible actions, and reflect tonight.</p>
            </HelpPopover>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-[15px]">
            Choose one priority, complete one visible action, and review what changed tonight.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className="font-medium text-[var(--text-secondary)]">Level {level}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--success))] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[var(--text-muted)]">+{todayXp} XP today</span>
            <span className="text-[var(--text-muted)]">{xpNeededForNext} XP to next level</span>
          </div>
        </div>
      </div>
    </header>
  );
}
