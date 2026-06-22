"use client";

import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--danger-soft)] ring-1 ring-[var(--danger-soft)]">
        <LifePulseLogo variant="mark" size="md" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-[var(--text)]">Something went wrong</h1>
      <p className="mb-6 max-w-sm text-center text-sm text-[var(--text-muted)]">
        An unexpected error occurred. Please try again or return to the home page.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent-strong)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-all hover:bg-[var(--surface-active)]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
