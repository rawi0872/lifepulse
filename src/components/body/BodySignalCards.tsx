"use client";

import { MetricCard } from "@/components/ui/metric-card";

interface BodySignalCardsProps {
  habitStreak: number;
  completionRate: number;
  totalXp: number;
}

export function BodySignalCards({ habitStreak, completionRate, totalXp }: BodySignalCardsProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricCard
        label="Best Streak"
        value={habitStreak}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
        }
        trend={habitStreak > 0 ? "up" : "neutral"}
        active={habitStreak > 0}
      />
      <MetricCard
        label="Completion"
        value={`${completionRate}%`}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        trend={completionRate >= 50 ? "up" : completionRate > 0 ? "neutral" : "down"}
        active={completionRate >= 50}
      />
      <MetricCard
        label="Total XP"
        value={totalXp}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        trend={totalXp > 0 ? "up" : "neutral"}
        active={totalXp > 0}
      />
    </div>
  );
}
