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
  const { level, progressPercent } = getLevelInfo(totalXp);

  return (
    <header className="mb-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
              Today&apos;s Pulse
            </span>
            <div className="h-1 w-1 rounded-full bg-[var(--accent)]/40" />
            <span className="text-[10px] text-[var(--text-muted)] tracking-wider">
              {subtitle}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
            Good {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {formatDate(new Date())}
            <HelpPopover title="Today's Pulse">
              <p>This is your Life OS command center. Set priorities, complete habits and tasks, then reflect in the evening to keep your life in motion.</p>
            </HelpPopover>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-[10px] font-medium text-[var(--accent)]">Level {level}</span>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">+{todayXp} XP today</span>
          </div>
        </div>
      </div>
    </header>
  );
}
