import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  examples?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({
  className,
  message,
  title,
  description,
  eyebrow,
  action,
  examples,
  compact,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--border)] bg-[radial-gradient(circle_at_top_left,var(--accent-soft),transparent_36%),var(--surface-soft)] text-center shadow-sm shadow-black/10",
        compact ? "px-3.5 py-4" : "px-5 py-8 sm:px-6 sm:py-10",
        className,
      )}
      {...props}
    >
      {eyebrow && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {eyebrow}
        </p>
      )}
      {title && (
        <p className={cn("font-semibold tracking-tight text-[var(--text)]", compact ? "text-sm" : "text-lg")}>
          {title}
        </p>
      )}
      <p className={cn("mx-auto max-w-sm text-pretty leading-relaxed text-[var(--text-muted)]", compact ? "text-xs" : "text-sm", title ? "mt-1.5" : "")}>
        {message}
      </p>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-pretty text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
      )}
      {action && <div className={cn(compact ? "mt-3" : "mt-5")}>{action}</div>}
      {examples && <div className={cn(compact ? "mt-3" : "mt-6")}>{examples}</div>}
    </div>
  );
}
