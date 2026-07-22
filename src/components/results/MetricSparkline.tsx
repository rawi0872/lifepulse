"use client";

import { useId } from "react";
import type { MetricEntryRow } from "@/lib/results/types";
import { sortEntriesChronological, parseNumeric } from "@/lib/results/calculations";
import { cn } from "@/lib/utils";

interface MetricSparklineProps {
  entries: MetricEntryRow[];
  className?: string;
  height?: number;
}

function scaleX(index: number, count: number, width: number, padding: number): number {
  if (count <= 1) return width / 2;
  return padding + (index / (count - 1)) * (width - 2 * padding);
}

function scaleY(value: number, min: number, max: number, height: number, padding: number): number {
  if (max === min) return height / 2;
  return height - padding - ((value - min) / (max - min)) * (height - 2 * padding);
}

export function MetricSparkline({ entries, className, height = 120 }: MetricSparklineProps) {
  const gradientId = useId();
  const numericPoints = sortEntriesChronological(entries)
    .map((entry) => ({ id: entry.id, value: parseNumeric(entry.value) }))
    .filter((point): point is { id: string; value: number } => point.value !== null);

  if (numericPoints.length === 0) {
    return (
      <div className={cn("flex h-[120px] w-full items-center justify-center rounded-lg bg-[var(--surface-soft)]", className)}>
        <p className="text-xs text-[var(--text-muted)]">No numeric entries to display</p>
      </div>
    );
  }

  const values = numericPoints.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin;
  const min = range === 0 ? rawMin - 1 : rawMin - range * 0.1;
  const max = range === 0 ? rawMax + 1 : rawMax + range * 0.1;
  const width = 360;
  const padding = 12;
  const points = numericPoints.map((point, index) => {
    const x = scaleX(index, numericPoints.length, width, padding);
    const y = scaleY(point.value, min, max, height, padding);
    return `${x},${y}`;
  });
  const areaPoints = [`${padding},${height - padding}`, ...points, `${width - padding},${height - padding}`].join(" ");

  return (
    <div className={cn("w-full", className)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Sparkline based on loaded entries">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`M${areaPoints}Z`} fill={`url(#${gradientId})`} stroke="none" />
        <polyline fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points.join(" ")} />
        {numericPoints.map((point, index) => {
          const x = scaleX(index, numericPoints.length, width, padding);
          const y = scaleY(point.value, min, max, height, padding);
          return <circle key={point.id} cx={x} cy={y} r={index === numericPoints.length - 1 ? 4 : 3} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />;
        })}
      </svg>
    </div>
  );
}
