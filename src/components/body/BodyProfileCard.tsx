"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PulseCard } from "@/components/ui/pulse-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ACTIVITY_LEVELS, type ActivityLevel, type BodyProfile, type BodyProfileFormData } from "@/lib/bodyPro";

const numberInputClass = "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none [appearance:textfield] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:min-h-0 sm:py-2 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const textInputClass = "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:min-h-0 sm:py-2";

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  active: "Active",
  very_active: "Very active",
};

function numericValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function BodyProfileCard() {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [height, setHeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">("");
  const [bodyGoal, setBodyGoal] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("body_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast({ type: "error", title: "Failed to load body profile." });
        setLoading(false);
        return;
      }

      const profile = data as BodyProfile | null;
      if (profile) {
        setHeight(profile.height_cm?.toString() ?? "");
        setTargetWeight(profile.target_weight_kg?.toString() ?? "");
        setActivityLevel(profile.activity_level ?? "");
        setBodyGoal(profile.body_goal ?? "");
        setNotes(profile.notes ?? "");
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [supabase, toast]);

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const formData: BodyProfileFormData = {
      height_cm: numericValue(height),
      target_weight_kg: numericValue(targetWeight),
      activity_level: activityLevel || null,
      body_goal: bodyGoal,
      notes,
    };

    const { error } = await supabase.from("body_profiles").upsert(
      {
        user_id: user.id,
        height_cm: formData.height_cm,
        target_weight_kg: formData.target_weight_kg,
        activity_level: formData.activity_level,
        body_goal: formData.body_goal.trim() || null,
        notes: formData.notes.trim() || null,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      toast({ type: "error", title: "Failed to save body profile." });
    } else {
      toast({ type: "success", title: "Body profile saved." });
    }
    setSaving(false);
  }

  return (
    <PulseCard title="Body Profile" accent="success" description="Wellness context">
      <div className="min-w-0 space-y-4 p-3.5 sm:p-4">
        <p className="break-words text-xs text-[var(--text-muted)]">
          Use this for wellness context and personal trends based on what you enter. Life Pulse does not provide medical advice.
        </p>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Height (cm)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175"
              className={numberInputClass}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Target weight (kg)
            </label>
            <p className="mb-1.5 text-[10px] text-[var(--text-muted)]">Optional personal reference, not advice.</p>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="70"
              className={numberInputClass}
            />
          </div>
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Activity level
          </label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel | "")}
            className={textInputClass}
          >
            <option value="">Not set</option>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>{ACTIVITY_LABELS[level]}</option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Body goal
          </label>
          <input
            type="text"
            value={bodyGoal}
            onChange={(e) => setBodyGoal(e.target.value)}
            placeholder="Example: feel stronger and more consistent"
            className={textInputClass}
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context for your own tracking."
            rows={2}
            className={`${textInputClass} min-h-24 resize-none`}
          />
        </div>

        <Button onClick={handleSave} disabled={loading || saving} className="w-full">
          {saving ? "Saving..." : "Save Body Profile"}
        </Button>
      </div>
    </PulseCard>
  );
}
