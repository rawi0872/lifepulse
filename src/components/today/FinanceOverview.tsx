"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/config";

interface FinanceOverviewProps {
  financeNet: number | null;
  financeHasTx: boolean;
}

export function FinanceOverview({ financeNet, financeHasTx }: FinanceOverviewProps) {
  if (financeHasTx && financeNet !== null) {
    return (
      <Link
        href="/finance"
        className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 transition-colors hover:bg-[var(--surface)]"
      >
        <span className="text-xs font-medium text-[var(--text-muted)]">Money this month</span>
        <span className={`text-xs font-semibold ${financeNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {formatMoney(financeNet)}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/finance"
      className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:bg-[var(--surface-soft)]"
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Track one transaction
    </Link>
  );
}
