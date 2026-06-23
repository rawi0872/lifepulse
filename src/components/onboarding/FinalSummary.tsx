"use client";

export function FinalSummary() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { label: "6 life areas ready", desc: "Organize everything you track", icon: "🧭" },
        { label: "Daily rhythm set", desc: "Plan, act, and reflect each day", icon: "🔄" },
        { label: "Dashboard unlocked", desc: "Your personal command center", icon: "🎯" },
      ].map((item) => (
        <div
          key={item.label}
          className="group relative flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/25 hover:bg-[var(--surface-raised)] hover:shadow-lg hover:shadow-[var(--accent)]/6"
        >
          <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: "radial-gradient(140px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
            }}
          />
          <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-ghost)] text-lg transition-all duration-300 group-hover:bg-[var(--accent-soft)] group-hover:scale-105">
            {item.icon}
          </div>
          <div className="relative z-10 min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">{item.label}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors duration-300">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
