"use client";

import { useState, useRef, useEffect } from "react";

interface HelpPopoverProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function HelpPopover({ title, children, className = "" }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-strong)] text-[11px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        aria-label="Show help"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
            <button
              onClick={() => setOpen(false)}
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              aria-label="Close help"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </span>
  );
}
