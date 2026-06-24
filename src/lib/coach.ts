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

let insightCounter = 0;

function insight(
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
    id: `coach-${++insightCounter}`,
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
  insightCounter = 0;
  const results: CoachInsight[] = [];

  if (!data.bodyLoggedToday) {
    results.push(
      insight(
        "Log your Body Pulse",
        "Consider logging today\u2019s energy, sleep, and overall body check-in to keep your Body Pulse streak going.",
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
      insight(
        "Check in with Mind Pulse",
        "A useful next step could be noting your mood and focus levels for today.",
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
      insight(
        "Focus on a high-priority task",
        "You have high-priority tasks waiting. Consider tackling one now.",
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
      insight(
        "Connect your goal to action",
        "Consider linking your goal to a project, task, or habit to make progress measurable.",
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
      insight(
        "Write a short reflection",
        "A brief journal entry at the end of the day can help you process what happened.",
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
      insight(
        "Add a passion or hobby",
        "Consider adding an activity you enjoy outside of work and responsibilities.",
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
      insight(
        "Log a passion practice session",
        "Spending even 15 minutes on a passion activity can improve your sense of balance.",
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
      insight(
        "Log a workout this week",
        "Consider planning or logging one workout session for this week.",
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
      insight(
        "Log today\u2019s nutrition",
        "If you haven\u2019t already, consider noting what you ate and your water intake.",
        "body",
        "medium",
        "Log Nutrition",
        "/body",
        "No nutrition logged today",
        "nutrition_not_logged"
      )
    );
  }

  if (data.dayOfWeek === 1) {
    results.push(
      insight(
        "Plan your week ahead",
        "Mondays are a good time to set intentions and plan your week.",
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
      insight(
        "Review your week",
        "Late week is a good time to reflect on what went well and what to adjust.",
        "weekly_review",
        "medium",
        "Open Weekly Review",
        "/weekly-review",
        "It\u2019s late in the week \u2014 consider a review",
        "weekly_review_reminder"
      )
    );
  }

  if (!data.hasFinanceData) {
    results.push(
      insight(
        "Add your first transaction",
        "Consider adding a transaction or category to start tracking your finances.",
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
      insight(
        "Save an important idea or resource",
        "Consider capturing a useful resource, article, or idea in your Knowledge system.",
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
      insight(
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
