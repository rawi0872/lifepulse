export interface TaskLike {
  id: string;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  created_at?: string | null;
}

export interface TaskGroups<T extends TaskLike> {
  overdue: T[];
  dueToday: T[];
  upcoming: T[];
  unscheduled: T[];
  completedToday: T[];
  olderCompleted: T[];
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function isValidLocalDateString(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function hasInvalidTaskDueDate(value: string | null | undefined): boolean {
  return Boolean(value) && !isValidLocalDateString(value);
}

export function timestampToLocalDateString(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority] ?? 1;
}

function stableTaskCompare<T extends TaskLike>(a: T, b: T): number {
  if ((a.created_at ?? "") !== (b.created_at ?? "")) return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  return a.id.localeCompare(b.id);
}

function priorityThenStable<T extends TaskLike>(a: T, b: T): number {
  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  return priorityDiff !== 0 ? priorityDiff : stableTaskCompare(a, b);
}

export function groupTasksByDate<T extends TaskLike>(tasks: T[], localDate: string): TaskGroups<T> {
  const groups: TaskGroups<T> = {
    overdue: [],
    dueToday: [],
    upcoming: [],
    unscheduled: [],
    completedToday: [],
    olderCompleted: [],
  };

  tasks.forEach((task) => {
    if (task.status === "done") {
      if (timestampToLocalDateString(task.completed_at) === localDate) groups.completedToday.push(task);
      else groups.olderCompleted.push(task);
      return;
    }

    if (task.status !== "todo") return;

    if (!isValidLocalDateString(task.due_date)) {
      groups.unscheduled.push(task);
      return;
    }

    if (task.due_date < localDate) groups.overdue.push(task);
    else if (task.due_date === localDate) groups.dueToday.push(task);
    else groups.upcoming.push(task);
  });

  groups.overdue.sort((a, b) => {
    const dueDiff = (a.due_date ?? "").localeCompare(b.due_date ?? "");
    return dueDiff !== 0 ? dueDiff : priorityThenStable(a, b);
  });
  groups.dueToday.sort(priorityThenStable);
  groups.upcoming.sort((a, b) => {
    const dueDiff = (a.due_date ?? "").localeCompare(b.due_date ?? "");
    return dueDiff !== 0 ? dueDiff : priorityThenStable(a, b);
  });
  groups.unscheduled.sort(priorityThenStable);
  groups.completedToday.sort(stableTaskCompare);
  groups.olderCompleted.sort(stableTaskCompare);

  return groups;
}

export function formatTaskDueStatus(dueDate: string | null, localDate: string, isDone: boolean): string {
  if (isDone) return "Completed";
  if (hasInvalidTaskDueDate(dueDate)) return "Date needs review";
  if (!dueDate) return "Unscheduled";
  if (dueDate < localDate) return "Overdue";
  if (dueDate === localDate) return "Due today";
  return "Upcoming";
}
