import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEveningShutdownReflection, removeEveningShutdownBlock } from "@lifepulse/domain";
import { parseWeeklyReviewReflection, removeWeeklyReviewBlock } from "@/lib/weekly-review";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { groupTasksByDate, isValidLocalDateString, timestampToLocalDateString } from "@lifepulse/domain";
import { getWeeklyProgress, isHabitDueOnDate, normalizeCompletedDates } from "@lifepulse/domain";
import { buildLifeMapGraph, summarizeLifeMapForNextron } from "@/lib/life-map";
import type { NextronContextDomain, NextronPermissionState } from "@/lib/nextron/context";
import { isNextronContextAllowed } from "@/lib/nextron/context";
import { buildWealthNextronEvidence, type WealthNextronEvidence } from "@/lib/nextron/wealth-evidence";

type EvidenceStatus = "available" | "missing" | "permission_denied" | "error";

interface EvidenceSection {
  status: EvidenceStatus;
  note?: string;
}

interface TaskEvidenceRow {
  id: string;
  title: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string | null;
  project_id: string | null;
}

interface HabitEvidenceRow {
  id: string;
  title: string | null;
  frequency: string;
  days_of_week: number[] | null;
  times_per_week: number | null;
}

interface HabitLogEvidenceRow {
  habit_id: string | null;
  completed_date: string | null;
}

interface MetricDefinitionEvidenceRow {
  id: string;
  name: string | null;
  unit: string | null;
  archived: boolean | null;
}

interface MetricEntryEvidenceRow {
  metric_definition_id: string | null;
  value: string | number | null;
  recorded_at: string | null;
}

interface JournalEvidenceRow {
  entry_date: string | null;
  content: string | null;
}

interface GoalEvidenceRow {
  id: string;
  title: string | null;
  status: string | null;
}

interface ProjectEvidenceRow {
  id: string;
  title: string | null;
  status: string | null;
}

export interface NextronPacketSection<T> extends EvidenceSection {
  data: T | null;
}

export interface NextronEvidencePacket {
  version: "nextron-evidence-v1";
  generatedForLocalDate: string;
  weekStart: string;
  permissionSummary: Record<NextronContextDomain, EvidenceStatus>;
  profile: NextronPacketSection<{ intendedUse: string | null }>;
  today: NextronPacketSection<{
    localDate: string;
    activePriorityCount: number;
    overdueTaskCount: number;
    dueTodayTaskCount: number;
    completedTodayTaskCount: number;
    dueHabitCount: number;
    completedHabitCount: number;
    incompleteHabitCount: number;
    hasMorningPlan: boolean;
  }>;
  tasks: NextronPacketSection<{
    boundedOpenTaskCount: number;
    overdueCount: number;
    dueTodayCount: number;
    unscheduledCount: number;
    completedTodayCount: number;
    nextOpenTitles: string[];
  }>;
  habits: NextronPacketSection<{
    totalHabitCount: number;
    dueTodayCount: number;
    completedTodayCount: number;
    weeklyCompletedCount: number;
    weeklyTargetCount: number | null;
  }>;
  results: NextronPacketSection<{
    activeMetricCount: number;
    recentEntryCount: number;
    latestValues: string[];
  }>;
  journal: NextronPacketSection<{ recentReflectionSnippet: string | null }>;
  eveningShutdown: NextronPacketSection<{ existsToday: boolean; tomorrowSeed: string | null }>;
  weeklyReview: NextronPacketSection<{ existsThisWeek: boolean; nextWeekFocus: string | null }>;
  goals: NextronPacketSection<{ activeCount: number; sampleNames: string[] }>;
  projects: NextronPacketSection<{ activeCount: number; activeWithoutOpenTaskCount: number; sampleNames: string[] }>;
  relationships: NextronPacketSection<ReturnType<typeof summarizeLifeMapForNextron>>;
  body: NextronPacketSection<{ availableMetrics: string[]; todaySummary: string | null }>;
  knowledge: NextronPacketSection<{ noteSearchAvailable: boolean }>;
  calendar: NextronPacketSection<{ connected: boolean; readOnly: true }>;
  memory: NextronPacketSection<{ preferences: string[] }>;
  wealth: NextronPacketSection<WealthNextronEvidence | null>;
  warnings: string[];
}

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function denied<T>(note = "Permission denied for this local session."): NextronPacketSection<T> {
  return { status: "permission_denied", note, data: null };
}

function missing<T>(note: string): NextronPacketSection<T> {
  return { status: "missing", note, data: null };
}

function errorSection<T>(note: string): NextronPacketSection<T> {
  return { status: "error", note, data: null };
}

function available<T>(data: T, note?: string): NextronPacketSection<T> {
  return { status: "available", note, data };
}

function safeText(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.replace(/<!--[^>]*-->/g, " ").replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function safeJournalSnippet(content: string | null | undefined): string | null {
  return safeText(removeWeeklyReviewBlock(removeEveningShutdownBlock(content ?? "")), 220);
}

function numberFromValue(value: string | number | null): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function permissionStatus(permissions: NextronPermissionState, domain: NextronContextDomain): EvidenceStatus {
  return isNextronContextAllowed(permissions, domain) ? "missing" : "permission_denied";
}

export async function buildNextronEvidencePacket(
  supabase: SupabaseClient,
  userId: string,
  permissions: NextronPermissionState,
): Promise<NextronEvidencePacket> {
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();
  const dayStart = toLocalDateBoundaryIso(today, "start");
  const dayEnd = toLocalDateBoundaryIso(today, "end");
  const warnings: string[] = [];
  const permissionSummary = Object.keys(permissions).reduce<Record<NextronContextDomain, EvidenceStatus>>((summary, key) => {
    const domain = key as NextronContextDomain;
    summary[domain] = permissionStatus(permissions, domain);
    return summary;
  }, {} as Record<NextronContextDomain, EvidenceStatus>);

  let profile: NextronEvidencePacket["profile"] = denied();
  let todaySection: NextronEvidencePacket["today"] = denied();
  let tasks: NextronEvidencePacket["tasks"] = denied();
  let habits: NextronEvidencePacket["habits"] = denied();
  let results: NextronEvidencePacket["results"] = denied();
  let journal: NextronEvidencePacket["journal"] = denied("Journal text is not loaded unless allowed.");
  let eveningShutdown: NextronEvidencePacket["eveningShutdown"] = denied("Evening Shutdown reflection is not loaded unless allowed.");
  let weeklyReview: NextronEvidencePacket["weeklyReview"] = denied("Weekly Review reflection is not loaded unless allowed.");
  let goals: NextronEvidencePacket["goals"] = denied();
  let projects: NextronEvidencePacket["projects"] = denied();
  let relationships: NextronEvidencePacket["relationships"] = denied("Life Map relationships require Goals, Projects, Tasks, and Habits context.");
  // Body evidence — explicit health_preferences nextron_allowed_metrics gating (separate from profile/today/tasks)
  let body: NextronPacketSection<{ availableMetrics: string[]; todaySummary: string | null }> = denied("Body evidence requires Health storage and NEXTRON health permission.");
  try {
    const { data: hp } = await supabase.from("health_preferences").select("allowed_metrics, nextron_allowed_metrics").eq("user_id", userId).maybeSingle() as any;
    const allowed: string[] = hp?.allowed_metrics ?? [];
    const nextronAllowed: string[] = hp?.nextron_allowed_metrics ?? [];
    // schema unavailable → treat as denied (pending 00040)
    if (Array.isArray(allowed) && Array.isArray(nextronAllowed)) {
      const effective = nextronAllowed.filter((m: string) => allowed.includes(m));
      if (effective.length > 0) {
        body = available({ availableMetrics: effective, todaySummary: `Body metrics available: ${effective.join(", ")}` }, "Body metrics are summarized, not raw.");
      } else if (allowed.length > 0) {
        body = denied("NEXTRON Body access is off — enable in Health Connections.");
      } else {
        body = missing("No Body health metrics are enabled for storage.");
      }
    }
  } catch {
    body = denied("Body evidence unavailable.");
  }

  const knowledge: NextronEvidencePacket["knowledge"] = isNextronContextAllowed(permissions, "knowledge")
    ? available({ noteSearchAvailable: true }, "Knowledge notes are searched only on explicit Knowledge questions.")
    : denied("Knowledge notes are not loaded unless allowed.");
  const calendar: NextronEvidencePacket["calendar"] = isNextronContextAllowed(permissions, "calendar")
    ? available({ connected: true, readOnly: true }, "Calendar is queried only for explicit Calendar questions.")
    : denied("Calendar is not loaded unless allowed and connected.");
  const memory: NextronEvidencePacket["memory"] = missing("No relevant confirmed preference memory was loaded for this request.");

  // Wealth evidence — finance_preferences gating (master + sections, fail-closed, no raw transactions)
  let wealth: NextronEvidencePacket["wealth"] = denied("Wealth financial data is private by default.");
  try {
    const { data: wp } = await supabase.from("finance_preferences").select("nextron_access_enabled, nextron_allowed_sections").eq("user_id", userId).maybeSingle() as any;
    const master = !!wp?.nextron_access_enabled;
    const sections: string[] = Array.isArray(wp?.nextron_allowed_sections) ? wp.nextron_allowed_sections : [];
    const valid: string[] = ["balances","cash_flow","transactions_summary","recurring_items","wealth_goals"];
    const effective = master ? sections.filter((s:string)=> valid.includes(s)) : [];
    if (!master) {
      wealth = denied("Wealth NEXTRON access is OFF — enable in Wealth settings.");
    } else if (effective.length===0) {
      wealth = missing("Wealth NEXTRON master ON but no sections selected.");
    } else {
      const ev = await buildWealthNextronEvidence(supabase, userId, effective as any);
      if (ev) wealth = available(ev as any, "Wealth summarized financial context — no raw transactions.");
      else wealth = missing("No Wealth data available for selected sections.");
    }
  } catch {
    wealth = denied("Wealth evidence unavailable.");
  }

  const wantsOperational = isNextronContextAllowed(permissions, "today") || isNextronContextAllowed(permissions, "tasks") || isNextronContextAllowed(permissions, "habits");
  const canLoadRelationships = isNextronContextAllowed(permissions, "goals")
    && isNextronContextAllowed(permissions, "projects")
    && isNextronContextAllowed(permissions, "tasks")
    && isNextronContextAllowed(permissions, "habits");

  const [profileResult, operationalResult, resultsResult, goalsResult, projectsResult, relationshipsResult, journalResult] = await Promise.allSettled([
    isNextronContextAllowed(permissions, "profile")
      ? supabase.from("profiles").select("intended_use").eq("user_id", userId).maybeSingle()
      : Promise.resolve(null),
    wantsOperational
      ? Promise.all([
          supabase
            .from("tasks")
            .select("id, title, priority, due_date, status, completed_at, created_at, project_id")
            .eq("user_id", userId)
            .or(`and(due_date.eq.${today},status.eq.todo),and(due_date.lt.${today},status.eq.todo),and(due_date.is.null,status.eq.todo),and(status.eq.done,completed_at.gte.${dayStart},completed_at.lte.${dayEnd})`)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("habits")
            .select("id, title, frequency, days_of_week, times_per_week")
            .eq("user_id", userId)
            .limit(100),
          supabase
            .from("habit_logs")
            .select("habit_id, completed_date")
            .eq("user_id", userId)
            .gte("completed_date", weekStart)
            .lte("completed_date", today)
            .limit(700),
        ])
      : Promise.resolve(null),
    isNextronContextAllowed(permissions, "results")
      ? Promise.all([
          supabase
            .from("metric_definitions")
            .select("id, name, unit, archived")
            .eq("user_id", userId)
            .eq("archived", false)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("metric_entries")
            .select("metric_definition_id, value, recorded_at")
            .eq("user_id", userId)
            .gte("recorded_at", toLocalDateBoundaryIso(weekStart, "start"))
            .lte("recorded_at", dayEnd)
            .order("recorded_at", { ascending: false })
            .limit(40),
        ])
      : Promise.resolve(null),
    isNextronContextAllowed(permissions, "goals")
      ? supabase.from("goals").select("id, title, status").eq("user_id", userId).eq("status", "active").limit(20)
      : Promise.resolve(null),
    isNextronContextAllowed(permissions, "projects")
      ? Promise.all([
          supabase.from("projects").select("id, title, status").eq("user_id", userId).eq("status", "active").limit(20),
          supabase.from("tasks").select("id, project_id, status").eq("user_id", userId).eq("status", "todo").not("project_id", "is", null).limit(100),
        ])
      : Promise.resolve(null),
    canLoadRelationships
      ? buildLifeMapGraph(supabase, userId)
      : Promise.resolve(null),
    isNextronContextAllowed(permissions, "journal") || isNextronContextAllowed(permissions, "eveningShutdown") || isNextronContextAllowed(permissions, "weeklyReview")
      ? supabase
          .from("journal_entries")
          .select("entry_date, content")
          .eq("user_id", userId)
          .gte("entry_date", weekStart)
          .lte("entry_date", today)
          .order("entry_date", { ascending: false })
          .limit(8)
      : Promise.resolve(null),
  ]);

  if (profileResult.status === "fulfilled" && profileResult.value) {
    const response = profileResult.value;
    if (response.error) profile = errorSection("Profile intent could not be loaded.");
    else profile = available({ intendedUse: safeText(response.data?.intended_use ?? null, 80) });
  }

  if (operationalResult.status === "fulfilled" && operationalResult.value) {
    const [tasksRes, habitsRes, logsRes] = operationalResult.value;
    if (tasksRes.error || habitsRes.error || logsRes.error) {
      const section = errorSection<{ localDate: string }>("Today, task, or habit evidence could not be loaded.");
      todaySection = section as NextronEvidencePacket["today"];
      tasks = errorSection("Task evidence could not be loaded.");
      habits = errorSection("Habit evidence could not be loaded.");
    } else {
      const taskRows = (tasksRes.data ?? []) as TaskEvidenceRow[];
      const habitRows = (habitsRes.data ?? []) as HabitEvidenceRow[];
      const logRows = (logsRes.data ?? []) as HabitLogEvidenceRow[];
      const validTaskRows = taskRows.filter((task) => !task.due_date || isValidLocalDateString(task.due_date));
      const taskGroups = groupTasksByDate(validTaskRows, today);
      const dedupedLogKeys = new Set<string>();
      const validLogs = logRows.filter((log) => {
        if (!log.habit_id || !isValidLocalDateString(log.completed_date)) return false;
        const key = `${log.habit_id}:${log.completed_date}`;
        if (dedupedLogKeys.has(key)) return false;
        dedupedLogKeys.add(key);
        return true;
      });
      const logsByHabit = validLogs.reduce<Record<string, string[]>>((map, log) => {
        if (!log.habit_id || !log.completed_date) return map;
        map[log.habit_id] = map[log.habit_id] ?? [];
        map[log.habit_id].push(log.completed_date);
        return map;
      }, {});
      const dueHabits = habitRows.filter((habit) => {
        const dates = logsByHabit[habit.id] ?? [];
        return dates.includes(today) || isHabitDueOnDate(habit, today, dates);
      });
      const completedHabits = dueHabits.filter((habit) => (logsByHabit[habit.id] ?? []).includes(today));
      let weeklyTargetCount = 0;
      let hasUnknownTarget = false;
      for (const habit of habitRows) {
        const progress = getWeeklyProgress(normalizeCompletedDates(logsByHabit[habit.id] ?? [], today), habit.frequency, habit.times_per_week, weekStart, habit.days_of_week, { asOfDate: today });
        if (progress?.target === undefined || progress.target === null) hasUnknownTarget = true;
        else weeklyTargetCount += progress.target;
      }
      const highPriorityOpen = [...taskGroups.overdue, ...taskGroups.dueToday, ...taskGroups.unscheduled].filter((task) => task.priority === "high").length;
      if (isNextronContextAllowed(permissions, "today")) {
        todaySection = available({
          localDate: today,
          activePriorityCount: highPriorityOpen,
          overdueTaskCount: taskGroups.overdue.length,
          dueTodayTaskCount: taskGroups.dueToday.length,
          completedTodayTaskCount: taskGroups.completedToday.length,
          dueHabitCount: dueHabits.length,
          completedHabitCount: completedHabits.length,
          incompleteHabitCount: dueHabits.length - completedHabits.length,
          hasMorningPlan: highPriorityOpen > 0 || taskGroups.dueToday.length > 0 || completedHabits.length > 0,
        });
      }
      if (isNextronContextAllowed(permissions, "tasks")) {
        tasks = available({
          boundedOpenTaskCount: taskGroups.overdue.length + taskGroups.dueToday.length + taskGroups.unscheduled.length,
          overdueCount: taskGroups.overdue.length,
          dueTodayCount: taskGroups.dueToday.length,
          unscheduledCount: taskGroups.unscheduled.length,
          completedTodayCount: taskGroups.completedToday.length,
          nextOpenTitles: [...taskGroups.overdue, ...taskGroups.dueToday, ...taskGroups.unscheduled]
            .map((task) => safeText(task.title, 80))
            .filter((title): title is string => Boolean(title))
            .slice(0, 3),
        });
      }
      if (isNextronContextAllowed(permissions, "habits")) {
        habits = available({
          totalHabitCount: habitRows.length,
          dueTodayCount: dueHabits.length,
          completedTodayCount: completedHabits.length,
          weeklyCompletedCount: validLogs.length,
          weeklyTargetCount: hasUnknownTarget ? null : weeklyTargetCount,
        });
      }
    }
  }

  if (resultsResult.status === "fulfilled" && resultsResult.value) {
    const [metricsRes, entriesRes] = resultsResult.value;
    if (metricsRes.error || entriesRes.error) results = errorSection("Results evidence could not be loaded.");
    else {
      const metrics = (metricsRes.data ?? []) as MetricDefinitionEvidenceRow[];
      const metricNames = new Map(metrics.map((metric) => [metric.id, { name: safeText(metric.name, 60) ?? "Metric", unit: safeText(metric.unit, 20) }]));
      const activeMetricEntries = ((entriesRes.data ?? []) as MetricEntryEvidenceRow[]).filter((entry) => Boolean(entry.metric_definition_id && metricNames.has(entry.metric_definition_id)));
      const latestValues = activeMetricEntries
        .map((entry) => {
          if (!entry.metric_definition_id || !isValidLocalDateString(timestampToLocalDateString(entry.recorded_at))) return null;
          const numeric = numberFromValue(entry.value);
          if (numeric === null) return null;
          const metric = metricNames.get(entry.metric_definition_id);
          return `${metric?.name ?? "Metric"}: ${numeric}${metric?.unit ? ` ${metric.unit}` : ""}`;
        })
        .filter((value): value is string => Boolean(value))
        .slice(0, 4);
      results = metrics.length === 0
        ? missing("No active manual Results metrics are configured.")
        : available({ activeMetricCount: metrics.length, recentEntryCount: activeMetricEntries.length, latestValues });
    }
  }

  if (goalsResult.status === "fulfilled" && goalsResult.value) {
    if (goalsResult.value.error) goals = errorSection("Goal evidence could not be loaded.");
    else {
      const rows = (goalsResult.value.data ?? []) as GoalEvidenceRow[];
      goals = rows.length === 0 ? missing("No active goals found.") : available({ activeCount: rows.length, sampleNames: rows.map((row) => safeText(row.title, 70)).filter((title): title is string => Boolean(title)).slice(0, 3) });
    }
  }

  if (projectsResult.status === "fulfilled" && projectsResult.value) {
    const [projectsRes, taskProjectsRes] = projectsResult.value;
    if (projectsRes.error || taskProjectsRes.error) projects = errorSection("Project evidence could not be loaded.");
    else {
      const rows = (projectsRes.data ?? []) as ProjectEvidenceRow[];
      const withOpenTasks = new Set(((taskProjectsRes.data ?? []) as { project_id: string | null }[]).map((task) => task.project_id).filter(Boolean));
      projects = rows.length === 0 ? missing("No active projects found.") : available({
        activeCount: rows.length,
        activeWithoutOpenTaskCount: rows.filter((project) => !withOpenTasks.has(project.id)).length,
        sampleNames: rows.map((row) => safeText(row.title, 70)).filter((title): title is string => Boolean(title)).slice(0, 3),
      });
    }
  }

  if (relationshipsResult.status === "fulfilled" && relationshipsResult.value) {
    relationships = available(summarizeLifeMapForNextron(relationshipsResult.value), "Uses explicit goal links and project task assignments only.");
  } else if (relationshipsResult.status === "rejected") {
    relationships = errorSection("Life Map relationship summary failed to load.");
    warnings.push("relationships_load_failed");
  } else if (!canLoadRelationships) {
    relationships = denied("Life Map relationships require Goals, Projects, Tasks, and Habits context.");
  }

  if (journalResult.status === "fulfilled" && journalResult.value) {
    if (journalResult.value.error) {
      const message = "Reflection evidence could not be loaded.";
      if (isNextronContextAllowed(permissions, "journal")) journal = errorSection(message);
      if (isNextronContextAllowed(permissions, "eveningShutdown")) eveningShutdown = errorSection(message);
      if (isNextronContextAllowed(permissions, "weeklyReview")) weeklyReview = errorSection(message);
    } else {
      const entries = (journalResult.value.data ?? []) as JournalEvidenceRow[];
      const todayEntry = entries.find((entry) => entry.entry_date === today);
      if (isNextronContextAllowed(permissions, "journal")) {
        journal = entries.length === 0 ? missing("No recent Journal entries found.") : available({ recentReflectionSnippet: safeJournalSnippet(entries[0]?.content) });
      }
      if (isNextronContextAllowed(permissions, "eveningShutdown")) {
        const parsed = parseEveningShutdownReflection(todayEntry?.content ?? "");
        const hasShutdown = Boolean(parsed.wentWell || parsed.gotInTheWay || parsed.learned || parsed.tomorrowSeed);
        eveningShutdown = available({ existsToday: hasShutdown, tomorrowSeed: hasShutdown ? safeText(parsed.tomorrowSeed, 160) : null });
      }
      if (isNextronContextAllowed(permissions, "weeklyReview")) {
        const currentReviewEntry = entries.find((entry) => entry.content?.includes("LIFE_PULSE_WEEKLY_REVIEW_START"));
        const parsed = parseWeeklyReviewReflection(currentReviewEntry?.content ?? "");
        const hasReview = Boolean(parsed.wentWell || parsed.movedForward || parsed.gotInTheWay || parsed.learned || parsed.continueDoing || parsed.changeNextWeek || parsed.focusNextWeek);
        weeklyReview = available({ existsThisWeek: hasReview, nextWeekFocus: hasReview ? safeText(parsed.focusNextWeek, 180) : null });
      }
    }
  }

  for (const [domain, section] of Object.entries({ profile, today: todaySection, tasks, habits, results, journal, eveningShutdown, weeklyReview, goals, projects, knowledge }) as Array<[NextronContextDomain, EvidenceSection]>) {
    permissionSummary[domain] = section.status;
    if (section.status === "error" && section.note) warnings.push(section.note);
  }

  // body evidence permission is metric-specific (health_preferences nextron_allowed_metrics), not generic domain
  // ensure body never leaks when storage off — already handled in body variable construction

  return {
    version: "nextron-evidence-v1",
    generatedForLocalDate: today,
    weekStart,
    permissionSummary,
    profile,
    today: todaySection,
    tasks,
    habits,
    results,
    journal,
    eveningShutdown,
    weeklyReview,
    knowledge,
    calendar,
    memory,
    goals,
    projects,
    relationships,
    body,
    wealth,
    warnings: Array.from(new Set(warnings)).slice(0, 4),
  };
}
