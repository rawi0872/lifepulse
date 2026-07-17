export type CoachCategory =
  | "body"
  | "mind"
  | "goals"
  | "tasks"
  | "habits"
  | "passions"
  | "knowledge"
  | "weekly_review"
  | "finance"
  | "general";

export type CoachPriority = "high" | "medium" | "low";

export interface CoachInsight {
  id: string;
  title: string;
  message: string;
  category: CoachCategory;
  priority: CoachPriority;
  actionLabel: string;
  actionHref: string;
  reason: string;
  createdFromRule: string;
}

export interface CoachData {
  bodyLoggedToday: boolean;
  mindLoggedToday: boolean;
  hasWorkoutThisWeek: boolean;
  hasNutritionToday: boolean;
  hasHighPriorityTasks: boolean;
  hasGoalWithoutLinks: boolean;
  hasJournalToday: boolean;
  hasContent: boolean;
  hasActivePassions: boolean;
  hasPassionSessionThisWeek: boolean;
  dayOfWeek: number;
  hasFinanceData: boolean;
  hasKnowledgeItems: boolean;
  hasKnowledgeCollections: boolean;
  bodyCheckInsThisWeek?: number;
  nutritionDaysThisWeek?: number;
  workoutCountThisWeek?: number;
  workoutMinutesThisWeek?: number;
  financeTransactionsThisWeek?: number;
  weeklyJournalEntries?: number;
  weeklyKnowledgeItems?: number;
}

const CATEGORY_LABELS: Record<CoachCategory, string> = {
  body: "Body",
  mind: "Mind",
  goals: "Goals",
  tasks: "Tasks",
  habits: "Habits",
  passions: "Passions",
  knowledge: "Knowledge",
  weekly_review: "Weekly Review",
  finance: "Finance",
  general: "General",
};

export function getCategoryLabel(category: CoachCategory): string {
  return CATEGORY_LABELS[category];
}

const PRIORITY_ORDER: Record<CoachPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortByPriority(insights: CoachInsight[]): CoachInsight[] {
  return [...insights].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

function insight(
  counter: { n: number },
  title: string,
  message: string,
  category: CoachCategory,
  priority: CoachPriority,
  actionLabel: string,
  actionHref: string,
  reason: string,
  ruleName: string
): CoachInsight {
  return {
    id: `coach-${++counter.n}`,
    title,
    message,
    category,
    priority,
    actionLabel,
    actionHref,
    reason,
    createdFromRule: ruleName,
  };
}

export function getCoachInsights(data: CoachData): CoachInsight[] {
  // counter is local — no shared mutable module state
  const counter = { n: 0 };
  const results: CoachInsight[] = [];

  // Helper that closes over the local counter
  const mk = (
    title: string,
    message: string,
    category: CoachCategory,
    priority: CoachPriority,
    actionLabel: string,
    actionHref: string,
    reason: string,
    ruleName: string
  ) => insight(counter, title, message, category, priority, actionLabel, actionHref, reason, ruleName);
  if (!data.bodyLoggedToday) {
    results.push(
      mk(
        "Add body context",
        "A quick body check-in can add energy, sleep, or recovery context to this week\u2019s reflection.",
        "body",
        "high",
        "Log Body Pulse",
        "/body",
        "No body metrics logged today",
        "body_not_logged"
      )
    );
  }

  if (!data.mindLoggedToday) {
    results.push(
      mk(
        "Check in with Mind Pulse",
        "If it fits, a quick mood and focus check-in can add context for today.",
        "mind",
        "high",
        "Check In",
        "/mind",
        "No mind metrics logged today",
        "mind_not_logged"
      )
    );
  }

  if (data.hasHighPriorityTasks) {
    results.push(
      mk(
        "Focus on a high-priority task",
        "There are high-priority tasks waiting. Pick one only if it fits your day.",
        "tasks",
        "high",
        "View Tasks",
        "/tasks",
        "High-priority tasks are pending",
        "high_priority_tasks"
      )
    );
  }

  if (data.hasGoalWithoutLinks) {
    results.push(
      mk(
        "Connect your goal to action",
        "A goal can be easier to review when it is linked to a project, task, or habit.",
        "goals",
        "medium",
        "Review Goals",
        "/goals",
        "Active goals have no completed milestones or linked actions",
        "goals_no_links"
      )
    );
  }

  if (!data.hasJournalToday && data.hasContent) {
    results.push(
      mk(
        "Write a short reflection",
        "A brief private reflection can give today more context for Weekly Review.",
        "general",
        "medium",
        "Open Journal",
        "/today",
        "No journal entry today",
        "journal_not_logged"
      )
    );
  }

  if (!data.hasActivePassions) {
    results.push(
      mk(
        "Add a passion or hobby",
        "If there is an activity you enjoy outside work and responsibilities, you can track it here.",
        "passions",
        "low",
        "Explore Passions",
        "/passions",
        "No passions or hobbies registered",
        "no_passions"
      )
    );
  } else if (!data.hasPassionSessionThisWeek) {
    results.push(
      mk(
        "Log a passion practice session",
        "If passion practice happened this week, logging it can make the week easier to review.",
        "passions",
        "medium",
        "Log Session",
        "/passions",
        "No passion session logged this week",
        "passion_no_session"
      )
    );
  }

  if (!data.hasWorkoutThisWeek) {
    results.push(
      mk(
        "Log movement this week",
        "If movement happened this week, logging it can make your weekly rhythm easier to review.",
        "body",
        "medium",
        "Log Workout",
        "/body",
        "No workouts logged this week",
        "no_workout_this_week"
      )
    );
  }

  if (!data.hasNutritionToday) {
    results.push(
      mk(
        "Log today\u2019s nutrition",
        "Add a simple nutrition or water entry if you want today reflected in Coach and Weekly Review.",
        "body",
        "medium",
        "Log Nutrition",
        "/body",
        "No nutrition logged today",
        "nutrition_not_logged"
      )
    );
  }

  const hasWeeklyReviewTimingRule = data.dayOfWeek === 1 || (data.dayOfWeek >= 4 && data.dayOfWeek <= 6);

  if (data.dayOfWeek === 1) {
    results.push(
      mk(
        "Plan your week ahead",
        "Monday can be a useful time to choose one realistic focus for the week.",
        "weekly_review",
        "medium",
        "Open Weekly Review",
        "/weekly-review",
        "It\u2019s Monday \u2014 a good time to plan",
        "monday_planning"
      )
    );
  } else if (data.dayOfWeek >= 4 && data.dayOfWeek <= 6) {
    results.push(
      mk(
        "Review your week",
        "Late week can be a useful time to review what changed and choose one adjustment.",
        "weekly_review",
        "medium",
        "Open Weekly Review",
        "/weekly-review",
        "It\u2019s late in the week \u2014 consider a review",
        "weekly_review_reminder"
      )
    );
  }

  const hasWeeklyBodySignalData =
    data.bodyCheckInsThisWeek !== undefined &&
    data.nutritionDaysThisWeek !== undefined &&
    data.workoutCountThisWeek !== undefined &&
    data.workoutMinutesThisWeek !== undefined;
  const hasWeeklyBodySignals =
    (data.bodyCheckInsThisWeek ?? 0) > 0 ||
    (data.nutritionDaysThisWeek ?? 0) > 0 ||
    (data.workoutCountThisWeek ?? 0) > 0;

  if (hasWeeklyBodySignalData && hasWeeklyBodySignals && !hasWeeklyReviewTimingRule) {
    results.push(
      mk(
        "Review this week\u2019s body rhythm",
        "You have body, nutrition, or movement data logged this week. Weekly Review can help you reflect on the pattern.",
        "weekly_review",
        "low",
        "Open Weekly Review",
        "/weekly-review",
        "Body or nutrition signals logged this week",
        "weekly_body_signals_review"
      )
    );
  }

  if ((data.financeTransactionsThisWeek ?? 0) > 0 && !hasWeeklyReviewTimingRule) {
    results.push(
      mk(
        "Review this week's money activity",
        "There are logged finance transactions this week. Weekly Review can show them as a private manual reflection prompt.",
        "weekly_review",
        "low",
        "Open Weekly Review",
        "/weekly-review",
        "Finance transactions logged this week",
        "weekly_finance_activity_review"
      )
    );
  }

  if (
    (data.weeklyJournalEntries ?? 0) > 0 &&
    (data.weeklyKnowledgeItems ?? 0) === 0 &&
    data.hasKnowledgeItems
  ) {
    results.push(
      mk(
        "Capture one lesson from this week",
        "There is reflection activity this week. If one lesson is worth keeping, Knowledge can store it manually.",
        "knowledge",
        "low",
        "Open Knowledge",
        "/knowledge",
        "Journal activity exists this week, but no knowledge item was added this week",
        "weekly_memory_lesson_capture"
      )
    );
  }

  if (!data.hasFinanceData) {
    results.push(
      mk(
        "Add your first transaction",
        "If you want a manual money record, Finance can store one transaction or category.",
        "finance",
        "low",
        "Open Finance",
        "/finance",
        "No finance data found",
        "no_finance_data"
      )
    );
  }

  if (!data.hasKnowledgeItems) {
    results.push(
      mk(
        "Save an important idea or resource",
        "If a useful resource, article, or idea matters later, Knowledge can store it manually.",
        "knowledge",
        "low",
        "Open Knowledge",
        "/knowledge",
        "No knowledge items saved yet",
        "no_knowledge_items"
      )
    );
  } else if (!data.hasKnowledgeCollections) {
    results.push(
      mk(
        "Create a knowledge collection",
        "Group related knowledge items into collections to keep things organized.",
        "knowledge",
        "low",
        "Open Collections",
        "/knowledge",
        "Knowledge exists but no collections",
        "no_knowledge_collections"
      )
    );
  }

  return results;
}

export function getTopInsights(
  data: CoachData,
  limit: number = 2
): CoachInsight[] {
  return sortByPriority(getCoachInsights(data)).slice(0, limit);
}

export function getInsightsByCategory(
  insights: CoachInsight[]
): Record<CoachCategory, CoachInsight[]> {
  const grouped: Record<string, CoachInsight[]> = {};
  for (const insight of insights) {
    if (!grouped[insight.category]) grouped[insight.category] = [];
    grouped[insight.category].push(insight);
  }
  return grouped as Record<CoachCategory, CoachInsight[]>;
}

export function getHighestPriority(
  insights: CoachInsight[]
): CoachPriority | null {
  if (insights.length === 0) return null;
  const order: CoachPriority[] = ["high", "medium", "low"];
  for (const p of order) {
    if (insights.some((i) => i.priority === p)) return p;
  }
  return null;
}
