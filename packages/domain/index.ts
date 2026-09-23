export { resolveIntendedUse, INTENDED_USE_VALUES } from "./intendedUse.ts";
export type { IntendedUse } from "./intendedUse.ts";

export {
  isValidLocalDateString,
  hasInvalidTaskDueDate,
  timestampToLocalDateString,
  priorityRank,
  groupTasksByDate,
  formatTaskDueStatus,
} from "./tasks.ts";
export type { TaskLike, TaskGroups } from "./tasks.ts";

export {
  MAX_ITEM_TITLE_LENGTH,
  WEEKDAY_DAYS,
  normalizeItemTitle,
  isValidItemTitle,
  normalizeHabitSchedule,
  buildTaskUpdatePayload,
  buildHabitUpdatePayload,
  removeDeletedById,
  isDeletedEverywhere,
  createSingleFlight,
} from "./item-mutations.ts";
export type { TaskPriority, HabitFrequency, TaskEdits, TaskUpdate, HabitEdits, HabitUpdate, NormalizedHabitSchedule, SingleFlight } from "./item-mutations.ts";

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
} from "./streaks.ts";
export type { HabitSchedule, HabitWeeklyProgress } from "./streaks.ts";

export { normalizeTodayData } from "./today/normalize.ts";
export { selectMorningPlanFirstAction, getMorningPlanAttentionItems } from "./today/morning-plan.ts";
export type { TodayLocalPriority, MorningPlanFirstAction } from "./today/morning-plan.ts";
export {
  buildEveningShutdownSummary,
  normalizeEveningShutdownReflection,
  buildEveningShutdownBlock,
  removeEveningShutdownBlock,
  mergeEveningShutdownBlock,
  parseEveningShutdownReflection,
} from "./today/evening-shutdown.ts";
export type { EveningShutdownReflection, EveningShutdownSummary } from "./today/evening-shutdown.ts";

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
} from "./today/types.ts";

export {
  toLocalPriority,
  isValidPosition,
  isValidPriorityText,
  MAX_PRIORITIES_PER_DAY,
} from "./today-priorities.ts";
export type { TodayPriority, TodayPriorityInput } from "./today-priorities.ts";

export {
  HEALTH_METRIC_META,
  CORE_HEALTH_METRICS,
  isCoreMetric,
  healthRecordDedupeKey,
  buildHealthDedupeKey,
  buildDailyHealthAggregateDedupeKey,
  isValidHealthValue,
  isValidHealthNumericValue,
} from "./health.ts";
export type { HealthSource, HealthMetricType, HealthUnit, HealthRecord, HealthSourceConnection, HealthProvenance } from "./health.ts";

export {
  DEFAULT_HEALTH_PRIVACY,
  isStorageAllowed,
  isNextronAllowed,
  nextronHealthRequiresExplicitConsent,
  filterForNextron,
} from "./health-privacy.ts";
export type { HealthPrivacyState, HealthScope } from "./health-privacy.ts";

export type { HealthSourceAdapter, HealthAvailability, HealthPermissionStatus, HealthSyncResult } from "./health-adapter.ts";

export * from "./body.ts";
export * from "./wealth.ts";
export * from "./wealth-intelligence.ts";
export * from "./today-wealth-ranking.ts";
export {
  REALM_NAMES,
  HABIT_FREQUENCY_LABELS,
  HABIT_FREQUENCY_DESCRIPTIONS,
  TODAY_LABELS,
  THEME_LABELS,
  APPEARANCE_STORAGE_KEY,
  isThemePreference,
} from "./copy.ts";
export type { CanonicalRealmKey, ThemePreference } from "./copy.ts";
