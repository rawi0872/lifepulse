import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WeeklyOutcome,
  WeeklyPlan,
  WeeklyPlanLink,
  WeeklyPlanLinkType,
  WeeklyPlanSnapshot,
} from "@lifepulse/domain";
import {
  buildWeeklyOutcomeInsert,
  buildWeeklyOutcomeUpdate,
  buildWeeklyPlanInsert,
  nextOutcomePosition,
  orderOutcomes,
} from "@lifepulse/domain";

export interface PlanOption {
  id: string;
  title: string;
  subtitle?: string | null;
}

/** Load the current-week plan (plan + outcomes + links), or null when none exists. */
export async function loadWeeklyPlan(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<WeeklyPlanSnapshot | null> {
  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError || !plan) return null;

  const [outcomesRes, linksRes] = await Promise.all([
    supabase
      .from("weekly_outcomes")
      .select("*")
      .eq("plan_id", (plan as WeeklyPlan).id)
      .order("position", { ascending: true }),
    supabase
      .from("weekly_plan_links")
      .select("*")
      .eq("plan_id", (plan as WeeklyPlan).id)
      .order("created_at", { ascending: true }),
  ]);

  return {
    plan: plan as WeeklyPlan,
    outcomes: orderOutcomes(((outcomesRes.data ?? []) as WeeklyOutcome[])),
    links: (linksRes.data ?? []) as WeeklyPlanLink[],
  };
}

/** Create the week plan row (idempotent per user/week). */
export async function createWeeklyPlan(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  intention?: string | null,
): Promise<WeeklyPlan | null> {
  const payload = buildWeeklyPlanInsert({ user_id: userId, week_start: weekStart, week_end: weekStart, intention });
  const { data, error } = await supabase
    .from("weekly_plans")
    .insert(payload)
    .select("*")
    .single();
  if (error) return null;
  return data as WeeklyPlan;
}

/** Update the weekly intention/title. */
export async function updatePlanIntention(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  intention: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("weekly_plans")
    .update({ intention: intention?.trim() ? intention.trim() : null })
    .eq("id", planId)
    .eq("user_id", userId);
  return !error;
}

/** Add an outcome at the next free position (max 3). */
export async function addWeeklyOutcome(
  supabase: SupabaseClient,
  snapshot: WeeklyPlanSnapshot,
  text: string,
): Promise<WeeklyOutcome | null> {
  const position = nextOutcomePosition(snapshot.outcomes);
  if (position === null) return null;
  const payload = buildWeeklyOutcomeInsert({
    user_id: snapshot.plan.user_id,
    plan_id: snapshot.plan.id,
    position,
    text,
  });
  if (!payload) return null;
  const { data, error } = await supabase
    .from("weekly_outcomes")
    .insert(payload)
    .select("*")
    .single();
  if (error) return null;
  return data as WeeklyOutcome;
}

/** Edit outcome text/links/done. Returns false when nothing changes. */
export async function updateWeeklyOutcome(
  supabase: SupabaseClient,
  userId: string,
  current: WeeklyOutcome,
  edits: { text?: string; done?: boolean; goal_id?: string | null; project_id?: string | null },
): Promise<boolean> {
  const payload = buildWeeklyOutcomeUpdate(current, edits);
  if (!payload) return false;
  const { error } = await supabase
    .from("weekly_outcomes")
    .update(payload)
    .eq("id", current.id)
    .eq("user_id", userId);
  return !error;
}

/** Delete an outcome (links to goals/projects die with it; tasks/habits survive). */
export async function deleteWeeklyOutcome(
  supabase: SupabaseClient,
  userId: string,
  outcomeId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("weekly_outcomes")
    .delete()
    .eq("id", outcomeId)
    .eq("user_id", userId);
  return !error;
}

/** Set exactly one Must Win (or clear with null). DB partial index enforces max 1. */
export async function setMustWin(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  outcomeId: string | null,
  outcomes: WeeklyOutcome[],
): Promise<boolean> {
  const clearing = outcomes.filter((o) => o.must_win && o.id !== outcomeId);
  for (const outcome of clearing) {
    const { error } = await supabase
      .from("weekly_outcomes")
      .update({ must_win: false })
      .eq("id", outcome.id)
      .eq("user_id", userId);
    if (error) return false;
  }
  if (outcomeId) {
    const { error } = await supabase
      .from("weekly_outcomes")
      .update({ must_win: true })
      .eq("id", outcomeId)
      .eq("plan_id", planId)
      .eq("user_id", userId);
    if (error) return false;
  }
  return true;
}

/** Link an existing task or habit as week support (reference only, never a copy). */
export async function addPlanLink(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  linkedType: WeeklyPlanLinkType,
  linkedId: string,
): Promise<WeeklyPlanLink | null> {
  const { data, error } = await supabase
    .from("weekly_plan_links")
    .insert({ user_id: userId, plan_id: planId, linked_type: linkedType, linked_id: linkedId })
    .select("*")
    .single();
  if (error) return null;
  return data as WeeklyPlanLink;
}

/** Remove a plan link (the task/habit itself is untouched). */
export async function removePlanLink(
  supabase: SupabaseClient,
  userId: string,
  linkId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("weekly_plan_links")
    .delete()
    .eq("id", linkId)
    .eq("user_id", userId);
  return !error;
}

/**
 * Minimal Today bridge (Prompt 1): does a week plan exist, and what is its
 * Must Win? Today shows "Plan your week" or "This week's Must Win".
 */
export async function loadTodayPlanBridge(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<{ hasPlan: boolean; mustWin: string | null }> {
  const { data: plan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!plan) return { hasPlan: false, mustWin: null };
  const { data: win } = await supabase
    .from("weekly_outcomes")
    .select("text")
    .eq("plan_id", (plan as { id: string }).id)
    .eq("must_win", true)
    .maybeSingle();
  return { hasPlan: true, mustWin: (win as { text: string } | null)?.text ?? null };
}

/** Link option lists for the editors (active goals/projects, open tasks, habits). */
export async function loadPlanLinkOptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ goals: PlanOption[]; projects: PlanOption[]; tasks: PlanOption[]; habits: PlanOption[] }> {
  const [goalsRes, projectsRes, tasksRes, habitsRes] = await Promise.all([
    supabase.from("goals").select("id, title, status").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(100),
    supabase.from("projects").select("id, title, status").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(100),
    supabase.from("tasks").select("id, title, status").eq("user_id", userId).eq("status", "todo").order("created_at", { ascending: false }).limit(200),
    supabase.from("habits").select("id, title").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
  ]);
  const map = (rows: unknown, subtitle?: (row: { status?: string }) => string | null): PlanOption[] =>
    ((rows ?? []) as { id: string; title: string; status?: string }[]).map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: subtitle?.(r) ?? null,
    }));
  return {
    goals: map(goalsRes.data),
    projects: map(projectsRes.data),
    tasks: map(tasksRes.data),
    habits: map(habitsRes.data),
  };
}
