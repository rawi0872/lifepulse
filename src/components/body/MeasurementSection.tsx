"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import type { BodyMeasurement, MeasurementFormData } from "@/lib/bodyPro";
import { getTodayDate, formatNumber } from "@/lib/bodyPro";

const numberInputClass = "min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none [appearance:textfield] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:min-h-0 sm:py-2 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function NumberField({ label, unit, hint, children }: { label: string; unit?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</label>
        {unit && <span className="text-[10px] text-[var(--text-muted)]">{unit}</span>}
      </div>
      {hint && <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</p>}
      {children}
    </div>
  );
}

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
        <PulseCard title="Current weight & latest measurements" accent="success" description="Based on your latest entry">
          <div className="grid min-w-0 grid-cols-1 gap-3 p-4 text-center sm:grid-cols-3">
            {latest.weight_kg !== null && (
              <div>
                <p className="text-lg font-bold text-[var(--text)]">{formatNumber(latest.weight_kg, 1)}</p>
                <p className="text-[10px] text-[var(--text-muted)]">Current weight · kg</p>
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

      <PulseCard title="Current weight & measurements" accent="success" description="Optional manual entry">
        <p className="px-3.5 pt-3.5 text-xs leading-relaxed text-[var(--text-muted)] sm:px-4">
          Add today&apos;s current weight or any measurement you want to remember. Leave anything blank.
        </p>
        <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          <NumberField label="Current weight today" unit="kg" hint="Your latest manual weight entry.">
            <input
              type="number" inputMode="decimal" min={0} step={0.1} placeholder="70.0"
              value={form.weight_kg ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value ? Number(e.target.value) : null }))}
              className={`${numberInputClass} w-full`}
            />
          </NumberField>
          <NumberField label="Body fat" unit="%">
            <input
              type="number" inputMode="decimal" min={0} max={100} step={0.1} placeholder="Optional"
              value={form.body_fat_percent ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, body_fat_percent: e.target.value ? Number(e.target.value) : null }))}
              className={`${numberInputClass} w-full`}
            />
          </NumberField>
          <NumberField label="Waist" unit="cm">
            <input
              type="number" inputMode="decimal" min={0} step={0.1} placeholder="Optional"
              value={form.waist_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, waist_cm: e.target.value ? Number(e.target.value) : null }))}
              className={`${numberInputClass} w-full`}
            />
          </NumberField>
          <NumberField label="Chest" unit="cm">
            <input
              type="number" inputMode="decimal" min={0} step={0.1} placeholder="Optional"
              value={form.chest_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, chest_cm: e.target.value ? Number(e.target.value) : null }))}
              className={`${numberInputClass} w-full`}
            />
          </NumberField>
          <NumberField label="Arms" unit="cm">
            <input
              type="number" inputMode="decimal" min={0} step={0.1} placeholder="Optional"
              value={form.arms_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, arms_cm: e.target.value ? Number(e.target.value) : null }))}
              className={`${numberInputClass} w-full`}
            />
          </NumberField>
          <NumberField label="Legs" unit="cm">
            <input
              type="number" inputMode="decimal" min={0} step={0.1} placeholder="Optional"
              value={form.legs_cm ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, legs_cm: e.target.value ? Number(e.target.value) : null }))}
              className={`${numberInputClass} w-full`}
            />
          </NumberField>
          <div className="flex justify-stretch sm:col-span-2 sm:justify-end lg:col-span-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-11 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {saving ? "Saving..." : "Save Measurement"}
            </button>
          </div>
        </div>
      </PulseCard>

      {!loading && measurements.length === 0 && (
        <PulseCard title="Measurement history" accent="success">
          <EmptyState message="No measurements logged yet." description="Start with current weight if useful. This is private tracking, not advice." />
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


