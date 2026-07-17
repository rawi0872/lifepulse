"use client";

export function FinalSummary() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { label: "Life areas ready", desc: "Keep the defaults or edit later", icon: "🧭" },
        { label: "Daily loop clear", desc: "Today, action, reflect, review", icon: "🔄" },
        { label: "First step chosen", desc: "Open Today and set one priority", icon: "🎯" },
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
