export default function TasksLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 h-8 w-36 animate-pulse rounded bg-[var(--surface-active)]" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
