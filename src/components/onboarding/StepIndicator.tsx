"use client";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  steps: readonly string[];
}

export function StepIndicator({ current, steps }: StepIndicatorProps) {
  return (
    <nav aria-label="Setup progress" className="flex flex-col gap-0">
      {steps.map((label, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-all duration-300",
                  isCompleted && "bg-[var(--accent-soft)] text-[var(--accent)]",
                  isCurrent && "bg-[var(--accent)] text-[var(--bg)] ring-2 ring-[var(--accent)]/30",
                  !isCompleted && !isCurrent && "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)]",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0L2.22 9.78a.75.75 0 011.06-1.06L5.75 11.2l6.97-6.98a.75.75 0 011.06 0z" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "mt-1 h-8 w-px transition-all duration-300",
                    i < current ? "bg-[var(--accent)]/40" : "bg-[var(--border)]",
                  )}
                />
              )}
            </div>
            <div className="flex flex-col pt-[3px]">
              <span
                className={cn(
                  "text-sm leading-tight transition-all duration-300",
                  isCurrent && "font-medium text-[var(--text)]",
                  isCompleted && "text-[var(--text-muted)]",
                  !isCompleted && !isCurrent && "text-[var(--text-muted)]",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
