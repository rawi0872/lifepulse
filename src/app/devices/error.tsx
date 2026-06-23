"use client";

import Link from "next/link";

export default function DevicesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4">
      <svg className="h-8 w-8 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-sm text-[var(--text-muted)]">Something went wrong loading Device Pulse.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[10px] font-medium text-white transition-opacity hover:opacity-90">Try again</button>
        <Link href="/today" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">Back to Today</Link>
      </div>
    </div>
  );
}
