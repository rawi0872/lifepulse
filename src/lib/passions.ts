export interface Passion {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  description: string | null;
  status: string | null;
  skill_level: string | null;
  target_hours_per_week: number | null;
  created_at: string;
  updated_at: string;
}

export interface PassionFormData {
  name: string;
  category: string;
  description: string;
  skill_level: string;
  target_hours_per_week: number | null;
}

export interface PassionSession {
  id: string;
  user_id: string;
  passion_id: string;
  session_date: string;
  duration_minutes: number | null;
  focus: string | null;
  notes: string | null;
  enjoyment: number | null;
  difficulty: number | null;
  created_at: string;
}

export interface SessionFormData {
  passion_id: string;
  duration_minutes: number | null;
  focus: string;
  notes: string;
  enjoyment: number | null;
  difficulty: number | null;
}

export interface PassionMilestone {
  id: string;
  user_id: string;
  passion_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface MilestoneFormData {
  passion_id: string;
  title: string;
  description: string;
  target_date: string;
}

export const PASSION_CATEGORIES = [
  "Music", "Fitness/Sport", "Art", "Coding",
  "Reading", "Language", "Content Creation", "Other",
] as const;

export const SKILL_LEVELS = [
  "Beginner", "Intermediate", "Advanced", "Expert",
] as const;

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
