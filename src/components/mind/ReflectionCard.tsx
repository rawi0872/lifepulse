"use client";

import Link from "next/link";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";

interface JournalEntry {
  id: string;
  content: string | null;
  reflection_prompt: string | null;
  created_at: string;
}

interface ReflectionCardProps {
  entries: JournalEntry[];
}

export function ReflectionCard({ entries }: ReflectionCardProps) {
  const latest = entries[0];

  return (
    <PulseCard title="Recent Reflections" accent="accent" description="Journal entries" action={
      <Link href="/journal" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
        Write
      </Link>
    }>
      {!latest ? (
        <div className="p-4">
          <EmptyState
            message="No journal entries yet."
            action={
              <Link href="/journal" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Write your first entry &rarr;
              </Link>
            }
          />
        </div>
      ) : (
        <div className="p-4">
          <p className="mb-1 text-[10px] text-[var(--text-muted)]">
            {new Date(latest.created_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {latest.reflection_prompt && (
            <p className="mb-2 text-xs font-medium italic text-[var(--text-secondary)]">
              &ldquo;{latest.reflection_prompt}&rdquo;
            </p>
          )}
          {latest.content && (
            <p className="line-clamp-3 text-sm leading-relaxed text-[var(--text)]">
              {latest.content}
            </p>
          )}
          <div className="mt-3">
            <Link
              href="/journal"
              className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
            >
              View all entries &rarr;
            </Link>
          </div>
        </div>
      )}
    </PulseCard>
  );
}
