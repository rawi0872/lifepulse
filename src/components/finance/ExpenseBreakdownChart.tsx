"use client";

import type { ExpenseCategoryBreakdown } from "./types";
import { formatCurrency } from "./financeUtils";

interface ExpenseBreakdownChartProps {
  data: ExpenseCategoryBreakdown[];
}

const RADIUS = 72;
const STROKE_WIDTH = 28;
const CENTER = 100;
const SIZE = 200;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
        <p className="text-sm text-[var(--text-muted)]">Add expense transactions to see your spending breakdown.</p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  function getSegmentProps(index: number) {
    let cumulative = 0;
    for (let i = 0; i < index; i++) {
      cumulative += total > 0 ? data[i].amount / total : 0;
    }
    const percent = total > 0 ? data[index].amount / total : 0;
    return {
      offset: cumulative * CIRCUMFERENCE,
      dashLen: percent * CIRCUMFERENCE,
    };
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[180px] h-auto"
        role="img"
        aria-label="Expense breakdown by category"
      >
        {data.map((item, i) => {
          const { offset, dashLen } = getSegmentProps(i);

          return (
            <circle
              key={item.categoryId}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={item.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${dashLen} ${CIRCUMFERENCE}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              className="transition-all duration-300"
            />
          );
        })}

        <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="text-sm font-semibold" fill="var(--text)">
          {formatCurrency(total)}
        </text>
        <text x={CENTER} y={CENTER + 12} textAnchor="middle" className="text-[10px]" fill="var(--text-muted)">
          Total expenses
        </text>
      </svg>

      <div className="mt-4 w-full space-y-1.5">
        {data.map((item) => (
          <div key={item.categoryId} className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-xs text-[var(--text-secondary)]">{item.categoryName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-[var(--text-muted)]">{item.percentage}%</span>
              <span className="text-xs font-medium text-[var(--text)]">{formatCurrency(item.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
