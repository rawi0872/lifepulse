"use client";

import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

interface JournalEntry {
  id: string;
  mood: number | null;
  energy: number | null;
  created_at: string;
}

interface MoodEnergyCardProps {
  entries: JournalEntry[];
}

export function MoodEnergyCard({ entries }: MoodEnergyCardProps) {
  const recent = entries.slice(0, 7);
  const hasData = recent.some((e) => e.mood !== null || e.energy !== null);

  return (
    <PulseCard title="Mood & Energy" accent="accent" description="Last 7 days">
      {!hasData ? (
        <div className="p-4">
          <EmptyState
            message="No mood or energy data yet."
            action={
              <Link href="/journal" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Write a journal entry &rarr;
              </Link>
            }
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {recent.map((entry) => (
            <div key={entry.id} className="flex min-w-0 flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-words text-xs text-[var(--text-muted)]">
                {new Date(entry.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {entry.mood !== null && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Mood</span>
                    <span className="text-sm font-medium text-[var(--text)]">{entry.mood}/5</span>
                  </div>
                )}
                {entry.energy !== null && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Energy</span>
                    <span className="text-sm font-medium text-[var(--text)]">{entry.energy}/5</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PulseCard>
  );
}
