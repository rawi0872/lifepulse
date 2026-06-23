"use client";

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48-2.12l-2.12 2.12M12 3v3m0 12v3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    name: "Today",
    desc: "Daily command center",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
    name: "Habits",
    desc: "Track daily practices",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
    name: "Projects",
    desc: "Manage goals and work",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    name: "Finance",
    desc: "Monitor spending",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    name: "Journal",
    desc: "End-of-day reflection",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    ),
    name: "Insights",
    desc: "See your patterns",
  },
] as const;

export function FeatureTour() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <div
          key={f.name}
          className="group relative flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-raised)] hover:shadow-lg hover:shadow-[var(--accent)]/6"
        >
          <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: "radial-gradient(160px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-ghost)] text-[var(--accent)] transition-all duration-300 group-hover:bg-[var(--accent-soft)] group-hover:shadow-sm group-hover:shadow-[var(--accent)]/10">
            <span className="transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
              {f.icon}
            </span>
          </div>

          <div className="relative z-10 min-w-0">
            <p className="text-sm font-medium text-[var(--text)] transition-colors duration-300 group-hover:text-[var(--text)]">
              {f.name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] transition-colors duration-300 group-hover:text-[var(--text-secondary)]">
              {f.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
