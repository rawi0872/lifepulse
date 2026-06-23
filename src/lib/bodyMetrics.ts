export interface BodyMetrics {
  id: string;
  user_id: string;
  entry_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  steps: number | null;
  workout_minutes: number | null;
  weight_kg: number | null;
  resting_heart_rate: number | null;
  recovery_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyMetricsFormData {
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  steps: number | null;
  workout_minutes: number | null;
  weight_kg: number | null;
  resting_heart_rate: number | null;
  recovery_score: number | null;
  notes: string | null;
}

export function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function avgRecent(entries: BodyMetrics[], field: keyof Pick<BodyMetrics, "sleep_hours" | "energy" | "steps" | "workout_minutes" | "recovery_score">): number | null {
  const vals = entries.map((e) => e[field]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}
