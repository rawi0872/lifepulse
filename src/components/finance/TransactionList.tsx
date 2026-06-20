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
      <Card variant="subtle" className="p-6 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-3">
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
      <div className="mb-3 flex gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => { setFilter(chip.key); setConfirmDelete(null); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
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
              className="flex items-center gap-3 px-4 py-3 animate-fade-in"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{tx.title}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    isExpense
                      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                      : "bg-[var(--success-soft)] text-[var(--success)]"
                  }`}>
                    {catName}
                  </span>
                  {acctName && (
                    <span className="shrink-0 text-[10px] text-[var(--text-muted)] hidden sm:inline">
                      {acctName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {new Date(tx.transaction_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {tx.note && <span> · {tx.note}</span>}
                </p>
              </div>
              <p className={`text-sm font-semibold whitespace-nowrap tabular-nums ${
                isExpense ? "text-[var(--danger)]" : "text-[var(--success)]"
              }`}>
                {isExpense ? "-" : "+"}{formatCurrency(Number(tx.amount))}
              </p>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(tx)}
                  className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                >
                  Edit
                </button>
                {confirmDelete === tx.id ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { onDelete(tx.id); setConfirmDelete(null); }}
                      className="rounded-md px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(tx.id)}
                    className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
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
