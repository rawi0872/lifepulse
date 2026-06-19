"use client";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  "#10b981", "#8b5cf6", "#3b82f6", "#f59e0b", "#f43f5e",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#a855f7",
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 ${
              value === color
                ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]"
                : "ring-1 ring-[var(--border)]"
            }`}
            style={{ backgroundColor: color }}
          >
            {value === color && (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Custom:</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-0.5 transition-all duration-150 focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
        />
        <span className="text-xs text-[var(--text-muted)] font-mono">{value}</span>
      </div>
    </div>
  );
}
