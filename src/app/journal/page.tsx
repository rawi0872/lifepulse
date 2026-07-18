"use client";

import { useState, useEffect, useMemo } from "react";
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

type EntryKind = "daily" | "weekly";
type EntryFilter = "all" | EntryKind;

interface ClassifiedJournalEntry extends JournalEntry {
  kind: EntryKind;
  weeklyReviewWeek: string | null;
  nextWeekFocus: string | null;
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
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
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

  const classifiedEntries = useMemo(() => entries.map(classifyJournalEntry), [entries]);
  const weeklyReviewCount = classifiedEntries.filter((entry) => entry.kind === "weekly").length;
  const dailyReflectionCount = classifiedEntries.length - weeklyReviewCount;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredEntries = classifiedEntries.filter((entry) => {
    const moodLabel = entry.mood != null ? MOOD_LABELS[entry.mood - 1] ?? "" : "";
    const typeLabel = entry.kind === "weekly" ? "weekly review saved from weekly review" : "daily reflection written from today";
    const matchesMood = !selectedMood || String(entry.mood ?? "") === selectedMood;
    const matchesEnergy = !selectedEnergy || String(entry.energy ?? "") === selectedEnergy;
    const matchesEntryType = entryFilter === "all" || entry.kind === entryFilter;
    const searchableText = [entry.content, moodLabel, typeLabel, entry.weeklyReviewWeek, entry.nextWeekFocus, entry.entry_date, formatEntryDate(entry.entry_date)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
    return matchesMood && matchesEnergy && matchesEntryType && matchesSearch;
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
            Your private history for daily reflections written from Today and weekly reviews saved from Weekly Review.
          </p>
          <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3.5 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span className="min-w-0 text-pretty">Return here to see what changed over time. No AI summaries or external processing.</span>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/today#evening-reflection" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0">
                Return to Today reflection
              </Link>
              <span className="hidden text-[var(--text-muted)] sm:inline">/</span>
              <Link href="/weekly-review" className="inline-flex min-h-10 items-center rounded-lg px-3 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:px-0">
                Open Weekly Review
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
              <p className="text-[10px] text-[var(--text-muted)]">{dailyReflectionCount} daily reflection{dailyReflectionCount === 1 ? "" : "s"} · {weeklyReviewCount} weekly review{weeklyReviewCount === 1 ? "" : "s"}</p>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState
            eyebrow="Private journal"
            title="Your private history will appear here."
            message="Write from Today, save weekly reviews from Weekly Review, then return here to see what changed over time."
            description="No judgment. Quiet weeks still count. No AI summaries, sharing, or external processing."
            action={(
              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                <Link href="/today#evening-reflection">
                  <Button>Return to Today reflection</Button>
                </Link>
                <Link href="/weekly-review" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0">
                  Open Weekly Review
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
                  <p className="mb-3 text-xs text-[var(--text-muted)]">A few daily reflections or a saved weekly review make this private history easier to return to.</p>
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
                    Return to Today reflection →
                  </Link>
                </div>
              </Card>
            )}

            <Card variant="subtle" className="border-[var(--border)]">
              <div className="p-4">
                <div className="mb-3 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Search your private history</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Find daily reflections and saved weekly reviews from what you logged.</p>
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Journal entry type filters">
                    <EntryFilterButton label="All" count={classifiedEntries.length} active={entryFilter === "all"} onClick={() => setEntryFilter("all")} />
                    <EntryFilterButton label="Daily reflections" count={dailyReflectionCount} active={entryFilter === "daily"} onClick={() => setEntryFilter("daily")} />
                    <EntryFilterButton label="Weekly reviews" count={weeklyReviewCount} active={entryFilter === "weekly"} onClick={() => setEntryFilter("weekly")} />
                  </div>
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
                  <span>Showing {filteredEntries.length} of {entries.length} private entries</span>
                  <span>Private manual history. No AI summaries or external processing. Based only on what you logged.</span>
                </div>
              </div>
            </Card>

            {filteredEntries.length === 0 ? (
              <Card variant="subtle" className="border-[var(--border)]">
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-sm font-medium text-[var(--text)]">No matching private entries found.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Try changing the search, entry type, mood, or energy filters.</p>
                </div>
              </Card>
            ) : filteredEntries.map((entry) => (
              <JournalEntryCard key={entry.id} entry={entry} formattedDate={formatEntryDate(entry.entry_date)} />
            ))}
          </div>
        )}
      </div>
    </DashboardNav>
  );
}

function classifyJournalEntry(entry: JournalEntry): ClassifiedJournalEntry {
  const content = entry.content ?? "";
  const weeklyMatch = content.match(/\*\*Weekly Reflection \(([^)]+)\)\*\*/i);
  const hasWeeklyPrefix = Boolean(weeklyMatch) || content.toLowerCase().includes("weekly reflection (");

  return {
    ...entry,
    kind: hasWeeklyPrefix ? "weekly" : "daily",
    weeklyReviewWeek: weeklyMatch?.[1] ?? null,
    nextWeekFocus: hasWeeklyPrefix ? extractWeeklyReviewSection(content, "Next week focus") : null,
  };
}

function extractWeeklyReviewSection(content: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"));
  const text = match?.[1]?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function EntryFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center rounded-full border px-3 text-[10px] font-medium transition-colors ${
        active
          ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface)]/70 text-[var(--text-muted)] hover:border-[var(--accent)]/25 hover:text-[var(--text-secondary)]"
      }`}
    >
      {label} <span className="ml-1 text-[var(--text-muted)]">{count}</span>
    </button>
  );
}

function JournalEntryCard({ entry, formattedDate }: { entry: ClassifiedJournalEntry; formattedDate: string }) {
  const isWeeklyReview = entry.kind === "weekly";
  const label = isWeeklyReview ? "Weekly review" : "Daily reflection";
  const title = isWeeklyReview ? "Saved weekly review" : "Daily reflection";
  const description = isWeeklyReview
    ? "Saved from Weekly Review"
    : "Written from Today or Journal history";

  return (
    <Card className={`overflow-hidden border-[var(--border-strong)] hover:border-[var(--border-strong)] ${isWeeklyReview ? "bg-[linear-gradient(180deg,rgba(122,162,199,0.055),rgba(244,247,251,0.012)),var(--surface)]" : ""}`}>
      <div className="relative p-4 sm:p-5">
        <div className={`absolute bottom-0 left-0 top-0 w-px ${isWeeklyReview ? "bg-[var(--accent)]/60" : "bg-[var(--accent)]/20"}`} />
        <div className="mb-3 flex min-w-0 flex-col gap-2 pl-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${isWeeklyReview ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)]"}`}>
                {label}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]">
                Private entry
              </span>
            </div>
            <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {formattedDate}{entry.weeklyReviewWeek ? ` · Week of ${entry.weeklyReviewWeek}` : ""}
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">{description}</p>
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

        {entry.nextWeekFocus && (
          <div className="mb-3 ml-3 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Next-week focus</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{entry.nextWeekFocus}</p>
          </div>
        )}

        <div className="pl-3">
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
            {entry.content || <span className="text-[var(--text-muted)]">No content recorded.</span>}
          </p>
        </div>
      </div>
    </Card>
  );
}
