"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getTodayDateString } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface JournalStats {
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  xpToday: number;
}

export function JournalSection({ stats }: { stats?: JournalStats }) {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();
  const today = getTodayDateString();

  const loadEntry = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .maybeSingle();

    if (data) {
      setEntryId(data.id);
      setContent(data.content || "");
      setMood(data.mood);
      setEnergy(data.energy);
    }
  }, [supabase, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntry();
  }, [loadEntry]);

  async function save() {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        user_id: user.id,
        entry_date: today,
        content,
        mood,
        energy,
      };

      if (entryId) {
        const { error: uErr } = await supabase
          .from("journal_entries")
          .update(payload)
          .eq("id", entryId);

        if (uErr) { toast({ type: "error", title: uErr.message }); setSaving(false); return; }
      } else {
        const { data, error: iErr } = await supabase
          .from("journal_entries")
          .insert(payload)
          .select()
          .single();

        if (iErr) { toast({ type: "error", title: iErr.message }); setSaving(false); return; }
        if (data) setEntryId(data.id);
      }

      setSaving(false);
      toast({ type: "success", title: "Journal entry saved." });
    } catch {
      toast({ type: "error", title: "Failed to save journal entry." });
      setSaving(false);
    }
  }

  const moodLabels = ["Awful", "Bad", "Okay", "Good", "Great"];

  return (
    <Card variant="subtle" className="border-[var(--border)] bg-gradient-to-b from-[var(--surface-ghost)] to-[var(--surface-soft)]">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">Close the day</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Write one honest note here. It saves to your private Journal history and helps Weekly Review later.</p>
          </div>
        </div>
        {stats && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <span>{stats.habitsDone}/{stats.habitsTotal} habits</span>
            <span className="text-[var(--text-muted)]">&middot;</span>
            <span>{stats.tasksDone}/{stats.tasksTotal} tasks</span>
            {stats.xpToday > 0 && (
              <>
                <span className="text-[var(--text-muted)]">&middot;</span>
                <span className="text-[var(--accent)]/60">+{stats.xpToday} XP</span>
              </>
            )}
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What stood out today?"
          rows={4}
          maxLength={10000}
          className="min-h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-base leading-relaxed text-[var(--text)] placeholder-[var(--text-muted)] shadow-inner shadow-black/10 transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:min-h-28 sm:text-sm"
        />
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">Private manual reflection. No AI summaries or external processing.</p>

        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Mood</p>
          <div className="grid grid-cols-5 gap-1.5">
            {moodLabels.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMood(mood === i + 1 ? null : i + 1)}
                className={`min-h-12 rounded-lg px-1.5 py-2 text-xs font-medium transition-all duration-150 sm:min-h-0 sm:px-2 sm:py-1.5 ${
                  mood === i + 1
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30 shadow-sm shadow-[var(--accent)]/10"
                    : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span className="block text-[10px]">{["😖","😟","😐","😊","🔥"][i]}</span>
                <span className="block mt-0.5">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Energy</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEnergy(energy === n ? null : n)}
                className={`min-h-11 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-150 sm:min-h-0 sm:py-1.5 ${
                  energy === n
                    ? "bg-[var(--surface)] text-[var(--text)] ring-1 ring-[var(--border-strong)]/40 shadow-sm shadow-black/10"
                    : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-[var(--text-muted)]">You can update today&apos;s reflection later from this same spot.</p>
          <Button size="sm" onClick={save} disabled={saving} className="min-h-11 w-full px-4 text-sm sm:min-h-0 sm:w-auto sm:text-xs">
            {saving ? "Saving..." : entryId ? "Update reflection" : "Save reflection"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
