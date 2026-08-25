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

export {
  toLocalPriority,
  isValidPosition,
  isValidPriorityText,
  MAX_PRIORITIES_PER_DAY,
} from "./today-priorities";
export type { TodayPriority, TodayPriorityInput } from "./today-priorities";

export {
  HEALTH_METRIC_META,
  CORE_HEALTH_METRICS,
  isCoreMetric,
  healthRecordDedupeKey,
  buildHealthDedupeKey,
  isValidHealthValue,
  isValidHealthNumericValue,
} from "./health";
export type { HealthSource, HealthMetricType, HealthUnit, HealthRecord, HealthSourceConnection, HealthProvenance } from "./health";

export {
  DEFAULT_HEALTH_PRIVACY,
  isStorageAllowed,
  isNextronAllowed,
  nextronHealthRequiresExplicitConsent,
  filterForNextron,
} from "./health-privacy";
export type { HealthPrivacyState, HealthScope } from "./health-privacy";

export type { HealthSourceAdapter, HealthAvailability, HealthPermissionStatus, HealthSyncResult } from "./health-adapter";
