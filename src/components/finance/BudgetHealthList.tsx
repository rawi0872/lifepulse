"use client";

import type { BudgetUsage } from "./types";
import { Card } from "@/components/ui/card";

interface BudgetHealthListProps {
  budgetUsage: BudgetUsage[];
  formatCurrency: (amount: number, currency?: string) => string;
  onDelete: (id: string) => void;
}

export function BudgetHealthList({ budgetUsage, formatCurrency, onDelete }: BudgetHealthListProps) {
  if (budgetUsage.length === 0) {
    return (
      <Card variant="subtle" className="p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">
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
            : "On track";

        const statusColor =
          b.status === "over_budget"
            ? "text-[var(--danger)]"
            : b.status === "near_limit"
            ? "text-[var(--warning)]"
            : "text-[var(--success)]";

        return (
          <Card key={b.budgetId} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-[var(--text)] truncate">{b.categoryName}</span>
                <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)] shrink-0">
                {formatCurrency(b.spent)} / {formatCurrency(b.budgetAmount)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--surface)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(b.percentage, 100)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">{b.percentage}% used</span>
              <button
                type="button"
                onClick={() => onDelete(b.budgetId)}
                className="rounded-md px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
              >
                Delete
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
