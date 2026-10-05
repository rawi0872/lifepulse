// Weekly planning domain (PLAN V1 — Prompt 1/3).
// Pure rules shared by web and mobile: local week range, outcome
// constraints, Must Win invariant, payload builders, honest evidence.
// No framework imports, no network calls.

import {
  dateToLocalDateString,
  getLocalTodayDateString,
  getWeekDatesForDate,
  getWeekStartForDate,
} from "./streaks.ts";
import {
  MAX_ITEM_TITLE_LENGTH,
  isValidItemTitle,
  normalizeItemTitle,
} from "./item-mutations.ts";

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD, always a Monday (local)
  week_end: string; // YYYY-MM-DD, always the following Sunday
  intention: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyOutcome {
  id: string;
  user_id: string;
  plan_id: string;
  position: number; // 1-3
  text: string;
  done: boolean;
  must_win: boolean;
  goal_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export type WeeklyPlanLinkType = "task" | "habit";

export interface WeeklyPlanLink {
  id: string;
  user_id: string;
  plan_id: string;
  linked_type: WeeklyPlanLinkType;
  linked_id: string;
  created_at: string;
}

export interface WeeklyPlanSnapshot {
  plan: WeeklyPlan;
  outcomes: WeeklyOutcome[];
  links: WeeklyPlanLink[];
}

/** Maximum Weekly Outcomes per plan — "what must be true by Friday". */
export const MAX_WEEKLY_OUTCOMES = 3;

/** Local calendar week (Monday..Sunday) containing the given local date. */
export function getPlanWeekRange(dateString: string): { weekStart: string; weekEnd: string } {
  const dates = getWeekDatesForDate(dateString);
  return { weekStart: dates[0], weekEnd: dates[6] };
}

/** Local calendar week containing today. */
export function getCurrentPlanWeekRange(todayString: string = getLocalTodayDateString()): {
  weekStart: string;
  weekEnd: string;
} {
  return getPlanWeekRange(todayString);
}

/** Monday week start for an arbitrary local date (same convention as Weekly Review). */
export function getPlanWeekStart(dateString: string): string {
  return getWeekStartForDate(dateString);
}

/** True when the date string is a Monday (a valid plan week start). */
export function isPlanWeekStart(dateString: string): boolean {
  return getWeekStartForDate(dateString) === dateString;
}

/** Smallest free outcome position (1-3), or null when the plan is full. */
export function nextOutcomePosition(outcomes: Pick<WeeklyOutcome, "position">[]): number | null {
  const taken = new Set(outcomes.map((o) => o.position));
  for (let position = 1; position <= MAX_WEEKLY_OUTCOMES; position += 1) {
    if (!taken.has(position)) return position;
  }
  return null;
}

/** Canonical outcome ordering: position 1-3. */
export function orderOutcomes<T extends Pick<WeeklyOutcome, "position">>(outcomes: T[]): T[] {
  return [...outcomes].sort((a, b) => a.position - b.position);
}

/** Outcome text follows the same title rules as tasks (trimmed, capped, never blank). */
export function isValidOutcomeText(text: string): boolean {
  return isValidItemTitle(text);
}

export function normalizeOutcomeText(text: string): string {
  return normalizeItemTitle(text);
}

export { MAX_ITEM_TITLE_LENGTH as MAX_WEEKLY_OUTCOME_LENGTH };

/** Client-side Must Win invariant: exactly the chosen outcome carries must_win. */
export function applyMustWin<T extends Pick<WeeklyOutcome, "id" | "must_win">>(
  outcomes: T[],
  outcomeId: string | null,
): T[] {
  return outcomes.map((o) => ({ ...o, must_win: outcomeId !== null && o.id === outcomeId }));
}

/** Validate a full snapshot; returns human-readable problems (empty = valid). */
export function validateWeeklyPlanSnapshot(snapshot: WeeklyPlanSnapshot): string[] {
  const problems: string[] = [];
  const { plan, outcomes, links } = snapshot;
  if (getPlanWeekStart(plan.week_start) !== plan.week_start) {
    problems.push("week_start must be a Monday");
  }
  const expectedEnd = getPlanWeekRange(plan.week_start).weekEnd;
  if (plan.week_end !== expectedEnd) {
    problems.push("week_end must be the Sunday of week_start");
  }
  if (outcomes.length > MAX_WEEKLY_OUTCOMES) {
    problems.push(`at most ${MAX_WEEKLY_OUTCOMES} outcomes`);
  }
  const positions = outcomes.map((o) => o.position);
  if (positions.some((p) => p < 1 || p > MAX_WEEKLY_OUTCOMES)) {
    problems.push("outcome positions must be 1-3");
  }
  if (new Set(positions).size !== positions.length) {
    problems.push("outcome positions must be unique");
  }
  for (const outcome of outcomes) {
    if (!isValidOutcomeText(outcome.text)) problems.push("outcome text must not be blank");
    if (outcome.plan_id !== plan.id) problems.push("outcome belongs to another plan");
  }
  if (outcomes.filter((o) => o.must_win).length > 1) {
    problems.push("at most one Must Win");
  }
  for (const link of links) {
    if (link.plan_id !== plan.id) problems.push("link belongs to another plan");
    if (link.linked_type !== "task" && link.linked_type !== "habit") {
      problems.push("links reference tasks or habits only");
    }
  }
  return problems;
}

export interface WeeklyPlanInsert {
  user_id: string;
  week_start: string;
  week_end: string;
  intention?: string | null;
}

/** Insert payload for one plan per user/week (intention optional). */
export function buildWeeklyPlanInsert(input: WeeklyPlanInsert): Record<string, unknown> {
  const range = getPlanWeekRange(input.week_start);
  return {
    user_id: input.user_id,
    week_start: range.weekStart,
    week_end: range.weekEnd,
    intention: input.intention?.trim() ? input.intention.trim() : null,
  };
}

export interface WeeklyOutcomeInsert {
  user_id: string;
  plan_id: string;
  position: number;
  text: string;
  goal_id?: string | null;
  project_id?: string | null;
}

/** Insert payload for a Weekly Outcome (never blank, position 1-3). */
export function buildWeeklyOutcomeInsert(input: WeeklyOutcomeInsert): Record<string, unknown> | null {
  if (input.position < 1 || input.position > MAX_WEEKLY_OUTCOMES) return null;
  if (!isValidOutcomeText(input.text)) return null;
  return {
    user_id: input.user_id,
    plan_id: input.plan_id,
    position: input.position,
    text: normalizeOutcomeText(input.text),
    goal_id: input.goal_id ?? null,
    project_id: input.project_id ?? null,
  };
}

export interface WeeklyOutcomeEdits {
  text?: string;
  done?: boolean;
  must_win?: boolean;
  goal_id?: string | null;
  project_id?: string | null;
}

/**
 * Update payload for a Weekly Outcome. Returns null when there is nothing
 * to change (or the text edit is blank) so callers short-circuit without a write.
 */
export function buildWeeklyOutcomeUpdate(
  current: Pick<WeeklyOutcome, "text" | "done" | "must_win" | "goal_id" | "project_id">,
  edits: WeeklyOutcomeEdits,
): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};
  if (edits.text !== undefined) {
    if (!isValidOutcomeText(edits.text)) return null;
    const next = normalizeOutcomeText(edits.text);
    if (next !== current.text) payload.text = next;
  }
  if (edits.done !== undefined && edits.done !== current.done) payload.done = edits.done;
  if (edits.must_win !== undefined && edits.must_win !== current.must_win) {
    payload.must_win = edits.must_win;
  }
  if (edits.goal_id !== undefined && edits.goal_id !== current.goal_id) {
    payload.goal_id = edits.goal_id;
  }
  if (edits.project_id !== undefined && edits.project_id !== current.project_id) {
    payload.project_id = edits.project_id;
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

export interface WeeklyPlanEvidence {
  linkedTasksTotal: number;
  linkedTasksDone: number;
  supportingHabitLogDays: number;
}

export interface EvidenceTask {
  id: string;
  status: string;
}

export interface EvidenceHabitLog {
  habit_id: string;
  completed_date: string;
}

/**
 * Honest evidence only: counts of linked completed tasks and habit-log days
 * inside the plan week. Never a score, never a percentage.
 */
export function summarizePlanEvidence(
  snapshot: WeeklyPlanSnapshot,
  tasks: EvidenceTask[],
  habitLogs: EvidenceHabitLog[],
): WeeklyPlanEvidence {
  const linkedTaskIds = new Set(
    snapshot.links.filter((l) => l.linked_type === "task").map((l) => l.linked_id),
  );
  const linkedHabitIds = new Set(
    snapshot.links.filter((l) => l.linked_type === "habit").map((l) => l.linked_id),
  );
  const linkedTasks = tasks.filter((t) => linkedTaskIds.has(t.id));
  const weekDays = new Set(
    habitLogs
      .filter((l) => linkedHabitIds.has(l.habit_id))
      .filter((l) => l.completed_date >= snapshot.plan.week_start && l.completed_date <= snapshot.plan.week_end)
      .map((l) => l.completed_date),
  );
  return {
    linkedTasksTotal: linkedTasks.length,
    linkedTasksDone: linkedTasks.filter((t) => t.status === "done").length,
    supportingHabitLogDays: weekDays.size,
  };
}

/** Local date string for week arithmetic in tests and clients. */
export function toPlanDateString(date: Date): string {
  return dateToLocalDateString(date);
}
