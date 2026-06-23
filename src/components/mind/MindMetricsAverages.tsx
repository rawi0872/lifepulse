"use client";

import { PulseCard } from "@/components/ui/pulse-card";
import type { MindMetrics } from "@/lib/mindMetrics";

interface Props {
  recent: MindMetrics[];
}

function avg(nums: (number | null)[]): number | null {
  const vals = nums.filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function trend(prev: MindMetrics | undefined, curr: MindMetrics | undefined, key: keyof MindMetrics): "up" | "down" | "flat" | null {
  if (!prev || !curr) return null;
  const a = prev[key] as number | null;
  const b = curr[key] as number | null;
  if (a === null || b === null) return null;
  if (b > a) return "up";
  if (b < a) return "down";
  return "flat";
}

function TrendIcon({ dir }: { dir: "up" | "down" | "flat" | null }) {
  if (!dir) return null;
  return (
    <span className={`ml-1 text-[10px] ${dir === "up" ? "text-[var(--success)]" : dir === "down" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
      {dir === "up" ? "\u2191" : dir === "down" ? "\u2193" : "\u2192"}
    </span>
  );
}

export function MindMetricsAverages({ recent }: Props) {
  const todayIdx = 0;
  const prev = recent[todayIdx + 1] ?? undefined;

  const metricRows: { label: string; value: number | null; unit: string; key: keyof MindMetrics }[] = [
    { label: "Mood", value: avg(recent.map((m) => m.mood)), unit: "/5", key: "mood" },
    { label: "Stress", value: avg(recent.map((m) => m.stress)), unit: "/5", key: "stress" },
    { label: "Focus", value: avg(recent.map((m) => m.focus)), unit: "/5", key: "focus" },
    { label: "Clarity", value: avg(recent.map((m) => m.clarity)), unit: "/5", key: "clarity" },
    { label: "Motivation", value: avg(recent.map((m) => m.motivation)), unit: "/5", key: "motivation" },
  ];

  if (recent.length === 0) {
    return (
      <PulseCard title="Averages" accent="accent" description="7-day mind metrics">
        <div className="p-4 text-center text-xs text-[var(--text-muted)]">
          No mind data yet. Start logging above.
        </div>
      </PulseCard>
    );
  }

  return (
    <PulseCard title="Averages" accent="accent" description="7-day mind metrics">
      <div className="divide-y divide-[var(--border)]">
        {metricRows.map((row) => {
          const dir = trend(prev, recent[todayIdx] ?? undefined, row.key);
          return (
            <div key={row.key} className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-[var(--text-muted)]">{row.label}</span>
              <span className="flex items-center text-xs font-medium text-[var(--text)]">
                {row.value !== null ? `${row.value}${row.unit}` : "\u2014"}
                <TrendIcon dir={dir} />
              </span>
            </div>
          );
        })}
      </div>
    </PulseCard>
  );
}
