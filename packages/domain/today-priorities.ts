// Today Priority domain types
// Shared between web and mobile for cross-device priority persistence.

export interface TodayPriority {
  id: string;
  user_id: string;
  local_date: string; // YYYY-MM-DD
  position: number; // 1-3
  text: string;
  task_id: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

/** Priority input for creating/updating priorities (no server-generated fields) */
export interface TodayPriorityInput {
  text: string;
  task_id?: string | null;
  done?: boolean;
}

/** Maximum number of priorities per user per day */
export const MAX_PRIORITIES_PER_DAY = 3;

/** Convert a TodayPriority to the TodayLocalPriority shape used by selectMorningPlanFirstAction */
export function toLocalPriority(priority: TodayPriority) {
  return {
    id: priority.id,
    text: priority.text,
    done: priority.done,
    taskId: priority.task_id ?? undefined,
  };
}

/** Validate priority position is within bounds */
export function isValidPosition(position: number): boolean {
  return position >= 1 && position <= MAX_PRIORITIES_PER_DAY;
}

/** Validate priority text is non-empty after trimming */
export function isValidPriorityText(text: string): boolean {
  return text.trim().length > 0;
}
