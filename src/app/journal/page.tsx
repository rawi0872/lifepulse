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
      <div className="mx-auto max-w-2xl px-5 py-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text)]">Journal</h1>
          <p className="text-sm text-[var(--text-muted)]">Your private space to reflect and notice patterns.</p>
        </div>

        {entries.length > 0 && (
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"}
          </p>
        )}

        {entries.length === 0 ? (
          <Card variant="subtle" className="border-[var(--border)]">
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-soft)] ring-1 ring-[var(--border)]">
                <svg className="h-7 w-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[var(--text)]">Your writing room</h2>
              <p className="mt-1.5 text-sm text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                A quiet place to hold your thoughts. Reflections, wins, and lessons — one day at a time.
              </p>

              <Link href="/today">
                <Button className="mt-8">
                  Write today&apos;s entry
                </Button>
              </Link>

              <div className="mx-auto mt-12 max-w-sm">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Need a starting point?</p>
                <div className="flex flex-col gap-2">
                  {REFLECTION_PROMPTS.map((prompt) => (
                    <Link
                      key={prompt}
                      href="/today"
                      className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-left text-xs text-[var(--text-muted)] leading-relaxed transition-all duration-150 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)]"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-muted)] transition-colors">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </span>
                      <span className="flex-1">{prompt}</span>
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
          <div className="flex flex-col gap-3">
            {entries.length < 3 && (
              <Card variant="subtle" className="border-[var(--border)]">
                <div className="p-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Writing prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {REFLECTION_PROMPTS.slice(0, 3).map((prompt) => (
                      <Link
                        key={prompt}
                        href="/today"
                        className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] hover:ring-1 hover:ring-[var(--accent)]/20 transition-all duration-150"
                      >
                        {prompt}
                      </Link>
                    ))}
                  </div>
                  <Link href="/today" className="mt-2 inline-block text-[10px] text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                    More prompts →
                  </Link>
                </div>
              </Card>
            )}

            {entries.map((entry) => (
              <Card key={entry.id} className="border-[var(--border-strong)] overflow-hidden hover:border-[var(--border-strong)]">
                <div className="relative p-5">
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--accent)]/20" />
                  <div className="mb-3 flex items-center justify-between pl-3">
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {formatEntryDate(entry.entry_date)}
                    </span>
                    <div className="flex items-center gap-2">
                      {entry.mood != null && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                          <span>{MOOD_EMOJIS[entry.mood - 1]}</span>
                          <span>{MOOD_LABELS[entry.mood - 1]}</span>
                        </span>
                      )}
                      {entry.energy != null && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                          <span>⚡</span>
                          <span>{entry.energy}/5</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pl-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
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
