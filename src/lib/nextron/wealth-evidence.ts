// @ts-nocheck
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWealthBalanceSummary } from "@lifepulse/domain";
import * as Intel from "@lifepulse/domain";

// Re-export for tests
export type WealthNextronSection = "balances" | "cash_flow" | "transactions_summary" | "recurring_items" | "wealth_goals";

export interface WealthNextronEvidence {
  version: "wealth-nextron-v1";
  generatedAt: string;
  effectiveSections: WealthNextronSection[];
  dataCoverage: {
    accountsTracked: number;
    transactionHistoryMonths: number;
    balancesFresh: number;
    balancesStale: number;
    unknownCurrencyTransactionCount: number;
    note: string;
  };
  balances?: {
    perCurrency: Array<{ currency: string; assets: number; liabilities: number; net: number; accountCount: number }>;
    freshness: Array<{ name: string; freshness: string; daysSince: number | null }>;
  };
  cashFlow?: {
    perCurrency: Array<{ currency: string; income: number; expenses: number; net: number; count: number }>;
    trends: Array<{ currency: string; direction: string; mode: string; netChange: number; expenseChangePct: number | null }>;
    periodLabel: string;
  };
  transactionsSummary?: {
    byCategory: Array<{ category: string; amount: number; share: number; count: number; currency: string }>;
    categoryChanges: Array<{ category: string; changePct: number; current: number; previous: number }>;
    transactionCount: number;
    unknownCurrencyCount: number;
  };
  recurring?: {
    due7: Array<{ kind: string; amount: number; currency: string; dueDate: string }>;
    due30Count: number;
    overdueCount: number;
    outflowByCurrency: Record<string, number>;
  };
  goals?: Array<{ type: string; target: number | null; current: number | null; remaining: number | null; currency: string | null; status: string; targetDate: string | null; sourceDescription: string }>;
}

function monthBounds(today: string) {
  const [y, m] = today.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  return { start, end };
}

export async function buildWealthNextronEvidence(
  supabase: SupabaseClient,
  userId: string,
  effectiveSections: WealthNextronSection[],
): Promise<WealthNextronEvidence | null> {
  if (effectiveSections.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { start: monthStart, end: monthEnd } = monthBounds(today);
  // 12-month window for history
  const now = new Date(); const y = now.getFullYear(), mm = now.getMonth() + 1;
  const start12 = new Date(y, mm - 12, 1);
  const start12Str = `${start12.getFullYear()}-${String(start12.getMonth() + 1).padStart(2, "0")}-01`;

  // Bounded queries — never raw transaction list unbounded
  const [accountsRes, tx12Res, catRes, budgetsRes, recurRes, goalsRes, prefsRes] = await Promise.all([
    supabase.from("finance_accounts").select("id, name, type, currency, starting_balance, is_archived, updated_at").eq("user_id", userId).order("created_at"),
    supabase.from("finance_transactions").select("id, amount, type, transaction_date, category_id, finance_accounts(currency)").eq("user_id", userId).gte("transaction_date", start12Str).lte("transaction_date", monthEnd).order("transaction_date", { ascending: true }),
    supabase.from("finance_categories").select("id, name, type").eq("user_id", userId),
    supabase.from("finance_budgets").select("id").eq("user_id", userId).limit(1),
    supabase.from("finance_recurring_items").select("id, name, kind, amount, currency, next_due_date, is_active").eq("user_id", userId).order("next_due_date"),
    supabase.from("goals").select("id, title, goal_type, target_value, baseline_value, target_metric, target_unit, target_date").eq("user_id", userId).limit(20),
    supabase.from("finance_preferences").select("base_currency").eq("user_id", userId).maybeSingle(),
  ]);

  const accounts = ((accountsRes.data as any[]) ?? []).map((r) => ({
    id: r.id, user_id: userId, name: r.name, type: r.type, currency: r.currency, starting_balance: Number(r.starting_balance), is_archived: !!r.is_archived, source_type: "manual" as const, updated_at: r.updated_at,
  }));
  const txs = ((tx12Res.data as any[]) ?? []).map((r) => ({
    id: r.id, user_id: userId, account_id: null, category_id: r.category_id, amount: Number(r.amount), type: r.type, title: "", transaction_date: r.transaction_date, currency: (r.finance_accounts as any)?.currency ?? null,
  }));
  const currencies = Array.from(new Set(accounts.filter((a) => !a.is_archived).map((a) => a.currency))).sort();
  const freshness = Intel.getWealthBalanceFreshness(accounts as any, today, 30);
  const coverageRaw = Intel.getWealthDataCoverage({ accounts: accounts as any, transactions: txs as any, budgets: (budgetsRes.data as any[]) ?? [], goals: (goalsRes.data as any[]) ?? [], recurring: (recurRes.data as any[]) ?? [], freshness });

  const evidence: WealthNextronEvidence = {
    version: "wealth-nextron-v1",
    generatedAt: new Date().toISOString(),
    effectiveSections: [...effectiveSections].sort(),
    dataCoverage: {
      accountsTracked: coverageRaw.accountsTracked,
      transactionHistoryMonths: coverageRaw.historyMonths,
      balancesFresh: coverageRaw.balancesFresh,
      balancesStale: coverageRaw.balancesStale,
      unknownCurrencyTransactionCount: coverageRaw.unknownCurrency,
      note: coverageRaw.note,
    },
  };

  if (effectiveSections.includes("balances")) {
    const balances = getWealthBalanceSummary(accounts as any);
    evidence.balances = {
      perCurrency: balances.map((b) => ({ currency: b.currencyCode, assets: b.assets, liabilities: b.liabilities, net: b.netWorth, accountCount: b.accountCount })).sort((a, b) => a.currency.localeCompare(b.currency)),
      freshness: freshness.slice(0,5).map((f) => ({ freshness: f.freshness, daysSince: f.daysSince })),
    };
  }
  if (effectiveSections.includes("cash_flow")) {
    const history = Intel.getWealthHistoryPerCurrency(txs as any, 2, currencies, today);
    const trends = currencies
      .map((cur) => {
        const h = history[cur];
        if (!h || h.length < 2) return null;
        // Use comparable MTD trend (more accurate than full-month when partial)
        const { getComparableTrend } = Intel as any;
        if (typeof getComparableTrend === "function") return getComparableTrend(txs as any, cur, today);
        return null;
      })
      .filter(Boolean) as any[];
    // Also summarize current month per currency
    const { start, end } = monthBounds(today);
    const perCurrency = currencies.map((cur) => {
      const txsIn = txs.filter((t) => t.currency === cur && t.transaction_date >= start && t.transaction_date <= end && t.type !== "transfer" && t.type !== "adjustment");
      let income = 0, expenses = 0;
      for (const t of txsIn) { if (t.type === "income") income += t.amount; else if (t.type === "expense") expenses += t.amount; }
      return { currency: cur, income, expenses, net: income - expenses, count: txsIn.length };
    });
    evidence.cashFlow = {
      perCurrency: perCurrency.sort((a, b) => a.currency.localeCompare(b.currency)),
      trends: trends.map((t: any) => ({ currency: t.currency, direction: t.direction, mode: t.mode, netChange: t.netChange, expenseChangePct: t.expenseChangePct })).sort((a: any, b: any) => a.currency.localeCompare(b.currency)),
      periodLabel: `${start} to ${end} (${trends[0]?.mode ?? "full_month"})`,
    };
  }
  if (effectiveSections.includes("transactions_summary")) {
    const { start, end } = monthBounds(today);
    const byCur = currencies[0] ?? "ILS";
    // Pick base currency's category summary (or first)
    const catSummary = Intel.getWealthCategorySummaries(txs as any, (catRes.data as any[]) ?? [], byCur, { start, end });
    const prevBounds = Intel.comparablePeriodBounds(today);
    const prevSummary = Intel.getWealthCategorySummaries(txs as any, (catRes.data as any[]) ?? [], byCur, { start: prevBounds.previous.start, end: prevBounds.previous.end });
    const changes = Intel.getTopCategoryChanges(catSummary, prevSummary).slice(0, 3);
    evidence.transactionsSummary = {
      byCategory: catSummary.slice(0, 5).map((c) => ({ category: c.categoryName, amount: c.amount, share: c.share, count: c.count, currency: c.currency })),
      categoryChanges: changes,
      transactionCount: txs.filter((t) => t.type !== "transfer" && t.type !== "adjustment" && !!t.currency).length,
      unknownCurrencyCount: txs.filter((t) => !t.currency).length,
    };
  }
  if (effectiveSections.includes("recurring_items")) {
    const intel = Intel.getWealthRecurringIntelligence((recurRes.data as any[]) ?? [], today);
    evidence.recurring = {
      due7: intel.due7.slice(0, 5).map((r) => ({ kind: r.kind, amount: Number(r.amount), currency: r.currency, dueDate: r.next_due_date })),
      due30Count: intel.due30.length,
      overdueCount: intel.overdue.length,
      outflowByCurrency: intel.outflowByCurrency,
    };
  }
  if (effectiveSections.includes("wealth_goals")) {
    const prog = Intel.getWealthGoalProgress((goalsRes.data as any[]) ?? [], accounts as any);
    evidence.goals = prog.slice(0, 5).map((g) => ({
      type: g.type, target: g.target, current: g.current, remaining: g.remaining, currency: g.currency, status: g.status, targetDate: (goalsRes.data as any[])?.find((x: any) => x.id === g.goalId)?.target_date ?? null, sourceDescription: g.sourceDescription, progressPct: g.progressPct, progressPercent: g.progressPct != null ? Math.round(g.progressPct*100) : null,
    }));
  }

  // Determinism: sort sections already, ensure stable
  return evidence;
}

export function isWealthEvidenceAllowed(effectiveSections: WealthNextronSection[], section: WealthNextronSection): boolean {
  return effectiveSections.includes(section);
}
