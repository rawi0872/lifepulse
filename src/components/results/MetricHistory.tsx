"use client";

import { Card } from "@/components/ui/card";
import type { MetricEntryRow, MetricDefinitionRow } from "@/lib/results/types";
import { formatValue, formatDate, formatRelativeTime } from "@/lib/results/format";
import { sortEntriesChronological } from "@/lib/results/calculations";

interface MetricHistoryProps {
  entries: MetricEntryRow[];
  metric: MetricDefinitionRow;
  limit: number;
}

export function MetricHistory({ entries, metric, limit }: MetricHistoryProps) {
  if (entries.length === 0) {
    return (
      <Card className="mb-6 p-4 sm:p-5 text-center">
        <p className="text-[var(--text-muted)]">No results recorded yet.</p>
      </Card>
    );
  }

  const sortedEntries = sortEntriesChronological(entries).reverse();

  return (
    <Card className="mb-6 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">History</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Showing the latest {limit} entries when available.</p>
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {sortedEntries.map((entry, index) => (
          <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-[var(--text)]">{formatValue(entry.value, metric.unit, metric.value_kind)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatDate(entry.recorded_at)} ({formatRelativeTime(entry.recorded_at)})
                </p>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">#{index + 1}</span>
            </div>
            {entry.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{entry.notes}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
