"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FinanceTransaction } from "./types";
import { formatCurrency } from "./financeUtils";

interface TransactionListProps {
  transactions: FinanceTransaction[];
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

export function TransactionList({ transactions, onEdit, onDelete, onAddNew }: TransactionListProps) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered =
    filter === "all"
      ? transactions
      : transactions.filter((tx) => tx.type === filter);

  const chips = [
    { key: "all", label: "All" },
    { key: "income", label: "Income" },
    { key: "expense", label: "Expense" },
  ] as const;

  if (transactions.length === 0) {
    return (
      <Card variant="subtle" className="p-5 text-center sm:p-6">
        <p className="mb-3 break-words text-sm text-[var(--text-muted)]">
          Add your first transaction to start seeing charts, trends, and insights.
        </p>
        <Button size="sm" onClick={onAddNew}>
          Add your first transaction
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => { setFilter(chip.key); setConfirmDelete(null); }}
            className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:min-h-0 ${
              filter === chip.key
                ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {filtered.map((tx) => {
          const isExpense = tx.type === "expense";
          const catName = tx.finance_categories?.name ?? "Uncategorized";
          const acctName = tx.finance_accounts?.name;

          return (
            <Card
              key={tx.id}
              className="flex min-w-0 flex-col gap-3 px-3.5 py-3 animate-fade-in sm:flex-row sm:items-center sm:px-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-[var(--text)]">{tx.title}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    isExpense
                      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                      : "bg-[var(--success-soft)] text-[var(--success)]"
                  }`}>
                    {catName}
                  </span>
                  {acctName && (
                    <span className="text-[10px] text-[var(--text-muted)] sm:shrink-0">
                      {acctName}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 break-words text-xs text-[var(--text-muted)]">
                  {new Date(tx.transaction_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {tx.note && <span> · {tx.note}</span>}
                </p>
              </div>
              <p className={`self-start whitespace-nowrap text-sm font-semibold tabular-nums sm:self-auto ${
                isExpense ? "text-[var(--danger)]" : "text-[var(--success)]"
              }`}>
                {isExpense ? "-" : "+"}{formatCurrency(Number(tx.amount))}
              </p>
              <div className="flex shrink-0 flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(tx)}
                  className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
                >
                  Edit
                </button>
                {confirmDelete === tx.id ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => { onDelete(tx.id); setConfirmDelete(null); }}
                       className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] sm:min-h-0"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                       className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] sm:min-h-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(tx.id)}
                    className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] sm:min-h-0"
                  >
                    Delete
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
