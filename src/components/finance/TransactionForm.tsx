"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "./SimpleSelect";

interface TransactionFormProps {
  show: boolean;
  saving: boolean;
  editingTxId: string | null;
  txTitle: string;
  txAmount: string;
  txType: "income" | "expense";
  txCategoryId: string;
  txAccountId: string;
  txDate: string;
  txNote: string;
  expenseOptions: { value: string; label: string }[];
  incomeOptions: { value: string; label: string }[];
  accountOptions: { value: string; label: string }[];
  onTitleChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onTypeChange: (v: "income" | "expense") => void;
  onCategoryChange: (v: string) => void;
  onAccountChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export function TransactionForm({
  show,
  saving,
  editingTxId,
  txTitle,
  txAmount,
  txType,
  txCategoryId,
  txAccountId,
  txDate,
  txNote,
  expenseOptions,
  incomeOptions,
  accountOptions,
  onTitleChange,
  onAmountChange,
  onTypeChange,
  onCategoryChange,
  onAccountChange,
  onDateChange,
  onNoteChange,
  onSave,
  onCancel,
}: TransactionFormProps) {
  if (!show) return null;

  return (
    <Card className="p-3.5 sm:p-4">
      <form onSubmit={onSave} className="min-w-0 space-y-3">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
            <input
              value={txTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Groceries, Salary, ..."
              required
              maxLength={200}
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={txAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              required
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
            />
          </div>
        </div>
        <div className="flex min-w-0 gap-2">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { onTypeChange(t.value as "income" | "expense"); onCategoryChange(""); }}
              className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:min-h-0 ${
                txType === t.value
                  ? t.value === "income"
                    ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[var(--success)]/30"
                    : "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-[var(--danger)]/30"
                  : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <SimpleSelect
            label="Category"
            options={txType === "income" ? incomeOptions : expenseOptions}
            value={txCategoryId}
            onChange={onCategoryChange}
            placeholder="Select category"
          />
          <SimpleSelect
            label="Account (optional)"
            options={accountOptions}
            value={txAccountId}
            onChange={onAccountChange}
            placeholder="No account"
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Date</label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => onDateChange(e.target.value)}
              required
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Note (optional)</label>
            <input
              value={txNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Optional note"
              maxLength={500}
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
            />
          </div>
        </div>
        <div className="flex justify-stretch gap-2 pt-1 sm:justify-end">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving..." : editingTxId ? "Update" : "Add Transaction"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
