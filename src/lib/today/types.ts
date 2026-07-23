import type { IntendedUse } from "@/lib/intendedUse";

export interface TodayRealmInfo {
  name: string;
  color: string;
  icon: string;
}

export interface TodayHabit {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  days_of_week: number[] | null;
  times_per_week: number | null;
  realms: TodayRealmInfo | null;
}

export interface TodayTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  project_id: string | null;
  realms: TodayRealmInfo | null;
  projects?: { title: string } | null;
}

export interface TodayProjectTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  project_id: string;
  projects: { title: string } | null;
  realms: TodayRealmInfo | null;
}

export interface TodayTaskProjectContext {
  id: string;
  title: string;
  status: string | null;
}

export interface TodayGoalLink {
  goal_id: string;
  linked_type: string;
  linked_id: string;
}

export interface TodayGoalPreviewLink {
  goal_id: string | null;
  linked_type: string | null;
}

export interface TodayLinkedGoal {
  id: string;
  title: string;
  status: string | null;
  target_date?: string | null;
}

export interface TodayGoalMilestone {
  goal_id: string;
  completed_at: string | null;
}

export interface TodayTaskExecutionContext {
  projectTitle?: string;
  goalContext?: string;
}

export interface TodayHabitLog {
  habit_id: string;
  completed_date: string;
}

export interface TodayDateContext {
  localDate: string;
  displayDate: string;
  dayStart: string;
  dayEnd: string;
  dayOfWeek: number;
  weekStart: string;
}

export interface TodayTaskGroups {
  relevant: TodayTask[];
  dueToday: TodayTask[];
  overdue: TodayTask[];
  upcoming: TodayTask[];
  unscheduled: TodayTask[];
  completedToday: TodayTask[];
  active: TodayTask[];
  totalRelevant: number;
  doneCount: number;
  hasHighPriorityActive: boolean;
  contextById: Record<string, TodayTaskExecutionContext>;
}

export interface TodayHabitGroups {
  all: TodayHabit[];
  dueToday: TodayHabit[];
  completedToday: TodayHabit[];
  incompleteToday: TodayHabit[];
  notDueToday: TodayHabit[];
  completedIds: Set<string>;
  timesPerWeekCounts: Record<string, number>;
  weeklyProgressById: Record<string, { completed: number; target: number } | null>;
  completedCount: number;
}

export interface TodayReflectionState {
  existingTodayEntry: { id: string } | null;
  hasReflection: boolean;
}

export interface TodayContextState {
  taskProjects: TodayTaskProjectContext[];
  taskGoalLinks: TodayGoalLink[];
  linkedGoals: TodayLinkedGoal[];
  projectTasks: TodayProjectTask[];
  goalPreviewGoals: { id: string; status: string; target_date: string | null }[];
  goalPreviewMilestones: TodayGoalMilestone[];
  goalPreviewLinks: TodayGoalPreviewLink[];
  goalWithoutLinks: boolean;
}

export interface TodayNextActionInputs {
  overdueTasks: TodayTask[];
  dueTodayTasks: TodayTask[];
  incompleteHabits: TodayHabit[];
  hasHighPriorityTasks: boolean;
  hasGoalWithoutLinks: boolean;
}

export interface TodayStatusState {
  loading: boolean;
  error: string | null;
  userId: string | null;
  lastLoadedLocalDate: string | null;
}

export interface TodayModel {
  date: TodayDateContext;
  tasks: TodayTaskGroups;
  habits: TodayHabitGroups;
  reflection: TodayReflectionState;
  context: TodayContextState;
  nextActionInputs: TodayNextActionInputs;
  status: TodayStatusState;
  xp: {
    today: number;
    total: number;
  };
  intendedUse: IntendedUse;
}

export interface TodayDataSnapshot {
  habits: TodayHabit[];
  tasks: TodayTask[];
  weekLogs: TodayHabitLog[];
  todayEntry: { id: string } | null;
  projectTasks: TodayProjectTask[];
  taskProjects: TodayTaskProjectContext[];
  taskGoalLinks: TodayGoalLink[];
  linkedGoals: TodayLinkedGoal[];
  goalPreviewMilestones: TodayGoalMilestone[];
  goalPreviewLinks: TodayGoalPreviewLink[];
  todayXp: number;
  totalXp: number;
  intendedUse: IntendedUse;
}
