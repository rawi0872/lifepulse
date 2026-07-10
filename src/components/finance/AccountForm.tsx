"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "./SimpleSelect";

const ACCOUNT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];

interface AccountFormProps {
  show: boolean;
  saving: boolean;
  acctName: string;
  acctType: string;
  acctBalance: string;
  acctCurrency: string;
  onNameChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onBalanceChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function AccountForm({
  show,
  saving,
  acctName,
  acctType,
  acctBalance,
  acctCurrency,
  onNameChange,
  onTypeChange,
  onBalanceChange,
  onCurrencyChange,
  onSave,
  onCancel,
}: AccountFormProps) {
  if (!show) return null;

  return (
    <Card className="mb-3 p-3.5 sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 w-full sm:min-w-[150px] sm:flex-1">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
          <input
            value={acctName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Wallet, Checking, ..."
            maxLength={100}
            className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
          />
        </div>
        <div className="min-w-0 w-full sm:w-36">
          <SimpleSelect
            label="Type"
            options={ACCOUNT_TYPES}
            value={acctType}
            onChange={onTypeChange}
          />
        </div>
        <div className="min-w-0 w-full sm:w-32">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Starting balance</label>
          <input
            type="number"
            step="0.01"
            value={acctBalance}
            onChange={(e) => onBalanceChange(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
          />
        </div>
        <div className="min-w-0 w-full sm:w-20">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Currency</label>
          <input
            value={acctCurrency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="ILS"
            className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || !acctName.trim()}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
