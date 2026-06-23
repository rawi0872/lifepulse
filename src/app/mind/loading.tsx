export default function MindLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-[var(--surface-active)]" />
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
