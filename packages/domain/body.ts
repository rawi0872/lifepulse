// Life Pulse Body Realm V1 — Foundation + Product Architecture
// Pure domain, no I/O, no Supabase imports.

import type { HealthMetricType } from "./health";

// ── Units ──
export type BodyMetricUnit = "count" | "minutes" | "hours" | "bpm" | "kg" | "lb";

export const BODY_METRIC_UNITS: Record<BodyMetricKey, BodyMetricUnit> = {
  steps: "count",
  activeMinutes: "minutes",
  exerciseMinutes: "minutes",
  sleepDuration: "hours",
  restingHeartRate: "bpm",
  weight: "kg",
};

export function formatBodyMetricValue(key: BodyMetricKey, value: number, opts?: { weightUnit?: "kg" | "lb" }): string {
  if (key === "sleepDuration") {
    const h = Math.floor(value / 60);
    const m = Math.round(value % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  if (key === "weight") {
    const unit = opts?.weightUnit ?? "kg";
    if (unit === "lb") return `${(value * 2.20462).toFixed(1)} lb`;
    return `${value.toFixed(1)} kg`;
  }
  if (key === "restingHeartRate") return `${Math.round(value)} bpm`;
  if (key === "steps") return `${Math.round(value).toLocaleString()} steps`;
  return `${Math.round(value)} min`;
}

// ── Metric keys — subset of health + manual body ──
export type BodyMetricKey =
  | "steps"
  | "activeMinutes"
  | "exerciseMinutes"
  | "sleepDuration"
  | "restingHeartRate"
  | "weight";

// ── Data quality ──
export type BodyDataQuality = "available" | "missing" | "stale" | "insufficient";

export interface BodyMetricSnapshot {
  key: BodyMetricKey;
  value: number | null;
  quality: BodyDataQuality;
  source: "health" | "manual" | "none";
  updatedAt: string | null;
  isZeroVsMissing: "zero" | "missing" | "present";
}

export function classifyMetricQuality(value: number | null | undefined, lastUpdatedAt: string | null, maxStaleHours: number = 48): BodyDataQuality {
  if (value == null) return "missing";
  if (lastUpdatedAt) {
    const ageHours = (Date.now() - new Date(lastUpdatedAt).getTime()) / 3_600_000;
    if (ageHours > maxStaleHours) return "stale";
  }
  return "available";
}

// ── Daily summary ──
export interface BodyDailySummary {
  date: string; // YYYY-MM-DD local
  metrics: Record<BodyMetricKey, BodyMetricSnapshot>;
  availableMetrics: BodyMetricKey[];
  missingMetrics: BodyMetricKey[];
  isSufficient: boolean; // at least one metric available
  freshness: "fresh" | "stale" | "empty";
  // activity status derived
  activityLevel: "unknown" | "sedentary" | "light" | "active" | "very_active";
}

export function getBodyActivityLevel(steps: number | null): BodyDailySummary["activityLevel"] {
  if (steps == null) return "unknown";
  if (steps < 3000) return "sedentary";
  if (steps < 7500) return "light";
  if (steps < 12000) return "active";
  return "very_active";
}

export interface BodySummaryInput {
  date: string;
  healthRecords: Array<{ metric: HealthMetricType; value: number; recorded_at: string; source: string }>;
  manualBodyMetrics?: Partial<Record<BodyMetricKey, number>>;
  allowedMetrics: HealthMetricType[]; // from health_preferences.allowed_metrics
  now?: Date;
}

const HEALTH_TO_BODY: Partial<Record<HealthMetricType, BodyMetricKey>> = {
  steps: "steps",
  active_minutes: "activeMinutes",
  exercise_minutes: "exerciseMinutes",
  sleep_duration: "sleepDuration",
  resting_heart_rate: "restingHeartRate",
  weight: "weight",
};

export function getBodyDailySummary(input: BodySummaryInput): BodyDailySummary {
  const keys: BodyMetricKey[] = ["steps", "activeMinutes", "exerciseMinutes", "sleepDuration", "restingHeartRate", "weight"];
  const byBodyKey = new Map<BodyMetricKey, { value: number; at: string }>();

  for (const r of input.healthRecords) {
    const bKey = HEALTH_TO_BODY[r.metric];
    if (!bKey) continue;
    if (!input.allowedMetrics.includes(r.metric)) continue;
    // keep latest by recorded_at; rely on upstream validation
    const existing = byBodyKey.get(bKey);
    if (!existing || new Date(r.recorded_at).getTime() > new Date(existing.at).getTime()) {
      byBodyKey.set(bKey, { value: r.value, at: r.recorded_at });
    }
  }

  const metrics = {} as Record<BodyMetricKey, BodyMetricSnapshot>;
  const available: BodyMetricKey[] = [];
  const missing: BodyMetricKey[] = [];

  for (const k of keys) {
    const healthVal = byBodyKey.get(k);
    const manualVal = input.manualBodyMetrics?.[k];
    let value: number | null = null;
    let at: string | null = null;
    let source: BodyMetricSnapshot["source"] = "none";

    if (healthVal) {
      // health sleep_duration is minutes, body expects minutes too — normalize
      value = healthVal.value;
      at = healthVal.at;
      source = "health";
    } else if (manualVal != null) {
      value = manualVal;
      source = "manual";
    }

    // Normalize weight display: keep kg, sleep keep minutes
    const quality = classifyMetricQuality(value, at);
    const isZeroVsMissing = value == null ? "missing" : value === 0 ? "zero" : "present";
    if (quality === "available" || quality === "stale") available.push(k);
    else missing.push(k);

    metrics[k] = { key: k, value, quality, source, updatedAt: at, isZeroVsMissing };
  }

  const isSufficient = available.length > 0;
  const freshness: BodyDailySummary["freshness"] = !isSufficient ? "empty" : available.some((k) => metrics[k].quality === "stale") ? "stale" : "fresh";

  return {
    date: input.date,
    metrics,
    availableMetrics: available,
    missingMetrics: missing,
    isSufficient,
    freshness,
    activityLevel: getBodyActivityLevel(metrics.steps.value),
  };
}

// ── Trend model ──
export interface BodyTrendPoint {
  date: string;
  value: number;
}

export type BodyTrendDirection = "up" | "down" | "flat" | "insufficient";

export interface BodyTrendSummary {
  metric: BodyMetricKey;
  periodDays: 7 | 30;
  currentAvg: number | null;
  previousAvg: number | null;
  change: number | null;
  changePct: number | null;
  direction: BodyTrendDirection;
  dataPoints: number;
  requiredPoints: number;
  isSufficient: boolean;
}

export function getBodyTrend(history: BodyTrendPoint[], periodDays: 7 | 30 = 7, minCoverage: number = 0.5): BodyTrendSummary {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const need = Math.ceil(periodDays * minCoverage);
  const currentSlice = sorted.slice(-periodDays);
  const previousSlice = sorted.slice(-periodDays * 2, -periodDays);

  const avg = (arr: BodyTrendPoint[]) => (arr.length === 0 ? null : arr.reduce((s, p) => s + p.value, 0) / arr.length);

  const currentAvg = currentSlice.length >= need ? avg(currentSlice) : null;
  const previousAvg = previousSlice.length >= need ? avg(previousSlice) : null;

  const isSufficient = currentAvg != null;
  let change: number | null = null;
  let changePct: number | null = null;
  let direction: BodyTrendDirection = "insufficient";
  if (currentAvg != null && previousAvg != null && previousAvg !== 0) {
    change = currentAvg - previousAvg;
    changePct = (change / Math.abs(previousAvg)) * 100;
    direction = Math.abs(changePct) < 3 ? "flat" : change > 0 ? "up" : "down";
  } else if (isSufficient) {
    direction = "flat";
  }

  return {
    metric: "steps" as BodyMetricKey, // caller overrides; default for test helper
    periodDays,
    currentAvg,
    previousAvg,
    change,
    changePct,
    direction,
    dataPoints: currentSlice.length,
    requiredPoints: need,
    isSufficient,
  };
}

export function getBodyMetricTrend(history: BodyTrendPoint[], metric: BodyMetricKey, periodDays: 7 | 30 = 7): BodyTrendSummary {
  const t = getBodyTrend(history, periodDays);
  return { ...t, metric };
}

// ── Body goal model — reuse existing goals with Body-specific helpers ──
export type BodyGoalKind =
  | "weight_target"
  | "steps_average"
  | "exercise_frequency"
  | "sleep_duration"
  | "weight_trend"
  | "general_fitness";

export interface BodyGoalInput {
  kind: BodyGoalKind;
  targetValue?: number;
  targetMetric?: BodyMetricKey;
  targetDate?: string | null;
  unit?: BodyMetricUnit;
}

export interface BodyGoalProgress {
  kind: BodyGoalKind;
  progress01: number | null; // 0..1, null if insufficient data
  status: "on_track" | "at_risk" | "behind" | "achieved" | "insufficient";
  currentValue: number | null;
  targetValue: number | null;
  message: string;
}

export function getBodyGoalProgress(input: BodyGoalInput, currentValue: number | null): BodyGoalProgress {
  if (currentValue == null || input.targetValue == null) {
    return { kind: input.kind, progress01: null, status: "insufficient", currentValue, targetValue: input.targetValue ?? null, message: "Not enough data yet." };
  }
  const t = input.targetValue;
  let progress01: number | null = null;
  let status: BodyGoalProgress["status"] = "on_track";
  let message = "";

  switch (input.kind) {
    case "weight_target": {
      // lower is better if target < current assumption not safe — use distance
      const diff = Math.abs(currentValue - t);
      progress01 = Math.max(0, 1 - diff / Math.max(1, Math.abs(t * 0.2)));
      if (diff < 1) { status = "achieved"; message = "Weight target reached."; }
      else if (diff < 3) { status = "on_track"; message = "Getting close to weight target."; }
      else { status = "at_risk"; message = "Weight progress needs attention."; }
      break;
    }
    case "steps_average": {
      progress01 = Math.min(1, currentValue / t);
      if (progress01 >= 1) { status = "achieved"; message = "Step goal met."; }
      else if (progress01 >= 0.7) { status = "on_track"; message = "Steps on track."; }
      else { status = "behind"; message = "Steps below target."; }
      break;
    }
    case "exercise_frequency":
    case "sleep_duration": {
      progress01 = Math.min(1, currentValue / t);
      status = progress01 >= 1 ? "achieved" : progress01 >= 0.75 ? "on_track" : "behind";
      message = input.kind === "sleep_duration"
        ? progress01 >= 1 ? "Sleep goal met." : "Sleep below goal."
        : progress01 >= 1 ? "Exercise frequency met." : "Exercise frequency behind.";
      break;
    }
    default: {
      progress01 = null;
      status = "insufficient";
      message = "Goal progress not yet available.";
      break;
    }
  }

  return { kind: input.kind, progress01, status, currentValue, targetValue: t, message };
}

// ── Body ↔ habits/tasks realm helpers (reuse realm_id) ──
export function isBodyHabit(habit: { realm_id: string | null; realms?: { name: string } | null }, bodyRealmId: string | null): boolean {
  if (!bodyRealmId) return false;
  return habit.realm_id === bodyRealmId;
}

export function filterBodyHabits<T extends { realm_id: string | null }>(habits: T[], bodyRealmId: string | null): T[] {
  if (!bodyRealmId) return [];
  return habits.filter((h) => h.realm_id === bodyRealmId);
}

// ── Body ↔ Today signals — deterministic, bounded, explainable ──
export type BodySignalKind = "body_habit_due" | "body_goal_at_risk" | "activity_below_target" | "sleep_below_goal";

export interface BodySignal {
  kind: BodySignalKind;
  priority: number; // lower = higher priority
  title: string;
  rationale: string;
}

export function deriveBodySignals(input: {
  dueBodyHabits: Array<{ id: string; title: string }>;
  goalProgress: BodyGoalProgress[];
  todaySteps: number | null;
  stepsTarget?: number | null;
  sleepMinutes: number | null;
  sleepTargetMinutes?: number | null;
}): BodySignal[] {
  const signals: BodySignal[] = [];
  if (input.dueBodyHabits.length > 0) {
    signals.push({
      kind: "body_habit_due",
      priority: 20,
      title: input.dueBodyHabits[0].title,
      rationale: `${input.dueBodyHabits.length} body habit${input.dueBodyHabits.length > 1 ? "s" : ""} due today`,
    });
  }
  for (const g of input.goalProgress) {
    if (g.status === "at_risk" || g.status === "behind") {
      signals.push({ kind: "body_goal_at_risk", priority: 30, title: g.message, rationale: `Body goal ${g.kind} needs attention` });
      break; // bounded: at most one
    }
  }
  if (input.stepsTarget != null && input.todaySteps != null && input.todaySteps < input.stepsTarget * 0.5) {
    signals.push({ kind: "activity_below_target", priority: 40, title: "Activity below target", rationale: `Steps ${input.todaySteps} < 50% of ${input.stepsTarget}` });
  }
  if (input.sleepTargetMinutes != null && input.sleepMinutes != null && input.sleepMinutes < input.sleepTargetMinutes) {
    signals.push({ kind: "sleep_below_goal", priority: 45, title: "Sleep below goal", rationale: `Sleep ${formatBodyMetricValue("sleepDuration", input.sleepMinutes)} < target` });
  }
  return signals.sort((a, b) => a.priority - b.priority).slice(0, 3); // bounded to 3
}

// ── Privacy — reuses health_preferences boundary, NEXTRON separate ──
export interface BodyPrivacyBoundary {
  storageAllowed: (metric: HealthMetricType) => boolean;
  nextronAllowed: (metric: HealthMetricType) => boolean;
}

export function createBodyPrivacyBoundary(allowedMetrics: HealthMetricType[], nextronHealthAllowed: boolean): BodyPrivacyBoundary {
  return {
    storageAllowed: (m) => allowedMetrics.includes(m),
    nextronAllowed: (m) => nextronHealthAllowed && allowedMetrics.includes(m),
  };
}

// ── Onboarding hook — physical improvement intents ──
export type BodyOnboardingIntent = "general_fitness" | "lose_weight" | "build_muscle" | "move_more" | "sleep_better" | "exercise_consistently";

export const BODY_ONBOARDING_OPTIONS: Array<{ value: BodyOnboardingIntent; label: string }> = [
  { value: "general_fitness", label: "General fitness" },
  { value: "lose_weight", label: "Lose weight" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "move_more", label: "Move more" },
  { value: "sleep_better", label: "Sleep better" },
  { value: "exercise_consistently", label: "Exercise consistently" },
];
