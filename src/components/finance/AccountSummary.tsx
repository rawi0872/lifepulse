"use client";

import { Card } from "@/components/ui/card";
import type { AccountBalance } from "./types";
import { formatCurrency } from "./financeUtils";

interface AccountSummaryProps {
  accountBalances: AccountBalance[];
  hasMixedCurrencies: boolean;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  confirmingDeleteId: string | null;
  onAddNew: () => void;
}

const accountTypeIcons: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  savings: "Savings",
  investment: "Invest",
  other: "Other",
};

export function AccountSummary({ accountBalances, hasMixedCurrencies, onDelete, onRequestDelete, onCancelDelete, confirmingDeleteId, onAddNew }: AccountSummaryProps) {
  if (accountBalances.length === 0) {
    return (
      <Card variant="subtle" className="p-6 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Add an account to organize where your money is stored.
        </p>
        <button
          type="button"
          onClick={onAddNew}
          className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0"
        >
          + Add account
        </button>
      </Card>
    );
  }

  const allSameCurrency = !hasMixedCurrencies;
  const totalBalance = accountBalances.reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <div>
      <div className="mb-3 flex min-w-0 items-center justify-between">
        <p className="break-words text-xs text-[var(--text-muted)]">
          {hasMixedCurrencies ? (
            <span className="italic">Multiple currencies tracked separately.</span>
          ) : (
            <>Total: <span className="font-semibold text-[var(--text)]">{formatCurrency(totalBalance, accountBalances[0].currency)}</span></>
          )}
        </p>
      </div>
      {hasMixedCurrencies && (
        <p className="mb-3 break-words text-[10px] italic text-[var(--text-muted)]">
          Total balance may not be comparable across different currencies.
        </p>
      )}
      <div className="space-y-1.5">
        {accountBalances.map((a) => {
          const share = allSameCurrency && totalBalance > 0
            ? ((a.currentBalance / totalBalance) * 100).toFixed(1)
            : null;
          const isNegative = a.currentBalance < 0;

          return (
            <Card key={a.accountId} className="min-w-0 px-3 py-3 sm:px-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)]">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {accountTypeIcons[a.accountType] || a.accountType.slice(0, 3)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-[var(--text)]">{a.accountName}</p>
                  <span className="text-[10px] text-[var(--text-muted)] capitalize">{a.accountType}</span>
                  {a.transactionCount > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)]">{a.transactionCount} txns</span>
                  )}
                </div>
                <p className="break-words text-xs text-[var(--text-muted)]">
                  Start {formatCurrency(a.startingBalance, a.currency)}
                  {a.incomeTotal > 0 && <> &middot; In {formatCurrency(a.incomeTotal, a.currency)}</>}
                  {a.expenseTotal > 0 && <> &middot; Out {formatCurrency(a.expenseTotal, a.currency)}</>}
                </p>
                {share !== null && (
                  <p className="text-xs text-[var(--text-muted)]">{share}% of total</p>
                )}
              </div>
              <p className={`self-start whitespace-nowrap text-sm font-semibold tabular-nums sm:self-auto ${
                isNegative ? "text-[var(--danger)]" : "text-[var(--text)]"
              }`}>
                {formatCurrency(a.currentBalance, a.currency)}
              </p>
              <span className="text-xs text-[var(--text-muted)] sm:inline">{a.currency}</span>
              <button
                type="button"
                onClick={() => onRequestDelete(a.accountId)}
                className="min-h-10 shrink-0 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] sm:min-h-0"
              >
                Delete
              </button>
              </div>
              {confirmingDeleteId === a.accountId && (
                <div className="mt-3 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)]/30 p-3">
                  <p className="text-xs font-medium text-[var(--text)]">Delete this account?</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Transactions linked to this account stay saved, but the account is removed.</p>
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onCancelDelete} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] sm:min-h-0 sm:py-1.5">
                      Cancel
                    </button>
                    <button type="button" onClick={() => onDelete(a.accountId)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]/50 sm:min-h-0 sm:py-1.5">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
