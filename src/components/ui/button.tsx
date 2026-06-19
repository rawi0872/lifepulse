import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        variant === "primary" &&
          "text-white bg-[var(--accent)] hover:bg-[var(--accent-strong)] shadow-sm shadow-[var(--accent)]/10",
        variant === "secondary" &&
          "border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text)] hover:bg-[var(--surface-active)] hover:border-[var(--accent)]/30",
        variant === "ghost" &&
          "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-ghost)]",
        variant === "danger" &&
          "text-white bg-[var(--danger)] hover:opacity-90 shadow-sm shadow-[var(--danger)]/10",
        className,
      )}
      {...props}
    />
  );
}
