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
      <div className="p-4 pb-0">
        <div className="mb-1 flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Close the day</p>
            <p className="text-xs text-[var(--text-muted)]">Write one honest note before you leave.</p>
          </div>
        </div>
        {stats && (
          <div className="mb-3 flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
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
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What stood out today?"
        rows={3}
        maxLength={10000}
        className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none shadow-inner shadow-black/10"
      />

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Mood</p>
          <div className="flex gap-1.5">
            {moodLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => setMood(mood === i + 1 ? null : i + 1)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
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

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Energy</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setEnergy(energy === n ? null : n)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
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

      <div className="mt-4 flex items-center justify-end">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save journal"}
        </Button>
      </div>
    </Card>
  );
}
