// ---------------------------------------------------------------------------
// Shared behavioral fixtures for web ↔ mobile parity (convergence).
// ---------------------------------------------------------------------------
// Same input/output pairs both clients' adapters must satisfy. Consumed
// by scripts/test-parity-v1.mjs. Framework-free: plain data + expectations
// evaluated against @lifepulse/domain functions.
// ---------------------------------------------------------------------------

export interface FixtureTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: "todo" | "done";
}

export const FIXTURE_TODAY = "2026-09-22";

export const fixtureTasks: FixtureTask[] = [
  { id: "t-overdue-high", title: "Overdue high", priority: "high", due_date: "2026-09-20", status: "todo" },
  { id: "t-due-medium", title: "Due today", priority: "medium", due_date: FIXTURE_TODAY, status: "todo" },
  { id: "t-unscheduled", title: "Unscheduled", priority: "low", due_date: null, status: "todo" },
  { id: "t-done", title: "Done", priority: "high", due_date: FIXTURE_TODAY, status: "done" },
  { id: "t-bad-date", title: "Bad date", priority: "medium", due_date: "not-a-date", status: "todo" },
];

export const fixtureHabits = [
  { id: "h-daily", title: "Daily", frequency: "daily", days_of_week: [] as number[], times_per_week: null as number | null },
  { id: "h-weekdays", title: "Weekdays", frequency: "weekdays", days_of_week: [1, 3, 5], times_per_week: null },
  { id: "h-weekly", title: "Weekly", frequency: "weekly", days_of_week: [] as number[], times_per_week: 3 },
  // Legacy web row: must coerce to canonical weekly (preserving N) or daily.
  { id: "h-legacy-tpw", title: "Legacy", frequency: "times_per_week", days_of_week: null as unknown as number[], times_per_week: 2 },
];

export const EXPECTED_TASK_GROUPS = {
  overdue: ["t-overdue-high"],
  dueToday: ["t-due-medium"],
  unscheduled: ["t-unscheduled", "t-bad-date"],
};

export const EXPECTED_RANKING_WINNER = "t-overdue-high";

export const EXPECTED_NORMALIZED_SCHEDULES: Record<string, { frequency: string; days_of_week: number[]; times_per_week: number | null }> = {
  daily: { frequency: "daily", days_of_week: [], times_per_week: null },
  weekdays: { frequency: "weekdays", days_of_week: [1, 3, 5], times_per_week: null },
  weekly: { frequency: "weekly", days_of_week: [], times_per_week: 3 },
};
