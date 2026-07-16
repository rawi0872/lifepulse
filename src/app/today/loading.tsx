export default function TodayLoading() {
  return (
    <div className="animate-fade-in px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-xl shadow-black/10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
            Opening Today
          </p>
          <h1 className="mt-1 text-xl font-bold text-[var(--text)]">Preparing your day...</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Loading your priorities, habits, and next actions.
          </p>
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-ghost)]/30">
          <div className="p-4">
            <div className="mb-3 h-4 w-28 animate-pulse rounded bg-[var(--surface-active)]" />
            <div className="grid gap-2 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]/70" />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-44 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
            <div className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          </div>
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
            <div className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
