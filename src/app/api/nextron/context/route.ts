import { NextResponse } from "next/server";
import { runNextronCalendarReadOnly } from "@/lib/nextron/calendar";
import type { NextronUserRequest } from "@/lib/nextron/coach";
import { normalizeNextronPreferences, type NextronPreferenceRow } from "@/lib/nextron/context";
import { buildNextronEvidencePacket } from "@/lib/nextron/evidence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_task_actions, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";
const PROJECT_PANEL_LIMIT = 4;
const CALENDAR_PANEL_LIMIT = 4;

interface PanelProjectRow { id: string; title: string | null; status: string | null; updated_at: string | null }

function cleanDisplayText(value: string | null | undefined, max = 90): string {
  const text = value?.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>`]/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return (text || "Untitled").slice(0, max);
}

function countValue(count: number | null): number {
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

function todayCalendarRequest(): NextronUserRequest {
  return {
    rawPrompt: "What do I have today?",
    normalizedPrompt: "what do i have today",
    intent: "CALENDAR_QUERY",
    handlingStatus: "handled",
    confidence: "high",
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load NEXTRON context." }, { status: 401 });
  const userId = user.id;

  const { data } = await supabase
    .from("nextron_context_preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  const { permissions } = normalizeNextronPreferences(data as NextronPreferenceRow | null);
  const packet = await buildNextronEvidencePacket(supabase, userId, permissions);

  const [projectsResult, projectTasksResult, knowledgeCountResult, driveCountResult, memoryCountResult, calendarResult] = await Promise.allSettled([
    permissions.projects === "allowed"
      ? supabase.from("projects").select("id, title, status, updated_at").eq("user_id", userId).eq("status", "active").order("updated_at", { ascending: false }).limit(PROJECT_PANEL_LIMIT)
      : Promise.resolve(null),
    permissions.projects === "allowed"
      ? supabase.from("tasks").select("project_id").eq("user_id", userId).eq("status", "todo").not("project_id", "is", null).limit(200)
      : Promise.resolve(null),
    permissions.knowledge === "allowed"
      ? supabase.from("knowledge_items").select("id", { count: "exact", head: true }).eq("user_id", userId)
      : Promise.resolve(null),
    permissions.drive === "allowed"
      ? supabase.from("google_drive_imports").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active")
      : Promise.resolve(null),
    supabase.from("nextron_memories").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "PREFERENCE").eq("status", "ACTIVE").eq("confirmed_by_user", true),
    runNextronCalendarReadOnly({ supabase, userId, permissions, request: todayCalendarRequest() }),
  ]);

  const projectTaskCounts = new Map<string, number>();
  if (projectTasksResult.status === "fulfilled" && projectTasksResult.value && !projectTasksResult.value.error) {
    for (const row of (projectTasksResult.value.data ?? []) as Array<{ project_id: string | null }>) {
      if (row.project_id) projectTaskCounts.set(row.project_id, (projectTaskCounts.get(row.project_id) ?? 0) + 1);
    }
  }

  const projectRows = projectsResult.status === "fulfilled" && projectsResult.value && !projectsResult.value.error
    ? (projectsResult.value.data ?? []) as PanelProjectRow[]
    : [];

  const now = Date.now();
  const calendar = calendarResult.status === "fulfilled" ? calendarResult.value : { ok: false as const, reason: "CALENDAR_API_UNAVAILABLE" as const, toolsUsed: [] };
  const calendarEvents = calendar.ok
    ? calendar.events
        .filter((event) => Date.parse(event.endsAt ?? event.startsAt) >= now)
        .slice(0, CALENDAR_PANEL_LIMIT)
        .map((event) => ({ title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay }))
    : [];

  return NextResponse.json({
    packet,
    panels: {
      today: {
        localDate: packet.generatedForLocalDate,
        tasksRemaining: packet.tasks.data?.dueTodayCount ?? packet.today.data?.dueTodayTaskCount ?? 0,
        completedToday: packet.tasks.data?.completedTodayCount ?? packet.today.data?.completedTodayTaskCount ?? 0,
        overdue: packet.tasks.data?.overdueCount ?? packet.today.data?.overdueTaskCount ?? 0,
        habitsDue: packet.habits.data?.dueTodayCount ?? packet.today.data?.dueHabitCount ?? 0,
        habitsCompleted: packet.habits.data?.completedTodayCount ?? packet.today.data?.completedHabitCount ?? 0,
        status: packet.today.status,
      },
      projects: {
        status: packet.projects.status,
        activeCount: packet.projects.data?.activeCount ?? 0,
        items: projectRows.map((project) => ({ title: cleanDisplayText(project.title), openTaskCount: projectTaskCounts.get(project.id) ?? 0 })).slice(0, PROJECT_PANEL_LIMIT),
        limit: PROJECT_PANEL_LIMIT,
      },
      calendar: calendar.ok
        ? { status: "available", events: calendarEvents, moreTodayCount: Math.max(0, calendar.events.filter((event) => Date.parse(event.endsAt ?? event.startsAt) >= now).length - calendarEvents.length), readOnly: true }
        : { status: permissions.calendar !== "allowed" ? "permission_denied" : calendar.reason === "DISCONNECTED" ? "disconnected" : calendar.reason === "RECONNECT_REQUIRED" ? "reconnect_required" : "unavailable", events: [], moreTodayCount: 0, readOnly: true },
      systems: {
        knowledge: { status: packet.knowledge.status, count: permissions.knowledge === "allowed" && knowledgeCountResult.status === "fulfilled" && knowledgeCountResult.value ? countValue(knowledgeCountResult.value.count) : null },
        memory: { status: memoryCountResult.status === "fulfilled" ? "available" : "unavailable", count: memoryCountResult.status === "fulfilled" && memoryCountResult.value ? countValue(memoryCountResult.value.count) : null },
        drive: { status: permissions.drive === "allowed" ? "available" : "permission_denied", count: permissions.drive === "allowed" && driveCountResult.status === "fulfilled" && driveCountResult.value ? countValue(driveCountResult.value.count) : null },
        calendar: { status: permissions.calendar !== "allowed" ? "permission_denied" : calendar.ok ? "available" : calendar.reason === "DISCONNECTED" ? "disconnected" : calendar.reason === "RECONNECT_REQUIRED" ? "reconnect_required" : "unavailable" },
        weeklyReview: { status: packet.weeklyReview.status, existsThisWeek: packet.weeklyReview.data?.existsThisWeek ?? false },
      },
    },
  });
}
