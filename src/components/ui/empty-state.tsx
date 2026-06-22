import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({
  className,
  message,
  description,
  action,
  compact,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-center",
        compact ? "px-3 py-4" : "px-4 py-6",
        className,
      )}
      {...props}
    >
      <p className={cn("text-[var(--text-muted)]", compact ? "text-xs" : "text-sm")}>
        {message}
      </p>
      {description && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
