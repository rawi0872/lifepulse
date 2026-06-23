export default function GoalsLoading() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-lg bg-[var(--surface)] animate-pulse" />
            <div className="space-y-1">
              <div className="h-5 w-28 rounded bg-[var(--surface)] animate-pulse" />
              <div className="h-3 w-40 rounded bg-[var(--surface)] animate-pulse" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
