"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import type { HealthNote, HealthNoteFormData } from "@/lib/bodyPro";
import { getTodayDate } from "@/lib/bodyPro";

const NOTE_CATEGORIES = ["General", "Pain", "Symptom", "Mood", "Sleep", "Injury", "Medication", "Doctor Visit", "Other"];

interface HealthNoteSectionProps {
  todayDate?: string;
}

export function HealthNoteSection({ todayDate = getTodayDate() }: HealthNoteSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [notes, setNotes] = useState<HealthNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<HealthNoteFormData>({
    title: "", category: "General", severity: null, notes: "",
  });

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("health_notes")
      .select("*")
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    return data as HealthNote[] | null;
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchNotes().then((data) => {
      if (!cancelled) {
        if (data) setNotes(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchNotes]);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("health_notes").insert({
      title: form.title,
      category: form.category || null,
      severity: form.severity,
      notes: form.notes || null,
      note_date: todayDate,
    });
    if (error) {
      toast({ type: "error", title: "Failed to save note" });
    } else {
      toast({ type: "success", title: "Health note saved" });
      setForm({ title: "", category: "General", severity: null, notes: "" });
      fetchNotes().then((data) => { if (data) setNotes(data); });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("health_notes").delete().eq("id", id);
    if (error) { toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Note deleted" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-6">
      <PulseCard title="Add Health Note" accent="warning">
        <div className="grid min-w-0 grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 sm:p-4">
          <input
            type="text" placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] sm:col-span-2 sm:min-h-0 sm:py-2"
          />
          <div className="min-w-0 flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2"
            >
              {NOTE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--text-muted)]">Severity (1-5)</label>
            <select
              value={form.severity ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none sm:min-h-0 sm:py-2"
            >
              <option value="">--</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <textarea
            placeholder="Details"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="min-h-24 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none sm:col-span-2 sm:min-h-0 sm:py-2"
            rows={3}
          />
          <div className="flex justify-stretch sm:col-span-2 sm:justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </PulseCard>

      {!loading && notes.length === 0 && (
        <PulseCard title="Health Notes" accent="warning">
          <EmptyState message="No health notes yet." />
        </PulseCard>
      )}

      {notes.length > 0 && (
        <PulseCard title="Recent Notes" accent="warning">
          <div className="divide-y divide-[var(--border)]">
            {notes.map((n) => (
              <div key={n.id} className="group flex min-w-0 items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-xs font-medium text-[var(--text)]">{n.title}</span>
                    {n.category && (
                      <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] text-[var(--warning)]">
                        {n.category}
                      </span>
                    )}
                    {n.severity !== null && (
                      <span className="text-[10px] text-[var(--text-muted)]">S:{n.severity}/5</span>
                    )}
                  </div>
                  {n.notes && <p className="break-words text-[10px] text-[var(--text-secondary)]">{n.notes}</p>}
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {new Date(n.note_date).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
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


