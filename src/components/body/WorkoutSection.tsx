"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import type {
  Workout, WorkoutFormData,
  WorkoutExercise, WorkoutExerciseFormData,
} from "@/lib/bodyPro";
import { getTodayDate } from "@/lib/bodyPro";

const WORKOUT_TYPES = ["Cardio", "Strength", "HIIT", "Yoga", "Sports", "Walk", "Other"];

interface WorkoutSectionProps {
  todayDate?: string;
}

export function WorkoutSection({ todayDate = getTodayDate() }: WorkoutSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Record<string, WorkoutExercise[]>>({});

  const [form, setForm] = useState<WorkoutFormData>({
    title: "", type: "Strength", duration_minutes: null, intensity: null, notes: "",
  });

  const [exForm, setExForm] = useState<WorkoutExerciseFormData>({
    exercise_name: "", sets: null, reps: null, weight_kg: null,
    distance_km: null, duration_minutes: null, notes: "",
  });

  const fetchWorkouts = useCallback(async () => {
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    return data as Workout[] | null;
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchWorkouts().then((data) => {
      if (!cancelled) {
        if (data) setWorkouts(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchWorkouts]);

  const fetchExercises = useCallback(async (workoutId: string) => {
    const { data } = await supabase
      .from("workout_exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("sort_order", { ascending: true });
    if (data) setExercises((prev) => ({ ...prev, [workoutId]: data }));
  }, [supabase]);

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!exercises[id]) fetchExercises(id);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("workouts").insert({
      title: form.title,
      type: form.type || null,
      duration_minutes: form.duration_minutes,
      intensity: form.intensity,
      notes: form.notes || null,
      workout_date: todayDate,
    });
    if (error) {
      toast({ type: "error", title: "Failed to save workout" });
    } else {
      toast({ type: "success", title: "Workout saved" });
      setForm({ title: "", type: "Strength", duration_minutes: null, intensity: null, notes: "" });
      fetchWorkouts().then((data) => { if (data) setWorkouts(data); });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Workout deleted" });
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  const handleAddExercise = async (workoutId: string) => {
    if (!exForm.exercise_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("workout_exercises").insert({
      workout_id: workoutId,
      exercise_name: exForm.exercise_name,
      sets: exForm.sets,
      reps: exForm.reps,
      weight_kg: exForm.weight_kg,
      distance_km: exForm.distance_km,
      duration_minutes: exForm.duration_minutes,
      notes: exForm.notes || null,
    });
    if (error) {
      toast({ type: "error", title: "Failed to add exercise" });
    } else {
      toast({ type: "success", title: "Exercise added" });
      setExForm({
        exercise_name: "", sets: null, reps: null, weight_kg: null,
        distance_km: null, duration_minutes: null, notes: "",
      });
      fetchExercises(workoutId);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PulseCard title="Log Workout" accent="success">
        <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4">
          <input
            type="text" placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] sm:col-span-2 sm:min-h-0 sm:py-2"
          />
          <div className="min-w-0 flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2"
            >
              {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Duration (min)</label>
            <input
              type="number" min={0} placeholder="min"
              value={form.duration_minutes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Intensity (1-5)</label>
            <select
              value={form.intensity ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, intensity: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2"
            >
              <option value="">--</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="min-h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2"
            rows={2}
          />
          <div className="flex justify-stretch sm:col-span-2 sm:justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {saving ? "Saving..." : "Save Workout"}
            </button>
          </div>
        </div>
      </PulseCard>

      {loading && <p className="px-4 text-xs text-[var(--text-muted)]">Loading workouts...</p>}

      {!loading && workouts.length === 0 && (
        <PulseCard title="Recent Workouts" accent="success">
          <EmptyState message="No workouts logged yet." />
        </PulseCard>
      )}

      {workouts.length > 0 && (
        <PulseCard title="Recent Workouts" accent="success">
          <div className="divide-y divide-[var(--border)]">
            {workouts.map((w) => (
              <div key={w.id}>
                <button
                  onClick={() => handleExpand(w.id)}
                  className="flex w-full min-w-0 items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-soft)] sm:items-center"
                >
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <p className="break-words text-xs font-medium text-[var(--text)]">{w.title}</p>
                    <p className="break-words text-[10px] text-[var(--text-muted)]">
                      {w.type && `${w.type}`}
                      {w.duration_minutes !== null && ` · ${w.duration_minutes} min`}
                      {w.intensity !== null && ` · Intensity ${w.intensity}/5`}
                      {!w.type && w.duration_minutes === null && w.intensity === null && "No details"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-right text-[10px] text-[var(--text-muted)]">
                      {new Date(w.workout_date).toLocaleDateString()}
                    </span>
                    <svg className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${expandedId === w.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {expandedId === w.id && (
                  <div className="border-t border-[var(--border)]">
                    {(exercises[w.id] ?? []).length > 0 && (
                      <div className="divide-y divide-[var(--border-soft)]">
                        {(exercises[w.id] ?? []).map((e) => (
                          <div key={e.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <span className="min-w-0 break-words text-xs text-[var(--text)]">{e.exercise_name}</span>
                            <span className="break-words text-[10px] text-[var(--text-muted)] sm:text-right">
                              {e.sets !== null && `${e.sets} sets`}
                              {e.reps !== null && ` · ${e.reps} reps`}
                              {e.weight_kg !== null && ` · ${e.weight_kg} kg`}
                              {e.distance_km !== null && ` · ${e.distance_km} km`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-[var(--border)] p-4">
                      <p className="mb-2 text-[10px] font-medium text-[var(--text-muted)]">Add Exercise</p>
                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                        <input
                          type="text" placeholder="Exercise name"
                          value={exForm.exercise_name}
                          onChange={(e) => setExForm((f) => ({ ...f, exercise_name: e.target.value }))}
                          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-3 sm:min-h-0 sm:py-2"
                        />
                        <input
                          type="number" placeholder="Sets"
                          value={exForm.sets ?? ""}
                          onChange={(e) => setExForm((f) => ({ ...f, sets: e.target.value ? Number(e.target.value) : null }))}
                          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
                        />
                        <input
                          type="number" placeholder="Reps"
                          value={exForm.reps ?? ""}
                          onChange={(e) => setExForm((f) => ({ ...f, reps: e.target.value ? Number(e.target.value) : null }))}
                          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
                        />
                        <input
                          type="number" placeholder="Weight (kg)"
                          value={exForm.weight_kg ?? ""}
                          onChange={(e) => setExForm((f) => ({ ...f, weight_kg: e.target.value ? Number(e.target.value) : null }))}
                          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
                        />
                        <button
                          onClick={() => handleAddExercise(w.id)}
                          disabled={saving || !exForm.exercise_name.trim()}
                          className="min-h-11 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:col-span-3 sm:min-h-0 sm:py-2"
                        >
                          {saving ? "Adding..." : "Add Exercise"}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[var(--border)] px-4 py-2">
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="text-[10px] text-[var(--danger)] hover:underline"
                      >
                        Delete workout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </PulseCard>
      )}
    </div>
  );
}


