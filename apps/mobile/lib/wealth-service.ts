import { supabase } from "./supabase";
import { getWealthBalanceSummary, getWealthCashFlowSummary, getUpcomingWealthCommitments, type WealthAccount, type WealthTransaction, type WealthRecurringItem } from "@lifepulse/domain";

export async function ensureWealthRealm(): Promise<{ id: string; name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: existing } = await supabase.from("realms").select("id, name").eq("user_id", user.id).ilike("name", "Wealth").limit(1).maybeSingle();
  if (existing) return existing as any;
  const { data: created, error } = await supabase.from("realms").insert({ user_id: user.id, name: "Wealth", color: "#0ea5e9", icon: "wealth" }).select("id, name").single();
  if (error) {
    const { data: retry } = await supabase.from("realms").select("id, name").eq("user_id", user.id).ilike("name", "Wealth").limit(1).maybeSingle();
    return retry as any;
  }
  return created as any;
}

export async function loadWealthOverview() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const realm = await ensureWealthRealm();
  if (!realm) return null;
  const [accountsRes, txRes, recurRes, goalsRes, prefsRes] = await Promise.all([
    supabase.from("wealth_accounts").select("*").eq("user_id", user.id).eq("realm_id", realm.id).order("created_at"),
    supabase.from("wealth_transactions").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false }).limit(50),
    supabase.from("wealth_recurring_items").select("*").eq("user_id", user.id).eq("realm_id", realm.id).eq("is_active", true).order("next_due_date"),
    supabase.from("goals").select("id, title, status, target_date").eq("user_id", user.id).eq("realm_id", realm.id).limit(10),
    supabase.from("wealth_preferences").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const accounts = (accountsRes.data ?? []) as unknown as WealthAccount[];
  const transactions = (txRes.data ?? []) as unknown as WealthTransaction[];
  const recurrings = (recurRes.data ?? []) as unknown as WealthRecurringItem[];
  const balance = getWealthBalanceSummary(accounts);
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10); const end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
  const cash = transactions.length ? getWealthCashFlowSummary(transactions, { start, end })[0] : null;
  const upcoming7 = getUpcomingWealthCommitments(recurrings, new Date().toISOString().slice(0,10), 7);
  const upcoming30 = getUpcomingWealthCommitments(recurrings, new Date().toISOString().slice(0,10), 30);
  return { realm, accounts, balance, cashFlow: cash, recurrings, upcoming7, upcoming30, goals: goalsRes.data ?? [], prefs: prefsRes.data ?? null };
}
