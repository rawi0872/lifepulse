export default function DevicesLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-[var(--surface-active)]" />
        <div className="mb-6 h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
