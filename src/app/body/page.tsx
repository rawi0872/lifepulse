"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { useToast } from "@/hooks/use-toast";
import { PulseCard } from "@/components/ui/pulse-card";
import { EmptyState } from "@/components/ui/empty-state";
import { BodyPulseHeader } from "@/components/body/BodyPulseHeader";
import { BodySignalCards } from "@/components/body/BodySignalCards";
import { BodyHabitsCard } from "@/components/body/BodyHabitsCard";
import { BodyMetricsForm } from "@/components/body/BodyMetricsForm";
import { BodyMetricsSummary } from "@/components/body/BodyMetricsSummary";
import type { BodyMetrics, BodyMetricsFormData } from "@/lib/bodyMetrics";
import { getTodayDate } from "@/lib/bodyMetrics";

const BODY_REALM = "Body";

interface RawHabit {
  id: string;
  title: string;
  realms: { name: string }[] | null;
}

interface RawTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  realms: { name: string }[] | null;
}

interface RawJournal {
  id: string;
  energy: number | null;
  created_at: string;
}

interface RawXpEvent {
  id: string;
  amount: number;
  realm: string | null;
}

interface RawLog {
  id: string;
  habit_id: string;
  logged_date: string;
}

interface HabitInfo {
  id: string;
  title: string;
  streak: number;
  completionRate: number;
}

function BodyContent() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bodyHabits, setBodyHabits] = useState<HabitInfo[]>([]);
  const [bodyTaskCount, setBodyTaskCount] = useState(0);
  const [journalCount, setJournalCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: habits }, { data: tasks }, { data: journals }, { data: xpEvents }, { data: logs }, { data: metrics }] = await Promise.all([
        supabase.from("habits").select("id, title, realms!inner(name)").eq("user_id", user.id).eq("realms.name", BODY_REALM),
        supabase.from("tasks").select("id, title, status, priority, realms!inner(name)").eq("user_id", user.id).neq("status", "done").eq("realms.name", BODY_REALM),
        supabase.from("journal_entries").select("id, energy, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("xp_events").select("id, amount, realm").eq("user_id", user.id).eq("realm", BODY_REALM),
        supabase.from("habit_logs").select("id, habit_id, logged_date").eq("user_id", user.id).gte("logged_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from("body_metrics").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(14),
      ]);

      if (cancelled) return;

      const habitsList = (habits as RawHabit[]) || [];
      const tasksList = (tasks as RawTask[]) || [];
      const journalsList = (journals as RawJournal[]) || [];
      const xpList = (xpEvents as RawXpEvent[]) || [];
      const logsList = (logs as RawLog[]) || [];

      const totalXpVal = xpList.reduce((sum, e) => sum + e.amount, 0);
      const journalCountVal = journalsList.length;
      const bodyTaskCountVal = tasksList.length;

      const habitInfos: HabitInfo[] = habitsList.map((h) => {
        const habitLogs = logsList.filter((l) => l.habit_id === h.id);
        const loggedDates = new Set(habitLogs.map((l) => l.logged_date));
        const totalDays = 30;
        const loggedDays = loggedDates.size;
        const rate = totalDays > 0 ? Math.round((loggedDays / totalDays) * 100) : 0;
        let streak = 0;
        const today = new Date();
        for (let d = 0; d < totalDays; d++) {
          const dateStr = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
          if (loggedDates.has(dateStr)) streak++;
          else if (d > 0) break;
        }
        return { id: h.id, title: h.title, streak, completionRate: rate };
      });

      const bestStreakVal = Math.max(...habitInfos.map((h) => h.streak), 0);
      const overallRate = habitInfos.length > 0
        ? Math.round(habitInfos.reduce((s, h) => s + h.completionRate, 0) / habitInfos.length)
        : 0;

      setBodyHabits(habitInfos);
      setBodyTaskCount(bodyTaskCountVal);
      setJournalCount(journalCountVal);
      setBestStreak(bestStreakVal);
      setCompletionRate(overallRate);
      setTotalXp(totalXpVal);
      setBodyMetrics((metrics as BodyMetrics[]) || []);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [router, supabase]);

  async function onSaveBody(data: BodyMetricsFormData) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const today = getTodayDate();
      const existing = bodyMetrics.find((m) => m.entry_date === today);
      if (existing) {
        const { data: updated, error } = await supabase.from("body_metrics").update(data).eq("id", existing.id).select().single();
        if (error) { toast({ type: "error", title: "Failed to update body data." }); setSaving(false); return; }
        if (updated) setBodyMetrics((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        toast({ type: "success", title: "Body data updated!" });
      } else {
        const { data: created, error } = await supabase.from("body_metrics").insert({ ...data, user_id: user.id, entry_date: today }).select().single();
        if (error) { toast({ type: "error", title: "Failed to save body data." }); setSaving(false); return; }
        if (created) setBodyMetrics((prev) => [created, ...prev]);
        toast({ type: "success", title: "Body data saved!" });
      }
    } catch {
      toast({ type: "error", title: "Failed to save body data. Try again." });
    }
    setSaving(false);
  }

  const todayMetrics = bodyMetrics.find((m) => m.entry_date === getTodayDate()) ?? null;

  if (loading) return null;

  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <BodyPulseHeader habitCount={bodyHabits.length} taskCount={bodyTaskCount} journalCount={journalCount} />

        <div className="mb-6">
          <BodySignalCards habitStreak={bestStreak} completionRate={completionRate} totalXp={totalXp} />
        </div>

        <div className="mb-6">
          <BodyMetricsForm
            initial={{
              sleep_hours: todayMetrics?.sleep_hours ?? null,
              sleep_quality: todayMetrics?.sleep_quality ?? null,
              energy: todayMetrics?.energy ?? null,
              steps: todayMetrics?.steps ?? null,
              workout_minutes: todayMetrics?.workout_minutes ?? null,
              weight_kg: todayMetrics?.weight_kg ?? null,
              resting_heart_rate: todayMetrics?.resting_heart_rate ?? null,
              recovery_score: todayMetrics?.recovery_score ?? null,
              notes: todayMetrics?.notes ?? null,
            }}
            saving={saving}
            onSave={onSaveBody}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <BodyHabitsCard habits={bodyHabits} />
            <PulseCard title="Body Tasks" accent="success" description="Open health-related tasks" action={
              <Link href="/tasks" className="text-[10px] font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                Manage
              </Link>
            }>
              {bodyTaskCount === 0 ? (
                <div className="p-4">
                  <EmptyState
                    message="No open body-related tasks."
                    action={
                      <Link href="/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                        Add a task &rarr;
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--text)]">{bodyTaskCount}</p>
                  <p className="text-xs text-[var(--text-muted)]">open task{bodyTaskCount !== 1 ? "s" : ""}</p>
                </div>
              )}
            </PulseCard>
          </div>

          <div className="space-y-6">
            <PulseCard title="Energy Trend" accent="warning" description="From journal entries">
              {journalCount === 0 ? (
                <div className="p-4">
                  <EmptyState
                    message="No journal energy data yet."
                    action={
                      <Link href="/journal" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                        Reflect in journal &rarr;
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-[10px] text-[var(--text-muted)] mb-2">
                    Energy data available from {journalCount} recent journal entries.
                  </p>
                  <Link
                    href="/journal"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
                  >
                    View journal &rarr;
                  </Link>
                </div>
              )}
            </PulseCard>

            <BodyMetricsSummary recent={bodyMetrics} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BodyPage() {
  return (
    <DashboardNav>
      <BodyContent />
    </DashboardNav>
  );
}
