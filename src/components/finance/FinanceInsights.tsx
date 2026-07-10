"use client";

import type { FinanceInsight } from "./types";

interface FinanceInsightsProps {
  insights: FinanceInsight[];
}

const typeStyles: Record<string, { border: string; bg: string; iconText: string }> = {
  positive: {
    border: "border-[var(--success)]/30",
    bg: "bg-[var(--success-soft)]",
    iconText: "text-[var(--success)]",
  },
  negative: {
    border: "border-[var(--danger)]/30",
    bg: "bg-[var(--danger-soft)]",
    iconText: "text-[var(--danger)]",
  },
  warning: {
    border: "border-[var(--warning)]/30",
    bg: "bg-[var(--warning-soft)]",
    iconText: "text-[var(--warning)]",
  },
  neutral: {
    border: "border-[var(--accent)]/30",
    bg: "bg-[var(--accent-soft)]",
    iconText: "text-[var(--accent)]",
  },
};

export function FinanceInsights({ insights }: FinanceInsightsProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight, i) => {
        const style = typeStyles[insight.type] || typeStyles.neutral;
        return (
          <div
            key={i}
             className={`flex min-w-0 items-start gap-3 rounded-lg border ${style.border} ${style.bg} px-3.5 py-3 sm:px-4`}
          >
            <span className={`mt-0.5 text-sm font-bold ${style.iconText}`}>{insight.icon}</span>
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-[var(--text)]">{insight.title}</p>
              <p className="mt-0.5 break-words text-xs text-[var(--text-muted)]">{insight.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
