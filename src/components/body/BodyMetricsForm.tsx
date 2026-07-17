"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { PulseCard } from "@/components/ui/pulse-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const numberInputClass = "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none [appearance:textfield] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:min-h-0 sm:py-2 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const textInputClass = "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:min-h-0 sm:py-2";

function FieldShell({ label, unit, hint, children }: { label: string; unit?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</label>
        {unit && <span className="text-[10px] text-[var(--text-muted)]">{unit}</span>}
      </div>
      {hint && <p className="mb-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</p>}
      {children}
    </div>
  );
}

interface BodyMetricsFormData {
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  steps: number | null;
  workout_minutes: number | null;
  weight_kg: number | null;
  resting_heart_rate: number | null;
  recovery_score: number | null;
  notes: string | null;
}

interface BodyMetricsFormProps {
  initial: BodyMetricsFormData;
  saving: boolean;
  onSave: (data: BodyMetricsFormData) => void;
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
                "flex h-10 w-10 items-center justify-center rounded-md text-xs font-medium transition-all sm:h-7 sm:w-7",
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

export function BodyMetricsForm({ initial, saving, onSave }: BodyMetricsFormProps) {
  const [sleepHours, setSleepHours] = useState<string>(initial.sleep_hours?.toString() ?? "");
  const [sleepQuality, setSleepQuality] = useState<number | null>(initial.sleep_quality);
  const [energy, setEnergy] = useState<number | null>(initial.energy);
  const [steps, setSteps] = useState<string>(initial.steps?.toString() ?? "");
  const [workoutMinutes, setWorkoutMinutes] = useState<string>(initial.workout_minutes?.toString() ?? "");
  const [weightKg, setWeightKg] = useState<string>(initial.weight_kg?.toString() ?? "");
  const [restingHr, setRestingHr] = useState<string>(initial.resting_heart_rate?.toString() ?? "");
  const [recoveryScore, setRecoveryScore] = useState<string>(initial.recovery_score?.toString() ?? "");
  const [notes, setNotes] = useState<string>(initial.notes ?? "");

  const hasEntry = initial.sleep_hours !== null || initial.sleep_quality !== null || initial.energy !== null ||
    initial.steps !== null || initial.workout_minutes !== null || initial.weight_kg !== null ||
    initial.resting_heart_rate !== null || initial.recovery_score !== null || initial.notes !== null;

  function handleSave() {
    onSave({
      sleep_hours: sleepHours !== "" ? parseFloat(sleepHours) : null,
      sleep_quality: sleepQuality,
      energy,
      steps: steps !== "" ? parseInt(steps, 10) : null,
      workout_minutes: workoutMinutes !== "" ? parseInt(workoutMinutes, 10) : null,
      weight_kg: weightKg !== "" ? parseFloat(weightKg) : null,
      resting_heart_rate: restingHr !== "" ? parseInt(restingHr, 10) : null,
      recovery_score: recoveryScore !== "" ? parseInt(recoveryScore, 10) : null,
      notes: notes || null,
    });
  }

  return (
    <PulseCard title={hasEntry ? "Update today's check-in" : "Today body check-in"} accent="success" description="Manual entry">
      <div className="min-w-0 space-y-4 p-3.5 sm:p-4">
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          Log only the signals you want to remember today. Leave the rest blank; this is private tracking, not a health score.
        </p>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4">
          <FieldShell label="Sleep" unit="hours">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="8.0"
              className={numberInputClass}
            />
          </FieldShell>
          <FieldShell label="Steps">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="8000"
              className={numberInputClass}
            />
          </FieldShell>
          <FieldShell label="Workout" unit="minutes">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={workoutMinutes}
              onChange={(e) => setWorkoutMinutes(e.target.value)}
              placeholder="30"
              className={numberInputClass}
            />
          </FieldShell>
          <FieldShell label="Current weight today" unit="kg" hint="Optional daily check-in value.">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="70.0"
              className={numberInputClass}
            />
          </FieldShell>
          <FieldShell label="Resting heart rate" unit="bpm">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              placeholder="65"
              className={numberInputClass}
            />
          </FieldShell>
          <FieldShell label="Recovery" unit="0-100">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              value={recoveryScore}
              onChange={(e) => setRecoveryScore(e.target.value)}
              placeholder="70"
              className={numberInputClass}
            />
          </FieldShell>
        </div>

        <RatingRow label="Sleep Quality" value={sleepQuality} onChange={setSleepQuality} />
        <RatingRow label="Energy" value={energy} onChange={setEnergy} />

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did your body feel today?"
            rows={2}
            className={cn(textInputClass, "min-h-24 resize-none")}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : hasEntry ? "Update Entry" : "Save Entry"}
        </Button>
      </div>
    </PulseCard>
  );
}
