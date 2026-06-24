import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({
  className,
  message,
  title,
  description,
  action,
  compact,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-center",
        compact ? "px-3 py-4" : "px-5 py-8",
        className,
      )}
      {...props}
    >
      {title && (
        <p className={cn("font-medium text-[var(--text-secondary)]", compact ? "text-xs" : "text-sm")}>
          {title}
        </p>
      )}
      <p className={cn("text-[var(--text-muted)]", compact ? "text-xs" : "text-sm", title ? "mt-1" : "")}>
        {message}
      </p>
      {description && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
