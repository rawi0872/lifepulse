"use client";

import { PulseCard } from "@/components/ui/pulse-card";
import type { BodyMetrics } from "@/lib/bodyMetrics";

interface Props {
  recent: BodyMetrics[];
}

function avg(nums: (number | null)[]): number | null {
  const vals = nums.filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function trend(prev: BodyMetrics | undefined, curr: BodyMetrics | undefined, key: keyof BodyMetrics): "up" | "down" | "flat" | null {
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

export function BodyMetricsAverages({ recent }: Props) {
  const todayIdx = recent.findIndex((m) => m.entry_date !== undefined);
  const prev = recent[todayIdx + 1] ?? undefined;

  const metricRows: { label: string; value: number | null; unit: string; key: keyof BodyMetrics }[] = [
    { label: "Sleep", value: avg(recent.map((m) => m.sleep_hours)), unit: "hrs", key: "sleep_hours" },
    { label: "Energy", value: avg(recent.map((m) => m.energy)), unit: "/5", key: "energy" },
    { label: "Recovery", value: avg(recent.map((m) => m.recovery_score)), unit: "%", key: "recovery_score" },
    { label: "Steps", value: avg(recent.map((m) => m.steps)), unit: "", key: "steps" },
    { label: "Workout", value: avg(recent.map((m) => m.workout_minutes)), unit: "min", key: "workout_minutes" },
  ];

  if (recent.length === 0) {
    return (
      <PulseCard title="Averages" accent="success" description="7-day body metrics">
        <div className="p-4 text-center text-xs text-[var(--text-muted)]">
          No body data yet. Start logging above.
        </div>
      </PulseCard>
    );
  }

  return (
    <PulseCard title="Averages" accent="success" description="7-day body metrics">
      <div className="divide-y divide-[var(--border)]">
        {metricRows.map((row) => {
          const dir = trend(prev, recent[todayIdx] ?? undefined, row.key);
          return (
            <div key={row.key} className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-[var(--text-muted)]">{row.label}</span>
              <span className="flex items-center text-xs font-medium text-[var(--text)]">
                {row.value !== null
                  ? `${row.key === "steps" ? Math.round(row.value).toLocaleString() : row.value}${row.unit}`
                  : "\u2014"}
                <TrendIcon dir={dir} />
              </span>
            </div>
          );
        })}
      </div>
    </PulseCard>
  );
}
