"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import type { BodyMeasurement, MeasurementFormData } from "@/lib/bodyPro";
import { getTodayDate, formatNumber } from "@/lib/bodyPro";

interface MeasurementSectionProps {
  todayDate?: string;
}

export function MeasurementSection({ todayDate = getTodayDate() }: MeasurementSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<MeasurementFormData>({
    weight_kg: null, body_fat_percent: null, waist_cm: null,
    chest_cm: null, arms_cm: null, legs_cm: null, notes: "",
  });

  const fetchMeasurements = useCallback(async () => {
    const { data } = await supabase
      .from("body_measurements")
      .select("*")
      .order("measurement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    return data as BodyMeasurement[] | null;
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchMeasurements().then((data) => {
      if (!cancelled) {
        if (data) setMeasurements(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchMeasurements]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("body_measurements").insert({
      weight_kg: form.weight_kg,
      body_fat_percent: form.body_fat_percent,
      waist_cm: form.waist_cm,
      chest_cm: form.chest_cm,
      arms_cm: form.arms_cm,
      legs_cm: form.legs_cm,
      notes: form.notes || null,
      measurement_date: todayDate,
    });
    if (error) {
      toast({ type: "error", title: "Failed to save measurement" });
    } else {
      toast({ type: "success", title: "Measurement saved" });
      setForm({
        weight_kg: null, body_fat_percent: null, waist_cm: null,
        chest_cm: null, arms_cm: null, legs_cm: null, notes: "",
      });
      fetchMeasurements().then((data) => { if (data) setMeasurements(data); });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("body_measurements").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Measurement deleted" });
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  const latest = measurements.length > 0 ? measurements[0] : null;

  return (
    <div className="space-y-6">
      {latest && (
        <PulseCard title="Latest" accent="success">
          <div className="grid min-w-0 grid-cols-1 gap-3 p-4 text-center sm:grid-cols-3">
            {latest.weight_kg !== null && (
              <div>
                <p className="text-lg font-bold text-[var(--text)]">{formatNumber(latest.weight_kg, 1)}</p>
                <p className="text-[10px] text-[var(--text-muted)]">kg</p>
              </div>
            )}
            {latest.body_fat_percent !== null && (
              <div>
                <p className="text-lg font-bold text-[var(--text)]">{formatNumber(latest.body_fat_percent, 1)}%</p>
                <p className="text-[10px] text-[var(--text-muted)]">Body Fat</p>
              </div>
            )}
            {latest.waist_cm !== null && (
              <div>
                <p className="text-lg font-bold text-[var(--text)]">{formatNumber(latest.waist_cm, 1)}</p>
                <p className="text-[10px] text-[var(--text-muted)]">Waist cm</p>
              </div>
            )}
          </div>
        </PulseCard>
      )}

      <PulseCard title="Log Measurement" accent="success">
        <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Weight (kg)</label>
            <input
              type="number" min={0} step={0.1} placeholder="kg"
              value={form.weight_kg ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Body Fat %</label>
            <input
              type="number" min={0} max={100} step={0.1} placeholder="%"
              value={form.body_fat_percent ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, body_fat_percent: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Waist (cm)</label>
            <input
              type="number" min={0} step={0.1} placeholder="cm"
              value={form.waist_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, waist_cm: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Chest (cm)</label>
            <input
              type="number" min={0} step={0.1} placeholder="cm"
              value={form.chest_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, chest_cm: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Arms (cm)</label>
            <input
              type="number" min={0} step={0.1} placeholder="cm"
              value={form.arms_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, arms_cm: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Legs (cm)</label>
            <input
              type="number" min={0} step={0.1} placeholder="cm"
              value={form.legs_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, legs_cm: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
            />
          </div>
          <div className="flex justify-stretch sm:col-span-2 sm:justify-end lg:col-span-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {saving ? "Saving..." : "Save Measurement"}
            </button>
          </div>
        </div>
      </PulseCard>

      {!loading && measurements.length === 0 && (
        <PulseCard title="Measurement History" accent="success">
          <EmptyState message="No measurements logged yet." />
        </PulseCard>
      )}

      {measurements.length > 0 && (
        <PulseCard title="Recent Measurements" accent="success">
          <div className="divide-y divide-[var(--border)]">
            {measurements.map((m) => (
              <div key={m.id} className="group flex min-w-0 items-start justify-between gap-3 px-4 py-2">
                <div className="min-w-0 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="text-xs text-[var(--text)]">
                    {new Date(m.measurement_date).toLocaleDateString()}
                  </span>
                  {m.weight_kg !== null && <span className="text-[10px] text-[var(--text-muted)]">{formatNumber(m.weight_kg, 1)} kg</span>}
                  {m.body_fat_percent !== null && <span className="text-[10px] text-[var(--text-muted)]">{formatNumber(m.body_fat_percent, 1)}% BF</span>}
                  {m.waist_cm !== null && <span className="text-[10px] text-[var(--text-muted)]">W:{formatNumber(m.waist_cm, 1)}</span>}
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="shrink-0 text-[10px] text-[var(--danger)] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </PulseCard>
      )}
    </div>
  );
}


