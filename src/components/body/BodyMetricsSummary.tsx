"use client";

import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import type { BodyMetrics } from "@/lib/bodyMetrics";

interface BodyMetricsSummaryProps {
  recent: BodyMetrics[];
}

export function BodyMetricsSummary({ recent }: BodyMetricsSummaryProps) {
  const hasData = recent.length > 0;

  return (
    <PulseCard title="Recent Body Data" accent="success" description="Last 7 days">
      {!hasData ? (
        <div className="p-4">
          <EmptyState
            message="No body metrics logged yet."
            description="Use the form to start tracking daily signals."
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {recent.slice(0, 7).map((entry) => {
            const date = new Date(entry.entry_date);
            const isToday = date.toDateString() === new Date().toDateString();
            const fields: string[] = [];
            if (entry.sleep_hours !== null) fields.push(`${entry.sleep_hours}h sleep`);
            if (entry.energy !== null) fields.push(`Energy ${entry.energy}/5`);
            if (entry.steps !== null) fields.push(`${entry.steps.toLocaleString()} steps`);
            if (entry.workout_minutes !== null) fields.push(`${entry.workout_minutes}min workout`);
            if (entry.recovery_score !== null) fields.push(`Recovery ${entry.recovery_score}`);
            if (entry.weight_kg !== null) fields.push(`${entry.weight_kg}kg`);

            return (
              <div key={entry.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[9px] font-medium text-[var(--success)]">Logged</span>
                  )}
                </div>
                {fields.length > 0 && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{fields.join(" · ")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasData && (
        <div className="border-t border-[var(--border)] px-4 py-2">
          <Link href="/body" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
            View all body data &rarr;
          </Link>
        </div>
      )}
    </PulseCard>
  );
}
