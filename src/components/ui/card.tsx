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
        variant === "default" && "border border-white/[0.07] bg-[linear-gradient(180deg,rgba(244,247,251,0.022),rgba(244,247,251,0.006)),var(--surface)]",
        variant === "subtle" && "border border-white/[0.06] bg-[var(--surface-soft)]",
        variant === "elevated" && "border border-white/[0.10] bg-[linear-gradient(180deg,rgba(244,247,251,0.035),rgba(244,247,251,0.01)),var(--surface-raised)] shadow-lg shadow-black/20",
        variant === "ghost" && "border border-transparent bg-[var(--bg-elevated)]",
        variant === "inset" && "border border-white/[0.06] bg-[var(--bg)]",
        className,
      )}
      {...props}
    />
  );
}
