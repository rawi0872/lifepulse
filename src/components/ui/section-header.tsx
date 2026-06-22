import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  count?: string;
  action?: React.ReactNode;
  accent?: "accent" | "success" | "warning" | "danger" | "none";
}

const accentDot: Record<string, string> = {
  accent: "bg-[var(--accent)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  none: "bg-transparent",
};

export function SectionHeader({
  className,
  label,
  count,
  action,
  accent = "accent",
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn("mb-3 flex items-center justify-between", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {accent !== "none" && (
          <div className={cn("h-1.5 w-1.5 rounded-full", accentDot[accent])} />
        )}
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </h2>
        {count && (
          <span className="text-[10px] text-[var(--text-muted)]">{count}</span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
