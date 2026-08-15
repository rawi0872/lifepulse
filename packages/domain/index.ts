export { resolveIntendedUse, INTENDED_USE_VALUES } from "./intendedUse";
export type { IntendedUse } from "./intendedUse";

export {
  isValidLocalDateString,
  hasInvalidTaskDueDate,
  timestampToLocalDateString,
  priorityRank,
  groupTasksByDate,
  formatTaskDueStatus,
} from "./tasks";
export type { TaskLike, TaskGroups } from "./tasks";

export {
  dateToLocalDateString,
  getLocalTodayDateString,
  getWeekStartForDate,
  getWeekDatesForDate,
  getTimesPerWeekTarget,
  normalizeCompletedDates,
  isHabitDueOnDate,
  getCurrentStreak,
  getBestStreak,
  getWeeklyProgress,
} from "./streaks";
export type { HabitSchedule, HabitWeeklyProgress } from "./streaks";

export { normalizeTodayData } from "./today/normalize";
export { selectMorningPlanFirstAction, getMorningPlanAttentionItems } from "./today/morning-plan";
export type { TodayLocalPriority, MorningPlanFirstAction } from "./today/morning-plan";
export {
  buildEveningShutdownSummary,
  normalizeEveningShutdownReflection,
  buildEveningShutdownBlock,
  removeEveningShutdownBlock,
  mergeEveningShutdownBlock,
  parseEveningShutdownReflection,
} from "./today/evening-shutdown";
export type { EveningShutdownReflection, EveningShutdownSummary } from "./today/evening-shutdown";

export type {
  TodayRealmInfo,
  TodayHabit,
  TodayTask,
  TodayTaskExecutionContext,
  TodayHabitLog,
  TodayDateContext,
  TodayTaskGroups,
  TodayHabitGroups,
  TodayReflectionState,
  TodayContextState,
  TodayNextActionInputs,
  TodayStatusState,
  TodayModel,
  TodayDataSnapshot,
  TodayProjectTask,
  TodayTaskProjectContext,
  TodayGoalLink,
  TodayGoalPreviewLink,
  TodayLinkedGoal,
  TodayGoalMilestone,
} from "./today/types";
