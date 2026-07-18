"use client";

import Link from "next/link";
import type { LifePulseModule, ModuleKey } from "@/lib/modules";

interface TodayEcosystemStripProps {
  modules: LifePulseModule[];
}

export function TodayEcosystemStrip({ modules }: TodayEcosystemStripProps) {
  if (modules.length === 0) return null;

  const groups: { label: string; note: string; keys: ModuleKey[] }[] = [
    { label: "Start today", note: "Main route for the first session.", keys: ["today"] },
    { label: "Support the loop", note: "Use Tasks or Habits for one visible action.", keys: ["tasks", "habits", "journal"] },
    { label: "Review later", note: "Useful after a few logged days.", keys: ["weeklyReview", "insights"] },
    { label: "Optional context", note: "Add only when it helps today's work.", keys: ["body", "mind", "finance"] },
    { label: "Build later", note: "Available when the daily loop is clear.", keys: ["goals", "projects", "knowledge", "passions", "coach", "settings", "devices"] },
  ];

  const modulesByKey = new Map(modules.map((module) => [module.key, module]));
  const groupedModules = groups
    .map((group) => ({
      ...group,
      modules: group.keys.map((key) => modulesByKey.get(key)).filter((module): module is LifePulseModule => Boolean(module)),
    }))
    .filter((group) => group.modules.length > 0);

  return (
    <section className="mt-7 rounded-xl border border-dashed border-[var(--border)] bg-black/10 px-4 py-3.5 opacity-80 sm:py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">
            <span className="sr-only">Active ecosystem</span>
            Route order
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Start with Today. The rest becomes useful after a few logged days.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groupedModules.map((group) => (
          <div key={group.label} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)]/35 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">{group.label}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">{group.note}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.modules.map((module) => (
                <Link
                  key={module.key}
                  href={module.href!}
                  className="inline-flex min-h-10 min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
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
          </div>
        ))}
      </div>
    </section>
  );
}
