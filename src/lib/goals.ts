export interface Goal {
  id: string;
  user_id: string;
  realm_id: string | null;
  title: string;
  description: string | null;
  why: string | null;
  status: "active" | "paused" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  realms?: { name: string; color: string; icon: string } | null;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GoalFormData {
  title: string;
  description?: string;
  why?: string;
  status?: "active" | "paused" | "completed" | "archived";
  priority?: "low" | "medium" | "high";
  realm_id?: string | null;
  target_date?: string | null;
}

export interface MilestoneFormData {
  title: string;
  description?: string;
  due_date?: string | null;
  sort_order?: number;
}

export type GoalLinkType = "project" | "task" | "habit";

export interface GoalLink {
  id: string;
  user_id: string;
  goal_id: string;
  linked_type: GoalLinkType;
  linked_id: string;
  created_at: string;
}

export const GOAL_LINK_LABELS: Record<GoalLinkType, string> = {
  project: "Project",
  task: "Task",
  habit: "Habit",
};

export function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
