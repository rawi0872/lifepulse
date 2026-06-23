"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { PulseCard } from "@/components/ui/pulse-card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { MindPulseHeader } from "@/components/mind/MindPulseHeader";
import { MoodEnergyCard } from "@/components/mind/MoodEnergyCard";
import { ReflectionCard } from "@/components/mind/ReflectionCard";
import { MindMetricsForm } from "@/components/mind/MindMetricsForm";
import { MindMetricsSummary } from "@/components/mind/MindMetricsSummary";
import type { MindMetrics, MindMetricsFormData } from "@/lib/mindMetrics";
import { getTodayDate } from "@/lib/mindMetrics";

const MIND_REALM = "Mind";

interface RawJournal {
  id: string;
  mood: number | null;
  energy: number | null;
  content: string | null;
  reflection_prompt: string | null;
  created_at: string;
}

interface RawHabit {
  id: string;
  title: string;
  realms: { name: string }[] | null;
}

interface RawTask {
  id: string;
  title: string;
  status: string;
  realms: { name: string }[] | null;
}

interface RawXpEvent {
  id: string;
  amount: number;
  realm: string | null;
}

function MindContent() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [journalEntries, setJournalEntries] = useState<RawJournal[]>([]);
  const [mindHabits, setMindHabits] = useState<RawHabit[]>([]);
  const [mindTaskCount, setMindTaskCount] = useState(0);
  const [journalStreak, setJournalStreak] = useState(0);
  const [avgMood, setAvgMood] = useState<number | null>(null);
  const [mindXp, setMindXp] = useState(0);
  const [mindMetrics, setMindMetrics] = useState<MindMetrics[]>([]);
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: journals }, { data: habits }, { data: tasks }, { data: xpEvents }, { data: metrics }] = await Promise.all([
        supabase.from("journal_entries").select("id, mood, energy, content, reflection_prompt, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("habits").select("id, title, realms!inner(name)").eq("user_id", user.id).eq("realms.name", MIND_REALM),
        supabase.from("tasks").select("id, title, status, realms!inner(name)").eq("user_id", user.id).neq("status", "done").eq("realms.name", MIND_REALM),
        supabase.from("xp_events").select("id, amount, realm").eq("user_id", user.id).eq("realm", MIND_REALM),
        supabase.from("mind_metrics").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(14),
      ]);

      if (cancelled) return;

      const journalsList = (journals as RawJournal[]) || [];
      const habitsList = (habits as RawHabit[]) || [];
      const tasksList = (tasks as RawTask[]) || [];
      const xpList = (xpEvents as RawXpEvent[]) || [];

      const mindXpVal = xpList.reduce((sum, e) => sum + e.amount, 0);
      const moodValues = journalsList.map((j) => j.mood).filter((m): m is number => m !== null);
      const avgMoodVal = moodValues.length > 0
        ? moodValues.reduce((s, m) => s + m, 0) / moodValues.length
        : null;

      let streak = 0;
      const today = new Date();
      for (let d = 0; d < 365; d++) {
        const dateStr = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
        const hasEntry = journalsList.some((e) => e.created_at.slice(0, 10) === dateStr);
        if (hasEntry) streak++;
        else if (d > 0) break;
      }

      setJournalEntries(journalsList);
      setMindHabits(habitsList);
      setMindTaskCount(tasksList.length);
      setJournalStreak(streak);
      setAvgMood(avgMoodVal);
      setMindXp(mindXpVal);
      setMindMetrics((metrics as MindMetrics[]) || []);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [router, supabase]);

  async function onSaveMind(data: MindMetricsFormData) {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = getTodayDate();
    const existing = mindMetrics.find((m) => m.entry_date === today);
    if (existing) {
      const { data: updated } = await supabase.from("mind_metrics").update(data).eq("id", existing.id).select().single();
      if (updated) setMindMetrics((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } else {
      const { data: created } = await supabase.from("mind_metrics").insert({ ...data, user_id: user.id, entry_date: today }).select().single();
      if (created) setMindMetrics((prev) => [created, ...prev]);
    }
    setSaving(false);
  }

  const todayMetrics = mindMetrics.find((m) => m.entry_date === getTodayDate()) ?? null;

  if (loading) return null;

  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <MindPulseHeader journalCount={journalEntries.length} journalStreak={journalStreak} avgMood={avgMood} />

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <MetricCard label="Journal Streak" value={journalStreak} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
          } trend={journalStreak > 0 ? "up" : "neutral"} active={journalStreak > 0} />
          <MetricCard label="Mind Habits" value={mindHabits.length} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          } trend={mindHabits.length > 0 ? "up" : "neutral"} active={mindHabits.length > 0} />
          <MetricCard label="Open Tasks" value={mindTaskCount} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          } trend={mindTaskCount > 0 ? "neutral" : "down"} active={mindTaskCount === 0} />
          <MetricCard label="Mind XP" value={mindXp} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          } trend={mindXp > 0 ? "up" : "neutral"} active={mindXp > 0} />
        </div>

        <div className="mb-6">
          <MindMetricsForm
            initial={{
              mood: todayMetrics?.mood ?? null,
              stress: todayMetrics?.stress ?? null,
              focus: todayMetrics?.focus ?? null,
              clarity: todayMetrics?.clarity ?? null,
              motivation: todayMetrics?.motivation ?? null,
              reflection: todayMetrics?.reflection ?? null,
              tags: todayMetrics?.tags ?? [],
            }}
            saving={saving}
            onSave={onSaveMind}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <MoodEnergyCard entries={journalEntries} />
            <ReflectionCard entries={journalEntries} />
          </div>

          <div className="space-y-6">
            <PulseCard title="Focus Habits" accent="accent" description="Meditation, focus, reading, learning" action={
              <Link href="/habits" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Manage
              </Link>
            }>
              {mindHabits.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    message="No mind-related habits yet."
                    action={
                      <Link href="/habits" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                        Create focus habit &rarr;
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {mindHabits.map((h) => (
                    <div key={h.id} className="px-4 py-3">
                      <p className="text-sm text-[var(--text)]">{h.title}</p>
                      {/focus|meditat|mindful|read|learn|study/i.test(h.title) && (
                        <span className="mt-0.5 inline-block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-medium text-[var(--accent)]">
                          Focus
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PulseCard>

            <PulseCard title="Open Tasks" accent="accent" description="Mind-related tasks" action={
              <Link href="/tasks" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Manage
              </Link>
            }>
              {mindTaskCount === 0 ? (
                <div className="p-4">
                  <EmptyState
                    message="No open mind-related tasks."
                    action={
                      <Link href="/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                        Add clarity task &rarr;
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--text)]">{mindTaskCount}</p>
                  <p className="text-xs text-[var(--text-muted)]">open task{mindTaskCount !== 1 ? "s" : ""}</p>
                </div>
              )}
            </PulseCard>

            <MindMetricsSummary recent={mindMetrics} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MindPage() {
  return (
    <DashboardNav>
      <MindContent />
    </DashboardNav>
  );
}
