"use client";

export default function BodyError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--danger-soft)]">
          <svg className="h-5 w-5 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="mb-1 text-base font-semibold text-[var(--text)]">Could not load Body Pulse</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">Something went wrong loading your body data.</p>
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-strong)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
