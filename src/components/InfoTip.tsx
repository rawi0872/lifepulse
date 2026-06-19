"use client";

import { useState } from "react";

interface InfoTipProps {
  id: string;
  title: string;
  children: React.ReactNode;
  icon?: string;
  className?: string;
}

export function InfoTip({ id, title, children, icon = "💡", className = "" }: InfoTipProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(`lifepulse_tip_${id}`) === "1";
    } catch {
      return true;
    }
  });

  function handleDismiss() {
    localStorage.setItem(`lifepulse_tip_${id}`, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className={`rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-ghost)] px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 text-lg">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--accent)]">{title}</p>
          <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
            {children}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
