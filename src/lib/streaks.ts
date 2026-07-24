// ---------------------------------------------------------------------------
// Life Pulse Habit Calendar Logic
// ---------------------------------------------------------------------------
// Pure helpers for local-calendar habit scheduling, completion, streaks, and
// weekly progress. All date strings are expected to be "YYYY-MM-DD".
// ---------------------------------------------------------------------------

export interface HabitSchedule {
  frequency: string;
  days_of_week?: number[] | null;
  times_per_week?: number | null;
}

export interface HabitWeeklyProgress {
  completed: number;
  target: number;
}

interface StreakOptions {
  asOfDate?: string;
}

const MAX_SCAN_DAYS = 4000;

export function isValidLocalDateString(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dateToLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getLocalTodayDateString(): string {
  return dateToLocalDateString(new Date());
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return dateToLocalDateString(date);
}

function addWeeks(dateString: string, weeks: number): string {
  return addDays(dateString, weeks * 7);
}

export function getWeekStartForDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.getFullYear(), date.getMonth(), diff, 12, 0, 0, 0);
  return dateToLocalDateString(monday);
}

export function getWeekDatesForDate(dateString: string): string[] {
  const weekStart = getWeekStartForDate(dateString);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function normalizeDaysOfWeek(daysOfWeek: number[] | null | undefined): Set<number> {
  return new Set((daysOfWeek ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
}

function targetForFlexibleWeek(schedule: HabitSchedule): number {
  if (schedule.frequency === "times_per_week") return Math.max(1, Math.min(7, Math.floor(schedule.times_per_week ?? 1)));
  if (schedule.frequency === "weekly") return 1;
  return 0;
}

function isFixedScheduledDate(dateString: string, schedule: HabitSchedule): boolean {
  if (!isValidLocalDateString(dateString)) return false;
  const day = parseLocalDate(dateString).getDay();

  if (schedule.frequency === "daily") return true;
  if (schedule.frequency === "weekdays") return normalizeDaysOfWeek(schedule.days_of_week).has(day);
  if (schedule.frequency === "weekends") return day === 0 || day === 6;
  return false;
}

export function normalizeCompletedDates(completedDates: (string | null | undefined)[], asOfDate = getLocalTodayDateString()): string[] {
  const completed = new Set<string>();
  completedDates.forEach((date) => {
    if (isValidLocalDateString(date) && date <= asOfDate) completed.add(date);
  });
  return [...completed].sort();
}

function countCompletionsInWeek(completed: Set<string>, weekStart: string, asOfDate: string, schedule: HabitSchedule): number {
  const weekDates = getWeekDatesForDate(weekStart);
  if (targetForFlexibleWeek(schedule) > 0) {
    return weekDates.filter((date) => date <= asOfDate && completed.has(date)).length;
  }

  return weekDates.filter((date) => date <= asOfDate && isFixedScheduledDate(date, schedule) && completed.has(date)).length;
}

export function isHabitDueOnDate(
  schedule: HabitSchedule,
  dateString: string,
  completedDates: (string | null | undefined)[] = [],
): boolean {
  if (!isValidLocalDateString(dateString)) return false;

  const flexibleTarget = targetForFlexibleWeek(schedule);
  if (flexibleTarget > 0) {
    const completed = new Set(normalizeCompletedDates(completedDates, dateString));
    const completedThisWeek = countCompletionsInWeek(completed, getWeekStartForDate(dateString), dateString, schedule);
    return completedThisWeek < flexibleTarget;
  }

  return isFixedScheduledDate(dateString, schedule);
}

function isWeekCompleted(completed: Set<string>, weekStart: string, asOfDate: string, schedule: HabitSchedule): boolean {
  const target = targetForFlexibleWeek(schedule);
  if (target <= 0) return false;
  return countCompletionsInWeek(completed, weekStart, asOfDate, schedule) >= target;
}

export function getCurrentStreak(
  completedDates: string[],
  frequency: string,
  daysOfWeek: number[] | null,
  options: StreakOptions = {},
): number {
  const asOfDate = isValidLocalDateString(options.asOfDate) ? options.asOfDate : getLocalTodayDateString();
  const schedule: HabitSchedule = { frequency, days_of_week: daysOfWeek };
  const completed = new Set(normalizeCompletedDates(completedDates, asOfDate));
  if (completed.size === 0 || frequency === "times_per_week") return 0;

  if (frequency === "weekly") {
    let cursorWeek = getWeekStartForDate(asOfDate);
    if (!isWeekCompleted(completed, cursorWeek, asOfDate, schedule)) cursorWeek = addWeeks(cursorWeek, -1);

    let streak = 0;
    for (let scanned = 0; scanned < Math.floor(MAX_SCAN_DAYS / 7); scanned++) {
      if (!isWeekCompleted(completed, cursorWeek, asOfDate, schedule)) break;
      streak++;
      cursorWeek = addWeeks(cursorWeek, -1);
    }
    return streak;
  }

  let cursor = asOfDate;
  if (isFixedScheduledDate(cursor, schedule) && !completed.has(cursor)) cursor = addDays(cursor, -1);

  let streak = 0;
  for (let scanned = 0; scanned < MAX_SCAN_DAYS; scanned++) {
    if (!isFixedScheduledDate(cursor, schedule)) {
      cursor = addDays(cursor, -1);
      continue;
    }

    if (!completed.has(cursor)) break;
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function getBestStreak(
  completedDates: string[],
  frequency: string,
  daysOfWeek: number[] | null,
  options: StreakOptions = {},
): number {
  const asOfDate = isValidLocalDateString(options.asOfDate) ? options.asOfDate : getLocalTodayDateString();
  const normalizedDates = normalizeCompletedDates(completedDates, asOfDate);
  if (normalizedDates.length === 0 || frequency === "times_per_week") return 0;

  const schedule: HabitSchedule = { frequency, days_of_week: daysOfWeek };
  const completed = new Set(normalizedDates);

  if (frequency === "weekly") {
    let cursorWeek = getWeekStartForDate(normalizedDates[0]);
    const endWeek = getWeekStartForDate(normalizedDates[normalizedDates.length - 1]);
    let current = 0;
    let best = 0;

    for (let scanned = 0; cursorWeek <= endWeek && scanned < Math.floor(MAX_SCAN_DAYS / 7); scanned++) {
      if (isWeekCompleted(completed, cursorWeek, asOfDate, schedule)) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
      cursorWeek = addWeeks(cursorWeek, 1);
    }

    return best;
  }

  let cursor = normalizedDates[0];
  const endDate = normalizedDates[normalizedDates.length - 1];
  let current = 0;
  let best = 0;

  for (let scanned = 0; cursor <= endDate && scanned < MAX_SCAN_DAYS; scanned++) {
    if (isFixedScheduledDate(cursor, schedule)) {
      if (completed.has(cursor)) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return best;
}

export function getWeeklyProgress(
  completedDates: string[],
  frequency: string,
  timesPerWeek: number | null,
  weekStart: string,
  daysOfWeek: number[] | null = null,
  options: StreakOptions = {},
): HabitWeeklyProgress | null {
  if (!isValidLocalDateString(weekStart)) return null;
  const asOfDate = isValidLocalDateString(options.asOfDate) ? options.asOfDate : getLocalTodayDateString();
  const schedule: HabitSchedule = { frequency, days_of_week: daysOfWeek, times_per_week: timesPerWeek };
  const flexibleTarget = targetForFlexibleWeek(schedule);
  const completed = new Set(normalizeCompletedDates(completedDates, asOfDate));

  if (flexibleTarget > 0) {
    return {
      completed: Math.min(countCompletionsInWeek(completed, weekStart, asOfDate, schedule), flexibleTarget),
      target: flexibleTarget,
    };
  }

  return null;
}
