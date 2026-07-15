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
  firstName: string;
  totalXp: number;
  todayXp: number;
  subtitle: string;
}

export function TodaysPulseHeader({ firstName, totalXp, todayXp, subtitle }: TodaysPulseHeaderProps) {
  const { level, xpNeededForNext, progressPercent } = getLevelInfo(totalXp);

  return (
    <header className="mb-4 sm:mb-5">
      <div className="flex min-w-0 items-start justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
              Today Command Center
            </span>
            <div className="hidden h-1 w-1 rounded-full bg-[var(--accent)]/40 sm:block" />
            <span className="min-w-0 text-[10px] tracking-wider text-[var(--text-muted)]">
              {subtitle}
            </span>
          </div>
          <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight text-[var(--text)]">
            Good {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-muted)]">
            {formatDate(new Date())}
            <HelpPopover title="Today">
              <p>Use Today to choose one priority, capture loose work, complete visible actions, and reflect tonight.</p>
            </HelpPopover>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Your next useful move is below. Start with one priority, then complete one visible action.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-medium text-[var(--accent)]">Level {level}</span>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">+{todayXp} XP today</span>
            <span className="text-[10px] text-[var(--text-muted)]">Next level: {xpNeededForNext} XP away</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
            Small actions become progress you can see.
          </p>
        </div>
      </div>
    </header>
  );
}
