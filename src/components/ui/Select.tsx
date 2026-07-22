import { cn } from "@/lib/utils";
import { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ className, label, id, children, error, "aria-describedby": ariaDescribedBy, ...props }: SelectProps) {
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy = Array.from(new Set([ariaDescribedBy, errorId].filter(Boolean))).join(" ") || undefined;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none",
          error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger-soft)]",
          className,
        )}
      >
        {children}
      </select>
      {error && <p id={errorId} className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
