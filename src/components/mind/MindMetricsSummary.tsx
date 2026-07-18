"use client";

import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import type { MindMetrics } from "@/lib/mindMetrics";

interface MindMetricsSummaryProps {
  recent: MindMetrics[];
}

export function MindMetricsSummary({ recent }: MindMetricsSummaryProps) {
  const hasData = recent.length > 0;

  return (
    <PulseCard title="Recent mind context" accent="accent" description="Last 7 days">
      {!hasData ? (
        <div className="p-4">
          <EmptyState
            message="No mind metrics logged yet."
            description="A few private check-ins make broader patterns easier to review."
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {recent.slice(0, 7).map((entry) => {
            const date = new Date(entry.entry_date);
            const isToday = date.toDateString() === new Date().toDateString();
            const parts: string[] = [];
            if (entry.mood !== null) parts.push(`Mood ${entry.mood}/5`);
            if (entry.focus !== null) parts.push(`Focus ${entry.focus}/5`);
            if (entry.stress !== null) parts.push(`Stress ${entry.stress}/5`);
            if (entry.tags && entry.tags.length > 0) parts.push(entry.tags.join(", "));

            return (
              <div key={entry.id} className="px-4 py-2.5">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="break-words text-xs font-medium text-[var(--text-muted)]">
                    {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {isToday && (
                     <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-medium text-[var(--accent)]">Logged</span>
                  )}
                </div>
                {parts.length > 0 && (
                  <p className="mt-0.5 break-words text-xs text-[var(--text-secondary)]">{parts.join(" · ")}</p>
                )}
                {entry.reflection && (
                  <p className="mt-0.5 break-words text-[10px] text-[var(--text-muted)] sm:line-clamp-1">&ldquo;{entry.reflection}&rdquo;</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasData && (
        <div className="border-t border-[var(--border)] px-4 py-2">
          <Link href="/mind" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
            View all mind data &rarr;
          </Link>
        </div>
      )}
    </PulseCard>
  );
}
