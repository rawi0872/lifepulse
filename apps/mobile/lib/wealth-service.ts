import { supabase } from "./supabase";
import { getWealthBalanceSummary, getWealthCashFlowSummary, getUpcomingWealthCommitments, type WealthAccount, type WealthTransaction, type WealthRecurringItem } from "@lifepulse/domain";

// ── Realm ──
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

// ── Recent vs Cash-flow separation (fix 50-row truncation) ──
export async function loadRecentWealthTransactions(limit = 50) {
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return [];
  const { data } = await supabase.from("finance_transactions").select("id, user_id, account_id, category_id, amount, type, title, note, transaction_date, linked_transaction_id, created_at, finance_accounts(name, currency), finance_categories(name, type)").eq("user_id", user.id).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  // currency: join or null (unknown) — do not fake ILS for null account
  return (data ?? []).map((r: any) => ({
    id: r.id, user_id: r.user_id, account_id: r.account_id, category_id: r.category_id, amount: Number(r.amount), type: r.type, title: r.title, note: r.note, transaction_date: r.transaction_date, linked_transaction_id: r.linked_transaction_id, currency: (r.finance_accounts as any)?.currency ?? null, raw: r,
  })) as Array<WealthTransaction & { raw?: any }>;
}
export async function loadWealthCashFlowTransactions(period: { start: string; end: string }) {
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return [] as Array<WealthTransaction & { raw?: any }>;
  // bounded, complete, no LIMIT — all transactions in requested window
  const { data } = await supabase.from("finance_transactions").select("id, user_id, account_id, category_id, amount, type, title, transaction_date, linked_transaction_id, finance_accounts(currency)").eq("user_id", user.id).gte("transaction_date", period.start).lte("transaction_date", period.end).order("transaction_date", { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id, user_id: r.user_id, account_id: r.account_id, category_id: r.category_id, amount: Number(r.amount), type: r.type, title: r.title, transaction_date: r.transaction_date, linked_transaction_id: r.linked_transaction_id, currency: (r.finance_accounts as any)?.currency ?? null, raw: r,
  })) as Array<WealthTransaction & { raw?: any }>;
}

// ── Overview (now correct) ──
export async function loadWealthOverview() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const realm = await ensureWealthRealm();
  if (!realm) return null;
  const now = new Date(); const y=now.getFullYear(), mm=now.getMonth()+1;
  const monthStart = `${y}-${String(mm).padStart(2,'0')}-01`;
  const monthEnd = `${y}-${String(mm).padStart(2,'0')}-${String(new Date(y, mm, 0).getDate()).padStart(2,'0')}`;
  const threeM = new Date(y, mm-3, 1); // two months before
  const threeY=threeM.getFullYear(), threeMo=threeM.getMonth()+1;
  const threeStart = `${threeY}-${String(threeMo).padStart(2,'0')}-01`;
  const [accountsRes, recentRes, cashMonthRes, cash3Res, catRes, recurRes, goalsRes, prefsRes] = await Promise.all([
    supabase.from("finance_accounts").select("id, user_id, realm_id, name, type, starting_balance, currency, is_archived, source_type, institution_name, created_at").eq("user_id", user.id).order("created_at"),
    loadRecentWealthTransactions(50),
    loadWealthCashFlowTransactions({ start: monthStart, end: monthEnd }),
    loadWealthCashFlowTransactions({ start: threeStart, end: monthEnd }),
    supabase.from("finance_categories").select("id, name, type").eq("user_id", user.id).order("name"),
    supabase.from("finance_recurring_items").select("id, user_id, realm_id, name, kind, amount, currency, frequency, next_due_date, account_id, category_id, is_active, created_at").eq("user_id", user.id).eq("is_active", true).order("next_due_date"),
    supabase.from("goals").select("id, title, status, target_date, goal_type, target_metric, target_value, target_unit").eq("user_id", user.id).eq("realm_id", realm.id).limit(10),
    supabase.from("finance_preferences").select("user_id, base_currency, nextron_access_enabled, nextron_allowed_sections").eq("user_id", user.id).maybeSingle(),
  ]);
  const accounts = (accountsRes.data ?? []).map((r: any) => ({
    id: r.id, user_id: r.user_id, realm_id: r.realm_id ?? null, name: r.name, type: r.type, starting_balance: Number(r.starting_balance), currency: r.currency, is_archived: !!r.is_archived, source_type: r.source_type, institution_name: r.institution_name,
  })) as WealthAccount[];
  const transactions = recentRes as Array<WealthTransaction & { raw?: any }>;
  const cashMonthTx = cashMonthRes as Array<WealthTransaction & { raw?: any }>;
  const cash3Tx = cash3Res as Array<WealthTransaction & { raw?: any }>;
  const recurrings = (recurRes.data ?? []).map((r: any)=> ({
    id: r.id, user_id: r.user_id, realm_id: r.realm_id ?? null, name: r.name, kind: r.kind, amount: Number(r.amount), currency: r.currency, frequency: r.frequency, next_due_date: r.next_due_date, account_id: r.account_id, category_id: r.category_id, is_active: r.is_active,
  })) as WealthRecurringItem[];
  const categories = (catRes.data ?? []) as Array<{id:string; name:string; type:string}>;
  const balance = getWealthBalanceSummary(accounts);
  // period summaries now from complete sets, with multi-currency grouping and unknown detection
  function perCurrencySummary(txs: Array<WealthTransaction & { currency: string | null }>, period:{start:string;end:string}){
    const byCur = new Map<string,{income:number;expenses:number;count:number;unknown:number}>();
    for(const t of txs){
      if(t.type==="transfer"||t.type==="adjustment") continue;
      const cur = (t as any).currency as string | null;
      if(!cur){ // legacy null account → unknown, track partial
        const k="__unknown"; let s=byCur.get(k); if(!s) { s={income:0,expenses:0,count:0,unknown:0}; byCur.set(k,s);} s.unknown++; continue;
      }
      let s=byCur.get(cur!); if(!s) { s={income:0,expenses:0,count:0,unknown:0}; byCur.set(cur!,s);}
      if(t.type==="income") s.income+=t.amount; else if(t.type==="expense") s.expenses+=t.amount; s.count++;
    }
    return Array.from(byCur.entries()).filter(([k])=>k!=="__unknown").map(([cur,s])=> ({ currency:cur, income:s.income, expenses:s.expenses, net: s.income-s.expenses, count:s.count, unknown: (byCur.get("__unknown")?.unknown ?? 0) }));
  }
  const cashByCurrencyMonth = perCurrencySummary(cashMonthTx as any, { start: monthStart, end: monthEnd });
  const cashByCurrency3 = perCurrencySummary(cash3Tx as any, { start: threeStart, end: monthEnd });
  const upcoming7 = getUpcomingWealthCommitments(recurrings, new Date().toISOString().slice(0,10), 7);
  const upcoming30 = getUpcomingWealthCommitments(recurrings, new Date().toISOString().slice(0,10), 30);
  return { realm, accounts, transactions, categories, recurrings, balance, cashMonthTx, cash3Tx, cashByCurrencyMonth, cashByCurrency3, monthBounds:{start:monthStart,end:monthEnd}, threeBounds:{start:threeStart,end:monthEnd}, upcoming7, upcoming30, goals: goalsRes.data ?? [], prefs: prefsRes.data ?? null, errors: { accounts: accountsRes.error, recurrings: recurRes.error } };
}

// ── Accounts ──
export async function createWealthAccount(input: { name:string; type:string; starting_balance:number; currency:string; institution_name?: string|null }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { data, error } = await supabase.from("finance_accounts").insert({ user_id:user.id, name: input.name.trim(), type: input.type, starting_balance: input.starting_balance, currency: input.currency, institution_name: input.institution_name ?? null, source_type:"manual" }).select("id").single();
  if(error) throw error; return data;
}
export async function updateWealthAccount(id:string, patch: { name?:string; type?:string; starting_balance?:number; currency?:string; institution_name?:string|null }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const row: any = {}; if(patch.name!==undefined) row.name = patch.name.trim(); if(patch.type!==undefined) row.type = patch.type; if(patch.starting_balance!==undefined) row.starting_balance = patch.starting_balance; if(patch.currency!==undefined) row.currency = patch.currency; if(patch.institution_name!==undefined) row.institution_name = patch.institution_name;
  const { error } = await supabase.from("finance_accounts").update(row).eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}
export async function archiveWealthAccount(id:string, is_archived:boolean){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { error } = await supabase.from("finance_accounts").update({ is_archived }).eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}
export async function deleteWealthAccount(id:string){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { error } = await supabase.from("finance_accounts").delete().eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}

// ── Categories ──
export async function createWealthCategory(input:{ name:string; type:"income"|"expense"}){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { data, error } = await supabase.from("finance_categories").insert({ user_id:user.id, name: input.name.trim(), type: input.type }).select("id, name, type").single();
  if(error) throw error; return data;
}
export async function listWealthCategories(){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) return [];
  const { data } = await supabase.from("finance_categories").select("id, name, type").eq("user_id", user.id).order("name"); return data ?? [];
}

// ── Transactions ──
export async function createWealthTransaction(input:{ account_id:string|null; category_id:string|null; amount:number; type:string; title:string; note?:string|null; transaction_date:string }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { data, error } = await supabase.from("finance_transactions").insert({ user_id:user.id, account_id: input.account_id, category_id: input.category_id, amount: input.amount, type: input.type, title: input.title.trim(), note: input.note ?? null, transaction_date: input.transaction_date }).select("id").single();
  if(error) throw error; return data;
}
// Paired transfer: creates two transfer rows linked via linked_transaction_id, compensates on second failure
export async function createPairedTransfer(input:{ from_account_id:string; to_account_id:string; amount:number; transaction_date:string; title?:string; note?:string }){
  if(input.from_account_id===input.to_account_id) throw new Error("same account");
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  // verify same currency (client-side)
  const { data: accs } = await supabase.from("finance_accounts").select("id, currency, user_id").in("id", [input.from_account_id, input.to_account_id]).eq("user_id", user.id);
  if(!accs || accs.length!==2) throw new Error("accounts not found/owned");
  if(accs[0].currency!==accs[1].currency) throw new Error("cross-currency not supported in V1");
  const title = (input.title?.trim() ? input.title.trim() : `Transfer ${accs.find(a=>a.id===input.from_account_id)?.currency ?? ""}`);
  const r1 = await supabase.from("finance_transactions").insert({ user_id:user.id, account_id: input.from_account_id, amount: input.amount, type:"transfer", title: `${title} →`, transaction_date: input.transaction_date, note: input.note ?? null }).select("id").single();
  if(r1.error) throw r1.error;
  const r2 = await supabase.from("finance_transactions").insert({ user_id:user.id, account_id: input.to_account_id, amount: input.amount, type:"transfer", title: `${title} ←`, transaction_date: input.transaction_date, note: input.note ?? null, linked_transaction_id: r1.data.id }).select("id").single();
  if(r2.error){ await supabase.from("finance_transactions").delete().eq("id", r1.data.id).eq("user_id", user.id); throw r2.error; }
  // link back first row to second
  await supabase.from("finance_transactions").update({ linked_transaction_id: r2.data.id }).eq("id", r1.data.id).eq("user_id", user.id);
  return { from: r1.data, to: r2.data };
}
export async function updateWealthTransaction(id:string, patch:{ title?:string; amount?:number; category_id?:string|null; transaction_date?:string; account_id?:string|null }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  // For paired transfer rows, allow only title/note/date changes, not amount/category
  const row: any = {}; if(patch.title!==undefined) row.title=patch.title.trim(); if(patch.amount!==undefined) row.amount=patch.amount; if(patch.category_id!==undefined) row.category_id=patch.category_id; if(patch.transaction_date!==undefined) row.transaction_date=patch.transaction_date; if(patch.account_id!==undefined) row.account_id=patch.account_id;
  const { error } = await supabase.from("finance_transactions").update(row).eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}
export async function deleteWealthTransaction(id:string){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  // if part of paired transfer, also clean linked row best-effort
  const { data: row } = await supabase.from("finance_transactions").select("linked_transaction_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("finance_transactions").delete().eq("id", id).eq("user_id", user.id);
  if(error) throw error;
  if(row?.linked_transaction_id){ await supabase.from("finance_transactions").delete().eq("id", row.linked_transaction_id).eq("user_id", user.id); }
}

// ── Recurring ──
export async function createWealthRecurring(input:{ name:string; kind:string; amount:number; currency:string; frequency:string; next_due_date:string; account_id?:string|null; category_id?:string|null }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { data, error } = await supabase.from("finance_recurring_items").insert({ user_id:user.id, name: input.name.trim(), kind: input.kind, amount: input.amount, currency: input.currency, frequency: input.frequency, next_due_date: input.next_due_date, account_id: input.account_id ?? null, category_id: input.category_id ?? null, is_active:true }).select("id").single();
  if(error) throw error; return data;
}
export async function updateWealthRecurring(id:string, patch:{ name?:string; amount?:number; currency?:string; frequency?:string; next_due_date?:string; account_id?:string|null; category_id?:string|null; kind?:string }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const row:any={}; if(patch.name!==undefined) row.name=patch.name.trim(); if(patch.amount!==undefined) row.amount=patch.amount; if(patch.currency!==undefined) row.currency=patch.currency; if(patch.frequency!==undefined) row.frequency=patch.frequency; if(patch.next_due_date!==undefined) row.next_due_date=patch.next_due_date; if(patch.account_id!==undefined) row.account_id=patch.account_id; if(patch.category_id!==undefined) row.category_id=patch.category_id; if(patch.kind!==undefined) row.kind=patch.kind;
  const { error } = await supabase.from("finance_recurring_items").update(row).eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}
export async function setRecurringActive(id:string, is_active:boolean){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { error } = await supabase.from("finance_recurring_items").update({ is_active }).eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}
export async function advanceWealthRecurring(id:string){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { data: row, error: e1 } = await supabase.from("finance_recurring_items").select("id, frequency, next_due_date").eq("id", id).eq("user_id", user.id).single();
  if(e1 || !row) throw e1 ?? new Error("not found");
  let next = row.next_due_date as string;
  const d = new Date(next + "T12:00:00");
  if(row.frequency==="weekly") d.setDate(d.getDate()+7);
  else if(row.frequency==="monthly") d.setMonth(d.getMonth()+1);
  else if(row.frequency==="quarterly") d.setMonth(d.getMonth()+3);
  else if(row.frequency==="yearly") d.setFullYear(d.getFullYear()+1);
  next = d.toISOString().slice(0,10);
  const { error } = await supabase.from("finance_recurring_items").update({ next_due_date: next }).eq("id", id).eq("user_id", user.id);
  if(error) throw error; return next;
}

// ── Goals (public.goals) ──
export async function createWealthGoal(input:{ title:string; goal_type:string; target_metric:string; target_value?:number|null; target_unit?:string|null; baseline_value?:number|null; target_date?:string|null }){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const realm = await ensureWealthRealm(); if(!realm) throw new Error("no realm");
  const { data, error } = await supabase.from("goals").insert({ user_id:user.id, realm_id: realm.id, title: input.title.trim(), status:"active", goal_type: input.goal_type, target_metric: input.target_metric, target_value: input.target_value ?? null, target_unit: input.target_unit ?? null, baseline_value: input.baseline_value ?? null, target_date: input.target_date ?? null }).select("id").single();
  if(error) throw error; return data;
}
export async function deleteWealthGoal(id:string){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
  if(error) throw error;
}

// ── Preferences ──
export async function getWealthPrefs(){
  const { data:{user}} = await supabase.auth.getUser(); if(!user) return null;
  const { data } = await supabase.from("finance_preferences").select("*").eq("user_id", user.id).maybeSingle(); return data;
}
export async function setBaseCurrency(currency:string){
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error("invalid currency");
  const { data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const { error } = await supabase.from("finance_preferences").upsert({ user_id:user.id, base_currency: currency }, { onConflict:"user_id" });
  if(error) throw error;
}
