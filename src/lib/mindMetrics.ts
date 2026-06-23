export interface MindMetrics {
  id: string;
  user_id: string;
  entry_date: string;
  mood: number | null;
  stress: number | null;
  focus: number | null;
  clarity: number | null;
  motivation: number | null;
  reflection: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MindMetricsFormData {
  mood: number | null;
  stress: number | null;
  focus: number | null;
  clarity: number | null;
  motivation: number | null;
  reflection: string | null;
  tags: string[];
}

export function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function avgRecent(entries: MindMetrics[], field: keyof Pick<MindMetrics, "mood" | "stress" | "focus" | "clarity" | "motivation">): number | null {
  const vals = entries.map((e) => e[field]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}
