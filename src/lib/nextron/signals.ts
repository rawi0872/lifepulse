import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { runNextronCalendarReadOnly } from "@/lib/nextron/calendar";
import type { NextronUserRequest } from "@/lib/nextron/coach";
import type { NextronPermissionState } from "@/lib/nextron/context";
import { isNextronContextAllowed } from "@/lib/nextron/context";
import type { NextronEvidencePacket } from "@/lib/nextron/evidence";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { isHabitDueOnDate } from "@/lib/streaks";

export type NextronSignalType = "deadline_overdue" | "project_stall" | "habit_interruption" | "review_gap" | "calendar_pressure" | "free_block" | "open_loop_cluster";
export type NextronSignalSeverity = "info" | "attention" | "important";
export type NextronSignalSource = "Today" | "Tasks" | "Habits" | "Projects" | "Calendar" | "Weekly Review";

export interface NextronSignal {
  id: string;
  type: NextronSignalType;
  severity: NextronSignalSeverity;
  title: string;
  summary: string;
  evidence: string[];
  sourceTypes: NextronSignalSource[];
  observedAt: string;
  validForLocalDate: string;
  route: "/today" | "/tasks" | "/habits" | "/projects" | "/weekly-review" | "/settings";
  bridgePrompt: string;
}

interface SignalTaskRow {
  id: string;
  title: string | null;
  priority: string | null;
  due_date: string | null;
  status: string | null;
  completed_at: string | null;
  created_at: string | null;
  project_id: string | null;
  projects?: { title: string | null; status: string | null; updated_at: string | null; deadline: string | null } | Array<{ title: string | null; status: string | null; updated_at: string | null; deadline: string | null }> | null;
}

interface SignalProjectRow {
  id: string;
  title: string | null;
  status: string | null;
  updated_at: string | null;
  deadline: string | null;
}

interface SignalHabitRow {
  id: string;
  title: string | null;
  frequency: string;
  days_of_week: number[] | null;
  times_per_week: number | null;
}

interface SignalHabitLogRow { habit_id: string | null; completed_date: string | null }

export interface SignalCalendarEvent { title: string; startsAt: string; endsAt: string | null; allDay: boolean }

export interface SignalEvidence {
  localDate: string;
  weekStart: string;
  observedAt: string;
  permissions: NextronPermissionState;
  packet: Pick<NextronEvidencePacket, "today" | "tasks" | "habits" | "projects" | "weeklyReview">;
  tasks: Array<{ id: string; title: string; priority: string; dueDate: string | null; status: string; completedAt: string | null; createdAt: string | null; projectId: string | null; projectTitle: string | null; projectStatus: string | null; projectUpdatedAt: string | null; projectDeadline: string | null }>;
  projects: Array<{ id: string; title: string; status: string; updatedAt: string | null; deadline: string | null }>;
  habits: Array<{ id: string; title: string; frequency: string; daysOfWeek: number[] | null; timesPerWeek: number | null }>;
  habitLogs: Array<{ habitId: string; completedDate: string }>;
  calendar: { status: "available"; events: SignalCalendarEvent[] } | { status: "permission_denied" | "unavailable" | "disconnected" | "reconnect_required"; events: [] };
}

export const NEXTRON_SIGNAL_LIMITS = {
  maxVisible: 5,
  projectStallDays: 8,
  habitMisses: 2,
  openLoopClusterSize: 3,
  overdueClusterSize: 2,
  reviewExpectedDay: 5,
  calendarPressureEventCount: 4,
  freeBlockMinutes: 90,
  calendarDayEndHour: 18,
} as const;

function todayCalendarRequest(): NextronUserRequest {
  return { rawPrompt: "What do I have today?", normalizedPrompt: "what do i have today", intent: "CALENDAR_QUERY", handlingStatus: "handled", confidence: "high" };
}

function cleanText(value: string | null | undefined, max = 90): string {
  const text = value?.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>`]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+/g, " ").replace(/\b(ignore|reveal|system prompt|developer message|secret)\b/gi, " ").replace(/\s+/g, " ").trim() ?? "";
  return (text || "Untitled").slice(0, max);
}

function projectOf(row: SignalTaskRow) {
  return Array.isArray(row.projects) ? row.projects[0] : row.projects;
}

function dateDaysAgo(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDay(dateString: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start" ? new Date(year, month - 1, day, 0, 0, 0, 0) : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

export async function buildNextronSignalEvidence(args: { supabase: SupabaseClient; userId: string; permissions: NextronPermissionState; packet: NextronEvidencePacket }): Promise<SignalEvidence> {
  const { supabase, userId, permissions, packet } = args;
  const localDate = getTodayDateString();
  const weekStart = getWeekStartDate();
  const lookbackStart = dateDaysAgo(localDate, NEXTRON_SIGNAL_LIMITS.projectStallDays + 2);
  const [taskResult, projectResult, habitResult, calendarResult] = await Promise.allSettled([
    isNextronContextAllowed(permissions, "tasks")
      ? supabase
          .from("tasks")
          .select("id, title, priority, due_date, status, completed_at, created_at, project_id, projects(title,status,updated_at,deadline)")
          .eq("user_id", userId)
          .or(`status.eq.todo,completed_at.gte.${toLocalDateBoundaryIso(lookbackStart, "start")}`)
          .order("created_at", { ascending: false })
          .limit(160)
      : Promise.resolve(null),
    isNextronContextAllowed(permissions, "projects")
      ? supabase.from("projects").select("id, title, status, updated_at, deadline").eq("user_id", userId).limit(80)
      : Promise.resolve(null),
    isNextronContextAllowed(permissions, "habits")
      ? Promise.all([
          supabase.from("habits").select("id, title, frequency, days_of_week, times_per_week").eq("user_id", userId).limit(100),
          supabase.from("habit_logs").select("habit_id, completed_date").eq("user_id", userId).gte("completed_date", dateDaysAgo(localDate, 10)).lte("completed_date", localDate).limit(500),
        ])
      : Promise.resolve(null),
    runNextronCalendarReadOnly({ supabase, userId, permissions, request: todayCalendarRequest() }),
  ]);

  const taskRows = taskResult.status === "fulfilled" && taskResult.value && !taskResult.value.error ? (taskResult.value.data ?? []) as unknown as SignalTaskRow[] : [];
  const projectRows = projectResult.status === "fulfilled" && projectResult.value && !projectResult.value.error ? (projectResult.value.data ?? []) as SignalProjectRow[] : [];
  const [habitRows, logRows] = habitResult.status === "fulfilled" && habitResult.value && Array.isArray(habitResult.value) && !habitResult.value[0].error && !habitResult.value[1].error
    ? [(habitResult.value[0].data ?? []) as SignalHabitRow[], (habitResult.value[1].data ?? []) as SignalHabitLogRow[]]
    : [[], []];
  const calendar = calendarResult.status === "fulfilled"
    ? calendarResult.value.ok
      ? { status: "available" as const, events: calendarResult.value.events.map((event) => ({ title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay })).slice(0, 12) }
      : { status: permissions.calendar !== "allowed" ? "permission_denied" as const : calendarResult.value.reason === "DISCONNECTED" ? "disconnected" as const : calendarResult.value.reason === "RECONNECT_REQUIRED" ? "reconnect_required" as const : "unavailable" as const, events: [] as [] }
    : { status: permissions.calendar !== "allowed" ? "permission_denied" as const : "unavailable" as const, events: [] as [] };

  return {
    localDate,
    weekStart,
    observedAt: new Date().toISOString(),
    permissions,
    packet,
    tasks: taskRows.map((row) => {
      const project = projectOf(row);
      return {
        id: row.id,
        title: cleanText(row.title),
        priority: cleanText(row.priority, 20).toLowerCase(),
        dueDate: row.due_date && /^\d{4}-\d{2}-\d{2}$/.test(row.due_date) ? row.due_date : null,
        status: row.status ?? "todo",
        completedAt: row.completed_at,
        createdAt: row.created_at,
        projectId: row.project_id,
        projectTitle: project ? cleanText(project.title) : null,
        projectStatus: project?.status ?? null,
        projectUpdatedAt: project?.updated_at ?? null,
        projectDeadline: project?.deadline ?? null,
      };
    }),
    projects: projectRows.map((project) => ({ id: project.id, title: cleanText(project.title), status: project.status ?? "active", updatedAt: project.updated_at, deadline: project.deadline })),
    habits: habitRows.map((habit) => ({ id: habit.id, title: cleanText(habit.title), frequency: habit.frequency, daysOfWeek: habit.days_of_week, timesPerWeek: habit.times_per_week })),
    habitLogs: logRows.filter((log): log is { habit_id: string; completed_date: string } => Boolean(log.habit_id && log.completed_date)).map((log) => ({ habitId: log.habit_id, completedDate: log.completed_date })),
    calendar,
  };
}

function signal(init: Omit<NextronSignal, "observedAt" | "validForLocalDate">, evidence: SignalEvidence): NextronSignal {
  return { ...init, observedAt: evidence.observedAt, validForLocalDate: evidence.localDate };
}

function taskBucket(task: SignalEvidence["tasks"][number], localDate: string): "overdue" | "due_today" | "future" | "unscheduled" {
  if (!task.dueDate) return "unscheduled";
  if (task.dueDate < localDate) return "overdue";
  if (task.dueDate === localDate) return "due_today";
  return "future";
}

function detectDeadlineSignals(evidence: SignalEvidence): NextronSignal[] {
  if (!isNextronContextAllowed(evidence.permissions, "tasks")) return [];
  const openTasks = evidence.tasks.filter((task) => task.status === "todo");
  const overdue = openTasks.filter((task) => taskBucket(task, evidence.localDate) === "overdue");
  const highOverdue = overdue.filter((task) => task.priority === "high");
  if (highOverdue.length > 0) {
    const task = highOverdue[0];
    return [signal({ id: "deadline:high-overdue", type: "deadline_overdue", severity: "important", title: "High-priority work is overdue", summary: `${task.title} is overdue and marked high priority.`, evidence: [`${highOverdue.length} high-priority overdue task${highOverdue.length === 1 ? "" : "s"}.`], sourceTypes: ["Tasks"], route: "/tasks", bridgePrompt: "Why does this overdue task matter?" }, evidence)];
  }
  if (overdue.length >= 2) {
    return [signal({ id: "deadline:multiple-overdue", type: "deadline_overdue", severity: "attention", title: "Overdue work is accumulating", summary: `${overdue.length} open tasks are past their due date.`, evidence: overdue.slice(0, 3).map((task) => task.title), sourceTypes: ["Tasks"], route: "/tasks", bridgePrompt: "What should I do about this overdue work?" }, evidence)];
  }
  return [];
}

function detectProjectSignals(evidence: SignalEvidence): NextronSignal[] {
  if (!isNextronContextAllowed(evidence.permissions, "projects") || !isNextronContextAllowed(evidence.permissions, "tasks")) return [];
  const openByProject = new Map<string, SignalEvidence["tasks"]>();
  for (const task of evidence.tasks.filter((item) => item.status === "todo" && item.projectId && item.projectStatus === "active")) {
    openByProject.set(task.projectId!, [...(openByProject.get(task.projectId!) ?? []), task]);
  }
  const candidates: NextronSignal[] = [];
  for (const [projectId, tasks] of openByProject) {
    const projectTitle = tasks[0]?.projectTitle ?? "Active project";
    const overdue = tasks.filter((task) => taskBucket(task, evidence.localDate) === "overdue");
    if (tasks.length >= NEXTRON_SIGNAL_LIMITS.openLoopClusterSize || overdue.length >= NEXTRON_SIGNAL_LIMITS.overdueClusterSize) {
      candidates.push(signal({ id: `cluster:${projectId}`, type: "open_loop_cluster", severity: overdue.length >= NEXTRON_SIGNAL_LIMITS.overdueClusterSize ? "important" : "attention", title: "Unfinished work is concentrated", summary: `${projectTitle} has ${tasks.length} open linked task${tasks.length === 1 ? "" : "s"}${overdue.length ? `, including ${overdue.length} overdue` : ""}.`, evidence: tasks.slice(0, 3).map((task) => task.title), sourceTypes: ["Projects", "Tasks"], route: "/projects", bridgePrompt: `What should I do about ${projectTitle}?` }, evidence));
      continue;
    }
    const cutoff = dateDaysAgo(evidence.localDate, NEXTRON_SIGNAL_LIMITS.projectStallDays);
    const updatedDay = localDay(tasks[0]?.projectUpdatedAt ?? null);
    const recentCompleted = evidence.tasks.some((task) => task.projectId === projectId && task.status === "done" && localDay(task.completedAt) && localDay(task.completedAt)! >= cutoff);
    if (updatedDay && updatedDay < cutoff && !recentCompleted) {
      candidates.push(signal({ id: `stall:${projectId}`, type: "project_stall", severity: "attention", title: "Active project looks quiet", summary: `${projectTitle} has open work but no completed linked task or project update in ${NEXTRON_SIGNAL_LIMITS.projectStallDays} days.`, evidence: [`${tasks.length} open linked task${tasks.length === 1 ? "" : "s"}.`, `Last project update before ${cutoff}.`], sourceTypes: ["Projects", "Tasks"], route: "/projects", bridgePrompt: `Why does ${projectTitle} look stalled?` }, evidence));
    }
  }
  return candidates;
}

function fixedScheduleMisses(habit: SignalEvidence["habits"][number], logs: Set<string>, localDate: string): string[] {
  if (habit.frequency === "times_per_week" || habit.frequency === "weekly") return [];
  const missed: string[] = [];
  for (let offset = 0; offset < 7 && missed.length < NEXTRON_SIGNAL_LIMITS.habitMisses; offset++) {
    const date = dateDaysAgo(localDate, offset);
    if (isHabitDueOnDate({ frequency: habit.frequency, days_of_week: habit.daysOfWeek, times_per_week: habit.timesPerWeek }, date, [...logs]) && !logs.has(date)) missed.push(date);
    else if (missed.length > 0) break;
  }
  return missed;
}

function detectHabitSignals(evidence: SignalEvidence): NextronSignal[] {
  if (!isNextronContextAllowed(evidence.permissions, "habits")) return [];
  const signals: NextronSignal[] = [];
  for (const habit of evidence.habits) {
    const logs = new Set(evidence.habitLogs.filter((log) => log.habitId === habit.id).map((log) => log.completedDate));
    const missed = fixedScheduleMisses(habit, logs, evidence.localDate);
    if (missed.length >= NEXTRON_SIGNAL_LIMITS.habitMisses) {
      signals.push(signal({ id: `habit:${habit.id}`, type: "habit_interruption", severity: "attention", title: "Routine interruption", summary: `${habit.title} has been missed for ${missed.length} consecutive expected days.`, evidence: missed.map((date) => `Expected on ${date}; no completion recorded.`), sourceTypes: ["Habits"], route: "/habits", bridgePrompt: `What should I do about ${habit.title}?` }, evidence));
    }
  }
  return signals.slice(0, 2);
}

function detectReviewSignal(evidence: SignalEvidence): NextronSignal[] {
  if (!isNextronContextAllowed(evidence.permissions, "weeklyReview")) return [];
  const day = new Date(`${evidence.localDate}T12:00:00`).getDay();
  if (day < NEXTRON_SIGNAL_LIMITS.reviewExpectedDay || evidence.packet.weeklyReview.data?.existsThisWeek) return [];
  return [signal({ id: "review:weekly-gap", type: "review_gap", severity: "info", title: "Weekly Review window is open", summary: "No Weekly Review is saved for the current review window.", evidence: [`Current week starts ${evidence.weekStart}.`], sourceTypes: ["Weekly Review"], route: "/weekly-review", bridgePrompt: "What should I review this week?" }, evidence)];
}

function eventBounds(event: SignalCalendarEvent): { start: number; end: number } | null {
  if (event.allDay) return null;
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt ?? event.startsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function detectCalendarSignals(evidence: SignalEvidence): NextronSignal[] {
  if (!isNextronContextAllowed(evidence.permissions, "calendar") || evidence.calendar.status !== "available") return [];
  const dueWork = evidence.tasks.filter((task) => task.status === "todo" && (taskBucket(task, evidence.localDate) === "overdue" || taskBucket(task, evidence.localDate) === "due_today")).length;
  const timed = evidence.calendar.events.map(eventBounds).filter((item): item is { start: number; end: number } => Boolean(item)).sort((a, b) => a.start - b.start);
  const signals: NextronSignal[] = [];
  const busyMinutes = timed.reduce((total, event) => total + Math.max(0, event.end - event.start) / 60000, 0);
  if ((timed.length >= NEXTRON_SIGNAL_LIMITS.calendarPressureEventCount || busyMinutes >= 300) && dueWork >= 2) {
    signals.push(signal({ id: "calendar:pressure", type: "calendar_pressure", severity: "attention", title: "Calendar pressure around due work", summary: "Today has limited open time relative to remaining due or overdue work.", evidence: [`${timed.length} timed Calendar commitment${timed.length === 1 ? "" : "s"}.`, `${dueWork} due or overdue task${dueWork === 1 ? "" : "s"}.`], sourceTypes: ["Calendar", "Tasks"], route: "/today", bridgePrompt: "How should I plan around today's Calendar pressure?" }, evidence));
  }
  const now = Date.now();
  const [year, month, day] = evidence.localDate.split("-").map(Number);
  let cursor = Math.max(now, new Date(year, month - 1, day, 8, 0, 0, 0).getTime());
  const dayEnd = new Date(year, month - 1, day, NEXTRON_SIGNAL_LIMITS.calendarDayEndHour, 0, 0, 0).getTime();
  for (const event of timed) {
    if (event.end <= cursor) continue;
    const gapMinutes = Math.floor((event.start - cursor) / 60000);
    if (gapMinutes >= NEXTRON_SIGNAL_LIMITS.freeBlockMinutes) {
      signals.push(signal({ id: "calendar:free-block", type: "free_block", severity: "info", title: "Useful open block today", summary: `There is a ${gapMinutes}-minute open block before the next fixed commitment.`, evidence: [`Open block starts around ${formatTimeIso(new Date(cursor).toISOString())}.`], sourceTypes: ["Calendar"], route: "/today", bridgePrompt: "What could fit into this open block?" }, evidence));
      break;
    }
    cursor = Math.max(cursor, event.end);
  }
  if (!signals.some((item) => item.type === "free_block")) {
    const gapMinutes = Math.floor((dayEnd - cursor) / 60000);
    if (gapMinutes >= NEXTRON_SIGNAL_LIMITS.freeBlockMinutes) signals.push(signal({ id: "calendar:free-block", type: "free_block", severity: "info", title: "Useful open block today", summary: `There is a ${gapMinutes}-minute open block later today.`, evidence: [`Open block starts around ${formatTimeIso(new Date(cursor).toISOString())}.`], sourceTypes: ["Calendar"], route: "/today", bridgePrompt: "What could fit into this open block?" }, evidence));
  }
  return signals;
}

function formatTimeIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unavailable" : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function severityRank(severity: NextronSignalSeverity): number {
  return severity === "important" ? 3 : severity === "attention" ? 2 : 1;
}

export function deriveNextronSignals(evidence: SignalEvidence): NextronSignal[] {
  const candidates = [
    ...detectDeadlineSignals(evidence),
    ...detectProjectSignals(evidence),
    ...detectHabitSignals(evidence),
    ...detectReviewSignal(evidence),
    ...detectCalendarSignals(evidence),
  ];
  const deduped = new Map<string, NextronSignal>();
  for (const candidate of candidates) {
    const key = candidate.id.split(":").slice(0, 2).join(":");
    const existing = deduped.get(key);
    if (!existing || severityRank(candidate.severity) > severityRank(existing.severity)) deduped.set(key, candidate);
  }
  return [...deduped.values()]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.title.localeCompare(b.title))
    .slice(0, NEXTRON_SIGNAL_LIMITS.maxVisible);
}
