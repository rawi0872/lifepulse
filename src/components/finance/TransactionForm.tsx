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

const STARTER_EXAMPLES = [
  { label: "Paycheck", type: "income", category: "Salary" },
  { label: "Food", type: "expense", category: "Food" },
  { label: "Transport", type: "expense", category: "Transport" },
  { label: "Client payment", type: "income", category: "Freelance" },
  { label: "Subscription", type: "expense", category: "Subscriptions" },
] as const;

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
}: TransactionFormProps) {
  if (!show) return null;

  function applyExample(example: (typeof STARTER_EXAMPLES)[number]) {
    const options = example.type === "income" ? incomeOptions : expenseOptions;
    const category = options.find((option) => option.label.toLowerCase() === example.category.toLowerCase());
    onTypeChange(example.type);
    onTitleChange(example.label);
    onCategoryChange(category?.value ?? "");
  }

  return (
    <Card className="p-3.5 sm:p-4">
      <form onSubmit={onSave} className="min-w-0 space-y-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Starter examples</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
            These only fill fields. You still choose the amount, date, and whether to save.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STARTER_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => applyExample(example)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)]"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Entry name</label>
            <input
              value={txTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Paycheck, Food, Subscription"
              required
              maxLength={200}
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
            />
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">A short label for what came in or went out.</p>
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
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Enter the amount manually. Use a positive number for both income and expense.</p>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">Entry type</p>
          <p className="mb-2 text-[10px] leading-relaxed text-[var(--text-muted)]">Income is money in. Expense is money out.</p>
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
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <SimpleSelect
            label={txType === "income" ? "Income category" : "Expense category"}
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
          <p className="-mt-2 text-[10px] leading-relaxed text-[var(--text-muted)] sm:col-span-2">Accounts are optional labels only. Life Pulse does not connect to banks.</p>
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
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Use the day the income or expense happened.</p>
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
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Optional context for Weekly Review.</p>
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
