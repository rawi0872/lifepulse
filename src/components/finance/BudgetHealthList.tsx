"use client";

import type { BudgetUsage } from "./types";
import { Card } from "@/components/ui/card";

interface BudgetHealthListProps {
  budgetUsage: BudgetUsage[];
  formatCurrency: (amount: number, currency?: string) => string;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  confirmingDeleteId: string | null;
}

export function BudgetHealthList({ budgetUsage, formatCurrency, onDelete, onRequestDelete, onCancelDelete, confirmingDeleteId }: BudgetHealthListProps) {
  if (budgetUsage.length === 0) {
    return (
      <Card variant="subtle" className="p-5 text-center sm:p-6">
        <p className="break-words text-sm text-[var(--text-muted)]">
          Create a monthly budget for a spending category to see whether you are on track.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      {budgetUsage.map((b) => {
        const barColor =
          b.status === "over_budget"
            ? "var(--danger)"
            : b.status === "near_limit"
            ? "var(--warning)"
            : "var(--accent)";

        const statusLabel =
          b.status === "over_budget"
            ? "Over budget"
            : b.status === "near_limit"
            ? "Near limit"
            : "Within budget";

        const statusColor =
          b.status === "over_budget"
            ? "text-[var(--danger)]"
            : b.status === "near_limit"
            ? "text-[var(--warning)]"
            : "text-[var(--success)]";

        return (
          <Card key={b.budgetId} className="min-w-0 px-3.5 py-3 sm:px-4">
            <div className="mb-1.5 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-sm font-medium text-[var(--text)]">{b.categoryName}</span>
                <span className={`rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
              </div>
              <span className="break-words text-xs text-[var(--text-muted)] sm:shrink-0 sm:text-right">
                {formatCurrency(b.spent)} / {formatCurrency(b.budgetAmount)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(b.percentage, 100)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
              <span className="text-[10px] text-[var(--text-muted)]">{b.percentage}% used</span>
              <button
                type="button"
                onClick={() => onRequestDelete(b.budgetId)}
                className="min-h-10 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] sm:min-h-0 sm:py-0.5"
              >
                Delete
              </button>
            </div>
            {confirmingDeleteId === b.budgetId && (
              <div className="mt-3 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)]/30 p-3">
                <p className="text-xs font-medium text-[var(--text)]">Delete this budget?</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">This removes the monthly budget only. Logged transactions stay unchanged.</p>
                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={onCancelDelete} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] sm:min-h-0 sm:py-1.5">
                    Cancel
                  </button>
                  <button type="button" onClick={() => onDelete(b.budgetId)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                    Delete
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
