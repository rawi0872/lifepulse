// Normalized Life Pulse Health Domain — provider-neutral, single source of truth
// No provider-specific payload shapes are exposed to Today / Body / NEXTRON.

export type HealthSource = "healthkit" | "health_connect" | "manual";

export type HealthMetricType =
  // CORE V1 — persisted in migration 00038 (tiny, intentional)
  | "sleep_duration"
  | "steps"
  | "active_minutes"
  | "exercise_minutes"
  | "resting_heart_rate"
  | "weight"
  // PREPARED — type support only, not persisted until first real ingestion needs it
  | "hrv"
  | "sleep_stage"
  | "respiratory_rate"
  | "workout_session"
  | "active_energy"
  | "body_fat_percentage"
  | "lean_body_mass"
  | "recovery_score";

export type HealthUnit = "minutes" | "count" | "bpm" | "kg" | "ms" | "breaths_per_min" | "kcal" | "percent";

// Provenance — stored as jsonb, never relied on for identity beyond dedupe_key
export interface HealthProvenance {
  sourceRecordId: string | null; // provider stable id when available
  sourceDeviceName?: string | null;
  sourceAppBundleId?: string | null;
  rawMetricType?: string | null; // e.g. HKQuantityTypeIdentifierHeartRate
}

// Persisted normalized record — typed numeric, interval via startAt/endAt for sleep
export interface HealthRecord {
  id: string;
  userId: string;
  healthSourceId: string; // FK -> health_sources(id, user_id)
  source: HealthSource; // denormalized for query convenience, must match source row provider
  dedupeKey: string; // non-null, unique per (user_id, health_source_id, dedupeKey)
  metricType: HealthMetricType; // CORE only in DB; prepared types remain code-only until needed
  numericValue: number; // typed double precision
  unit: HealthUnit;
  recordedAt: string; // ISO timestamptz
  startAt: string | null; // for sleep_duration interval
  endAt: string | null;
  localDate: string; // YYYY-MM-DD from recordedAt local tz
  syncedAt: string;
  provenance: HealthProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface HealthSourceConnection {
  id: string;
  userId: string;
  provider: HealthSource;
  status: "connected" | "disconnected" | "revoked";
  lastSyncAt: string | null;
  scopesGranted: HealthMetricType[]; // minimal necessary
  createdAt: string;
  updatedAt: string;
}

export const HEALTH_METRIC_META: Record<HealthMetricType, { label: string; unit: HealthUnit; core: boolean; description: string }> = {
  sleep_duration: { label: "Sleep duration", unit: "minutes", core: true, description: "Total sleep time (with start/end interval)" },
  steps: { label: "Steps", unit: "count", core: true, description: "Daily step count" },
  active_minutes: { label: "Active minutes", unit: "minutes", core: true, description: "Active time (move)" },
  exercise_minutes: { label: "Exercise minutes", unit: "minutes", core: true, description: "Dedicated workout time" },
  resting_heart_rate: { label: "Resting heart rate", unit: "bpm", core: true, description: "Morning resting BPM" },
  weight: { label: "Weight", unit: "kg", core: true, description: "Body weight" },
  hrv: { label: "HRV", unit: "ms", core: false, description: "Heart rate variability (RMSSD)" },
  sleep_stage: { label: "Sleep stages", unit: "json" as HealthUnit, core: false, description: "Structured sleep stage intervals" },
  respiratory_rate: { label: "Respiratory rate", unit: "breaths_per_min", core: false, description: "Breaths per minute" },
  workout_session: { label: "Workout session", unit: "json" as HealthUnit, core: false, description: "Workout with type/duration" },
  active_energy: { label: "Active energy", unit: "kcal", core: false, description: "Active calories" },
  body_fat_percentage: { label: "Body fat", unit: "percent", core: false, description: "Body fat percentage" },
  lean_body_mass: { label: "Lean mass", unit: "kg", core: false, description: "Lean body mass" },
  recovery_score: { label: "Recovery", unit: "percent", core: false, description: "Provider recovery metric" },
};

export const CORE_HEALTH_METRICS: HealthMetricType[] = (Object.entries(HEALTH_METRIC_META) as Array<[HealthMetricType, (typeof HEALTH_METRIC_META)[HealthMetricType]]>)
  .filter(([, meta]) => meta.core)
  .map(([type]) => type);

export function isCoreMetric(type: HealthMetricType): boolean {
  return HEALTH_METRIC_META[type]?.core ?? false;
}

// Provider adapter must generate dedupeKey deterministically
export function buildHealthDedupeKey(args: { sourceRecordId: string | null; metricType: HealthMetricType; recordedAt: string; startAt: string | null; endAt: string | null; rawMetricType?: string | null }): string {
  if (args.sourceRecordId) return `sid:${args.sourceRecordId}`;
  const range = args.startAt && args.endAt ? `${args.startAt}|${args.endAt}` : args.recordedAt;
  const raw = args.rawMetricType ? `:${args.rawMetricType}` : "";
  return `${args.metricType}:${range}${raw}`;
}

// Sanity bounds — reject obviously malformed ingestion, no medical interpretation
export function isValidHealthNumericValue(type: HealthMetricType, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (type === "steps" && (value < 0 || value > 200000)) return false;
  if (type === "resting_heart_rate" && (value < 20 || value > 220)) return false;
  if (type === "weight" && (value < 20 || value > 500)) return false;
  if ((type === "sleep_duration" || type === "active_minutes" || type === "exercise_minutes") && (value < 0 || value > 1440)) return false;
  if (type === "hrv" && (value < 0 || value > 500)) return false;
  if (type === "respiratory_rate" && (value < 4 || value > 60)) return false;
  return true;
}

// Legacy alias for older callers (now numeric-only)
export function isValidHealthValue(type: HealthMetricType, value: number | string): boolean {
  if (typeof value === "string") return false; // Core V1 is numeric only
  return isValidHealthNumericValue(type, value);
}

// Backwards-compat alias
export const healthRecordDedupeKey = buildHealthDedupeKey;
