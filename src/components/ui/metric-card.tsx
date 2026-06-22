import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  active?: boolean;
  href?: string;
}

export function MetricCard({
  className,
  label,
  value,
  icon,
  trend,
  active,
  ...props
}: MetricCardProps) {
  const valueColor = active
    ? "text-[var(--accent)]"
    : trend === "up"
      ? "text-[var(--success)]"
      : trend === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--text)]";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-all duration-150",
        active
          ? "border-[var(--accent)]/30 bg-[var(--accent-ghost)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className={cn("text-[var(--text-muted)]", active && "text-[var(--accent)]")}>
          {icon}
        </span>
      )}
      <span className={cn("text-sm font-bold tracking-tight transition-colors duration-150", valueColor)}>
        {value}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}
