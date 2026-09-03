// Wealth Realm V1 — canonical finance domain, pure TS, numeric(12,2) exact decimal
// PostgreSQL numeric is exact decimal, not float. JS number used with 2-decimal rounding
// matches DB storage. No bigint minor-units duplication.

export type WealthAccountType = "cash" | "bank" | "card" | "savings" | "investment" | "other" | "checking" | "credit_card" | "loan" | "asset" | "liability";
export type WealthCategory = "income" | "housing" | "food" | "transport" | "health" | "education" | "entertainment" | "shopping" | "subscriptions" | "debt" | "savings" | "investments" | "other";
export type WealthTransactionType = "income" | "expense" | "transfer" | "adjustment";
export type WealthRecurringKind = "income" | "bill" | "subscription" | "debt_payment" | "savings" | "investment" | "other";
export type WealthFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

// Canonical shapes map 1:1 to finance_* tables (numeric amounts, category_id FK preferred)
export interface WealthAccount {
  id: string;
  user_id: string;
  realm_id?: string | null;
  name: string;
  type: WealthAccountType;
  starting_balance: number; // numeric(12,2)
  currency: string; // e.g. ILS
  is_archived: boolean;
  source_type: "manual" | "import" | "external";
  institution_name?: string | null;
}

export interface WealthTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number; // numeric(12,2) exact
  type: WealthTransactionType;
  title: string;
  note?: string | null;
  transaction_date: string; // YYYY-MM-DD
  currency?: string | null; // derived from account if null; kept for compat
  linked_transaction_id?: string | null;
}

export interface WealthRecurringItem {
  id: string;
  user_id: string;
  realm_id?: string | null;
  name: string;
  kind: WealthRecurringKind;
  amount: number; // numeric(12,2)
  currency: string;
  frequency: WealthFrequency;
  next_due_date: string;
  account_id?: string | null;
  category_id?: string | null;
  is_active: boolean;
}

export function isLiabilityAccount(a: Pick<WealthAccount, "type">): boolean {
  return a.type === "credit_card" || a.type === "loan" || a.type === "liability";
}
export function isAssetAccount(a: Pick<WealthAccount, "type">): boolean {
  return !isLiabilityAccount(a);
}

// ── Net worth (starting_balance + transactions if needed, but V1 stored explicit starting_balance as current for manual-first) ──
// Source-of-truth: finance_accounts.starting_balance is the displayed balance for manual-first V1.
// Transactions do NOT auto-mutate balances to avoid silent drift. Future bank imports will reconcile.
// Invariant documented in migration comment and service.
export interface WealthBalanceSummary {
  currencyCode: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  accountCount: number;
  assetAccountCount: number;
  liabilityAccountCount: number;
}

export function getWealthBalanceSummary(accounts: WealthAccount[]): WealthBalanceSummary[] {
  const byCur = new Map<string, WealthBalanceSummary>();
  for (const acc of accounts) {
    if (acc.is_archived) continue;
    const cur = acc.currency;
    let s = byCur.get(cur);
    if (!s) { s = { currencyCode: cur, assets: 0, liabilities: 0, netWorth: 0, accountCount: 0, assetAccountCount: 0, liabilityAccountCount: 0 }; byCur.set(cur, s); }
    s.accountCount++;
    if (isLiabilityAccount(acc)) { s.liabilities += acc.starting_balance; s.liabilityAccountCount++; }
    else { s.assets += acc.starting_balance; s.assetAccountCount++; }
  }
  for (const s of byCur.values()) s.netWorth = s.assets - s.liabilities;
  return Array.from(byCur.values());
}

// ── Cash flow ──
export interface WealthCashFlowSummary {
  periodStart: string;
  periodEnd: string;
  currencyCode: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  transactionCount: number;
}

export function getWealthCashFlowSummary(transactions: WealthTransaction[], period: { start: string; end: string; currencyCode?: string }): WealthCashFlowSummary[] {
  const cur = period.currencyCode ?? (transactions.find(t=>t.currency)?.currency as string) ?? "ILS";
  // Strict per-currency: null/unknown currency is NOT silently assigned to cur (prevents misclassifying legacy null-account rows as ILS)
  const filtered = transactions.filter((t) => t.transaction_date >= period.start && t.transaction_date <= period.end && t.currency === cur);
  let income = 0, expenses = 0, count = 0;
  for (const t of filtered) {
    if (t.type === "transfer" || t.type === "adjustment") continue;
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expenses += t.amount;
    count++;
  }
  return [{ periodStart: period.start, periodEnd: period.end, currencyCode: cur, income, expenses, netCashFlow: income - expenses, transactionCount: count }];
}

export function getSavingsRate(cashFlow: WealthCashFlowSummary): { rate: number | null; status: "insufficient" | "ok" } {
  if (cashFlow.income <= 0 || cashFlow.transactionCount < 3) return { rate: null, status: "insufficient" };
  return { rate: (cashFlow.income - cashFlow.expenses) / cashFlow.income, status: "ok" };
}

// ── Recurring upcoming ──
export interface WealthUpcomingCommitment {
  id: string;
  name: string;
  kind: WealthRecurringKind;
  amount: number;
  currency: string;
  dueDate: string;
  daysUntilDue: number;
}

export function getUpcomingWealthCommitments(items: WealthRecurringItem[], today: string, windowDays: number): WealthUpcomingCommitment[] {
  const start = new Date(today);
  const end = new Date(today); end.setDate(end.getDate() + windowDays);
  const out: WealthUpcomingCommitment[] = [];
  for (const it of items) {
    if (!it.is_active) continue;
    const due = new Date(it.next_due_date);
    if (due >= start && due <= end) {
      const diff = Math.ceil((due.getTime() - start.getTime()) / 86400000);
      out.push({ id: it.id, name: it.name, kind: it.kind, amount: it.amount, currency: it.currency, dueDate: it.next_due_date, daysUntilDue: diff });
    }
  }
  return out.sort((a,b)=> a.dueDate.localeCompare(b.dueDate));
}

// ── Data quality ──
export type WealthDataQuality = "available" | "missing" | "partial" | "insufficient";
export interface WealthDataQualityMeta { quality: WealthDataQuality; lastUpdated?: string | null; coverage: number; }

// ── Signals ──
export type WealthSignalKind = "wealth_bill_due" | "wealth_subscription_due" | "wealth_goal_action_due" | "wealth_task_due" | "wealth_negative_cash_flow" | "wealth_savings_goal_behind";
export interface WealthSignal { kind: WealthSignalKind; priority: number; title: string; rationale: string; dueDate?: string; }

export function deriveWealthSignals(input: {
  upcomingBills: WealthUpcomingCommitment[];
  upcomingSubscriptions: WealthUpcomingCommitment[];
  dueWealthTasks: Array<{ id: string; title: string }>;
  dueWealthHabits: Array<{ id: string; title: string }>;
  cashFlow?: WealthCashFlowSummary;
}): WealthSignal[] {
  const signals: WealthSignal[] = [];
  for (const b of input.upcomingBills.slice(0,2)) signals.push({ kind:"wealth_bill_due", priority:10, title:b.name, rationale:`Due in ${b.daysUntilDue}d`, dueDate: b.dueDate });
  for (const s of input.upcomingSubscriptions.slice(0,1)) signals.push({ kind:"wealth_subscription_due", priority:15, title:s.name, rationale:`Subscription due in ${s.daysUntilDue}d`, dueDate: s.dueDate });
  for (const t of input.dueWealthTasks.slice(0,1)) signals.push({ kind:"wealth_task_due", priority:20, title:t.title, rationale:"Wealth task due" });
  for (const h of input.dueWealthHabits.slice(0,1)) signals.push({ kind:"wealth_goal_action_due", priority:25, title:h.title, rationale:"Wealth habit due" });
  if (input.cashFlow && input.cashFlow.netCashFlow < 0 && input.cashFlow.transactionCount >= 5) signals.push({ kind:"wealth_negative_cash_flow", priority:40, title:"Spending exceeded income", rationale:`Net ${input.cashFlow.netCashFlow}` });
  return signals.sort((a,b)=> a.priority-b.priority).slice(0,4);
}

// ── Privacy ──
export interface WealthPrivacy { nextron_access_enabled: boolean; nextron_allowed_sections: string[]; }
export function isWealthNextronAllowed(pref: WealthPrivacy | null, section: string): boolean {
  if (!pref || !pref.nextron_access_enabled) return false;
  return pref.nextron_allowed_sections.includes(section);
}

// ── NEXTRON evidence contract (summarized, no raw transactions) ──
export interface WealthNextronEvidence {
  generatedAt: string;
  currencies: string[];
  netWorthSummary: WealthBalanceSummary[];
  monthlyCashFlow: WealthCashFlowSummary | null;
  recurringSummary: { due7: number; due30: number };
  wealthGoalProgress: Array<{ title: string; status: string }>;
  dataQuality: WealthDataQualityMeta;
}

// ── Onboarding ──
export type WealthOnboardingIntent = "save_more" | "understand_spending" | "build_emergency" | "pay_debt" | "grow_investments" | "track_net_worth" | "stay_on_top_of_bills" | "general_organization";
export const WEALTH_ONBOARDING_OPTIONS: Array<{ value: WealthOnboardingIntent; label: string }> = [
  { value: "save_more", label: "Save more" },
  { value: "understand_spending", label: "Understand spending" },
  { value: "build_emergency", label: "Build emergency savings" },
  { value: "pay_debt", label: "Pay off debt" },
  { value: "grow_investments", label: "Grow investments" },
  { value: "track_net_worth", label: "Track net worth" },
  { value: "stay_on_top_of_bills", label: "Stay on top of bills" },
  { value: "general_organization", label: "General financial organization" },
];

// ── Money helpers (numeric exact) ──
export function formatWealth(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const major = abs.toFixed(2);
  const sign = amount < 0 ? "-" : "";
  return `${sign}${major} ${currency}`;
}
// Locale-aware presentation (commas) without FX
export function formatWealthGrouped(amount: number, currency: string): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${parts[0]}.${parts[1]} ${currency}`;
}
export function parseWealthAmount(input: string): number | null {
  const t = input.trim().replace(/,/g, "");
  if (!t) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null; // V1 expects positive amounts; liability owed is positive
  if (n > 999999999) return null;
  return Math.round(n * 100) / 100;
}
export const WEALTH_CURRENCIES: string[] = ["ILS","USD","EUR","GBP"];
export function isValidWealthCurrency(c: string): boolean { return /^[A-Z]{3}$/.test(c); }
export const WEALTH_ACCOUNT_TYPE_DISPLAY: Record<WealthAccountType, string> = {
  cash:"Cash", bank:"Checking / Bank", checking:"Checking / Bank", card:"Card", savings:"Savings",
  investment:"Investment", credit_card:"Credit card", loan:"Loan", asset:"Other asset", liability:"Other liability", other:"Other",
};
export const WEALTH_ACCOUNT_TYPE_OPTIONS: Array<{ value: WealthAccountType; label: string }> = [
  { value:"checking", label:"Checking / Bank"}, { value:"savings", label:"Savings"}, { value:"cash", label:"Cash"},
  { value:"investment", label:"Investment"}, { value:"credit_card", label:"Credit card"}, { value:"loan", label:"Loan"},
  { value:"asset", label:"Other asset"}, { value:"liability", label:"Other liability"}, { value:"other", label:"Other"},
];
export const WEALTH_GOAL_TYPE_DISPLAY: Record<string,string> = {
  savings_target:"Save money", net_worth_target:"Reach net worth", debt_payoff:"Pay off debt",
  emergency_fund:"Build emergency fund", investment_contribution:"Investment contribution", general:"General financial goal",
};
export const WEALTH_GOAL_TARGET_METRIC: Record<string,string> = {
  savings_target:"savings_balance", net_worth_target:"net_worth", debt_payoff:"debt_balance",
  emergency_fund:"savings_balance", investment_contribution:"investment_contribution", general:"savings_balance",
};

export function advanceWealthRecurrence(date: string, freq: WealthFrequency): string {
  const d = new Date(date + "T12:00:00");
  if (freq==="weekly") d.setDate(d.getDate()+7);
  else if (freq==="monthly") d.setMonth(d.getMonth()+1);
  else if (freq==="quarterly") d.setMonth(d.getMonth()+3);
  else if (freq==="yearly") d.setFullYear(d.getFullYear()+1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Cash-flow period helper (local, no UTC shift)
export function wealthPeriodBounds(period: "month" | "3months"): { start: string; end: string } {
  const now = new Date(); const y=now.getFullYear(), mm=now.getMonth()+1;
  const end = `${y}-${String(mm).padStart(2,'0')}-${String(new Date(y, mm, 0).getDate()).padStart(2,'0')}`;
  if (period==="month") { const s = `${y}-${String(mm).padStart(2,'0')}-01`; return { start:s, end }; }
  const d = new Date(y, mm-3, 1); return { start: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, end };
}
// Compat wrappers for previous minor-units API (avoid silent breakage, delegate to numeric)
export function formatWealthMinor(minor: number, currency: string): string { return formatWealth(minor/100, currency); }
export function wealthMinorFromMajor(major: number, _currency: string): number { return Math.round(major * 100); }
