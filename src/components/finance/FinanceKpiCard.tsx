import { cn } from "@/lib/utils";
import { HelpPopover } from "@/components/HelpPopover";

interface KpiDelta {
  value: string;
  isPositive: boolean;
}

interface FinanceKpiCardProps {
  label: string;
  value: string;
  delta: KpiDelta | null;
  variant: "income" | "expense" | "net" | "budget";
  isLoading?: boolean;
  helpContent?: React.ReactNode;
}

const variantStyles: Record<string, { valueColor: string; deltaUp: string; deltaDown: string }> = {
  income: {
    valueColor: "text-[var(--success)]",
    deltaUp: "text-[var(--success)]",
    deltaDown: "text-[var(--danger)]",
  },
  expense: {
    valueColor: "text-[var(--text)]",
    deltaUp: "text-[var(--danger)]",
    deltaDown: "text-[var(--success)]",
  },
  net: {
    valueColor: "text-[var(--text)]",
    deltaUp: "text-[var(--success)]",
    deltaDown: "text-[var(--danger)]",
  },
  budget: {
    valueColor: "text-[var(--text)]",
    deltaUp: "text-[var(--warning)]",
    deltaDown: "text-[var(--warning)]",
  },
};

export function FinanceKpiCard({ label, value, delta, variant, isLoading, helpContent }: FinanceKpiCardProps) {
  const styles = variantStyles[variant];

  if (isLoading) {
    return (
      <div className="min-h-[100px] rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[var(--surface)]" />
        <div className="mb-1 h-7 w-24 animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface)]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100px] rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-all duration-150 hover:border-[var(--border-strong)]">
      <p className="text-xs font-medium text-[var(--text-muted)]">
        {label}
        {helpContent && (
          <HelpPopover title={label} className="ml-1">
            {helpContent}
          </HelpPopover>
        )}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight sm:text-2xl", styles.valueColor)}>{value}</p>
      {delta ? (
        <p className={cn("mt-0.5 text-xs", delta.isPositive ? styles.deltaUp : styles.deltaDown)}>
          <span>
            {delta.isPositive ? "+" : ""}{delta.value}
          </span>
          <span className="ml-1 text-[var(--text-muted)]">vs last month</span>
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">No previous data</p>
      )}
    </div>
  );
}
