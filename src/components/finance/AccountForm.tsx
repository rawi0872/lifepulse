"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "./SimpleSelect";
import { WEALTH_ACCOUNT_TYPE_OPTIONS, WEALTH_CURRENCIES } from "@lifepulse/domain";

interface AccountFormProps {
  show: boolean;
  saving: boolean;
  editing: boolean;
  acctName: string;
  acctType: string;
  acctBalance: string;
  acctCurrency: string;
  acctInstitution: string;
  onNameChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onBalanceChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onInstitutionChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function AccountForm({
  show,
  saving,
  editing,
  acctName,
  acctType,
  acctBalance,
  acctCurrency,
  acctInstitution,
  onNameChange,
  onTypeChange,
  onBalanceChange,
  onCurrencyChange,
  onInstitutionChange,
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
            options={WEALTH_ACCOUNT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={acctType}
            onChange={onTypeChange}
          />
        </div>
        <div className="min-w-0 w-full sm:w-32">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Balance (manual)</label>
          <input
            type="number"
            step="0.01"
            value={acctBalance}
            onChange={(e) => onBalanceChange(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
          />
        </div>
        <div className="min-w-0 w-full sm:w-24">
          <SimpleSelect
            label="Currency"
            options={WEALTH_CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={acctCurrency}
            onChange={onCurrencyChange}
          />
        </div>
        <div className="min-w-0 w-full sm:min-w-[150px] sm:flex-1">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Institution (optional)</label>
          <input
            value={acctInstitution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            placeholder="Bank name"
            maxLength={100}
            className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-0 sm:py-2"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || !acctName.trim()}>
            {saving ? "Saving..." : editing ? "Save changes" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">The balance you set is the balance shown. Transactions never change it.</p>
    </Card>
  );
}
