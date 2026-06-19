"use client";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

const SUGGESTED_ICONS = [
  "🧠", "💪", "💼", "❤️", "💰", "🙏", "🎸", "📚",
  "💻", "🏠", "🎨", "🌱", "🧘", "🚀",
  "🎯", "🏆", "⚡", "🔥", "🛠️", "🧪", "🧩", "📝",
  "📅", "🕒", "🛡️", "🗣️", "🤝", "🌍", "✈️", "🏋️",
  "🏃", "🥗", "💤", "🎹", "🎤", "🎧", "📷", "🎬",
  "🧵", "✨", "⭐", "🌙", "☀️",
];

export function IconPicker({ value, onChange }: IconPickerProps) {
  const isCustom = value !== "" && !SUGGESTED_ICONS.includes(value);

  return (
    <div>
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        {SUGGESTED_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            aria-label={`Icon ${icon}`}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base transition-all duration-150 ${
              value === icon
                ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]/50"
                : "bg-[var(--surface-soft)] hover:bg-[var(--surface)] ring-1 ring-[var(--border)]"
            }`}
          >
            {icon}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Custom icon"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs transition-all duration-150 ${
            isCustom
              ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-2 ring-[var(--accent)]/50"
              : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--surface)] ring-1 ring-[var(--border)]"
          }`}
          title="Custom icon"
        >
          ✏️
        </button>
      </div>
      {isCustom && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
          placeholder="Paste any emoji"
        />
      )}
    </div>
  );
}
