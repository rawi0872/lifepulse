"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { useToast } from "@/hooks/use-toast";
import { BodyPulseHeader } from "@/components/body/BodyPulseHeader";
import { BodySignalCards } from "@/components/body/BodySignalCards";
import { BodyProOverview } from "@/components/body/BodyProOverview";
import { WorkoutSection } from "@/components/body/WorkoutSection";
import { NutritionSection } from "@/components/body/NutritionSection";
import { MeasurementSection } from "@/components/body/MeasurementSection";
import { HealthNoteSection } from "@/components/body/HealthNoteSection";
import type { BodyMetrics, BodyMetricsFormData } from "@/lib/bodyMetrics";
import { getTodayDate } from "@/lib/bodyMetrics";
import type { Workout, NutritionLog, BodyMeasurement, HealthNote } from "@/lib/bodyPro";

const BODY_REALM = "Body";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "workouts", label: "Workouts" },
  { id: "nutrition", label: "Nutrition" },
  { id: "measurements", label: "Measurements" },
  { id: "health", label: "Health Notes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface RawHabit { id: string; title: string; realms: { name: string }[] | null; }
interface RawTask { id: string; title: string; status: string; priority: string; realms: { name: string }[] | null; }
interface RawJournal { id: string; energy: number | null; created_at: string; }
interface RawXpEvent { id: string; amount: number; realm: string | null; }
interface RawLog { id: string; habit_id: string; logged_date: string; }
interface HabitInfo { id: string; title: string; streak: number; completionRate: number; }

function BodyContent() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core body metrics
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics[]>([]);
  const [bodyHabits, setBodyHabits] = useState<HabitInfo[]>([]);
  const [bodyTaskCount, setBodyTaskCount] = useState(0);
  const [journalCount, setJournalCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [totalXp, setTotalXp] = useState(0);

  // Body Pro overview data
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);
  const [workoutMinutesThisWeek, setWorkoutMinutesThisWeek] = useState(0);
  const [nutritionToday, setNutritionToday] = useState<NutritionLog[]>([]);
  const [waterToday, setWaterToday] = useState(0);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [latestHealthNote, setLatestHealthNote] = useState<HealthNote | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const today = getTodayDate();
      const weekStart = new Date();
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const [
        { data: habits },
        { data: tasks },
        { data: journals },
        { data: xpEvents },
        { data: logs },
        { data: metrics },
        { data: workouts },
        { data: nutrition },
        { data: measurements },
        { data: healthNotes },
      ] = await Promise.all([
        supabase.from("habits").select("id, title, realms!inner(name)").eq("user_id", user.id).eq("realms.name", BODY_REALM),
        supabase.from("tasks").select("id, title, status, priority, realms!inner(name)").eq("user_id", user.id).neq("status", "done").eq("realms.name", BODY_REALM),
        supabase.from("journal_entries").select("id, energy, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("xp_events").select("id, amount, realm").eq("user_id", user.id).eq("realm", BODY_REALM),
        supabase.from("habit_logs").select("id, habit_id, logged_date").eq("user_id", user.id).gte("logged_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from("body_metrics").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(14),
        supabase.from("workouts").select("id, workout_date, duration_minutes").eq("user_id", user.id).gte("workout_date", weekStartStr),
        supabase.from("nutrition_logs").select("*").eq("user_id", user.id).eq("log_date", today),
        supabase.from("body_measurements").select("weight_kg").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(1),
        supabase.from("health_notes").select("*").eq("user_id", user.id).order("note_date", { ascending: false }).order("created_at", { ascending: false }).limit(1),
      ]);

      if (cancelled) return;

      const habitsList = (habits as RawHabit[]) || [];
      const tasksList = (tasks as RawTask[]) || [];
      const journalsList = (journals as RawJournal[]) || [];
      const xpList = (xpEvents as RawXpEvent[]) || [];
      const logsList = (logs as RawLog[]) || [];
      const workoutsList = (workouts as Workout[]) || [];
      const nutritionList = (nutrition as NutritionLog[]) || [];
      const measurementsList = (measurements as BodyMeasurement[]) || [];
      const healthNotesList = (healthNotes as HealthNote[]) || [];

      const totalXpVal = xpList.reduce((sum, e) => sum + e.amount, 0);
      const habitInfos: HabitInfo[] = habitsList.map((h) => {
        const habitLogs = logsList.filter((l) => l.habit_id === h.id);
        const loggedDates = new Set(habitLogs.map((l) => l.logged_date));
        const totalDays = 30;
        const loggedDays = loggedDates.size;
        const rate = totalDays > 0 ? Math.round((loggedDays / totalDays) * 100) : 0;
        let streak = 0;
        const today_ = new Date();
        for (let d = 0; d < totalDays; d++) {
          const dateStr = new Date(today_.getTime() - d * 86400000).toISOString().slice(0, 10);
          if (loggedDates.has(dateStr)) streak++;
          else if (d > 0) break;
        }
        return { id: h.id, title: h.title, streak, completionRate: rate };
      });

      setBodyHabits(habitInfos);
      setBodyTaskCount(tasksList.length);
      setJournalCount(journalsList.length);
      setBestStreak(Math.max(...habitInfos.map((h) => h.streak), 0));
      setCompletionRate(habitInfos.length > 0 ? Math.round(habitInfos.reduce((s, h) => s + h.completionRate, 0) / habitInfos.length) : 0);
      setTotalXp(totalXpVal);
      setBodyMetrics((metrics as BodyMetrics[]) || []);

      const wMinutes = workoutsList.reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
      setWorkoutsThisWeek(workoutsList.length);
      setWorkoutMinutesThisWeek(wMinutes);
      setNutritionToday(nutritionList);
      setWaterToday(nutritionList.reduce((s, n) => s + (n.water_ml ?? 0), 0));
      setLatestWeight(measurementsList.length > 0 ? measurementsList[0].weight_kg : null);
      setLatestHealthNote(healthNotesList.length > 0 ? healthNotesList[0] : null);
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

  if (loading) return null;

  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <BodyPulseHeader habitCount={bodyHabits.length} taskCount={bodyTaskCount} journalCount={journalCount} />

        <div className="mb-6">
          <BodySignalCards habitStreak={bestStreak} completionRate={completionRate} totalXp={totalXp} />
        </div>

        {/* Tab Bar */}
        <div className="mb-6 flex gap-1 rounded-xl bg-[var(--surface-soft)] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <BodyProOverview
            bodyMetrics={bodyMetrics}
            onSaveBody={onSaveBody}
            saving={saving}
            workoutsThisWeek={workoutsThisWeek}
            workoutMinutesThisWeek={workoutMinutesThisWeek}
            nutritionToday={nutritionToday}
            waterToday={waterToday}
            latestWeight={latestWeight}
            latestHealthNote={latestHealthNote}
            bodyHabits={bodyHabits}
            bodyTaskCount={bodyTaskCount}
          />
        )}

        {activeTab === "workouts" && <WorkoutSection />}
        {activeTab === "nutrition" && <NutritionSection />}
        {activeTab === "measurements" && <MeasurementSection />}
        {activeTab === "health" && <HealthNoteSection />}
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
