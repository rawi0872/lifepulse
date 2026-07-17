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

const NOTE_HELPERS = ["Slept poorly", "Good focus block", "Felt distracted", "Social day", "Heavy workload"] as const;

function RatingRow({ label, hint, value, onChange, max = 5 }: { label: string; hint: string; value: number | null; onChange: (v: number | null) => void; max?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <span className="break-words text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <p className="mt-0.5 break-words text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</p>
      </div>
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

  function applyNoteHelper(note: string) {
    setReflection((current) => current.trim() ? `${current.trim()} ${note}.` : `${note}.`);
  }

  return (
    <PulseCard title={hasEntry ? "Update today's mind check-in" : "Log today's mind check-in"} accent="accent" description="Private manual tracking">
      <div className="min-w-0 space-y-4 p-3.5 sm:p-4">
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          Capture the signals you want to remember from today. The 1-5 buttons are optional; this is private tracking, not a score.
        </p>
        <RatingRow label="Mood today" hint="1 is low, 5 is high. Use your own meaning." value={mood} onChange={setMood} />
        <RatingRow label="Stress level" hint="1 is low stress, 5 is high stress." value={stress} onChange={setStress} />
        <RatingRow label="Focus quality" hint="1 is scattered, 5 is steady focus." value={focus} onChange={setFocus} />
        <RatingRow label="Clarity" hint="How clear the day felt. 1 is low, 5 is high." value={clarity} onChange={setClarity} />
        <RatingRow label="Motivation / energy to act" hint="How much drive you felt. 1 is low, 5 is high." value={motivation} onChange={setMotivation} />

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Optional tags</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="work, creative, social, rest"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none sm:min-h-0 sm:py-1.5"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Comma-separated context labels. Example: work, creative, social, rest.</p>
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Short note</label>
          <p className="mb-2 text-[10px] leading-relaxed text-[var(--text-muted)]">What affected today? One honest note is enough.</p>
          <div className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Note examples</p>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">These only fill the note. You still choose whether to save.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NOTE_HELPERS.map((helper) => (
                <button key={helper} type="button" onClick={() => applyNoteHelper(helper)} className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--text-secondary)]">
                  {helper}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What affected your mood, stress, focus, or clarity today?"
            rows={3}
            className="min-h-24 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none sm:min-h-0 sm:py-1.5"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : hasEntry ? "Update mind check-in" : "Save mind check-in"}
        </Button>
      </div>
    </PulseCard>
  );
}
