"use client";

import { cn } from "@/lib/utils";

const DAILY_LOOP = [
  {
    step: "01",
    title: "Plan",
    desc: "Choose your priorities for today",
    color: "from-[var(--accent)]/20 to-[var(--accent)]/5",
    borderColor: "border-[var(--accent)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Capture",
    desc: "Add tasks, ideas, and notes",
    color: "from-[var(--success)]/20 to-[var(--success)]/5",
    borderColor: "border-[var(--success)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Act",
    desc: "Complete habits and track actions",
    color: "from-[var(--warning)]/20 to-[var(--warning)]/5",
    borderColor: "border-[var(--warning)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <polyline points="9,18 15,12 9,6" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Reflect",
    desc: "Close the day with a journal entry",
    color: "from-[var(--accent-strong)]/20 to-[var(--accent-strong)]/5",
    borderColor: "border-[var(--accent-strong)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
] as const;

export function DailyLoopGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {DAILY_LOOP.map((item, i) => (
        <div
          key={item.step}
          className="group relative"
        >
          {i % 2 === 0 && i < DAILY_LOOP.length - 1 && (
            <div className="pointer-events-none absolute -right-2 top-1/2 z-20 hidden h-px w-4 bg-gradient-to-r from-[var(--border-strong)] to-transparent sm:block" />
          )}

          <div className={cn(
            "relative flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-5 transition-all duration-300",
            "hover:-translate-y-1 hover:shadow-lg hover:shadow-black/10",
            item.borderColor,
          )}>
            <div className={cn(
              "absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r opacity-60",
              item.color,
            )} />

            <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "radial-gradient(200px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
              }}
            />

            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)] transition-all duration-300 group-hover:border-[var(--accent)]/30 group-hover:bg-[var(--accent-soft)] group-hover:shadow-sm group-hover:shadow-[var(--accent)]/10">
                <span className="transition-all duration-300 group-hover:scale-110">
                  {item.icon}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-widest text-[var(--accent)]">{item.step}</span>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">{item.title}</p>
              </div>
            </div>

            <p className="relative z-10 text-xs leading-relaxed text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors duration-300">
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
