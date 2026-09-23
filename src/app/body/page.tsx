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
import {
  formatBodyMetricValue,
  getBodyMetricTrend,
  getBodyGoalProgress,
  type BodyMetricKey,
  type BodyGoalKind,
} from "@lifepulse/domain";

const SYNCED_METRICS: Array<{ key: BodyMetricKey; label: string }> = [
  { key: "steps", label: "Steps" },
  { key: "sleepDuration", label: "Sleep" },
  { key: "restingHeartRate", label: "Resting heart rate" },
  { key: "weight", label: "Weight" },
  { key: "exerciseMinutes", label: "Exercise" },
];

const BODY_GOAL_KINDS: Array<{ value: BodyGoalKind; label: string }> = [
  { value: "general_fitness", label: "General fitness" },
  { value: "steps_average", label: "Daily steps" },
  { value: "weight_target", label: "Weight target" },
  { value: "sleep_duration", label: "Sleep duration" },
];

const BODY_REALM = "Body";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "synced", label: "Synced" },
  { id: "workouts", label: "Workouts" },
  { id: "nutrition", label: "Food & water" },
  { id: "measurements", label: "Weight & measurements" },
  { id: "health", label: "Health Notes" },
] as const;

interface SyncedRecord { metric: string; value: number; recorded_at: string; source: string | null; }
interface BodyGoalRow {
  id: string;
  title: string;
  status: string | null;
  goal_type: string | null;
  target_metric: string | null;
  target_value: number | null;
  target_unit: string | null;
  target_date: string | null;
}

type TabId = (typeof TABS)[number]["id"];

interface RawHabit { id: string; title: string; realms: { name: string }[] | null; }
interface RawTask { id: string; title: string; status: string; priority: string; realms: { name: string }[] | null; }
interface RawJournal { id: string; energy: number | null; created_at: string; }
interface RawXpEvent { id: string; amount: number; realm: string | null; }
interface RawLog { id: string; habit_id: string; logged_date: string; }
interface HabitInfo { id: string; title: string; streak: number; completionRate: number; }

function SyncedBodySection({
  records,
  allowedMetrics,
  nextronMetrics,
  providers,
  goals,
  period,
  onPeriodChange,
  goalTitle,
  goalKind,
  goalTarget,
  goalError,
  goalSaving,
  canCreateGoal,
  onGoalTitleChange,
  onGoalKindChange,
  onGoalTargetChange,
  onCreateGoal,
  onDeleteGoal,
}: {
  records: SyncedRecord[];
  allowedMetrics: string[];
  nextronMetrics: string[];
  providers: string[];
  goals: BodyGoalRow[];
  period: 7 | 30;
  onPeriodChange: (period: 7 | 30) => void;
  goalTitle: string;
  goalKind: BodyGoalKind;
  goalTarget: string;
  goalError: string | null;
  goalSaving: boolean;
  canCreateGoal: boolean;
  onGoalTitleChange: (value: string) => void;
  onGoalKindChange: (value: BodyGoalKind) => void;
  onGoalTargetChange: (value: string) => void;
  onCreateGoal: () => void;
  onDeleteGoal: (id: string) => void;
}) {
  const latestByMetric = new Map<string, SyncedRecord>();
  for (const record of records) {
    const current = latestByMetric.get(record.metric);
    if (!current || record.recorded_at > current.recorded_at) latestByMetric.set(record.metric, record);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">Synced data</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
          {providers.length > 0
            ? `Synced from ${providers.join(", ")} through the Life Pulse mobile app.`
            : "No device sync yet. Connect health sync in the mobile app to see device data here."}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          The web never reads your devices directly. Storage and NEXTRON permissions below are managed on mobile and shown here read-only.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Trends</h3>
          <div className="flex gap-1.5">
            {([7, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onPeriodChange(days)}
                aria-pressed={period === days}
                className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-0 ${
                  period === days
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                    : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          {SYNCED_METRICS.map(({ key, label }) => {
            const history = records
              .filter((r) => r.metric === key)
              .map((r) => ({ date: r.recorded_at.slice(0, 10), value: Number(r.value) }));
            const trend = getBodyMetricTrend(history, key, period);
            const latest = latestByMetric.get(key);
            return (
              <div key={key} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
                <p className="mt-1 break-words text-lg font-bold text-[var(--text)]">
                  {latest ? formatBodyMetricValue(key, Number(latest.value)) : "No data yet"}
                </p>
                <p className="mt-1 break-words text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {trend.direction === "insufficient"
                    ? "Not enough synced points for a trend."
                    : `${trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} ${trend.currentAvg ?? "—"} avg × ${trend.dataPoints} pts${trend.changePct != null ? ` (${Math.round(trend.changePct * 100)}% vs previous)` : ""}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Storage consent</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          Metrics Life Pulse may store from device sync. Change these in the mobile app under Health Connections.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allowedMetrics.length === 0 && (
            <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">Nothing allowed — sync stores nothing</span>
          )}
          {allowedMetrics.map((metric) => (
            <span key={metric} className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--success)]">{metric}</span>
          ))}
        </div>
        <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">NEXTRON Body access</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          Metrics NEXTRON may summarize. Separate explicit permission, also managed on mobile.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {nextronMetrics.length === 0 && (
            <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">NEXTRON Body access is off</span>
          )}
          {nextronMetrics.map((metric) => (
            <span key={metric} className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]">{metric}</span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Body goals</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Quantitative goals with truthful progress from synced data.</p>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_120px_auto] sm:items-end">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Title</label>
            <input value={goalTitle} onChange={(e) => onGoalTitleChange(e.target.value)} placeholder="Walk daily" maxLength={120} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Kind</label>
            <select value={goalKind} onChange={(e) => onGoalKindChange(e.target.value as BodyGoalKind)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0">
              {BODY_GOAL_KINDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Target</label>
            <input type="number" step="any" min="0" value={goalTarget} onChange={(e) => onGoalTargetChange(e.target.value)} placeholder="Optional" className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0" />
          </div>
          <button
            type="button"
            onClick={onCreateGoal}
            disabled={goalSaving || !goalTitle.trim() || !canCreateGoal}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-60 sm:min-h-0 sm:py-2"
          >
            {goalSaving ? "Saving..." : "Add"}
          </button>
        </div>
        {goalError && <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{goalError}</p>}
        <div className="mt-3 space-y-1.5">
          {goals.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">No Body goals yet.</p>
          )}
          {goals.map((goal) => {
            const targetValue = goal.target_value == null ? null : Number(goal.target_value);
            const currentMetric = goal.target_metric === "steps" ? "steps" : goal.target_metric === "weight" ? "weight" : goal.target_metric === "sleep_duration" ? "sleepDuration" : null;
            const currentValue = currentMetric ? latestByMetric.get(currentMetric)?.value ?? null : null;
            const progress = getBodyGoalProgress(
              { kind: (goal.goal_type as BodyGoalKind | null) ?? "general_fitness", targetValue: targetValue ?? undefined, targetMetric: (goal.target_metric as never) ?? undefined },
              currentValue != null ? Number(currentValue) : null,
            );
            return (
              <div key={goal.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium text-[var(--text)]">{goal.title}</p>
                  <button type="button" onClick={() => onDeleteGoal(goal.id)} className="shrink-0 rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]">Delete</button>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  {progress.status}{progress.progress01 != null && ` · ${Math.round(progress.progress01 * 100)}%`} · {progress.message}
                </p>
                {progress.progress01 != null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.round(progress.progress01 * 100))}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BodyContent() {  const router = useRouter();
  const [supabase] = useState(() => createClient());
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

  // Synced (server-normalized device data — display only, never ingested here)
  const [syncedRecords, setSyncedRecords] = useState<SyncedRecord[]>([]);
  const [allowedMetrics, setAllowedMetrics] = useState<string[]>([]);
  const [nextronMetrics, setNextronMetrics] = useState<string[]>([]);
  const [syncProviders, setSyncProviders] = useState<string[]>([]);
  const [bodyGoals, setBodyGoals] = useState<BodyGoalRow[]>([]);
  const [bodyRealmId, setBodyRealmId] = useState<string | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<7 | 30>(7);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalKind, setGoalKind] = useState<BodyGoalKind>("general_fitness");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);

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
        { data: synced },
        { data: healthPrefs },
        { data: healthSrcs },
        { data: bodyRealm },
      ] = await Promise.all([
        supabase.from("habits").select("id, title, realms!inner(name)").eq("user_id", user.id).eq("realms.name", BODY_REALM),
        supabase.from("tasks").select("id, title, status, priority, realms!inner(name)").eq("user_id", user.id).neq("status", "done").eq("realms.name", BODY_REALM),
        supabase.from("journal_entries").select("id, energy, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("xp_events").select("amount").eq("user_id", user.id).eq("realm", BODY_REALM),
        supabase.from("habit_logs").select("id, habit_id, logged_date").eq("user_id", user.id).gte("logged_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from("body_metrics").select("id, user_id, entry_date, sleep_hours, sleep_quality, energy, steps, workout_minutes, weight_kg, resting_heart_rate, recovery_score, notes, created_at, updated_at").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(14),
        supabase.from("workouts").select("id, workout_date, duration_minutes").eq("user_id", user.id).gte("workout_date", weekStartStr),
        supabase.from("nutrition_logs").select("id, user_id, log_date, meal_name, calories, protein_g, carbs_g, fat_g, water_ml, notes, created_at").eq("user_id", user.id).eq("log_date", today),
        supabase.from("body_measurements").select("weight_kg").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(1),
        supabase.from("health_notes").select("id, user_id, note_date, category, severity, title, notes, created_at").eq("user_id", user.id).order("note_date", { ascending: false }).order("created_at", { ascending: false }).limit(1),
        supabase.from("health_records").select("metric, value, recorded_at, source").eq("user_id", user.id).gte("recorded_at", new Date(Date.now() - 60 * 86400000).toISOString()).order("recorded_at", { ascending: true }).limit(2000),
        supabase.from("health_preferences").select("allowed_metrics, nextron_allowed_metrics").eq("user_id", user.id).maybeSingle(),
        supabase.from("health_sources").select("provider").eq("user_id", user.id),
        supabase.from("realms").select("id").eq("user_id", user.id).ilike("name", BODY_REALM).limit(1).maybeSingle(),
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
      setSyncedRecords(((synced ?? []) as SyncedRecord[]).map((r) => ({ ...r, value: Number(r.value) })));
      const prefs = (healthPrefs ?? null) as { allowed_metrics?: string[] | null; nextron_allowed_metrics?: string[] | null } | null;
      setAllowedMetrics(prefs?.allowed_metrics ?? []);
      setNextronMetrics(prefs?.nextron_allowed_metrics ?? []);
      setSyncProviders(((healthSrcs ?? []) as Array<{ provider: string }>).map((s) => s.provider).filter(Boolean));
      const realmId = ((bodyRealm ?? null) as { id: string } | null)?.id ?? null;
      setBodyRealmId(realmId);
      if (realmId) {
        const { data: goals } = await supabase
          .from("goals")
          .select("id, title, status, goal_type, target_metric, target_value, target_unit, target_date")
          .eq("user_id", user.id)
          .eq("realm_id", realmId)
          .order("created_at", { ascending: false });
        setBodyGoals((goals ?? []) as BodyGoalRow[]);
      } else {
        setBodyGoals([]);
      }
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

  async function handleCreateBodyGoal() {
    // Quantitative mapping per 00039 contract (same as mobile createBodyGoal).
    if (!goalTitle.trim() || !bodyRealmId) return;
    const base: Record<string, unknown> = {
      user_id: "",
      realm_id: bodyRealmId,
      title: goalTitle.trim(),
      status: "active",
    };
    if (goalKind !== "general_fitness") {
      const v = Number(goalTarget);
      if (!Number.isFinite(v) || v <= 0) {
        setGoalError("Enter a valid target value.");
        return;
      }
      base.goal_type = goalKind;
      base.target_value = v;
      base.target_metric =
        goalKind === "steps_average" ? "steps" : goalKind === "weight_target" ? "weight" : goalKind === "sleep_duration" ? "sleep_duration" : null;
      base.target_unit =
        goalKind === "steps_average" ? "count" : goalKind === "weight_target" ? "kg" : goalKind === "sleep_duration" ? "hours" : null;
    }
    setGoalSaving(true);
    setGoalError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...base, user_id: user.id })
        .select("id, title, status, goal_type, target_metric, target_value, target_unit, target_date")
        .single();
      if (error) throw error;
      setBodyGoals((prev) => [data as BodyGoalRow, ...prev]);
      setGoalTitle("");
      setGoalTarget("");
      setGoalKind("general_fitness");
      toast({ type: "success", title: "Body goal added." });
    } catch {
      setGoalError("Could not create goal. Try again.");
    } finally {
      setGoalSaving(false);
    }
  }

  async function handleDeleteBodyGoal(id: string) {
    try {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
      setBodyGoals((prev) => prev.filter((g) => g.id !== id));
    } catch {
      toast({ type: "error", title: "Failed to delete goal." });
    }
  }

  if (loading) return <RouteLoadingState label="Body" detail="Loading today's body context." />;

  return (
    <div className="animate-fade-in overflow-x-hidden px-4 py-5 md:p-6">
      <div className="mx-auto max-w-5xl min-w-0">
        <BodyPulseHeader habitCount={bodyHabits.length} taskCount={bodyTaskCount} journalCount={journalCount} />

        <div className="mb-6">
          <BodySignalCards habitStreak={bestStreak} completionRate={completionRate} totalXp={totalXp} />
        </div>

        {/* Tab Bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-soft)] p-1 [-webkit-overflow-scrolling:touch]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs font-medium transition-all sm:min-h-0 sm:flex-1 ${
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
            onQuickAction={setActiveTab}
          />
        )}

        {activeTab === "workouts" && <WorkoutSection />}
        {activeTab === "nutrition" && <NutritionSection />}
        {activeTab === "measurements" && <MeasurementSection />}
        {activeTab === "health" && <HealthNoteSection />}
        {activeTab === "synced" && <SyncedBodySection
          records={syncedRecords}
          allowedMetrics={allowedMetrics}
          nextronMetrics={nextronMetrics}
          providers={syncProviders}
          goals={bodyGoals}
          period={trendPeriod}
          onPeriodChange={setTrendPeriod}
          goalTitle={goalTitle}
          goalKind={goalKind}
          goalTarget={goalTarget}
          goalError={goalError}
          goalSaving={goalSaving}
          canCreateGoal={bodyRealmId !== null}
          onGoalTitleChange={setGoalTitle}
          onGoalKindChange={setGoalKind}
          onGoalTargetChange={setGoalTarget}
          onCreateGoal={() => void handleCreateBodyGoal()}
          onDeleteGoal={(id) => void handleDeleteBodyGoal(id)}
        />}
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

function RouteLoadingState({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="overflow-x-hidden px-4 py-5 md:p-6">
      <div className="mx-auto max-w-5xl min-w-0">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">{label}</p>
        <h1 className="text-xl font-bold text-[var(--text)]">Preparing your check-in...</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{detail}</p>
        <div className="mt-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
