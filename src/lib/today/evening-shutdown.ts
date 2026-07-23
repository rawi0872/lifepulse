import type { TodayHabit, TodayModel, TodayTask } from "@/lib/today/types";

const EVENING_SHUTDOWN_START = "<!-- LIFE_PULSE_EVENING_SHUTDOWN_START -->";
const EVENING_SHUTDOWN_END = "<!-- LIFE_PULSE_EVENING_SHUTDOWN_END -->";
const WEEKLY_REVIEW_MARKER = "**Weekly Reflection (";

export interface EveningShutdownReflection {
  wentWell: string;
  gotInTheWay: string;
  learned: string;
  tomorrowSeed: string;
}

export interface EveningShutdownSummary {
  completedTaskCount: number;
  completedHabitCount: number;
  remainingDueTodayTaskCount: number;
  remainingOverdueTaskCount: number;
  remainingDueHabitCount: number;
  wins: { type: "task" | "habit"; id: string; title: string }[];
  openItems: { type: "task" | "habit"; id: string; title: string; label: "Overdue" | "Due today" | "Habit" }[];
}

interface EncodedEveningShutdownReflection {
  wentWell: string;
  gotInTheWay: string;
  learned: string;
  tomorrowSeed: string;
}

function priorityRank(priority: string): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function sortTasks(tasks: TodayTask[]): TodayTask[] {
  return [...tasks].sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    const dueDelta = (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31");
    if (dueDelta !== 0) return dueDelta;
    return a.id.localeCompare(b.id);
  });
}

function sortHabits(habits: TodayHabit[]): TodayHabit[] {
  return [...habits].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function buildEveningShutdownSummary(model: TodayModel): EveningShutdownSummary {
  const completedTasks = sortTasks(model.tasks.completedToday);
  const completedHabits = sortHabits(model.habits.completedToday);
  const overdueTasks = sortTasks(model.tasks.overdue);
  const dueTodayTasks = sortTasks(model.tasks.dueToday);
  const incompleteHabits = sortHabits(model.habits.incompleteToday);

  const wins = [
    ...completedTasks.map((task) => ({ type: "task" as const, id: task.id, title: task.title })),
    ...completedHabits.map((habit) => ({ type: "habit" as const, id: habit.id, title: habit.title })),
  ].slice(0, 5);

  const openItems = [
    ...overdueTasks.map((task) => ({ type: "task" as const, id: task.id, title: task.title, label: "Overdue" as const })),
    ...dueTodayTasks.map((task) => ({ type: "task" as const, id: task.id, title: task.title, label: "Due today" as const })),
    ...incompleteHabits.map((habit) => ({ type: "habit" as const, id: habit.id, title: habit.title, label: "Habit" as const })),
  ];

  const seen = new Set<string>();
  const dedupedOpenItems = openItems.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  return {
    completedTaskCount: completedTasks.length,
    completedHabitCount: completedHabits.length,
    remainingDueTodayTaskCount: dueTodayTasks.length,
    remainingOverdueTaskCount: overdueTasks.length,
    remainingDueHabitCount: incompleteHabits.length,
    wins,
    openItems: dedupedOpenItems,
  };
}

function cleanField(value: string): string {
  return value.trim().slice(0, 1000);
}

export function normalizeEveningShutdownReflection(reflection: EveningShutdownReflection): EveningShutdownReflection {
  return {
    wentWell: cleanField(reflection.wentWell),
    gotInTheWay: cleanField(reflection.gotInTheWay),
    learned: cleanField(reflection.learned),
    tomorrowSeed: cleanField(reflection.tomorrowSeed).slice(0, 240),
  };
}

export function buildEveningShutdownBlock(reflection: EveningShutdownReflection): string {
  const clean = normalizeEveningShutdownReflection(reflection);
  const encoded: EncodedEveningShutdownReflection = {
    wentWell: encodeURIComponent(clean.wentWell),
    gotInTheWay: encodeURIComponent(clean.gotInTheWay),
    learned: encodeURIComponent(clean.learned),
    tomorrowSeed: encodeURIComponent(clean.tomorrowSeed),
  };
  const lines = [EVENING_SHUTDOWN_START, JSON.stringify(encoded), EVENING_SHUTDOWN_END];

  return lines.join("\n").trim();
}

export function removeEveningShutdownBlock(content: string): string {
  const startIndex = content.indexOf(EVENING_SHUTDOWN_START);
  const endIndex = content.indexOf(EVENING_SHUTDOWN_END, startIndex + EVENING_SHUTDOWN_START.length);

  if (startIndex < 0 || endIndex <= startIndex) return content;

  const before = content.slice(0, startIndex).trimEnd();
  const after = content.slice(endIndex + EVENING_SHUTDOWN_END.length).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

export function mergeEveningShutdownBlock(existingContent: string, block: string): string {
  const existing = existingContent.trimEnd();
  if (!existing) return block;

  const startIndex = existing.indexOf(EVENING_SHUTDOWN_START);
  const endIndex = existing.indexOf(EVENING_SHUTDOWN_END, startIndex + EVENING_SHUTDOWN_START.length);

  if (startIndex >= 0 && endIndex > startIndex) {
    const before = existing.slice(0, startIndex).trimEnd();
    const after = existing.slice(endIndex + EVENING_SHUTDOWN_END.length).trimStart();
    return [before, block, after].filter(Boolean).join("\n\n");
  }

  const weeklyMarkerIndex = existing.indexOf(WEEKLY_REVIEW_MARKER);
  if (weeklyMarkerIndex >= 0) {
    const beforeWeeklyReview = existing.slice(0, weeklyMarkerIndex).trimEnd();
    const weeklyReviewAndAfter = existing.slice(weeklyMarkerIndex).trimStart();
    return [beforeWeeklyReview, block, weeklyReviewAndAfter].filter(Boolean).join("\n\n");
  }

  return `${existing}\n\n${block}`;
}

function extractSection(block: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\n${EVENING_SHUTDOWN_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|$)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseJsonReflection(block: string): EveningShutdownReflection | null {
  const body = block
    .replace(EVENING_SHUTDOWN_START, "")
    .replace(EVENING_SHUTDOWN_END, "")
    .trim();

  try {
    const parsed = JSON.parse(body) as Partial<EveningShutdownReflection>;
    return normalizeEveningShutdownReflection({
      wentWell: decodeStoredField(parsed.wentWell),
      gotInTheWay: decodeStoredField(parsed.gotInTheWay),
      learned: decodeStoredField(parsed.learned),
      tomorrowSeed: decodeStoredField(parsed.tomorrowSeed),
    });
  } catch {
    return null;
  }
}

function decodeStoredField(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseEveningShutdownReflection(content: string): EveningShutdownReflection {
  const startIndex = content.indexOf(EVENING_SHUTDOWN_START);
  const endIndex = content.indexOf(EVENING_SHUTDOWN_END, startIndex + EVENING_SHUTDOWN_START.length);

  if (startIndex < 0 || endIndex <= startIndex) {
    return { wentWell: "", gotInTheWay: "", learned: "", tomorrowSeed: "" };
  }

  const block = content.slice(startIndex, endIndex + EVENING_SHUTDOWN_END.length);
  const jsonReflection = parseJsonReflection(block);
  if (jsonReflection) return jsonReflection;

  return normalizeEveningShutdownReflection({
    wentWell: extractSection(block, "What went well"),
    gotInTheWay: extractSection(block, "What got in the way"),
    learned: extractSection(block, "What I learned"),
    tomorrowSeed: extractSection(block, "Tomorrow seed"),
  });
}
