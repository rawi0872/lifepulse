// ---------------------------------------------------------------------------
// Life Pulse Habit Streaks
// ---------------------------------------------------------------------------
// All functions are pure and work on arrays of date strings ("YYYY-MM-DD").
// No database queries, no side effects.
// ---------------------------------------------------------------------------

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isExpectedDay(date: Date, frequency: string, daysOfWeek: number[] | null): boolean {
  if (frequency === "daily") return true;
  if (frequency === "weekdays" && daysOfWeek && daysOfWeek.length > 0) {
    return daysOfWeek.includes(date.getDay());
  }
  return true;
}

/**
 * Calculate the current streak for a habit.
 *
 * - daily: consecutive calendar days
 * - weekdays (specific days): consecutive expected days (skips unselected days)
 * - times_per_week: returns 0 (no streak concept)
 *
 * If today is an expected day and completed, streak includes today.
 * If today is expected but not yet completed, counting starts from yesterday
 * (grace period — no penalty for not having done it yet today).
 * Non-expected days never break a streak.
 */
export function getCurrentStreak(
  completedDates: string[],
  frequency: string,
  daysOfWeek: number[] | null,
): number {
  if (frequency === "times_per_week" || completedDates.length === 0) return 0;

  const completed = new Set(completedDates);
  const today = new Date();
  const todayStr = dateToStr(today);
  const todayExpected = isExpectedDay(today, frequency, daysOfWeek);
  const todayDone = completed.has(todayStr);

  // Determine starting point
  const startDate = new Date(today);
  if (todayExpected && todayDone) {
    // Count from today
  } else {
    // Count from yesterday (grace for not-yet-done today)
    startDate.setDate(startDate.getDate() - 1);
  }

  let streak = 0;
  const cursor = new Date(startDate);

  // Safety: don't scan more than 4000 days (~11 years)
  let safety = 0;
  while (safety < 4000) {
    safety++;
    const cursorStr = dateToStr(cursor);

    if (!isExpectedDay(cursor, frequency, daysOfWeek)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    if (completed.has(cursorStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Find the longest streak ever for a habit.
 * Scans from earliest completion to most recent.
 */
export function getBestStreak(
  completedDates: string[],
  frequency: string,
  daysOfWeek: number[] | null,
): number {
  if (frequency === "times_per_week" || completedDates.length === 0) return 0;

  const completed = new Set(completedDates);
  const sorted = [...completedDates].sort();
  const startDate = new Date(sorted[0]);
  const endDate = new Date(sorted[sorted.length - 1]);

  let best = 0;
  let current = 0;
  const cursor = new Date(startDate);

  // Safety: don't scan more than 4000 days
  let safety = 0;
  while (cursor <= endDate && safety < 4000) {
    safety++;
    const cursorStr = dateToStr(cursor);

    if (!isExpectedDay(cursor, frequency, daysOfWeek)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    if (completed.has(cursorStr)) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return best;
}

/**
 * Weekly progress for times_per_week habits.
 * Returns null for non-times_per_week habits.
 */
export function getWeeklyProgress(
  completedDates: string[],
  frequency: string,
  timesPerWeek: number | null,
  weekStart: string,
): { completed: number; target: number } | null {
  if (frequency !== "times_per_week" || !timesPerWeek) return null;

  const thisWeek = completedDates.filter((d) => d >= weekStart);
  return {
    completed: thisWeek.length,
    target: timesPerWeek,
  };
}
