// Web adapter for the Today wealth hero (parity with mobile
// loadWealthTodayCandidate). Same bounded deterministic semantics:
// recurring due-7d / overdue-30d, realm-filtered tasks/habits,
// deriveWealthSignalsV2, strong signals only, fail-closed (null).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveWealthSignalsV2,
  getWealthRecurringIntelligence,
  type WealthSignalV2,
  type WealthRecurringItem,
} from "@lifepulse/domain";

export async function ensureWebWealthRealm(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("realms")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", "Wealth")
    .limit(1)
    .maybeSingle();
  const id = (existing as { id: string } | null)?.id ?? null;
  if (id) return id;
  const { data: created, error } = await supabase
    .from("realms")
    .insert({ user_id: userId, name: "Wealth", color: "#0ea5e9", icon: "wealth" })
    .select("id")
    .single();
  if (error || !created) return null;
  return (created as { id: string }).id;
}

async function findWealthRealmId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  return ensureWebWealthRealm(supabase, userId);
}

export async function loadWebWealthTodayCandidate(
  supabase: SupabaseClient,
  todayStr: string,
): Promise<WealthSignalV2 | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const realmId = await findWealthRealmId(supabase, user.id);
  if (!realmId) return null;

  const [recurRes, tasksRes, habitsRes] = await Promise.all([
    supabase
      .from("finance_recurring_items")
      .select("id, name, kind, amount, currency, next_due_date, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("next_due_date")
      .limit(20),
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .eq("user_id", user.id)
      .eq("status", "todo")
      .eq("realm_id", realmId)
      .limit(10),
    supabase
      .from("habits")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("realm_id", realmId)
      .limit(10),
  ]);

  const tasksData = tasksRes.error ? [] : ((tasksRes.data ?? []) as Array<{ id: string; title: string; due_date: string | null }>);
  const habitsData = habitsRes.error ? [] : ((habitsRes.data ?? []) as Array<{ id: string; title: string }>);
  const allRecur = ((recurRes.data ?? []) as WealthRecurringItem[]).filter((r) => r.next_due_date);
  const intel = getWealthRecurringIntelligence(allRecur, todayStr);
  const overdueBounded = intel.overdue.filter((r) => {
    const diff = (new Date(r.next_due_date).getTime() - new Date(todayStr).getTime()) / 86400000;
    return diff >= -30 && diff < 0;
  });
  const weekAgo = new Date(new Date(todayStr).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const tasksDue = tasksData
    .filter((t) => t.due_date && t.due_date <= todayStr && t.due_date >= weekAgo)
    .slice(0, 2)
    .map((t) => ({ id: t.id, title: t.title }));
  const habitsDue = habitsData.slice(0, 1).map((h) => ({ id: h.id, title: h.title }));
  const signals = deriveWealthSignalsV2({
    billsDue: intel.due7.filter((r) => r.kind === "bill"),
    subsDue: intel.due7.filter((r) => r.kind === "subscription"),
    tasksDue,
    habitsDue,
    goalsDue: [],
    insights: [],
  });
  const strong = signals.filter((s) => s.strength === "strong");
  if (strong.length === 0) {
    if (overdueBounded.length > 0) {
      const r = overdueBounded[0];
      return {
        kind: "wealth_bill_due",
        priority: 10,
        title: r.name,
        rationale: `Scheduled date for ${r.name} has passed`,
        dueDate: r.next_due_date,
        sourceId: r.id,
        strength: "strong",
      } as unknown as WealthSignalV2;
    }
    return null;
  }
  return strong.sort((a, b) => a.priority - b.priority || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0] ?? null;
}
