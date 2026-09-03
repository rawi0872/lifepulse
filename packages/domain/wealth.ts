// Wealth Realm V1 — foundation domain, pure TS, integer minor units

export type WealthAccountType = "checking" | "savings" | "cash" | "investment" | "credit_card" | "loan" | "asset" | "liability" | "other";
export type WealthCategory = "income" | "housing" | "food" | "transport" | "health" | "education" | "entertainment" | "shopping" | "subscriptions" | "debt" | "savings" | "investments" | "other";
export type WealthTransactionType = "income" | "expense" | "transfer" | "adjustment";
export type WealthRecurringKind = "income" | "bill" | "subscription" | "debt_payment" | "savings" | "investment" | "other";
export type WealthFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface WealthAccount {
  id: string;
  user_id: string;
  realm_id: string;
  name: string;
  account_type: WealthAccountType;
  currency_code: string;
  current_balance_minor: number;
  institution_name?: string | null;
  is_archived: boolean;
  source_type: "manual" | "import" | "external";
}

export interface WealthTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  transaction_type: WealthTransactionType;
  amount_minor: number;
  currency_code: string;
  category: WealthCategory;
  description?: string | null;
  transaction_date: string;
  linked_transaction_id?: string | null;
}

export interface WealthRecurringItem {
  id: string;
  user_id: string;
  realm_id: string;
  name: string;
  kind: WealthRecurringKind;
  amount_minor: number;
  currency_code: string;
  frequency: WealthFrequency;
  next_due_date: string;
  account_id?: string | null;
  category?: WealthCategory | null;
  is_active: boolean;
}

export function isLiabilityAccount(a: Pick<WealthAccount, "account_type">): boolean {
  return a.account_type === "credit_card" || a.account_type === "loan" || a.account_type === "liability";
}
export function isAssetAccount(a: Pick<WealthAccount, "account_type">): boolean {
  return !isLiabilityAccount(a);
}

// ── Net worth ──
export interface WealthBalanceSummary {
  currencyCode: string;
  assetsMinor: number;
  liabilitiesMinor: number;
  netWorthMinor: number;
  accountCount: number;
  assetAccountCount: number;
  liabilityAccountCount: number;
}

export function getWealthBalanceSummary(accounts: WealthAccount[]): WealthBalanceSummary[] {
  const byCur = new Map<string, WealthBalanceSummary>();
  for (const acc of accounts) {
    if (acc.is_archived) continue;
    const cur = acc.currency_code;
    let s = byCur.get(cur);
    if (!s) { s = { currencyCode: cur, assetsMinor: 0, liabilitiesMinor: 0, netWorthMinor: 0, accountCount: 0, assetAccountCount: 0, liabilityAccountCount: 0 }; byCur.set(cur, s); }
    s.accountCount++;
    if (isLiabilityAccount(acc)) { s.liabilitiesMinor += acc.current_balance_minor; s.liabilityAccountCount++; }
    else { s.assetsMinor += acc.current_balance_minor; s.assetAccountCount++; }
  }
  for (const s of byCur.values()) s.netWorthMinor = s.assetsMinor - s.liabilitiesMinor;
  return Array.from(byCur.values());
}

// ── Cash flow ──
export interface WealthCashFlowSummary {
  periodStart: string;
  periodEnd: string;
  currencyCode: string;
  incomeMinor: number;
  expensesMinor: number;
  netCashFlowMinor: number;
  transactionCount: number;
}

export function getWealthCashFlowSummary(transactions: WealthTransaction[], period: { start: string; end: string; currencyCode?: string }): WealthCashFlowSummary[] {
  const cur = period.currencyCode ?? transactions[0]?.currency_code ?? "ILS";
  const filtered = transactions.filter((t) => t.transaction_date >= period.start && t.transaction_date <= period.end && t.currency_code === cur);
  let income = 0, expenses = 0, count = 0;
  for (const t of filtered) {
    if (t.transaction_type === "transfer" || t.transaction_type === "adjustment") continue;
    if (t.transaction_type === "income") income += t.amount_minor;
    else if (t.transaction_type === "expense") expenses += t.amount_minor;
    count++;
  }
  return [{ periodStart: period.start, periodEnd: period.end, currencyCode: cur, incomeMinor: income, expensesMinor: expenses, netCashFlowMinor: income - expenses, transactionCount: count }];
}

export function getSavingsRate(cashFlow: WealthCashFlowSummary): { rate: number | null; status: "insufficient" | "ok" } {
  if (cashFlow.incomeMinor <= 0 || cashFlow.transactionCount < 3) return { rate: null, status: "insufficient" };
  return { rate: (cashFlow.incomeMinor - cashFlow.expensesMinor) / cashFlow.incomeMinor, status: "ok" };
}

// ── Recurring upcoming ──
export interface WealthUpcomingCommitment {
  id: string;
  name: string;
  kind: WealthRecurringKind;
  amount_minor: number;
  currency_code: string;
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
      out.push({ id: it.id, name: it.name, kind: it.kind, amount_minor: it.amount_minor, currency_code: it.currency_code, dueDate: it.next_due_date, daysUntilDue: diff });
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
  if (input.cashFlow && input.cashFlow.netCashFlowMinor < 0 && input.cashFlow.transactionCount >= 5) signals.push({ kind:"wealth_negative_cash_flow", priority:40, title:"Spending exceeded income", rationale:`Net ${input.cashFlow.netCashFlowMinor} minor` });
  // only strong signals auto-worthy; weak analytical must not nag — caller filters by priority <30
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

// ── Money ──
export function formatWealthMinor(minor: number, currency: string): string {
  const abs = Math.abs(minor);
  const major = (abs / 100).toFixed(2);
  const sign = minor < 0 ? "-" : "";
  return `${sign}${major} ${currency}`;
}
export function wealthMinorFromMajor(major: number, _currency: string): number {
  return Math.round(major * 100);
}
