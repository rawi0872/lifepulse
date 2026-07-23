"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TodayModel } from "@/lib/today/types";
import {
  buildEveningShutdownBlock,
  buildEveningShutdownSummary,
  mergeEveningShutdownBlock,
  normalizeEveningShutdownReflection,
  parseEveningShutdownReflection,
  type EveningShutdownReflection,
} from "@/lib/today/evening-shutdown";

interface EveningShutdownProps {
  model: TodayModel;
  supabase: SupabaseClient;
  timePeriod: "morning" | "day" | "evening";
  onSaved: () => Promise<void> | void;
  onAuthRequired: () => void;
  onSuccess: () => void;
  onError: () => void;
}

const EMPTY_REFLECTION: EveningShutdownReflection = {
  wentWell: "",
  gotInTheWay: "",
  learned: "",
  tomorrowSeed: "",
};

export function EveningShutdown({
  model,
  supabase,
  timePeriod,
  onSaved,
  onAuthRequired,
  onSuccess,
  onError,
}: EveningShutdownProps) {
  const wentWellId = useId();
  const gotInTheWayId = useId();
  const learnedId = useId();
  const tomorrowSeedId = useId();
  const mountedRef = useRef(true);
  const [reflection, setReflection] = useState<EveningShutdownReflection>(EMPTY_REFLECTION);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const summary = buildEveningShutdownSummary(model);
  const isEvening = timePeriod === "evening";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingBlock() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("journal_entries")
        .select("content")
        .eq("user_id", user.id)
        .eq("entry_date", model.date.localDate)
        .maybeSingle();

      if (cancelled) return;
      setReflection(parseEveningShutdownReflection(data?.content ?? ""));
      setSaved(false);
      setSaveError(null);
    }

    loadExistingBlock();
    return () => {
      cancelled = true;
    };
  }, [model.date.localDate, supabase]);

  function updateReflectionField(field: keyof EveningShutdownReflection, value: string) {
    const nextValue = field === "tomorrowSeed" ? value.slice(0, 240) : value.slice(0, 1000);
    setReflection((current) => ({ ...current, [field]: nextValue }));
    setSaved(false);
    setSaveError(null);
  }

  async function saveShutdown() {
    if (saving) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onAuthRequired();
        return;
      }

      const { data: existingEntry, error: lookupError } = await supabase
        .from("journal_entries")
        .select("id, content")
        .eq("user_id", user.id)
        .eq("entry_date", model.date.localDate)
        .maybeSingle();

      if (lookupError) {
        onError();
        if (mountedRef.current) setSaveError("We could not save Evening Shutdown. Please try again.");
        return;
      }

      const normalized = normalizeEveningShutdownReflection(reflection);
      const nextContent = mergeEveningShutdownBlock(existingEntry?.content ?? "", buildEveningShutdownBlock(normalized));
      const { data: savedEntry, error: saveErrorResult } = await supabase
        .from("journal_entries")
        .upsert({
          user_id: user.id,
          entry_date: model.date.localDate,
          content: nextContent,
        }, { onConflict: "user_id,entry_date" })
        .select("id")
        .maybeSingle();

      if (saveErrorResult || !savedEntry) {
        onError();
        if (mountedRef.current) setSaveError("We could not save Evening Shutdown. Please try again.");
        return;
      }

      await onSaved();
      onSuccess();
      if (mountedRef.current) {
        setReflection(normalized);
        setSaved(true);
      }
    } catch {
      onError();
      if (mountedRef.current) setSaveError("We could not save Evening Shutdown. Please try again.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <section id="evening-reflection" className="mb-6 scroll-mt-24" aria-labelledby="evening-shutdown-heading">
      <Card className={`overflow-hidden ${isEvening ? "border-[var(--accent)]/28 bg-[linear-gradient(135deg,rgba(122,162,199,0.11),rgba(244,247,251,0.032)),var(--surface)] shadow-xl shadow-black/20" : "border-white/[0.08] bg-[linear-gradient(180deg,rgba(244,247,251,0.026),rgba(244,247,251,0.006)),var(--surface)]"}`}>
        <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">Evening shutdown</p>
              <h2 id="evening-shutdown-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                Close the day with one honest note.
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
                Review what moved, what stayed open, and leave a small note for tomorrow. This saves to today&apos;s private Journal entry.
              </p>
            </div>
            <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-medium ${isEvening ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)]"}`}>
              {isEvening ? "Evening emphasis" : "Available later today"}
            </span>
          </div>
        </div>

        <div className="grid min-w-0 gap-0 divide-y divide-[var(--border)] lg:grid-cols-[0.95fr_1.05fr] lg:divide-x lg:divide-y-0">
          <div className="min-w-0 space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Day summary</h3>
              <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
                <SummaryMetric label="Tasks completed today" value={summary.completedTaskCount} />
                <SummaryMetric label="Habits checked in" value={summary.completedHabitCount} />
                <SummaryMetric label="Due-today tasks still open" value={summary.remainingDueTodayTaskCount} />
                <SummaryMetric label="Overdue tasks still open" value={summary.remainingOverdueTaskCount} />
                <SummaryMetric label="Due habits still open" value={summary.remainingDueHabitCount} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">What moved forward?</h3>
              {summary.wins.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {summary.wins.map((item) => (
                    <li key={`${item.type}:${item.id}`} className="min-w-0 rounded-lg bg-[var(--surface-soft)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                      <span className="mr-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{item.type === "task" ? "Task" : "Habit"}</span>
                      <span className="break-words [overflow-wrap:anywhere]">{item.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-black/[0.08] px-3 py-3 text-xs text-[var(--text-muted)]">
                  No completed tasks or habits are logged for today yet.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--text)]">Still open</h3>
                <a href="#daily-execution" className="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">Return to actions</a>
              </div>
              {summary.openItems.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {summary.openItems.map((item) => (
                    <li key={`${item.type}:${item.id}`} className="flex min-w-0 items-start gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2.5">
                      <span className="mt-0.5 shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{item.label}</span>
                      <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-[var(--text-secondary)] [overflow-wrap:anywhere]">{item.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-black/[0.08] px-3 py-3 text-xs text-[var(--text-muted)]">
                  No open items need attention.
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3 py-3 text-xs leading-relaxed text-[var(--text-muted)]">
              Write one sentence and close the day. Empty fields are allowed; save updates only the Evening Shutdown block in today&apos;s Journal entry.
            </div>

            <div className="grid gap-4">
              <ShutdownField id={wentWellId} label="What went well?" value={reflection.wentWell} onChange={(value) => updateReflectionField("wentWell", value)} />
              <ShutdownField id={gotInTheWayId} label="What got in the way?" value={reflection.gotInTheWay} onChange={(value) => updateReflectionField("gotInTheWay", value)} />
              <ShutdownField id={learnedId} label="What did I learn?" value={reflection.learned} onChange={(value) => updateReflectionField("learned", value)} />
              <ShutdownField
                id={tomorrowSeedId}
                label="What is the first useful action for tomorrow?"
                value={reflection.tomorrowSeed}
                onChange={(value) => updateReflectionField("tomorrowSeed", value)}
                maxLength={240}
                note="Saved as a reflection note only. No task or priority is created."
                rows={2}
              />
            </div>

            <div className="mt-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-[10px] leading-relaxed text-[var(--text-muted)]">
                <p>Private manual reflection. No AI summaries or external processing.</p>
                {saved && <p className="mt-1 text-[var(--success)]">Evening Shutdown saved to today&apos;s Journal.</p>}
                {saveError && <p className="mt-1 text-[var(--danger)]" role="alert">{saveError}</p>}
              </div>
              <Button size="sm" onClick={saveShutdown} disabled={saving} className="min-h-11 w-full px-4 text-sm sm:min-h-0 sm:w-auto sm:text-xs">
                {saving ? "Saving..." : "Save shutdown"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3">
      <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</p>
      <p className="mt-1 break-words text-[10px] leading-snug text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function ShutdownField({
  id,
  label,
  value,
  onChange,
  maxLength = 1000,
  note,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  note?: string;
  rows?: number;
}) {
  const noteId = note ? `${id}-note` : undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        rows={rows}
        aria-describedby={noteId}
        className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--text-muted)] shadow-inner shadow-black/10 transition-all focus:border-[var(--accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
      />
      {note && <p id={noteId} className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{note}</p>}
    </div>
  );
}
