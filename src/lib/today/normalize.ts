import { getWeeklyProgress } from "@/lib/streaks";
import type {
  TodayDataSnapshot,
  TodayDateContext,
  TodayGoalLink,
  TodayHabit,
  TodayLinkedGoal,
  TodayModel,
  TodayTask,
  TodayTaskExecutionContext,
} from "@/lib/today/types";

function isValidDateString(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isCompletedToday(completedAt: string | null, localDate: string): boolean {
  if (!completedAt) return false;
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return false;
  const completedLocalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return completedLocalDate === localDate;
}

function isHabitDueToday(habit: TodayHabit, dayOfWeek: number, timesPerWeekCounts: Record<string, number>): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekdays") return habit.days_of_week?.includes(dayOfWeek) ?? false;
  if (habit.frequency === "times_per_week") return (timesPerWeekCounts[habit.id] ?? 0) < (habit.times_per_week ?? 1);
  return false;
}

function priorityRank(priority: string): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function sortTasksForToday(tasks: TodayTask[]): TodayTask[] {
  return [...tasks].sort((a, b) => {
    const aStatus = a.status === "todo" ? 0 : 1;
    const bStatus = b.status === "todo" ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;

    const aDue = isValidDateString(a.due_date) ? a.due_date : "9999-12-31";
    const bDue = isValidDateString(b.due_date) ? b.due_date : "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);

    return priorityRank(a.priority) - priorityRank(b.priority);
  });
}

function formatGoalContext(goals: TodayLinkedGoal[]): string | undefined {
  if (goals.length === 0) return undefined;

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const displayGoals = activeGoals.length > 0 ? activeGoals : goals;
  const goalTitles = displayGoals.slice(0, 2).map((goal) => goal.title).join(" · ");
  const remainingCount = displayGoals.length - 2;

  if (displayGoals.length === 1) return `Goal: ${goalTitles}`;
  if (goalTitles) return `Supports goals: ${goalTitles}${remainingCount > 0 ? ` +${remainingCount}` : ""}`;
  return `Supports ${goals.length} goals`;
}

function buildTaskExecutionContext(
  tasks: TodayTask[],
  taskProjects: TodayDataSnapshot["taskProjects"],
  taskGoalLinks: TodayGoalLink[],
  linkedGoals: TodayLinkedGoal[],
): Record<string, TodayTaskExecutionContext> {
  const projectsById = taskProjects.reduce<Record<string, TodayDataSnapshot["taskProjects"][number]>>((map, project) => {
    map[project.id] = project;
    return map;
  }, {});
  const goalsById = linkedGoals.reduce<Record<string, TodayLinkedGoal>>((map, goal) => {
    map[goal.id] = goal;
    return map;
  }, {});
  const goalsByTaskId = taskGoalLinks.reduce<Record<string, TodayLinkedGoal[]>>((map, link) => {
    if (link.linked_type !== "task") return map;
    const goal = goalsById[link.goal_id];
    if (!goal) return map;
    if (!map[link.linked_id]) map[link.linked_id] = [];
    map[link.linked_id].push(goal);
    return map;
  }, {});

  return tasks.reduce<Record<string, TodayTaskExecutionContext>>((map, task) => {
    const projectTitle = task.project_id ? projectsById[task.project_id]?.title ?? task.projects?.title : undefined;
    const goalContext = formatGoalContext(goalsByTaskId[task.id] ?? []);
    if (projectTitle || goalContext) map[task.id] = { projectTitle, goalContext };
    return map;
  }, {});
}

export function normalizeTodayData(snapshot: TodayDataSnapshot, date: TodayDateContext): TodayModel {
  const weekLogs = snapshot.weekLogs.filter((log) => log.completed_date >= date.weekStart);
  const todayLogs = weekLogs.filter((log) => log.completed_date === date.localDate);
  const completedIds = new Set(todayLogs.map((log) => log.habit_id));

  const timesPerWeekCounts: Record<string, number> = {};
  weekLogs.forEach((log) => {
    timesPerWeekCounts[log.habit_id] = (timesPerWeekCounts[log.habit_id] ?? 0) + 1;
  });

  const dueToday = snapshot.habits.filter((habit) => isHabitDueToday(habit, date.dayOfWeek, timesPerWeekCounts));
  const completedToday = dueToday.filter((habit) => completedIds.has(habit.id));
  const incompleteToday = dueToday.filter((habit) => !completedIds.has(habit.id));
  const notDueToday = snapshot.habits.filter((habit) => !dueToday.some((dueHabit) => dueHabit.id === habit.id));

  const weeklyProgressById: Record<string, { completed: number; target: number } | null> = {};
  snapshot.habits.forEach((habit) => {
    const dates = weekLogs.filter((log) => log.habit_id === habit.id).map((log) => log.completed_date);
    weeklyProgressById[habit.id] = getWeeklyProgress(dates, habit.frequency, habit.times_per_week, date.weekStart);
  });

  const relevantTasks = sortTasksForToday(snapshot.tasks);
  const activeTasks = relevantTasks.filter((task) => task.status === "todo");
  const dueTodayTasks = activeTasks.filter((task) => task.due_date === date.localDate);
  const overdueTasks = activeTasks.filter((task) => isValidDateString(task.due_date) && task.due_date < date.localDate);
  const upcomingTasks = activeTasks.filter((task) => isValidDateString(task.due_date) && task.due_date > date.localDate);
  const unscheduledTasks = activeTasks.filter((task) => !task.due_date);
  const completedTodayTasks = relevantTasks.filter((task) => task.status === "done" && isCompletedToday(task.completed_at, date.localDate));
  const taskContextById = buildTaskExecutionContext(relevantTasks, snapshot.taskProjects, snapshot.taskGoalLinks, snapshot.linkedGoals);

  const activeGoalIds = new Set(snapshot.linkedGoals.filter((goal) => goal.status === "active").map((goal) => goal.id));
  const linkedGoalIds = new Set(snapshot.goalPreviewLinks.map((link) => link.goal_id).filter((goalId): goalId is string => Boolean(goalId)));
  const goalWithoutLinks = activeGoalIds.size > 0 && [...activeGoalIds].some((goalId) => !linkedGoalIds.has(goalId));

  return {
    date,
    tasks: {
      relevant: relevantTasks,
      dueToday: dueTodayTasks,
      overdue: overdueTasks,
      upcoming: upcomingTasks,
      unscheduled: unscheduledTasks,
      completedToday: completedTodayTasks,
      active: activeTasks,
      totalRelevant: relevantTasks.length,
      doneCount: relevantTasks.filter((task) => task.status === "done").length,
      hasHighPriorityActive: activeTasks.some((task) => task.priority === "high"),
      contextById: taskContextById,
    },
    habits: {
      all: snapshot.habits,
      dueToday,
      completedToday,
      incompleteToday,
      notDueToday,
      completedIds,
      timesPerWeekCounts,
      weeklyProgressById,
      completedCount: completedToday.length,
    },
    reflection: {
      existingTodayEntry: snapshot.todayEntry,
      hasReflection: Boolean(snapshot.todayEntry),
    },
    context: {
      taskProjects: snapshot.taskProjects,
      taskGoalLinks: snapshot.taskGoalLinks,
      linkedGoals: snapshot.linkedGoals,
      projectTasks: snapshot.projectTasks,
      goalPreviewGoals: snapshot.linkedGoals.map((goal) => ({ id: goal.id, status: goal.status ?? "", target_date: goal.target_date ?? null })),
      goalPreviewMilestones: snapshot.goalPreviewMilestones,
      goalPreviewLinks: snapshot.goalPreviewLinks,
      goalWithoutLinks,
    },
    nextActionInputs: {
      overdueTasks,
      dueTodayTasks,
      incompleteHabits: incompleteToday,
      hasHighPriorityTasks: activeTasks.some((task) => task.priority === "high"),
      hasGoalWithoutLinks: goalWithoutLinks,
    },
    status: {
      loading: false,
      error: null,
      userId: null,
      lastLoadedLocalDate: date.localDate,
    },
    xp: {
      today: snapshot.todayXp,
      total: snapshot.totalXp,
    },
    intendedUse: snapshot.intendedUse,
  };
}
