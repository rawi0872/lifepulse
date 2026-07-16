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
      <div className="flex min-w-0 items-start justify-between rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(244,247,251,0.035),rgba(244,247,251,0.01))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent-ghost)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              Today Command Center
            </span>
            <span className="min-w-0 text-[10px] tracking-[0.12em] text-[var(--text-muted)]">
              {subtitle}
            </span>
          </div>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-4xl">
            Good {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-muted)]">
            {formatDate(new Date())}
            <HelpPopover title="Today">
              <p>Use Today to choose one priority, capture loose work, complete visible actions, and reflect tonight.</p>
            </HelpPopover>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-[15px]">
            Your day, reduced to the next move. Start with one priority, then complete one visible action.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-2 py-1 text-[10px] font-medium text-[var(--accent-strong)]">Level {level}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/30 ring-1 ring-inset ring-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--success))] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
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
