export interface Workout {
  id: string;
  user_id: string;
  workout_date: string;
  title: string;
  type: string | null;
  duration_minutes: number | null;
  intensity: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutFormData {
  title: string;
  type: string;
  duration_minutes: number | null;
  intensity: number | null;
  notes: string;
}

export interface WorkoutExercise {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface WorkoutExerciseFormData {
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  notes: string;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  log_date: string;
  meal_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  notes: string | null;
  created_at: string;
}

export interface NutritionFormData {
  meal_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  notes: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  measurement_date: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  notes: string | null;
  created_at: string;
}

export interface MeasurementFormData {
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  notes: string;
}

export interface HealthNote {
  id: string;
  user_id: string;
  note_date: string;
  category: string | null;
  severity: number | null;
  title: string;
  notes: string | null;
  created_at: string;
}

export interface HealthNoteFormData {
  title: string;
  category: string;
  severity: number | null;
  notes: string;
}

export function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "\u2014";
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
