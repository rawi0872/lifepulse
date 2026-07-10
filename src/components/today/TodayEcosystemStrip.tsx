"use client";

import Link from "next/link";
import type { LifePulseModule } from "@/lib/modules";

interface TodayEcosystemStripProps {
  modules: LifePulseModule[];
}

export function TodayEcosystemStrip({ modules }: TodayEcosystemStripProps) {
  if (modules.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5 sm:py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Active ecosystem
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Relevant Life Pulse areas for your current mode.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {modules.map((module) => (
          <Link
            key={module.key}
            href={module.href!}
            className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] sm:min-h-0"
          >
            <span>{module.label}</span>
            {module.status === "preview" && (
              <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Preview
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
