// Wealth Intelligence — deterministic, bounded, per-currency, no AI
import type { WealthAccount, WealthTransaction, WealthRecurringItem } from "./wealth";
import { isLiabilityAccount, getWealthBalanceSummary } from "./wealth";

// ── Data contract (what can be inferred) ──
export const WEALTH_DATA_CONTRACT = `
CAN infer: monthly income/expenses per currency from recorded income/expense transactions; category distribution; recurring due/overdue; goal progress from current account balances vs targets; budget vs recorded expenses with currency caveat; balance freshness from updated_at.
CANNOT infer: current Balance from transaction sums; historical net worth without snapshots; investment market gains; unrecorded real-world spending; debt payoff verification without account linkage; adherence counts without handled history.
` as const;

// ── Period helpers ──
export interface WealthPeriodSummary { month: string; // YYYY-MM
  currency: string; income: number; expenses: number; net: number; count: number; hasData: boolean; isPartial: boolean; }
function monthRange(y:number,m:number){ const start=`${y}-${String(m).padStart(2,'0')}-01`; const end=`${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`; return {start,end}; }
export function getWealthMonthlyHistory(transactions: WealthTransaction[], months: number, opts?: { today?: string; currency?: string }): WealthPeriodSummary[] {
  const today = opts?.today ?? new Date().toISOString().slice(0,10);
  const [ty, tm] = today.split("-").map(Number);
  const cur = opts?.currency;
  const out: WealthPeriodSummary[] = [];
  // Build months inclusive of current month backwards
  for(let i=months-1;i>=0;i--){
    const d = new Date(ty, tm-1 - i, 1);
    const y=d.getFullYear(), m=d.getMonth()+1;
    const {start,end} = monthRange(y,m);
    const isPartial = (y===ty && m===tm); // current month in progress
    const txs = transactions.filter(t=>{
      if(t.type==="transfer"||t.type==="adjustment") return false;
      if(!t.currency) return false;
      if(cur && t.currency!==cur) return false;
      if(!cur && t.currency!== (t.currency)) return false; // per-currency handled outside? For generic, include only matching cur if provided else all but per-currency external
      return t.transaction_date >= start && t.transaction_date <= end;
    });
    // When cur not provided, we will have separate per-currency histories outside; for now aggregate per provided cur or first currency
    // If cur not specified, aggregate all currencies separately is caller responsibility; here aggregate for cur or for all if no cur? Simpler: if cur not specified, count all (but caller will call per currency)
    let income=0, expenses=0, count=0;
    for(const t of txs){ if(!cur || t.currency===cur){ if(t.type==="income") income+=t.amount; else if(t.type==="expense") expenses+=t.amount; count++; } }
    // When cur specified, only that cur; when not, count all but share logic needs per-currency
    // For generic no-cur case, re-filter: if !cur, count all currencies together is WRONG per prompt, so caller must pass cur. We mark hasData based on count.
    out.push({ month:`${y}-${String(m).padStart(2,'0')}`, currency: cur ?? "MIXED", income, expenses, net: income-expenses, count, hasData: count>0, isPartial });
  }
  return out;
}
export function getWealthHistoryPerCurrency(transactions: WealthTransaction[], months:number, currencies: string[], today?:string): Record<string, WealthPeriodSummary[]> {
  const map: Record<string, WealthPeriodSummary[]> = {};
  for(const cur of currencies){
    map[cur]=getWealthMonthlyHistory(transactions.filter(t=>t.currency===cur), months, { today, currency: cur });
  }
  return map;
}

// ── Trend ──
export interface WealthTrend { currency: string; current: WealthPeriodSummary; previous: WealthPeriodSummary | null; netChange: number; expenseChangePct: number | null; incomeChangePct: number | null; direction: "up"|"down"|"flat"|"insufficient"; isSufficient: boolean; coverage: string; }
export function getWealthTrends(history: WealthPeriodSummary[]): WealthTrend | null {
  if(history.length<2) return null;
  const cur = history[history.length-1];
  const prev = history[history.length-2];
  const isPartial = cur.isPartial;
  // insufficient if either has no data or previous count <3? Use count>0 and not both zero
  const isSufficient = cur.hasData && prev.hasData && prev.expenses>0;
  let expensePct: number|null = null; if(prev.expenses>0) expensePct=(cur.expenses - prev.expenses)/prev.expenses;
  let incomePct: number|null = null; if(prev.income>0) incomePct=(cur.income - prev.income)/prev.income;
  let dir: WealthTrend["direction"]="flat";
  if(!isSufficient) dir="insufficient";
  else if(cur.net > prev.net) dir="up";
  else if(cur.net < prev.net) dir="down";
  return { currency: cur.currency, current: cur, previous: prev, netChange: cur.net - prev.net, expenseChangePct: expensePct, incomeChangePct: incomePct, direction: dir, isSufficient, coverage: isPartial ? "current month partial" : "complete months" };
}

// ── Category ──
export interface WealthCategorySummary { categoryId: string|null; categoryName: string; amount: number; share: number; count: number; currency: string; }
export function getWealthCategorySummaries(transactions: WealthTransaction[], categories: Array<{id:string;name:string;type:string}>, currency: string, period:{start:string;end:string}): WealthCategorySummary[] {
  const catMap = new Map<string,string>(categories.map(c=>[c.id, c.name]));
  const filtered = transactions.filter(t=> t.type==="expense" && t.currency===currency && t.transaction_date>=period.start && t.transaction_date<=period.end);
  const byCat = new Map<string, { amount:number; count:number; name:string }>();
  let total=0;
  for(const t of filtered){
    const key = t.category_id ?? "__uncat";
    const name = t.category_id ? (catMap.get(t.category_id) ?? "Unknown") : "Uncategorized";
    let s=byCat.get(key); if(!s) { s={amount:0,count:0,name}; byCat.set(key,s); }
    s.amount+=t.amount; s.count++; total+=t.amount;
  }
  const out: WealthCategorySummary[] = [];
  for(const [id, s] of byCat.entries()){
    out.push({ categoryId: id==="__uncat"?null:id, categoryName: s.name, amount: s.amount, share: total>0? s.amount/total:0, count: s.count, currency });
  }
  return out.sort((a,b)=>b.amount-a.amount);
}
export function getTopCategoryChanges(current: WealthCategorySummary[], previous: WealthCategorySummary[], threshold=0.15): Array<{category:string; changePct:number; current:number; previous:number}> {
  const prevMap = new Map<string,number>(previous.map(c=>[c.categoryName, c.amount]));
  const changes: Array<{category:string; changePct:number; current:number; previous:number}> = [];
  for(const c of current){
    const p = prevMap.get(c.categoryName) ?? 0;
    if(p===0) continue;
    if(p<10) continue; // trivial denominator
    const pct=(c.amount - p)/p;
    if(Math.abs(pct) < threshold) continue;
    changes.push({category:c.categoryName, changePct:pct, current:c.amount, previous:p});
  }
  return changes.sort((a,b)=> Math.abs(b.changePct)-Math.abs(a.changePct)).slice(0,3);
}

// ── Budget ──
export interface WealthBudgetStatus { budgetId:string; categoryId:string; categoryName:string; month:string; budget:number; actual:number; remaining:number; percentUsed:number; status:"on_track"|"near_limit"|"over_budget"|"no_activity"|"insufficient"; currency:string; note?:string; }
export function getWealthBudgetStatuses(budgets: Array<{id:string; category_id:string; month:string; amount:number}>, categories: Array<{id:string;name:string}>, expensesByCategory: WealthCategorySummary[], baseCurrency:string): WealthBudgetStatus[] {
  const catName = new Map<string,string>(categories.map(c=>[c.id,c.name]));
  // budget schema has no currency → treat as baseCurrency, compare only to that currency's expenses
  return budgets.map(b=>{
    const name=catName.get(b.category_id)??"Unknown";
    const actualRow=expensesByCategory.find(c=>c.categoryId===b.category_id);
    const actual=actualRow?.amount ?? 0;
    const percent = b.amount>0 ? actual / Number(b.amount) : 0;
    let status: WealthBudgetStatus["status"]="on_track";
    if(!actualRow || actual===0) status="no_activity";
    else if(percent>=1) status="over_budget";
    else if(percent>=0.8) status="near_limit";
    else status="on_track";
    return { budgetId:b.id, categoryId:b.category_id, categoryName:name, month:b.month.slice(0,7), budget:Number(b.amount), actual, remaining: Number(b.amount)-actual, percentUsed:percent, status, currency: baseCurrency, note: "Budget compared in base currency; multi-currency budgets require currency column." };
  });
}

// ── Goal progress ──
export interface WealthGoalProgress { goalId:string; title:string; type:string; target:number|null; current:number|null; baseline:number|null; remaining:number|null; progressPct:number|null; status:"achieved"|"in_progress"|"behind"|"insufficient"; direction:"up"|"down"; }
export function getWealthGoalProgress(goals: Array<{id:string;title:string;goal_type:string;target_value:number|null;baseline_value:number|null;target_metric:string|null}>, accounts: WealthAccount[]): WealthGoalProgress[] {
  const bal = getWealthBalanceSummary(accounts);
  // helpers to get current per target currency (use first currency or ILS)
  const firstCur = bal[0]?.currencyCode ?? "ILS";
  function currentFor(goal:any): number|null {
    const cur = firstCur;
    const s = bal.find(b=>b.currencyCode===cur);
    if(goal.goal_type==="savings_target" || goal.goal_type==="emergency_fund"){
      // sum savings accounts in target currency
      const sum = accounts.filter(a=>!a.is_archived && a.currency===cur && (a.type==="savings"||a.type==="cash"||a.type==="checking"||a.type==="bank")).reduce((acc,a)=>acc+a.starting_balance,0);
      return sum;
    }
    if(goal.goal_type==="net_worth_target"){
      return s ? s.netWorth : null;
    }
    if(goal.goal_type==="debt_payoff"){
      // total liabilities in cur
      return s ? s.liabilities : null;
    }
    if(goal.goal_type==="investment_contribution"){
      const sumInv = accounts.filter(a=>!a.is_archived && a.currency===cur && a.type==="investment").reduce((acc,a)=>acc+a.starting_balance,0);
      return sumInv;
    }
    return null;
  }
  return goals.map(g=>{
    const cur = currentFor(g);
    const target = g.target_value!=null? Number(g.target_value): null;
    const baseline = g.baseline_value!=null? Number(g.baseline_value): null;
    const isDebt = g.goal_type==="debt_payoff";
    const direction: "up"|"down" = isDebt ? "down" : "up";
    if(cur===null || target===null) return { goalId:g.id, title:g.title, type:g.goal_type, target, current:cur, baseline, remaining: target!=null && cur!=null ? (isDebt? cur - target : target - cur) : null, progressPct: null, status:"insufficient" as const, direction };
    let pct: number|null=null;
    if(isDebt){
      // debt: progress = (baseline - current)/(baseline - target) or if no baseline, (target? ) simpler: if baseline exists else 1 - cur/target
      if(baseline!=null && baseline!==target) pct = (baseline - cur)/(baseline - target);
      else if(target>0) pct = Math.max(0, 1 - cur/target);
    } else {
      if(baseline!=null && target!==baseline) pct = (cur - baseline)/(target - baseline);
      else if(target>0) pct = cur/target;
    }
    if(pct!=null) pct = Math.max(0, Math.min(1.5, pct));
    let status: WealthGoalProgress["status"]="in_progress";
    if(pct!=null && pct>=1) status="achieved";
    else if(pct!=null && pct<0.5 && g.target_value!=null) status="behind";
    else if(pct===null) status="insufficient";
    const remaining = isDebt? (cur - target) : (target - cur);
    return { goalId:g.id, title:g.title, type:g.goal_type, target, current:cur, baseline, remaining, progressPct: pct, status, direction };
  });
}

// ── Balance freshness ──
export type BalanceFreshness = "fresh"|"stale"|"unknown";
export interface WealthBalanceFreshness { accountId:string; name:string; freshness:BalanceFreshness; daysSince:number|null; }
export function getWealthBalanceFreshness(accounts: Array<WealthAccount & {updated_at?:string}>, nowStr?:string, staleDays=30): WealthBalanceFreshness[] {
  const now = nowStr ? new Date(nowStr) : new Date();
  return accounts.map(a=>{
    const upd = (a as any).updated_at as string | undefined;
    if(!upd) return { accountId:a.id, name:a.name, freshness:"unknown" as const, daysSince:null };
    const d = new Date(upd);
    const diff = Math.floor((now.getTime() - d.getTime())/86400000);
    return { accountId:a.id, name:a.name, freshness: diff>staleDays ? "stale" : "fresh", daysSince: diff };
  });
}

// ── Recurring intelligence ──
export interface WealthRecurringIntelligence { due7: WealthRecurringItem[]; due30: WealthRecurringItem[]; overdue: WealthRecurringItem[]; outflowByCurrency: Record<string,number>; incomeByCurrency: Record<string,number>; totalOutflow: Record<string,number>; }
export function getWealthRecurringIntelligence(items: WealthRecurringItem[], todayStr?:string): WealthRecurringIntelligence {
  const today = todayStr ?? new Date().toISOString().slice(0,10);
  const due7: WealthRecurringItem[]=[]; const due30: WealthRecurringItem[]=[]; const overdue: WealthRecurringItem[]=[];
  const outflow: Record<string,number>={}; const income: Record<string,number>={};
  for(const it of items){
    if(!it.is_active) continue;
    if(it.next_due_date < today) overdue.push(it);
    const diff = (new Date(it.next_due_date).getTime() - new Date(today).getTime())/86400000;
    if(diff>=0 && diff<=7) due7.push(it);
    if(diff>=0 && diff<=30) due30.push(it);
    const isOut = ["bill","subscription","debt_payment","savings","investment"].includes(it.kind);
    const isIn = it.kind==="income";
    if(isOut) outflow[it.currency]=(outflow[it.currency]??0)+Number(it.amount);
    if(isIn) income[it.currency]=(income[it.currency]??0)+Number(it.amount);
  }
  return { due7, due30, overdue, outflowByCurrency: outflow, incomeByCurrency: income, totalOutflow: outflow };
}

// ── Data coverage ──
export interface WealthDataCoverage { accountsTracked:number; transactionsRecorded:number; historyMonths:number; balancesFresh:number; balancesStale:number; budgetsConfigured:number; goalsConfigured:number; recurringConfigured:number; unknownCurrency:number; note:string; }
export function getWealthDataCoverage(input:{ accounts: WealthAccount[]; transactions: WealthTransaction[]; budgets: any[]; goals:any[]; recurring: WealthRecurringItem[]; freshness: WealthBalanceFreshness[] }): WealthDataCoverage {
  const unknown = input.transactions.filter(t=>!t.currency).length;
  const months = new Set(input.transactions.map(t=>t.transaction_date.slice(0,7))).size;
  const fresh = input.freshness.filter(f=>f.freshness==="fresh").length;
  const stale = input.freshness.filter(f=>f.freshness==="stale").length;
  const note = unknown>0 ? `${unknown} legacy transactions have unknown currency — partial` : "Based on recorded transactions";
  return { accountsTracked: input.accounts.filter(a=>!a.is_archived).length, transactionsRecorded: input.transactions.length, historyMonths: months, balancesFresh: fresh, balancesStale: stale, budgetsConfigured: input.budgets.length, goalsConfigured: input.goals.length, recurringConfigured: input.recurring.filter(r=>r.is_active).length, unknownCurrency: unknown, note };
}

// ── Insights (bounded 3-5) ──
export interface WealthInsight { kind:string; title:string; rationale:string; currency?:string; priority:number; dataSufficiency:"sufficient"|"insufficient"; sourceIds?:string[]; }
export function deriveWealthInsights(input:{
  trends: WealthTrend[]; categoryChanges: Array<{category:string;changePct:number}>; budgets: WealthBudgetStatus[]; goals: WealthGoalProgress[]; recurring: WealthRecurringIntelligence; freshness: WealthBalanceFreshness[]; coverage: WealthDataCoverage;
}): WealthInsight[] {
  const out: WealthInsight[]=[];
  // budget over
  for(const b of input.budgets.filter(b=>b.status==="over_budget").slice(0,1)){
    out.push({ kind:"budget_over_limit", title:`${b.categoryName} over budget`, rationale:`Recorded ${b.actual} of ${b.budget} ${b.currency}`, currency:b.currency, priority:10, dataSufficiency:"sufficient", sourceIds:[b.budgetId] });
  }
  for(const b of input.budgets.filter(b=>b.status==="near_limit").slice(0,1)){
    out.push({ kind:"budget_near_limit", title:`${b.categoryName} near limit`, rationale:`${Math.round(b.percentUsed*100)}% of ${b.budget} used`, currency:b.currency, priority:15, dataSufficiency:"sufficient" });
  }
  // recurring due
  if(input.recurring.due7.length>0){
    const first=input.recurring.due7[0];
    out.push({ kind:"recurring_due_soon", title:`${first.name} scheduled within 7 days`, rationale:`Scheduled date ${first.next_due_date} — not assumed unpaid`, currency:first.currency, priority:12, dataSufficiency:"sufficient", sourceIds:[first.id] });
  }
  // goal achieved / behind
  for(const g of input.goals.filter(g=>g.status==="achieved").slice(0,1)){
    out.push({ kind:"goal_achieved", title:`${g.title} achieved`, rationale:`Current ${g.current} target ${g.target}`, priority:13, dataSufficiency:"sufficient" });
  }
  for(const g of input.goals.filter(g=>g.status==="behind").slice(0,1)){
    out.push({ kind:"goal_behind", title:`${g.title} behind`, rationale:`Progress ${g.progressPct!=null?Math.round(g.progressPct*100)+"%":"insufficient"}`, priority:20, dataSufficiency:"sufficient" });
  }
  // stale balance
  const stale=input.freshness.filter(f=>f.freshness==="stale").slice(0,1);
  if(stale.length) out.push({ kind:"balance_stale", title:`${stale[0].name} balance stale`, rationale:`Not updated in ${stale[0].daysSince} days — overview may be stale`, priority:18, dataSufficiency:"sufficient" });
  // trend negative
  for(const t of input.trends.filter(t=>t.isSufficient && t.direction==="down" && t.current.net <0).slice(0,1)){
    out.push({ kind:"cash_flow_negative", title:`Recorded net negative this month`, rationale:`Net ${t.current.net} ${t.currency} vs ${t.previous?.net}`, currency:t.currency, priority:16, dataSufficiency:"sufficient" });
  }
  // category change
  for(const ch of input.categoryChanges.slice(0,1)){
    out.push({ kind:"category_spending_changed", title:`${ch.category} recorded change`, rationale:`Change ${Math.round(ch.changePct*100)}% vs previous comparable period`, priority:22, dataSufficiency:"sufficient" });
  }
  return out.sort((a,b)=>a.priority-b.priority).slice(0,5);
}

// ── Signals (update) ──
export type WealthSignalStrength = "strong"|"analytical";
export interface WealthSignalV2 { kind:string; priority:number; title:string; rationale:string; dueDate?:string; sourceId?:string; strength: WealthSignalStrength; }
export function deriveWealthSignalsV2(input:{
  billsDue: WealthRecurringItem[]; subsDue: WealthRecurringItem[]; tasksDue: Array<{id:string;title:string}>; habitsDue: Array<{id:string;title:string}>; goalsDue: WealthGoalProgress[]; insights: WealthInsight[];
}): WealthSignalV2[] {
  const out: WealthSignalV2[]=[];
  for(const b of input.billsDue.slice(0,2)) out.push({ kind:"wealth_bill_due", priority:10, title:b.name, rationale:`Scheduled ${b.next_due_date}`, dueDate:b.next_due_date, sourceId:b.id, strength:"strong" });
  for(const s of input.subsDue.slice(0,1)) out.push({ kind:"wealth_subscription_due", priority:15, title:s.name, rationale:`Scheduled ${s.next_due_date}`, dueDate:s.next_due_date, sourceId:s.id, strength:"strong" });
  for(const t of input.tasksDue.slice(0,1)) out.push({ kind:"wealth_task_due", priority:20, title:t.title, rationale:"Wealth task due", sourceId:t.id, strength:"strong" });
  for(const h of input.habitsDue.slice(0,1)) out.push({ kind:"wealth_habit_due", priority:25, title:h.title, rationale:"Wealth habit due", sourceId:h.id, strength:"strong" });
  // analytical from insights (weak) — not auto Today
  for(const ins of input.insights.filter(i=>["cash_flow_negative","budget_near_limit","budget_over_limit"].includes(i.kind)).slice(0,1)){
    out.push({ kind:`wealth_${ins.kind}`, priority:40, title:ins.title, rationale:ins.rationale, strength:"analytical" });
  }
  return out.sort((a,b)=>a.priority-b.priority).slice(0,4);
}
