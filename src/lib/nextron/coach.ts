import type { NextronEvidencePacket } from "@/lib/nextron/evidence";

export type NextronEvidenceCategory = keyof Pick<NextronEvidencePacket, "today" | "tasks" | "habits" | "results" | "journal" | "eveningShutdown" | "weeklyReview" | "goals" | "projects" | "profile">;

export interface NextronFact {
  category: NextronEvidenceCategory;
  text: string;
}

export interface NextronNextAction {
  label: string;
  href: string;
  rationale: string;
}

export interface NextronCoachResponse {
  facts: NextronFact[];
  interpretation: string;
  nextAction: NextronNextAction;
  priority: "high" | "medium" | "low" | "calm";
  ruleId: string;
  supportingEvidence: string[];
}

function fact(category: NextronEvidenceCategory, text: string): NextronFact {
  return { category, text };
}

function response(
  ruleId: string,
  priority: NextronCoachResponse["priority"],
  facts: NextronFact[],
  interpretation: string,
  label: string,
  href: string,
  rationale: string,
): NextronCoachResponse {
  return {
    ruleId,
    priority,
    facts,
    interpretation,
    nextAction: { label, href, rationale },
    supportingEvidence: facts.map((item) => item.text).slice(0, 4),
  };
}

export function buildDeterministicNextronResponse(packet: NextronEvidencePacket): NextronCoachResponse {
  if (packet.warnings.length > 0) {
    return response(
      "partial_context_loaded",
      "medium",
      [fact("today", "Some optional NEXTRON context could not be loaded."), ...packet.warnings.slice(0, 2).map((warning) => fact("today", warning))],
      "NEXTRON can still use the context that loaded, but this response should be treated as partial.",
      "Open Today",
      "/today",
      "Use Today as the stable manual command center while optional context recovers.",
    );
  }

  const today = packet.today.data;
  const tasks = packet.tasks.data;
  const habits = packet.habits.data;
  const results = packet.results.data;
  const evening = packet.eveningShutdown.data;
  const weekly = packet.weeklyReview.data;
  const projects = packet.projects.data;

  if (tasks && tasks.overdueCount > 0) {
    return response(
      "overdue_task",
      "high",
      [
        fact("tasks", `You have ${tasks.overdueCount} overdue open task${tasks.overdueCount === 1 ? "" : "s"}.`),
        fact("tasks", `${tasks.dueTodayCount} task${tasks.dueTodayCount === 1 ? " is" : "s are"} due today.`),
      ],
      "The immediate workload appears to have at least one carryover item. It may be worth deciding manually whether it still matters today.",
      "Review overdue tasks",
      "/tasks",
      "Open Tasks and choose whether the overdue item should be completed, rescheduled manually, or removed.",
    );
  }

  if (tasks && tasks.dueTodayCount > 0) {
    return response(
      "due_today_task",
      "medium",
      [
        fact("tasks", `You have ${tasks.dueTodayCount} open task${tasks.dueTodayCount === 1 ? "" : "s"} due today.`),
        fact("tasks", `${tasks.completedTodayCount} task${tasks.completedTodayCount === 1 ? " has" : "s have"} been completed today.`),
      ],
      "There is a clear next execution surface today. Keeping the next step small can preserve momentum.",
      "Open Today",
      "/today",
      "Use Today to pick one visible action instead of scanning every task.",
    );
  }

  if (habits && habits.dueTodayCount > habits.completedTodayCount) {
    const remaining = habits.dueTodayCount - habits.completedTodayCount;
    return response(
      "incomplete_due_habit",
      "medium",
      [
        fact("habits", `${remaining} due habit${remaining === 1 ? " is" : "s are"} still waiting today.`),
        fact("habits", `${habits.completedTodayCount} of ${habits.dueTodayCount} due habit${habits.dueTodayCount === 1 ? "" : "s"} are completed.`),
      ],
      "Your task load may not be the only useful signal. A small habit can be the lowest-friction way to keep the loop alive.",
      "Open Habits",
      "/habits",
      "Check the due habit list and complete one only if it actually happened.",
    );
  }

  if (today && !today.hasMorningPlan && today.completedTodayTaskCount === 0 && today.completedHabitCount === 0) {
    return response(
      "missing_morning_plan",
      "medium",
      [fact("today", "NEXTRON does not see a clear priority, completed task, or completed due habit for today.")],
      "Evidence is limited for today. The safest move is to define one realistic priority before adding more context.",
      "Set today's priority",
      "/today",
      "Open Today and choose one priority that would make the day count.",
    );
  }

  if (results && results.activeMetricCount > 0 && results.recentEntryCount === 0) {
    return response(
      "configured_results_without_entries",
      "low",
      [fact("results", `You have ${results.activeMetricCount} active Results metric${results.activeMetricCount === 1 ? "" : "s"} and no recent entries this week.`)],
      "If those metrics still matter, a manual check-in could make this week's review more factual.",
      "Open Results",
      "/results",
      "Record a value only if you have a real measurement to enter.",
    );
  }

  const hour = new Date().getHours();
  if (hour >= 18 && today && (today.completedTodayTaskCount > 0 || today.completedHabitCount > 0) && (!evening || !evening.existsToday)) {
    return response(
      "late_day_shutdown",
      "low",
      [fact("today", `${today.completedTodayTaskCount} task${today.completedTodayTaskCount === 1 ? "" : "s"} and ${today.completedHabitCount} habit${today.completedHabitCount === 1 ? "" : "s"} are completed today.`)],
      "There is enough activity to make a short end-of-day reflection useful, but it should stay optional.",
      "Inspect Evening Shutdown",
      "/today#evening-reflection",
      "Open Today and write a brief shutdown only if you are ready to save a real reflection.",
    );
  }

  const day = new Date().getDay();
  if ((day === 0 || day >= 5) && (!weekly || !weekly.existsThisWeek)) {
    return response(
      "weekly_review_handoff",
      "low",
      [fact("weeklyReview", "The calendar is near a natural weekly review window."), fact("today", `Current week starts ${packet.weekStart}.`)],
      "A weekly review may be useful if you have enough logged evidence. If not, there is no need to force it.",
      "Open Weekly Review",
      "/weekly-review",
      "Review the factual summary first, then save only if you have a real reflection.",
    );
  }

  if (projects && projects.activeWithoutOpenTaskCount > 0) {
    return response(
      "project_without_open_task",
      "low",
      [fact("projects", `${projects.activeWithoutOpenTaskCount} active project${projects.activeWithoutOpenTaskCount === 1 ? " has" : "s have"} no open task in the bounded check.`)],
      "One active project may not have a visible next action. This is only a prompt to inspect, not proof that the project is stuck.",
      "Review Projects",
      "/projects",
      "Open Projects and decide whether one project needs a next task.",
    );
  }

  return response(
    "calm_no_pressure",
    "calm",
    [
      fact("today", today ? `${today.completedTodayTaskCount} task${today.completedTodayTaskCount === 1 ? "" : "s"} and ${today.completedHabitCount} habit${today.completedHabitCount === 1 ? "" : "s"} completed today.` : "Today context is limited or denied."),
      fact("tasks", tasks ? `${tasks.boundedOpenTaskCount} bounded open task${tasks.boundedOpenTaskCount === 1 ? "" : "s"} are visible.` : "Task context is limited or denied."),
    ],
    "Nothing in the permitted evidence requires urgency. Keep the loop simple and avoid adding work just to satisfy the system.",
    "Open Today",
    "/today",
    "Use Today if you want to choose one small next step; otherwise keep logging normally.",
  );
}
