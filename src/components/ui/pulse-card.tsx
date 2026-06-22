import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";

interface PulseCardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: "accent" | "success" | "warning" | "danger" | "none";
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "subtle" | "elevated";
}

const accentStyles: Record<string, string> = {
  accent: "bg-[var(--accent)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  none: "bg-transparent",
};

export function PulseCard({
  className,
  accent = "none",
  title,
  description,
  action,
  variant = "default",
  children,
  ...props
}: PulseCardProps) {
  return (
    <Card variant={variant} className={cn("overflow-hidden", className)} {...props}>
      {title && (
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            {accent !== "none" && (
              <div className={cn("h-1 w-1 rounded-full", accentStyles[accent])} />
            )}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-[var(--text)]">
                {title}
              </h3>
              {description && (
                <p className="text-[10px] text-[var(--text-muted)]">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Card>
  );
}
