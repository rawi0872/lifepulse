import type { TodayHabit, TodayModel, TodayTask, TodayTaskExecutionContext } from "@/lib/today/types";

export interface TodayLocalPriority {
  id: string;
  text: string;
  done: boolean;
  taskId?: string;
}

export type MorningPlanFirstAction =
  | {
      type: "task";
      id: string;
      title: string;
      reason: "Top priority" | "Overdue" | "Due today" | "Active task";
      task: TodayTask;
      context?: TodayTaskExecutionContext;
    }
  | {
      type: "habit";
      id: string;
      title: string;
      reason: "Habit due today";
      habit: TodayHabit;
    };

function priorityRank(priority: string): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function taskOrderValue(task: TodayTask): string {
  return `${task.due_date ?? "9999-12-31"}|${task.id}`;
}

function sortActionTasks(tasks: TodayTask[]): TodayTask[] {
  return [...tasks].sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return taskOrderValue(a).localeCompare(taskOrderValue(b));
  });
}

function findPriorityTask(model: TodayModel, priorities: TodayLocalPriority[]): TodayTask | null {
  const activeTasks = model.tasks.active;
  for (const priority of priorities) {
    if (priority.done) continue;

    if (priority.taskId) {
      const linkedTask = activeTasks.find((task) => task.id === priority.taskId);
      if (linkedTask) return linkedTask;
      continue;
    }

    const matchingTitleTasks = activeTasks.filter((task) => task.title.trim().toLowerCase() === priority.text.trim().toLowerCase());
    const linkedTask = matchingTitleTasks.length === 1 ? matchingTitleTasks[0] : null;

    if (linkedTask) return linkedTask;
  }

  return null;
}

export function selectMorningPlanFirstAction(
  model: TodayModel,
  localPriorities: TodayLocalPriority[],
): MorningPlanFirstAction | null {
  const priorityTask = findPriorityTask(model, localPriorities);
  if (priorityTask) {
    return {
      type: "task",
      id: priorityTask.id,
      title: priorityTask.title,
      reason: "Top priority",
      task: priorityTask,
      context: model.tasks.contextById[priorityTask.id],
    };
  }

  const overdueTask = sortActionTasks(model.tasks.overdue)[0];
  if (overdueTask) {
    return {
      type: "task",
      id: overdueTask.id,
      title: overdueTask.title,
      reason: "Overdue",
      task: overdueTask,
      context: model.tasks.contextById[overdueTask.id],
    };
  }

  const dueTodayTask = sortActionTasks(model.tasks.dueToday)[0];
  if (dueTodayTask) {
    return {
      type: "task",
      id: dueTodayTask.id,
      title: dueTodayTask.title,
      reason: "Due today",
      task: dueTodayTask,
      context: model.tasks.contextById[dueTodayTask.id],
    };
  }

  const dueHabit = [...model.habits.incompleteToday].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))[0];
  if (dueHabit) {
    return {
      type: "habit",
      id: dueHabit.id,
      title: dueHabit.title,
      reason: "Habit due today",
      habit: dueHabit,
    };
  }

  const unscheduledTask = sortActionTasks(model.tasks.unscheduled)[0];
  if (unscheduledTask) {
    return {
      type: "task",
      id: unscheduledTask.id,
      title: unscheduledTask.title,
      reason: "Active task",
      task: unscheduledTask,
      context: model.tasks.contextById[unscheduledTask.id],
    };
  }

  return null;
}

export function getMorningPlanAttentionItems(model: TodayModel, limit = 5) {
  const items = [
    ...sortActionTasks(model.tasks.overdue).map((task) => ({ type: "task" as const, id: task.id, title: task.title, label: "Overdue" })),
    ...sortActionTasks(model.tasks.dueToday).map((task) => ({ type: "task" as const, id: task.id, title: task.title, label: "Due today" })),
    ...[...model.habits.incompleteToday]
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
      .map((habit) => ({ type: "habit" as const, id: habit.id, title: habit.title, label: "Habit" })),
  ];

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}
