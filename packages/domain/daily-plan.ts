// Daily planning domain (PLAN V1 — Prompt 2/3).
// Morning Plan (Daily Big 3 + Daily Must Win), deterministic candidate
// ranking, Midday Reset adjustment semantics, and minimal change history
// for later Weekly Review. Pure rules shared by web and mobile.

import { MAX_PRIORITIES_PER_DAY } from "./today-priorities.ts";
import { getLocalTodayDateString } from "./streaks.ts";

/** Daily Big 3 cap — same contract as today_priorities positions. */
export const MAX_DAILY_PRIORITIES = MAX_PRIORITIES_PER_DAY;

export type PriorityReferenceKind = "task" | "habit" | "outcome" | "text";

export interface DailyPriority {
  id: string;
  user_id: string;
  local_date: string; // YYYY-MM-DD (local)
  position: number; // 1-3
  text: string;
  task_id: string | null;
  habit_id: string | null;
  outcome_id: string | null;
  is_must_win: boolean;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface MorningCandidate {
  kind: Exclude<PriorityReferenceKind, "text">;
  id: string;
  title: string;
  reason: string;
}

export interface DayPlanSummary {
  planned: string[];
  completed: string[];
  remaining: string[];
  mustWin: string | null;
  total: number;
  doneCount: number;
}

export type DailyPlanEventType =
  | "morning_plan_confirmed"
  | "priority_added"
  | "priority_removed"
  | "priority_replaced"
  | "must_win_changed"
  | "midday_reset";

export const DAILY_PLAN_EVENT_TYPES: DailyPlanEventType[] = [
  "morning_plan_confirmed",
  "priority_added",
  "priority_removed",
  "priority_replaced",
  "must_win_changed",
  "midday_reset",
];

export interface DailyPlanEvent {
  id: string;
  user_id: string;
  local_date: string;
  event_type: DailyPlanEventType;
  priority_id: string | null;
  detail: string | null;
  created_at: string;
}

/** Which single reference a priority carries (at most one; text always set). */
export function priorityReferenceKind(p: Pick<DailyPriority, "task_id" | "habit_id" | "outcome_id">): PriorityReferenceKind {
  if (p.task_id) return "task";
  if (p.habit_id) return "habit";
  if (p.outcome_id) return "outcome";
  return "text";
}

/** Smallest free priority position (1-3), or null when the day is full. */
export function nextPriorityPosition(priorities: Pick<DailyPriority, "position">[]): number | null {
  const taken = new Set(priorities.map((p) => p.position));
  for (let position = 1; position <= MAX_DAILY_PRIORITIES; position += 1) {
    if (!taken.has(position)) return position;
  }
  return null;
}

/** Canonical priority ordering: position 1-3. */
export function orderDailyPriorities<T extends Pick<DailyPriority, "position">>(priorities: T[]): T[] {
  return [...priorities].sort((a, b) => a.position - b.position);
}

export interface PriorityDraft {
  text: string;
  task_id?: string | null;
  habit_id?: string | null;
  outcome_id?: string | null;
}

/** Insert payload: trimmed non-blank text, at most one reference, position 1-3. */
export function buildPriorityInsert(
  userId: string,
  localDate: string,
  position: number,
  draft: PriorityDraft,
): Record<string, unknown> | null {
  const text = draft.text.trim();
  if (!text || position < 1 || position > MAX_DAILY_PRIORITIES) return null;
  const refs = [draft.task_id, draft.habit_id, draft.outcome_id].filter(Boolean);
  if (refs.length > 1) return null;
  return {
    user_id: userId,
    local_date: localDate,
    position,
    text: text.slice(0, 120),
    task_id: draft.task_id ?? null,
    habit_id: draft.habit_id ?? null,
    outcome_id: draft.outcome_id ?? null,
  };
}

export interface PriorityEdits {
  text?: string;
  done?: boolean;
  is_must_win?: boolean;
}

/** Update payload; null when nothing changes (short-circuit, no write). */
export function buildPriorityUpdate(
  current: Pick<DailyPriority, "text" | "done" | "is_must_win">,
  edits: PriorityEdits,
): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};
  if (edits.text !== undefined) {
    const next = edits.text.trim();
    if (!next) return null;
    if (next !== current.text) payload.text = next.slice(0, 120);
  }
  if (edits.done !== undefined && edits.done !== current.done) payload.done = edits.done;
  if (edits.is_must_win !== undefined && edits.is_must_win !== current.is_must_win) {
    payload.is_must_win = edits.is_must_win;
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

/** Client-side Daily Must Win invariant: exactly the chosen priority flagged. */
export function applyDailyMustWin<T extends Pick<DailyPriority, "id" | "is_must_win">>(
  priorities: T[],
  priorityId: string | null,
): T[] {
  return priorities.map((p) => ({ ...p, is_must_win: priorityId !== null && p.id === priorityId }));
}

/** Validate a day's priorities; empty = valid. */
export function validateDayPriorities(priorities: Pick<DailyPriority, "position" | "text" | "is_must_win" | "task_id" | "habit_id" | "outcome_id">[]): string[] {
  const problems: string[] = [];
  if (priorities.length > MAX_DAILY_PRIORITIES) problems.push(`at most ${MAX_DAILY_PRIORITIES} priorities`);
  const positions = priorities.map((p) => p.position);
  if (positions.some((p) => p < 1 || p > MAX_DAILY_PRIORITIES)) problems.push("positions must be 1-3");
  if (new Set(positions).size !== positions.length) problems.push("positions must be unique");
  for (const p of priorities) {
    if (!p.text.trim()) problems.push("priority text must not be blank");
    const refs = [p.task_id, p.habit_id, p.outcome_id].filter(Boolean);
    if (refs.length > 1) problems.push("priority references at most one item");
  }
  if (priorities.filter((p) => p.is_must_win).length > 1) problems.push("at most one Daily Must Win");
  return problems;
}

export interface CandidateTask {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
  outcome_id?: string | null;
  outcome_title?: string | null;
  supportsWeeklyMustWin?: boolean;
}

export interface CandidateHabit {
  id: string;
  title: string;
}

export interface CandidateOutcome {
  id: string;
  title: string;
  done: boolean;
}

/**
 * Deterministic Morning Plan candidates, ordered and explainable.
 * Priority: overdue tasks → due-today tasks → weekly-outcome work →
 * due habits → unfinished weekly outcomes. Already-planned items excluded.
 * No scores, no AI — reasons are human-readable.
 */
export function rankMorningCandidates(input: {
  tasks: CandidateTask[];
  habitsDue: CandidateHabit[];
  outcomes: CandidateOutcome[];
  localDate: string;
  plannedTaskIds: Set<string>;
  plannedHabitIds: Set<string>;
  plannedOutcomeIds: Set<string>;
}): MorningCandidate[] {
  const { tasks, habitsDue, outcomes, localDate, plannedTaskIds, plannedHabitIds, plannedOutcomeIds } = input;
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open
    .filter((t) => t.due_date !== null && t.due_date < localDate && !plannedTaskIds.has(t.id))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const dueToday = open
    .filter((t) => t.due_date === localDate && !plannedTaskIds.has(t.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const outcomeWork = open
    .filter((t) => t.outcome_id && !plannedTaskIds.has(t.id) && !overdue.includes(t) && !dueToday.includes(t))
    .sort((a, b) => a.title.localeCompare(b.title));
  const candidates: MorningCandidate[] = [];
  for (const t of overdue) {
    candidates.push({
      kind: "task",
      id: t.id,
      title: t.title,
      reason: t.supportsWeeklyMustWin ? "Overdue · supports this week's Must Win" : "Overdue",
    });
  }
  for (const t of dueToday) {
    candidates.push({
      kind: "task",
      id: t.id,
      title: t.title,
      reason: t.supportsWeeklyMustWin ? "Due today · supports this week's Must Win" : "Due today",
    });
  }
  for (const t of outcomeWork) {
    candidates.push({
      kind: "task",
      id: t.id,
      title: t.title,
      reason: t.outcome_title ? `Supports: ${t.outcome_title}` : "Supports this week",
    });
  }
  for (const h of habitsDue) {
    if (plannedHabitIds.has(h.id)) continue;
    candidates.push({ kind: "habit", id: h.id, title: h.title, reason: "Due today" });
  }
  for (const o of outcomes) {
    if (o.done || plannedOutcomeIds.has(o.id)) continue;
    candidates.push({ kind: "outcome", id: o.id, title: o.title, reason: "Weekly outcome" });
  }
  return candidates;
}

/** Factual day summary for Today + Evening Shutdown: counts and titles only. */
export function summarizeDayPlan(priorities: Pick<DailyPriority, "text" | "done" | "is_must_win">[]): DayPlanSummary {
  const planned = priorities.map((p) => p.text);
  const completed = priorities.filter((p) => p.done).map((p) => p.text);
  const remaining = priorities.filter((p) => !p.done).map((p) => p.text);
  const mustWin = priorities.find((p) => p.is_must_win)?.text ?? null;
  return { planned, completed, remaining, mustWin, total: priorities.length, doneCount: completed.length };
}

/** Append-only history event payload (Keep-plan writes nothing). */
export function buildPlanEventInsert(
  userId: string,
  localDate: string,
  eventType: DailyPlanEventType,
  priorityId?: string | null,
  detail?: string | null,
): Record<string, unknown> | null {
  if (!DAILY_PLAN_EVENT_TYPES.includes(eventType)) return null;
  return {
    user_id: userId,
    local_date: localDate,
    event_type: eventType,
    priority_id: priorityId ?? null,
    detail: detail && detail.trim() ? detail.trim().slice(0, 280) : null,
  };
}

/** Today's local date for plan reads/writes (single shared semantic). */
export function getDayPlanDate(todayString: string = getLocalTodayDateString()): string {
  return todayString;
}
