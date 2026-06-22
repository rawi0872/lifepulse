export default function JournalLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 h-8 w-36 animate-pulse rounded bg-[var(--surface-active)]" />
        <div className="h-48 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
