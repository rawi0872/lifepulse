"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import type { NutritionLog, NutritionFormData } from "@/lib/bodyPro";
import { getTodayDate, formatNumber } from "@/lib/bodyPro";

interface NutritionSectionProps {
  todayDate?: string;
}

export function NutritionSection({ todayDate = getTodayDate() }: NutritionSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<NutritionFormData>({
    meal_name: "", calories: null, protein_g: null, carbs_g: null, fat_g: null, water_ml: null, notes: "",
  });

  const todayLogs = logs.filter((l) => l.log_date === todayDate);
  const otherLogs = logs.filter((l) => l.log_date !== todayDate);

  const totals = todayLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein: acc.protein + (l.protein_g ?? 0),
      water: acc.water + (l.water_ml ?? 0),
    }),
    { calories: 0, protein: 0, water: 0 }
  );

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("nutrition_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    return data as NutritionLog[] | null;
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchLogs().then((data) => {
      if (!cancelled) {
        if (data) setLogs(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchLogs]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("nutrition_logs").insert({
      meal_name: form.meal_name || null,
      calories: form.calories,
      protein_g: form.protein_g,
      carbs_g: form.carbs_g,
      fat_g: form.fat_g,
      water_ml: form.water_ml,
      notes: form.notes || null,
      log_date: todayDate,
    });
    if (error) {
      toast({ type: "error", title: "Failed to save nutrition log" });
    } else {
      toast({ type: "success", title: "Nutrition logged" });
      setForm({
        meal_name: "", calories: null, protein_g: null, carbs_g: null, fat_g: null, water_ml: null, notes: "",
      });
      fetchLogs().then((data) => { if (data) setLogs(data); });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("nutrition_logs").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Entry deleted" });
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-6">
      <PulseCard title="Log Nutrition" accent="success">
        <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4">
          <input
            type="text" placeholder="Meal name"
            value={form.meal_name}
            onChange={(e) => setForm((f) => ({ ...f, meal_name: e.target.value }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] sm:col-span-2 sm:min-h-0 sm:py-2"
          />
          <input
            type="number" min={0} placeholder="Calories"
            value={form.calories ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value ? Number(e.target.value) : null }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
          />
          <input
            type="number" min={0} placeholder="Water (ml)"
            value={form.water_ml ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, water_ml: e.target.value ? Number(e.target.value) : null }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
          />
          <input
            type="number" min={0} step={0.1} placeholder="Protein (g)"
            value={form.protein_g ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, protein_g: e.target.value ? Number(e.target.value) : null }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
          />
          <input
            type="number" min={0} step={0.1} placeholder="Carbs (g)"
            value={form.carbs_g ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, carbs_g: e.target.value ? Number(e.target.value) : null }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
          />
          <input
            type="number" min={0} step={0.1} placeholder="Fat (g)"
            value={form.fat_g ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, fat_g: e.target.value ? Number(e.target.value) : null }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:min-h-0 sm:py-2"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:col-span-2 sm:min-h-0 sm:py-2"
          >
            {saving ? "Saving..." : "Log Entry"}
          </button>
        </div>
      </PulseCard>

      {todayLogs.length > 0 && (
        <PulseCard title="Today's Nutrition" accent="success">
          <div className="divide-y divide-[var(--border)]">
            {todayLogs.map((l) => (
              <div key={l.id} className="group flex min-w-0 items-start justify-between gap-3 px-4 py-2">
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="break-words text-xs text-[var(--text)]">{l.meal_name || "Meal"}</span>
                  <span className="break-words text-[10px] text-[var(--text-muted)]">
                    {l.calories !== null && `${l.calories} cal`}
                    {l.protein_g !== null && ` · ${l.protein_g}g protein`}
                    {l.carbs_g !== null && ` · ${l.carbs_g}g carbs`}
                    {l.fat_g !== null && ` · ${l.fat_g}g fat`}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(l.id)}
                  className="shrink-0 text-[10px] text-[var(--danger)] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
            <div className="flex min-w-0 flex-col gap-1 bg-[var(--surface-soft)] px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-[var(--text)]">Totals</span>
              <span className="break-words text-xs text-[var(--text-secondary)] sm:text-right">
                {formatNumber(totals.calories)} cal &middot; {formatNumber(totals.protein)}g protein &middot; {formatNumber(totals.water)}ml water
              </span>
            </div>
          </div>
        </PulseCard>
      )}

      {!loading && otherLogs.length === 0 && todayLogs.length === 0 && (
        <PulseCard title="Nutrition History" accent="success">
          <EmptyState message="No nutrition logged yet." />
        </PulseCard>
      )}

      {otherLogs.length > 0 && (
        <PulseCard title="Recent Entries" accent="success">
          <div className="divide-y divide-[var(--border)]">
            {otherLogs.slice(0, 10).map((l) => (
              <div key={l.id} className="flex min-w-0 flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="break-words text-xs text-[var(--text)]">{l.meal_name || "Meal"}</span>
                  <span className="break-words text-[10px] text-[var(--text-muted)]">
                    {l.calories !== null && `${l.calories} cal`}
                    {l.protein_g !== null && ` · ${l.protein_g}g`}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {new Date(l.log_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </PulseCard>
      )}
    </div>
  );
}


