// Canonical Wealth mutations for web (parity with mobile wealth-service).
// Same tables, same invariants: manual-first balances, paired transfers
// with linked cleanup, transfer/adjustment excluded from cash flow,
// same-currency transfers only, fail-closed ownership scoping.
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWealthAmount, WEALTH_ACCOUNT_TYPE_OPTIONS } from "@lifepulse/domain";

const ACCOUNT_TYPES = WEALTH_ACCOUNT_TYPE_OPTIONS.map((o) => o.value);

async function requireUserId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  return user.id;
}

export interface WealthAccountInput {
  name: string;
  type: string;
  startingBalance: string;
  currency: string;
  institutionName?: string | null;
}

export function validateWealthAccount(input: WealthAccountInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!ACCOUNT_TYPES.includes(input.type as never)) return "Choose a valid account type.";
  if (parseWealthAmount(input.startingBalance) === null) return "Enter a valid non-negative balance.";
  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) return "Use a 3-letter currency code.";
  return null;
}

export async function createWealthAccount(supabase: SupabaseClient, input: WealthAccountInput) {
  const userId = await requireUserId(supabase);
  const error = validateWealthAccount(input);
  if (error) throw new Error(error);
  const { error: err } = await supabase.from("finance_accounts").insert({
    user_id: userId,
    name: input.name.trim(),
    type: input.type,
    starting_balance: parseWealthAmount(input.startingBalance) ?? 0,
    currency: input.currency.trim().toUpperCase(),
    institution_name: input.institutionName?.trim() || null,
    source_type: "manual",
  });
  if (err) throw err;
}

export async function updateWealthAccount(supabase: SupabaseClient, id: string, input: WealthAccountInput) {
  const userId = await requireUserId(supabase);
  const error = validateWealthAccount(input);
  if (error) throw new Error(error);
  const { error: err } = await supabase
    .from("finance_accounts")
    .update({
      name: input.name.trim(),
      type: input.type,
      starting_balance: parseWealthAmount(input.startingBalance) ?? 0,
      currency: input.currency.trim().toUpperCase(),
      institution_name: input.institutionName?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (err) throw err;
}

export async function archiveWealthAccount(supabase: SupabaseClient, id: string, archived: boolean) {
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("finance_accounts")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteWealthAccount(supabase: SupabaseClient, id: string) {
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("finance_accounts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function createWealthTransaction(supabase: SupabaseClient, input: {
  accountId: string | null;
  categoryId: string | null;
  amount: number;
  type: string;
  title: string;
  note?: string | null;
  transactionDate: string;
}) {
  const userId = await requireUserId(supabase);
  if (!input.accountId) throw new Error("Account is required.");
  const { error } = await supabase.from("finance_transactions").insert({
    user_id: userId,
    account_id: input.accountId,
    category_id: input.categoryId,
    amount: input.amount,
    type: input.type,
    title: input.title.trim(),
    note: input.note ?? null,
    transaction_date: input.transactionDate,
  });
  if (error) throw error;
}

export async function createWealthTransfer(supabase: SupabaseClient, input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transactionDate: string;
  title?: string;
  note?: string | null;
}) {
  if (input.fromAccountId === input.toAccountId) throw new Error("Choose two different accounts.");
  const userId = await requireUserId(supabase);
  const { data: accs } = await supabase
    .from("finance_accounts")
    .select("id, currency")
    .in("id", [input.fromAccountId, input.toAccountId])
    .eq("user_id", userId);
  if (!accs || accs.length !== 2) throw new Error("Accounts not found.");
  if (accs[0].currency !== accs[1].currency) throw new Error("Transfers need same-currency accounts.");
  const title = input.title?.trim() || `Transfer ${accs[0].currency}`;
  const first = await supabase
    .from("finance_transactions")
    .insert({
      user_id: userId,
      account_id: input.fromAccountId,
      amount: input.amount,
      type: "transfer",
      title: `${title} →`,
      transaction_date: input.transactionDate,
      note: input.note ?? null,
    })
    .select("id")
    .single();
  if (first.error) throw first.error;
  const second = await supabase
    .from("finance_transactions")
    .insert({
      user_id: userId,
      account_id: input.toAccountId,
      amount: input.amount,
      type: "transfer",
      title: `${title} ←`,
      transaction_date: input.transactionDate,
      note: input.note ?? null,
      linked_transaction_id: first.data.id,
    })
    .select("id")
    .single();
  if (second.error) {
    await supabase.from("finance_transactions").delete().eq("id", first.data.id).eq("user_id", userId);
    throw second.error;
  }
  await supabase
    .from("finance_transactions")
    .update({ linked_transaction_id: second.data.id })
    .eq("id", first.data.id)
    .eq("user_id", userId);
}

export async function deleteWealthTransaction(supabase: SupabaseClient, id: string) {
  const userId = await requireUserId(supabase);
  const { data: row } = await supabase
    .from("finance_transactions")
    .select("linked_transaction_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await supabase.from("finance_transactions").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  const linked = (row as { linked_transaction_id: string | null } | null)?.linked_transaction_id;
  if (linked) {
    await supabase.from("finance_transactions").delete().eq("id", linked).eq("user_id", userId);
  }
}

export async function createWealthRecurring(supabase: SupabaseClient, input: {
  name: string;
  kind: string;
  amount: number;
  currency: string;
  frequency: string;
  nextDueDate: string;
  accountId?: string | null;
  categoryId?: string | null;
}) {
  const userId = await requireUserId(supabase);
  if (!input.name.trim()) throw new Error("Name is required.");
  if (!["bill", "subscription", "income"].includes(input.kind)) throw new Error("Choose bill, subscription, or income.");
  if (!["weekly", "monthly", "quarterly", "yearly"].includes(input.frequency)) throw new Error("Choose a valid frequency.");
  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) throw new Error("Use a 3-letter currency code.");
  const { error } = await supabase.from("finance_recurring_items").insert({
    user_id: userId,
    name: input.name.trim(),
    kind: input.kind,
    amount: input.amount,
    currency: input.currency.trim().toUpperCase(),
    frequency: input.frequency,
    next_due_date: input.nextDueDate,
    account_id: input.accountId ?? null,
    category_id: input.categoryId ?? null,
    is_active: true,
  });
  if (error) throw error;
}

export async function setWealthRecurringActive(supabase: SupabaseClient, id: string, active: boolean) {
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("finance_recurring_items")
    .update({ is_active: active })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function advanceWealthRecurring(supabase: SupabaseClient, id: string): Promise<string> {
  const userId = await requireUserId(supabase);
  const { data: row, error: fetchError } = await supabase
    .from("finance_recurring_items")
    .select("id, frequency, next_due_date")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (fetchError || !row) throw fetchError ?? new Error("Not found.");
  const next = new Date(`${row.next_due_date}T12:00:00`);
  if (row.frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (row.frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else if (row.frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  const { error } = await supabase
    .from("finance_recurring_items")
    .update({ next_due_date: nextDate })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  return nextDate;
}

export async function deleteWealthRecurring(supabase: SupabaseClient, id: string) {
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("finance_recurring_items").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export const WEALTH_GOAL_OPTIONS = [
  { value: "savings_target", label: "Save money" },
  { value: "net_worth_target", label: "Reach net worth" },
  { value: "debt_payoff", label: "Pay off debt" },
  { value: "emergency_fund", label: "Build emergency fund" },
  { value: "investment_contribution", label: "Investment contribution" },
  { value: "general", label: "General financial goal" },
] as const;

export async function createWealthGoal(supabase: SupabaseClient, realmId: string, input: {
  title: string;
  goalType: string;
  targetMetric: string;
  targetValue?: number | null;
  targetUnit?: string | null;
  targetDate?: string | null;
}) {
  const userId = await requireUserId(supabase);
  if (!input.title.trim()) throw new Error("Title is required.");
  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    realm_id: realmId,
    title: input.title.trim(),
    status: "active",
    goal_type: input.goalType,
    target_metric: input.targetMetric,
    target_value: input.targetValue ?? null,
    target_unit: input.targetUnit ?? null,
    baseline_value: null,
    target_date: input.targetDate || null,
  });
  if (error) throw error;
}

export async function deleteWealthGoal(supabase: SupabaseClient, id: string) {
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function setWealthBaseCurrency(supabase: SupabaseClient, currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Use a 3-letter currency code.");
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("finance_preferences")
    .upsert({ user_id: userId, base_currency: currency }, { onConflict: "user_id" });
  if (error) throw error;
}
