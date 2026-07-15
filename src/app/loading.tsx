export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Loading your Life Pulse...</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Preparing your workspace.</p>
        </div>
      </div>
    </div>
  );
}
