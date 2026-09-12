// ---------------------------------------------------------------------------
// Life Pulse friction-v1 mutation helpers
// ---------------------------------------------------------------------------
// Deterministic, framework-free logic behind task/habit edit + delete flows:
// payload builders (update same row, never duplicate), optimistic-removal
// helpers, and a single-flight guard that prevents double-submit from
// repeated taps. Tested in apps/mobile/scripts/test-friction-v1.mjs.
// ---------------------------------------------------------------------------

import { isValidLocalDateString } from "./tasks";
import type { TodayHabit, TodayTask } from "./today/types";

export const MAX_ITEM_TITLE_LENGTH = 120;

export type TaskPriority = "high" | "medium" | "low";
export type HabitFrequency = "daily" | "weekdays" | "weekly";

const TASK_PRIORITIES: readonly string[] = ["high", "medium", "low"];
const HABIT_FREQUENCIES: readonly string[] = ["daily", "weekdays", "weekly"];

export function normalizeItemTitle(title: string): string {
  return title.trim().slice(0, MAX_ITEM_TITLE_LENGTH);
}

export function isValidItemTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_ITEM_TITLE_LENGTH;
}

export interface TaskEdits {
  title: string;
  priority: string;
  /** "" clears the due date; otherwise must be YYYY-MM-DD. */
  dueDate: string;
}

export interface TaskUpdate {
  title: string;
  priority: TaskPriority;
  due_date: string | null;
}

/**
 * Build the update payload for editing an existing task.
 * The row id is never part of the payload — callers must scope the update
 * with `.eq("id", current.id).eq("user_id", ownerId)` so the same row is
 * updated and no duplicate can be created.
 */
export function buildTaskUpdatePayload(
  current: Pick<TodayTask, "title" | "priority" | "due_date">,
  edits: TaskEdits,
): { ok: true; payload: TaskUpdate; changed: boolean } | { ok: false; error: string } {
  if (!isValidItemTitle(edits.title)) {
    return { ok: false, error: "Enter a title to save this task." };
  }
  const title = normalizeItemTitle(edits.title);
  const priority: TaskPriority = (TASK_PRIORITIES as readonly string[]).includes(edits.priority)
    ? (edits.priority as TaskPriority)
    : (TASK_PRIORITIES.includes(current.priority) ? (current.priority as TaskPriority) : "medium");

  let due_date: string | null = null;
  if (edits.dueDate.trim() !== "") {
    if (!isValidLocalDateString(edits.dueDate.trim())) {
      return { ok: false, error: "Due date must look like YYYY-MM-DD, or be left empty." };
    }
    due_date = edits.dueDate.trim();
  }

  const payload: TaskUpdate = { title, priority, due_date };
  const changed =
    payload.title !== current.title || payload.priority !== current.priority || payload.due_date !== current.due_date;
  return { ok: true, payload, changed };
}

export interface HabitEdits {
  title: string;
  frequency: string;
  daysOfWeek: number[];
  timesPerWeek: number;
}

export interface HabitUpdate {
  title: string;
  frequency: HabitFrequency;
  days_of_week: number[];
  /** Only meaningful for weekly habits; null clears a stale target. */
  times_per_week: number | null;
}

/**
 * Build the update payload for editing an existing habit definition.
 * Completion history (habit_logs) is never touched here — callers update
 * the habits row only, so streaks and Today presentation stay valid.
 */
export function buildHabitUpdatePayload(
  current: Pick<TodayHabit, "title" | "frequency" | "days_of_week" | "times_per_week">,
  edits: HabitEdits,
): { ok: true; payload: HabitUpdate; changed: boolean } | { ok: false; error: string } {
  if (!isValidItemTitle(edits.title)) {
    return { ok: false, error: "Enter a name to save this habit." };
  }
  const title = normalizeItemTitle(edits.title);
  const frequency: HabitFrequency = (HABIT_FREQUENCIES as readonly string[]).includes(edits.frequency)
    ? (edits.frequency as HabitFrequency)
    : "daily";
  const days_of_week = [...new Set(edits.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const times_per_week =
    frequency === "weekly" ? Math.min(7, Math.max(1, Math.floor(edits.timesPerWeek) || 1)) : null;

  const payload: HabitUpdate = { title, frequency, days_of_week, times_per_week };
  const currentDays = [...(current.days_of_week ?? [])].sort();
  const changed =
    payload.title !== current.title ||
    payload.frequency !== current.frequency ||
    JSON.stringify(payload.days_of_week) !== JSON.stringify(currentDays) ||
    payload.times_per_week !== (current.times_per_week ?? null);
  return { ok: true, payload, changed };
}

/** Optimistic removal after a confirmed delete; preserves order of the rest. */
export function removeDeletedById<T extends { id: string }>(items: T[], deletedId: string): T[] {
  return items.filter((item) => item.id !== deletedId);
}

/** True when the deleted row is gone from every list that could present it. */
export function isDeletedEverywhere<T extends { id: string }>(lists: T[][], deletedId: string): boolean {
  return lists.every((list) => list.every((item) => item.id !== deletedId));
}

// ---------------------------------------------------------------------------
// Single-flight guard — prevents duplicate requests from repeated taps.
// ---------------------------------------------------------------------------

export interface SingleFlight {
  readonly busy: boolean;
  /**
   * Runs `fn` unless another run is still pending. Returns `started: false`
   * (without invoking `fn`) when a previous run has not settled yet, so UI
   * handlers can simply ignore extra taps.
   */
  run<T>(fn: () => Promise<T>): Promise<{ started: boolean; result?: T }>;
}

export function createSingleFlight(): SingleFlight {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run<T>(fn: () => Promise<T>): Promise<{ started: boolean; result?: T }> {
      if (busy) return { started: false };
      busy = true;
      try {
        const result = await fn();
        return { started: true, result };
      } finally {
        busy = false;
      }
    },
  };
}
