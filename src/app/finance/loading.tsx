export default function FinanceLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-40 animate-pulse rounded bg-[var(--surface-active)]" />
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
