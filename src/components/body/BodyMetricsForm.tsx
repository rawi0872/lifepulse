"use client";

import { useState } from "react";
import { PulseCard } from "@/components/ui/pulse-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-all",
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
      sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
      sleep_quality: sleepQuality,
      energy,
      steps: steps ? parseInt(steps, 10) : null,
      workout_minutes: workoutMinutes ? parseInt(workoutMinutes, 10) : null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      resting_heart_rate: restingHr ? parseInt(restingHr, 10) : null,
      recovery_score: recoveryScore ? parseInt(recoveryScore, 10) : null,
      notes: notes || null,
    });
  }

  return (
    <PulseCard title={hasEntry ? "Update Today's Body Data" : "Log Today's Body Data"} accent="success" description="Manual entry">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Sleep (hours)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="8.0"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Steps</label>
            <input
              type="number"
              min="0"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="8000"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Workout (min)</label>
            <input
              type="number"
              min="0"
              value={workoutMinutes}
              onChange={(e) => setWorkoutMinutes(e.target.value)}
              placeholder="30"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="70.0"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Resting HR</label>
            <input
              type="number"
              min="0"
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              placeholder="65"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Recovery (0–100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={recoveryScore}
              onChange={(e) => setRecoveryScore(e.target.value)}
              placeholder="70"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>

        <RatingRow label="Sleep Quality" value={sleepQuality} onChange={setSleepQuality} />
        <RatingRow label="Energy" value={energy} onChange={setEnergy} />

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did your body feel today?"
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none resize-none"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : hasEntry ? "Update Entry" : "Save Entry"}
        </Button>
      </div>
    </PulseCard>
  );
}
