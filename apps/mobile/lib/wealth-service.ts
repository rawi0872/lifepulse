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
  // Canonical: finance_* tables (realm_id optional, do not filter accounts by realm to preserve existing finance rows)
  const [accountsRes, txRes, recurRes, goalsRes, prefsRes] = await Promise.all([
    supabase.from("finance_accounts").select("id, user_id, realm_id, name, type, starting_balance, currency, is_archived, source_type, institution_name").eq("user_id", user.id).order("created_at"),
    supabase.from("finance_transactions").select("id, user_id, account_id, category_id, amount, type, title, note, transaction_date, linked_transaction_id").eq("user_id", user.id).order("transaction_date", { ascending: false }).limit(50),
    supabase.from("finance_recurring_items").select("id, user_id, realm_id, name, kind, amount, currency, frequency, next_due_date, account_id, category_id, is_active").eq("user_id", user.id).eq("is_active", true).order("next_due_date"),
    supabase.from("goals").select("id, title, status, target_date, goal_type, target_metric").eq("user_id", user.id).eq("realm_id", realm.id).limit(10),
    supabase.from("finance_preferences").select("user_id, base_currency, nextron_access_enabled, nextron_allowed_sections").eq("user_id", user.id).maybeSingle(),
  ]);
  // Map finance_* rows to domain shapes (numeric amounts, currency handling)
  const accounts = (accountsRes.data ?? []).map((r: any) => ({
    id: r.id, user_id: r.user_id, realm_id: r.realm_id ?? null, name: r.name, type: r.type, starting_balance: Number(r.starting_balance), currency: r.currency, is_archived: !!r.is_archived, source_type: r.source_type, institution_name: r.institution_name,
  })) as WealthAccount[];
  const transactions = (txRes.data ?? []).map((r: any) => ({
    id: r.id, user_id: r.user_id, account_id: r.account_id, category_id: r.category_id, amount: Number(r.amount), type: r.type, title: r.title, note: r.note, transaction_date: r.transaction_date, linked_transaction_id: r.linked_transaction_id, currency: null as string | null,
  })) as WealthTransaction[];
  // Derive currency per transaction from its account (fallback ILS)
  const accCurrency = new Map<string,string>(accounts.map(a=>[a.id, a.currency]));
  for (const t of transactions) (t as any).currency = t.account_id ? (accCurrency.get(t.account_id) ?? "ILS") : "ILS";
  const recurrings = (recurRes.data ?? []).map((r: any)=> ({
    id: r.id, user_id: r.user_id, realm_id: r.realm_id ?? null, name: r.name, kind: r.kind, amount: Number(r.amount), currency: r.currency, frequency: r.frequency, next_due_date: r.next_due_date, account_id: r.account_id, category_id: r.category_id, is_active: r.is_active,
  })) as WealthRecurringItem[];
  const balance = getWealthBalanceSummary(accounts);
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10); const end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
  const cash = transactions.length ? getWealthCashFlowSummary(transactions, { start, end })[0] : null;
  const upcoming7 = getUpcomingWealthCommitments(recurrings, new Date().toISOString().slice(0,10), 7);
  const upcoming30 = getUpcomingWealthCommitments(recurrings, new Date().toISOString().slice(0,10), 30);
  return { realm, accounts, balance, cashFlow: cash, recurrings, upcoming7, upcoming30, goals: goalsRes.data ?? [], prefs: prefsRes.data ?? null };
}
