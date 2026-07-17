"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { DailyLoopConnector } from "@/components/DailyLoopConnector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface JournalEntry {
  id: string;
  entry_date: string;
  content: string;
  mood: number | null;
  energy: number | null;
  created_at: string;
}

const MOOD_LABELS = ["Awful", "Bad", "Okay", "Good", "Great"];
const MOOD_EMOJIS = ["😖", "😟", "😐", "😊", "🔥"];

const REFLECTION_PROMPTS = [
  "What went well today?",
  "What drained my energy?",
  "What is one thing to improve tomorrow?",
  "What did I learn today?",
  "What am I grateful for?",
];

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [selectedEnergy, setSelectedEnergy] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false });

      if (cancelled) return;
      if (data) setEntries(data as JournalEntry[]);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatEntryDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(d);
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    const moodLabel = entry.mood != null ? MOOD_LABELS[entry.mood - 1] ?? "" : "";
    const matchesMood = !selectedMood || String(entry.mood ?? "") === selectedMood;
    const matchesEnergy = !selectedEnergy || String(entry.energy ?? "") === selectedEnergy;
    const searchableText = [entry.content, moodLabel, entry.entry_date, formatEntryDate(entry.entry_date)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
    return matchesMood && matchesEnergy && matchesSearch;
  });

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3 h-28 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-6 min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
            Private history
          </p>
          <h1 className="text-2xl font-bold text-[var(--text)]">Journal</h1>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-[var(--text-muted)]">
            Your private space to reflect and notice patterns. Review what you wrote, notice what keeps coming back, and give Weekly Review more context.
          </p>
          <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3.5 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span className="min-w-0 text-pretty">Daily reflection starts from Today. Journal keeps the private record of what changed.</span>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/today#evening-reflection" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0">
                Open Today&apos;s reflection
              </Link>
              <span className="hidden text-[var(--text-muted)] sm:inline">/</span>
              <Link href="/weekly-review" className="inline-flex min-h-10 items-center rounded-lg px-3 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:px-0">
                Review the week
              </Link>
            </div>
          </div>
        </div>

        <DailyLoopConnector
          activeStep="reflect"
          note="Journal is the private history of what changed. Reflection starts from Today, then Weekly Review gets clearer as entries collect."
        />

        {entries.length > 0 && (
          <div className="mb-4 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text)]">
                {entries.length} private entr{entries.length === 1 ? "y" : "ies"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">Search what you logged, then bring the useful patterns into your weekly picture.</p>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState
            eyebrow="Private journal"
            title="Your private history starts with one reflection."
            message="No entries yet is not a failure. Write tonight from Today, then Journal becomes the place to review what happened, what mattered, and what changed."
            description="Reflections help Weekly Review become clearer as a few days of history accumulate. No AI summaries, no sharing, no judgment."
            action={(
              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                <Link href="/today#evening-reflection">
                  <Button>Open Today&apos;s reflection</Button>
                </Link>
                <Link href="/weekly-review" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
                  View Weekly Review
                </Link>
              </div>
            )}
            examples={(
              <div className="mx-auto max-w-sm">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Starting prompts</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REFLECTION_PROMPTS.slice(0, 4).map((prompt) => (
                    <Link
                      key={prompt}
                      href="/today#evening-reflection"
                      className="inline-flex min-h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 text-left text-xs leading-relaxed text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/25 hover:text-[var(--text-secondary)]"
                    >
                      {prompt}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          />
        ) : (
          <div className="flex flex-col gap-3.5 sm:gap-3">
            {entries.length < 3 && (
              <Card variant="subtle" className="border-[var(--border)]">
                <div className="p-4">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Build the record</p>
                  <p className="mb-3 text-xs text-[var(--text-muted)]">A few honest notes are enough to make the week easier to review.</p>
                  <div className="flex flex-wrap gap-2">
                    {REFLECTION_PROMPTS.slice(0, 3).map((prompt) => (
                      <Link
                        key={prompt}
                        href="/today#evening-reflection"
                        className="inline-flex min-h-10 items-center rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] hover:ring-1 hover:ring-[var(--accent)]/20 sm:min-h-0 sm:px-2.5 sm:py-1"
                      >
                        {prompt}
                      </Link>
                    ))}
                  </div>
                  <Link href="/today#evening-reflection" className="mt-2 inline-flex min-h-10 items-center rounded-md py-1.5 text-[10px] text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:py-0">
                    Open Today&apos;s reflection →
                  </Link>
                </div>
              </Card>
            )}

            <Card variant="subtle" className="border-[var(--border)]">
              <div className="p-4">
                <div className="mb-3 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Search your private history</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Find patterns, decisions, and repeated themes from what you logged.</p>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    type="search"
                    placeholder="Search reflections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] sm:py-2"
                  />
                  <select
                    value={selectedMood}
                    onChange={(e) => setSelectedMood(e.target.value)}
                    className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] sm:py-2"
                  >
                    <option value="">All moods</option>
                    {MOOD_LABELS.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}
                  </select>
                  <select
                    value={selectedEnergy}
                    onChange={(e) => setSelectedEnergy(e.target.value)}
                    className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] sm:py-2"
                  >
                    <option value="">All energy levels</option>
                    {[1, 2, 3, 4, 5].map((level) => <option key={level} value={String(level)}>{level}/5</option>)}
                  </select>
                </div>
                <div className="mt-3 flex min-w-0 flex-col gap-1 text-pretty text-[10px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                  <span>Showing {filteredEntries.length} of {entries.length} reflections</span>
                  <span>Private manual reflection library. No AI summaries or external processing. Based only on what you logged.</span>
                </div>
              </div>
            </Card>

            {filteredEntries.length === 0 ? (
              <Card variant="subtle" className="border-[var(--border)]">
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-sm font-medium text-[var(--text)]">No matching reflections found.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Try changing the search or filters.</p>
                </div>
              </Card>
            ) : filteredEntries.map((entry) => (
              <Card key={entry.id} className="overflow-hidden border-[var(--border-strong)] hover:border-[var(--border-strong)]">
                <div className="relative p-4 sm:p-5">
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--accent)]/20" />
                  <div className="mb-3 flex min-w-0 flex-col gap-2 pl-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Private entry</p>
                      <p className="text-sm font-semibold text-[var(--text)]">{formatEntryDate(entry.entry_date)}</p>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {entry.mood != null && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-secondary)] sm:py-0.5">
                          <span>{MOOD_EMOJIS[entry.mood - 1]}</span>
                          <span>{MOOD_LABELS[entry.mood - 1]}</span>
                        </span>
                      )}
                      {entry.energy != null && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-secondary)] sm:py-0.5">
                          <span>⚡</span>
                          <span>{entry.energy}/5</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pl-3">
                    <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                      {entry.content || <span className="text-[var(--text-muted)]">No content recorded.</span>}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardNav>
  );
}
