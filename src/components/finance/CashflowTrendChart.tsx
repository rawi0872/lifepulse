"use client";

import type { MonthlyTrend } from "./types";
import { formatCurrency } from "./financeUtils";

interface CashflowTrendChartProps {
  data: MonthlyTrend[];
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 36, left: 56 };

const chartW = CHART_WIDTH - PADDING.left - PADDING.right;
const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

function scaleY(value: number, min: number, max: number): number {
  if (max === min) return PADDING.top + chartH / 2;
  return PADDING.top + chartH - ((value - min) / (max - min)) * chartH;
}

function scaleX(index: number, count: number): number {
  if (count <= 1) return PADDING.left + chartW / 2;
  return PADDING.left + (index / (count - 1)) * chartW;
}

function buildPath(
  data: MonthlyTrend[],
  accessor: (d: MonthlyTrend) => number,
  min: number,
  max: number
): string {
  return data
    .map((d, i) => {
      const x = scaleX(i, data.length);
      const y = scaleY(accessor(d), min, max);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function CashflowTrendChart({ data }: CashflowTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-center">
        <p className="break-words text-sm text-[var(--text-muted)]">Add transactions across multiple months to build a useful trend.</p>
      </div>
    );
  }

  const allValues = data.flatMap((d) => [d.income, d.expenses]);
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;

  const ySteps = 4;
  const yStepSize = maxVal / ySteps;

  const incomePath = buildPath(data, (d) => d.income, minVal, maxVal);
  const expensePath = buildPath(data, (d) => d.expenses, minVal, maxVal);

  return (
    <div className="min-w-0 w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cashflow trend chart"
      >
        {Array.from({ length: ySteps + 1 }).map((_, i) => {
          const y = scaleY(i * yStepSize, minVal, maxVal);
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px]"
                fill="var(--text-muted)"
              >
                {formatCurrency(i * yStepSize).replace(/\.00$/, "")}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = scaleX(i, data.length);
          return (
            <text
              key={i}
              x={x}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              className="text-[10px]"
              fill="var(--text-muted)"
            >
              {d.label}
            </text>
          );
        })}

        <path d={incomePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={expensePath} fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => {
          return (
            <g key={`dots-${i}`}>
              <circle cx={scaleX(i, data.length)} cy={scaleY(d.income, minVal, maxVal)} r={3} fill="var(--accent)" />
              <circle cx={scaleX(i, data.length)} cy={scaleY(d.expenses, minVal, maxVal)} r={3} fill="var(--danger)" />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 sm:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
          <span className="text-xs text-[var(--text-secondary)]">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
          <span className="text-xs text-[var(--text-secondary)]">Expenses</span>
        </div>
      </div>
    </div>
  );
}
