"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        <div className="mb-8 min-w-0">
          <h1 className="text-2xl font-bold text-[var(--text)]">Journal</h1>
          <p className="text-pretty text-sm text-[var(--text-muted)]">Your private space to reflect and notice patterns.</p>
        </div>

        {entries.length > 0 && (
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"}
          </p>
        )}

        {entries.length === 0 ? (
          <Card variant="subtle" className="border-[var(--border)]">
            <div className="px-5 py-12 text-center sm:px-6 sm:py-16">
              <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-soft)] ring-1 ring-[var(--border)]">
                <svg className="h-7 w-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[var(--text)]">Your writing room</h2>
              <p className="mx-auto mt-1.5 max-w-xs text-pretty text-sm leading-relaxed text-[var(--text-muted)]">
                A quiet place to review your reflections. Writing currently lives inside Today so your entry stays connected to the day.
              </p>

              <Link href="/today#evening-reflection">
                <Button className="mt-8">
                  Open Today&apos;s reflection
                </Button>
              </Link>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
                You&apos;ll write in the same daily reflection form used from Today.
              </p>

              <div className="mx-auto mt-12 max-w-sm">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Need a starting point in Today?</p>
                <div className="flex flex-col gap-2">
                  {REFLECTION_PROMPTS.map((prompt) => (
                    <Link
                      key={prompt}
                      href="/today#evening-reflection"
                      className="group flex min-w-0 items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-left text-xs leading-relaxed text-[var(--text-muted)] transition-all duration-150 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:items-center"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-muted)] transition-colors">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1 text-pretty">{prompt}</span>
                      <svg className="h-3 w-3 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3.5 sm:gap-3">
            {entries.length < 3 && (
              <Card variant="subtle" className="border-[var(--border)]">
                <div className="p-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Writing prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {REFLECTION_PROMPTS.slice(0, 3).map((prompt) => (
                      <Link
                        key={prompt}
                        href="/today#evening-reflection"
                        className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] hover:ring-1 hover:ring-[var(--accent)]/20 sm:px-2.5 sm:py-1"
                      >
                        {prompt}
                      </Link>
                    ))}
                  </div>
                  <Link href="/today#evening-reflection" className="mt-2 inline-block rounded-md py-1.5 text-[10px] text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:py-0">
                    Open Today&apos;s reflection →
                  </Link>
                </div>
              </Card>
            )}

            <Card variant="subtle" className="border-[var(--border)]">
              <div className="p-4">
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
                  <span>Private manual reflection library. No AI summaries or external processing.</span>
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
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {formatEntryDate(entry.entry_date)}
                    </span>
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
                    <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
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
