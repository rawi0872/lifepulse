import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "elevated" | "ghost" | "inset";
}

export function Card({
  className,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-150",
        variant === "default" && "border border-[var(--border)] bg-[var(--surface)]",
        variant === "subtle" && "border border-[var(--border)] bg-[var(--surface-soft)]",
        variant === "elevated" && "border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-lg shadow-black/20",
        variant === "ghost" && "border border-transparent bg-[var(--bg-elevated)]",
        variant === "inset" && "border border-[var(--border)] bg-[var(--bg)]",
        className,
      )}
      {...props}
    />
  );
}
