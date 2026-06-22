export default function InsightsLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 h-8 w-36 animate-pulse rounded bg-[var(--surface-active)]" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
