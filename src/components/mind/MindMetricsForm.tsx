"use client";

import { useState } from "react";
import { PulseCard } from "@/components/ui/pulse-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MindMetricsFormData {
  mood: number | null;
  stress: number | null;
  focus: number | null;
  clarity: number | null;
  motivation: number | null;
  reflection: string | null;
  tags: string[];
}

interface MindMetricsFormProps {
  initial: MindMetricsFormData;
  saving: boolean;
  onSave: (data: MindMetricsFormData) => void;
}

function RatingRow({ label, value, onChange, max = 5 }: { label: string; value: number | null; onChange: (v: number | null) => void; max?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="break-words text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-all sm:h-7 sm:w-7",
              value !== null && n <= value
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-active)]",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MindMetricsForm({ initial, saving, onSave }: MindMetricsFormProps) {
  const [mood, setMood] = useState<number | null>(initial.mood);
  const [stress, setStress] = useState<number | null>(initial.stress);
  const [focus, setFocus] = useState<number | null>(initial.focus);
  const [clarity, setClarity] = useState<number | null>(initial.clarity);
  const [motivation, setMotivation] = useState<number | null>(initial.motivation);
  const [reflection, setReflection] = useState<string>(initial.reflection ?? "");
  const [tagsInput, setTagsInput] = useState<string>(initial.tags.join(", "));

  const hasEntry = initial.mood !== null || initial.stress !== null || initial.focus !== null ||
    initial.clarity !== null || initial.motivation !== null || initial.reflection !== null || initial.tags.length > 0;

  function handleSave() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSave({
      mood,
      stress,
      focus,
      clarity,
      motivation,
      reflection: reflection || null,
      tags,
    });
  }

  return (
    <PulseCard title={hasEntry ? "Update Today's Mind Data" : "Log Today's Mind Data"} accent="accent" description="Manual entry">
      <div className="min-w-0 space-y-4 p-3.5 sm:p-4">
        <RatingRow label="Mood" value={mood} onChange={setMood} />
        <RatingRow label="Stress" value={stress} onChange={setStress} />
        <RatingRow label="Focus" value={focus} onChange={setFocus} />
        <RatingRow label="Clarity" value={clarity} onChange={setClarity} />
        <RatingRow label="Motivation" value={motivation} onChange={setMotivation} />

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Tags</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="work, creative, social, rest"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none sm:min-h-0 sm:py-1.5"
          />
          <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">Comma-separated tags</p>
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Reflection</label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="How is your mind feeling today?"
            rows={3}
            className="min-h-24 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none sm:min-h-0 sm:py-1.5"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : hasEntry ? "Update Entry" : "Save Entry"}
        </Button>
      </div>
    </PulseCard>
  );
}
