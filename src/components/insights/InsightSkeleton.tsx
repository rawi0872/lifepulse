"use client";

import { DashboardNav } from "@/components/DashboardNav";

export function InsightSkeleton() {
  return (
    <DashboardNav>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-8">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--surface)]" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-h-[120px] rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
              <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[var(--surface)]" />
              <div className="mb-4 h-8 w-14 animate-pulse rounded bg-[var(--surface)]" />
              <div className="mt-auto h-3 w-28 animate-pulse rounded bg-[var(--surface-soft)]" />
            </div>
          ))}
        </div>
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="mb-3 h-4 w-48 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface)]" />
              </div>
              <div className="mb-2 h-3 w-40 animate-pulse rounded bg-[var(--surface-soft)]" />
              <div className="h-1.5 w-full animate-pulse rounded bg-[var(--surface)]" />
              <div className="mt-1 h-3 w-36 animate-pulse rounded bg-[var(--surface-soft)]" />
            </div>
          ))}
        </div>
      </div>
    </DashboardNav>
  );
}
