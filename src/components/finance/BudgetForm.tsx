"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "./SimpleSelect";

interface BudgetFormProps {
  show: boolean;
  saving: boolean;
  budgetCategoryId: string;
  budgetAmount: string;
  budgetCatOptions: { value: string; label: string }[];
  onCategoryChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function BudgetForm({
  show,
  saving,
  budgetCategoryId,
  budgetAmount,
  budgetCatOptions,
  onCategoryChange,
  onAmountChange,
  onSave,
  onCancel,
}: BudgetFormProps) {
  if (!show) return null;

  return (
    <Card className="mb-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="w-full sm:flex-1 sm:min-w-[150px]">
          <SimpleSelect
            label="Category"
            options={budgetCatOptions}
            value={budgetCategoryId}
            onChange={onCategoryChange}
            placeholder="Select category"
          />
        </div>
        <div className="w-full sm:w-32">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Monthly amount</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={budgetAmount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || !budgetCategoryId || !budgetAmount}>
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
