import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className, label, id, error, "aria-describedby": ariaDescribedBy, ...props }: InputProps) {
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy = Array.from(new Set([ariaDescribedBy, errorId].filter(Boolean))).join(" ") || undefined;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none",
          error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger-soft)]",
          className,
        )}
      />
      {error && <p id={errorId} className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
