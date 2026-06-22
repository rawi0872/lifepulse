export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]" />
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-active)]" />
      </div>
    </div>
  );
}
