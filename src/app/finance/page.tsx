"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpPopover } from "@/components/HelpPopover";
import { InfoTip } from "@/components/InfoTip";
import { getTodayDateString } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
} from "@/components/finance/types";
import {
  formatCurrency,
  get6MonthRange,
  getMonthRange,
  computeAnalytics,
  computeInsights,
} from "@/components/finance/financeUtils";
import { FinanceKpiCard } from "@/components/finance/FinanceKpiCard";
import { CashflowTrendChart } from "@/components/finance/CashflowTrendChart";
import { ExpenseBreakdownChart } from "@/components/finance/ExpenseBreakdownChart";
import { FinanceInsights } from "@/components/finance/FinanceInsights";
import { TransactionList } from "@/components/finance/TransactionList";
import { AccountSummary } from "@/components/finance/AccountSummary";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { BudgetForm } from "@/components/finance/BudgetForm";
import { AccountForm } from "@/components/finance/AccountForm";
import { BudgetHealthList } from "@/components/finance/BudgetHealthList";

const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Health", "Education", "Entertainment", "Subscriptions", "Shopping", "Savings", "Other expense"];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Other income"];


export default function FinancePage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const cancelledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [balanceTransactions, setBalanceTransactions] = useState<Pick<FinanceTransaction, "account_id" | "amount" | "type">[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);

  const monthRange = getMonthRange(currentMonth);

  const analytics = useMemo(
    () => computeAnalytics({ transactions, balanceTransactions, budgets, accounts, currentMonth }),
    [transactions, balanceTransactions, budgets, accounts, currentMonth]
  );

  const insights = useMemo(
    () => computeInsights(analytics, monthRange.label),
    [analytics, monthRange.label]
  );

  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.transaction_date >= monthRange.start && tx.transaction_date <= monthRange.end
      ),
    [transactions, monthRange.start, monthRange.end]
  );

  const [seeding, setSeeding] = useState(false);

  async function loadData() {
    if (cancelledRef.current) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const sixMonthRange = get6MonthRange(currentMonth);

      const [accountsRes, categoriesRes, txRes, balanceTxRes, budgetsRes] = await Promise.all([
        supabase.from("finance_accounts").select("id, name, type, starting_balance, currency").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_categories").select("id, name, type, color, icon").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_transactions")
          .select("id, account_id, category_id, amount, type, title, note, transaction_date, finance_accounts(name, type, currency), finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .gte("transaction_date", sixMonthRange.start)
          .lte("transaction_date", sixMonthRange.end)
          .order("transaction_date", { ascending: false }),
        supabase.from("finance_transactions")
          .select("account_id, amount, type")
          .eq("user_id", user.id),
        supabase.from("finance_budgets").select("id, category_id, month, amount, finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .eq("month", `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`),
      ]);

      if (!cancelledRef.current) {
        if (accountsRes.error) throw accountsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        if (txRes.error) throw txRes.error;
        if (balanceTxRes.error) throw balanceTxRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        setAccounts(accountsRes.data ?? []);
        setCategories(categoriesRes.data ?? []);
        setTransactions((txRes.data ?? []) as unknown as FinanceTransaction[]);
        setBalanceTransactions((balanceTxRes.data ?? []) as Pick<FinanceTransaction, "account_id" | "amount" | "type">[]);
        setBudgets((budgetsRes.data ?? []) as unknown as FinanceBudget[]);

        if ((categoriesRes.data ?? []).length === 0) {
          await seedDefaultCategories(user.id);
        }
      }
    } catch {
      if (!cancelledRef.current) {
        toast({ type: "error", title: "Failed to load finance data." });
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  async function seedDefaultCategories(userId: string) {
    if (seeding) return;
    setSeeding(true);
    try {
      const defaults: { name: string; type: "income" | "expense"; user_id: string }[] = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name, type: "expense" as const, user_id: userId })),
        ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, type: "income" as const, user_id: userId })),
      ];
      const { error } = await supabase.from("finance_categories").insert(defaults);
      if (error) throw error;
      const { data } = await supabase.from("finance_categories").select("id, name, type, color, icon").eq("user_id", userId);
      if (data) setCategories(data);
    } catch {
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txTitle, setTxTitle] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txDate, setTxDate] = useState(getTodayDateString());
  const [txNote, setTxNote] = useState("");

  function resetTxForm() {
    setTxTitle("");
    setTxAmount("");
    setTxType("expense");
    setTxCategoryId("");
    setTxAccountId("");
    setTxDate(getTodayDateString());
    setTxNote("");
    setEditingTxId(null);
    setShowTxForm(false);
  }

  function startTransaction(type: "income" | "expense") {
    resetTxForm();
    setTxType(type);
    setShowTxForm(true);
  }

  function editTransaction(tx: FinanceTransaction) {
    setTxTitle(tx.title);
    setTxAmount(String(tx.amount));
    setTxType(tx.type as "income" | "expense");
    setTxCategoryId(tx.category_id ?? "");
    setTxAccountId(tx.account_id ?? "");
    setTxDate(tx.transaction_date);
    setTxNote(tx.note ?? "");
    setEditingTxId(tx.id);
    setShowTxForm(true);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    const title = txTitle.trim();
    const amount = parseFloat(txAmount);

    if (!title) {
      toast({ type: "error", title: "Title is required." });
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      toast({ type: "error", title: "Amount must be greater than 0." });
      return;
    }
    if (!txCategoryId) {
      toast({ type: "error", title: "Category is required." });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const txData = {
        user_id: user.id,
        title,
        amount,
        type: txType,
        category_id: txCategoryId || null,
        account_id: txAccountId || null,
        transaction_date: txDate,
        note: txNote || null,
      };

      if (editingTxId) {
        const { error } = await supabase.from("finance_transactions").update(txData).eq("id", editingTxId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_transactions").insert(txData);
        if (error) throw error;
      }

      resetTxForm();
      loadData();
      toast({ type: "success", title: editingTxId ? "Transaction updated." : "Transaction added." });
    } catch {
      toast({ type: "error", title: "Failed to save transaction." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id: string) {
    setSaving(true);
    try {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete transaction." });
    } finally {
      setSaving(false);
    }
  }

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [confirmingBudgetDeleteId, setConfirmingBudgetDeleteId] = useState<string | null>(null);

  async function handleAddBudget() {
    const amount = parseFloat(budgetAmount);
    if (!budgetCategoryId || !amount || isNaN(amount) || amount <= 0) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const { error } = await supabase.from("finance_budgets").insert({
        user_id: user.id,
        category_id: budgetCategoryId,
        month,
        amount,
      });
      if (error) throw error;
      setBudgetCategoryId("");
      setBudgetAmount("");
      setShowBudgetForm(false);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to add budget." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    try {
      await supabase.from("finance_budgets").delete().eq("id", id);
      setConfirmingBudgetDeleteId(null);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete budget." });
    }
  }

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [acctName, setAcctName] = useState("");
  const [acctType, setAcctType] = useState("cash");
  const [acctBalance, setAcctBalance] = useState("0");
  const [acctCurrency, setAcctCurrency] = useState("ILS");
  const [confirmingAccountDeleteId, setConfirmingAccountDeleteId] = useState<string | null>(null);

  async function handleAddAccount() {
    const name = acctName.trim();
    const balance = parseFloat(acctBalance);
    if (!name) return;
    if (isNaN(balance)) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("finance_accounts").insert({
        user_id: user.id,
        name,
        type: acctType,
        starting_balance: balance,
        currency: acctCurrency,
      });
      if (error) throw error;
      setAcctName("");
      setAcctType("cash");
      setAcctBalance("0");
      setAcctCurrency("ILS");
      setShowAccountForm(false);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to add account." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    try {
      await supabase.from("finance_accounts").delete().eq("id", id);
      setConfirmingAccountDeleteId(null);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete account." });
    }
  }

  const expenseOptions = categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }));
  const incomeOptions = categories.filter((c) => c.type === "income").map((c) => ({ value: c.id, label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }));
  const budgetCatOptions = categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }));

  const hasData = transactions.length > 0 || budgets.length > 0 || accounts.length > 0;

  function getKpiDelta(value: number, delta: number | null): { value: string; isPositive: boolean } | null {
    if (delta === null) return null;
    return {
      value: `${delta}%`,
      isPositive: delta >= 0,
    };
  }

  const budgetTotal = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetPct = budgetTotal > 0 ? Math.round((analytics.currentMonthExpenses / budgetTotal) * 100) : 0;
  const incomeCountThisMonth = currentMonthTransactions.filter((tx) => tx.type === "income").length;
  const expenseCountThisMonth = currentMonthTransactions.filter((tx) => tx.type === "expense").length;
  const latestTransaction = currentMonthTransactions[0] ?? null;

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <FinanceKpiCard key={i} label="" value="" delta={null} variant="income" isLoading />
            ))}
          </div>
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-5xl overflow-x-hidden px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-6 min-w-0">
          <div className="flex min-w-0 items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Manual money check-in</p>
              <h1 className="break-words text-2xl font-bold tracking-tight text-[var(--text)]">Finance</h1>
              <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                {hasData
                  ? `Review manually logged income and expenses for ${monthRange.label.toLowerCase()}.`
                  : "Log income and expenses manually so you can notice where money went."}
                <HelpPopover title="What is Finance?" className="ml-1.5">
                  <p>Finance is a private manual tracker. Add income and expenses to understand your money flow. No bank connection. Not financial, investment, tax, or debt advice.</p>
                </HelpPopover>
              </p>
              <p className="mt-1 break-words text-xs text-[var(--text-muted)]">
                Weekly Review can use logged entries as context. One entry is enough to start.
              </p>
            </div>
          </div>
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="block text-xs font-semibold text-[var(--text)]">Income</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Money that came in, such as pay, client payment, or gift.</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="block text-xs font-semibold text-[var(--text)]">Expense</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Money that went out, such as food, transport, or subscription.</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="block text-xs font-semibold text-[var(--text)]">Boundaries</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Private tracking only. No bank connection or advice.</span>
            </div>
          </div>
          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="break-words text-sm font-medium text-[var(--text-secondary)]">{monthRange.label}</h2>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
                aria-label="Previous month"
              >
                &larr; Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date())}
                className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
                aria-label="Next month"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>

        {!hasData && (
          <>
            <InfoTip id="finance" title="Start with one income or expense" className="mb-4">
              <ol className="list-inside list-decimal space-y-1 break-words">
                <li>Choose Expense for money that went out, like Food or Transport.</li>
                <li>Choose Income for money that came in, like Paycheck or Client payment.</li>
                <li>Amount, date, category, and note are manual entries only.</li>
                <li>Your weekly review becomes clearer as you log.</li>
              </ol>
            </InfoTip>
            <Card className="mb-6 p-5 text-center sm:p-6">
              <p className="mb-2 break-words text-sm font-medium text-[var(--text)]">One entry is enough to start.</p>
              <p className="mx-auto mb-4 max-w-lg break-words text-sm leading-relaxed text-[var(--text-muted)]">
                Start with one income or expense. Manual entries only; this is for awareness, not advice.
              </p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <Button onClick={() => startTransaction("expense")} size="sm">
                  Log an expense
                </Button>
                <Button onClick={() => startTransaction("income")} size="sm" variant="secondary">
                  Log income
                </Button>
              </div>
            </Card>
          </>
        )}

        {hasData && (
          <>
            <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <FinanceKpiCard
                label="Income"
                value={formatCurrency(analytics.currentMonthIncome)}
                delta={getKpiDelta(analytics.currentMonthIncome, analytics.incomeDelta)}
                variant="income"
                helpContent={<p>Total money received during the selected month. The percentage compares this month to the previous month.</p>}
              />
              <FinanceKpiCard
                label="Expenses"
                value={formatCurrency(analytics.currentMonthExpenses)}
                delta={getKpiDelta(analytics.currentMonthExpenses, analytics.expensesDelta)}
                variant="expense"
                helpContent={<p>Total money spent during the selected month. The percentage compares this month to the previous month.</p>}
              />
              <FinanceKpiCard
                label="Net Cashflow"
                value={formatCurrency(analytics.currentMonthNet)}
                delta={getKpiDelta(analytics.currentMonthNet, analytics.netDelta)}
                variant="net"
                helpContent={<p>Income minus expenses. Positive means more money came in than went out.</p>}
              />
              <FinanceKpiCard
                label="Budget Used"
                value={budgets.length > 0 ? `${budgetPct}%` : "—"}
                delta={null}
                variant="budget"
                helpContent={<p>How much of your monthly budget has already been used across budgeted categories.</p>}
              />
            </div>

            <Card className="mb-6 min-w-0 p-4 sm:p-5">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Manual context</p>
                  <h3 className="mt-1 break-words text-sm font-semibold text-[var(--text)]">This month&apos;s money context</h3>
                  <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                    Based on what you logged for {monthRange.label.toLowerCase()}, Weekly Review has {analytics.transactionCountThisMonth} transaction{analytics.transactionCountThisMonth !== 1 ? "s" : ""}: {incomeCountThisMonth} income and {expenseCountThisMonth} expense entr{expenseCountThisMonth === 1 ? "y" : "ies"}.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                  Not financial advice
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <span className="block text-xs font-semibold text-[var(--text)]">Latest entry</span>
                  <span className="mt-1 block break-words text-[10px] leading-relaxed text-[var(--text-muted)]">
                    {latestTransaction ? `${latestTransaction.title} - ${formatCurrency(Number(latestTransaction.amount))}` : "No entry for this month."}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <span className="block text-xs font-semibold text-[var(--text)]">Top category</span>
                  <span className="mt-1 block break-words text-[10px] leading-relaxed text-[var(--text-muted)]">
                    {analytics.biggestCategory ? `${analytics.biggestCategory.categoryName} - ${formatCurrency(analytics.biggestCategory.amount)}` : "No expense category logged."}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <span className="block text-xs font-semibold text-[var(--text)]">Private review</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Manual entries only. No bank connection, AI summaries, or external processing.</span>
                </div>
              </div>
            </Card>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="min-w-0 p-4 sm:p-5">
                <h3 className="mb-4 break-words text-sm font-medium text-[var(--text-secondary)]">
                  Cashflow Trend
                  <HelpPopover title="Cashflow Trend" className="ml-1">
                    <p>This shows manually logged income and expenses over the last 6 months so you can review how your money flow changed.</p>
                    <p className="mt-1.5 text-[var(--text-muted)]">Income line (blue) shows money in. Expenses line (red) shows money out. Net = income minus expenses.</p>
                  </HelpPopover>
                </h3>
                <CashflowTrendChart data={analytics.monthlyTrendLast6Months} />
              </Card>
              <Card className="min-w-0 p-4 sm:p-5">
                <h3 className="mb-4 break-words text-sm font-medium text-[var(--text-secondary)]">
                  Expense Breakdown
                  <HelpPopover title="Expense Breakdown" className="ml-1">
                    <p>This shows where logged expenses went during the selected month, grouped by category.</p>
                    <p className="mt-1.5 text-[var(--text-muted)]">Percentages are based on monthly expenses only. Income transactions are not included. Larger slices mean more money spent in that category.</p>
                  </HelpPopover>
                </h3>
                <ExpenseBreakdownChart data={analytics.expensesByCategory} />
              </Card>
            </div>

            {insights.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 break-words text-sm font-medium text-[var(--text-secondary)]">
                  Review Context
                  <HelpPopover title="Review Context" className="ml-1">
                  <p>These notes are calculated from manually logged finance data. They summarize logged money context, budget usage, and changes from last month without financial advice.</p>
                  </HelpPopover>
                </h3>
                <FinanceInsights insights={insights} />
              </div>
            )}
          </>
        )}

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              {editingTxId ? "Edit income or expense" : "Log income or expense"}
              <HelpPopover title="Income or expense" className="ml-1">
                <p>Use Expense for money that went out and Income for money that came in. The entry is manual and only saves when you press Add transaction.</p>
              </HelpPopover>
            </h3>
            {!showTxForm ? (
              <Button size="sm" variant="secondary" onClick={() => startTransaction("expense")}>
                + Income/expense
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={resetTxForm}>
                Cancel
              </Button>
            )}
          </div>
          <TransactionForm
            show={showTxForm}
            saving={saving}
            editingTxId={editingTxId}
            txTitle={txTitle}
            txAmount={txAmount}
            txType={txType}
            txCategoryId={txCategoryId}
            txAccountId={txAccountId}
            txDate={txDate}
            txNote={txNote}
            expenseOptions={expenseOptions}
            incomeOptions={incomeOptions}
            accountOptions={accountOptions}
            onTitleChange={setTxTitle}
            onAmountChange={setTxAmount}
            onTypeChange={(v) => { setTxType(v); setTxCategoryId(""); }}
            onCategoryChange={setTxCategoryId}
            onAccountChange={setTxAccountId}
            onDateChange={setTxDate}
            onNoteChange={setTxNote}
            onSave={handleSaveTransaction}
            onCancel={resetTxForm}
          />
        </div>

        <div className="mb-8">
          <h3 className="mb-3 break-words text-sm font-medium text-[var(--text-secondary)]">
            Recent Transactions
            <HelpPopover title="Recent Transactions" className="ml-1">
              <p>Transactions are the money moves you add manually. Income adds to logged monthly income, and expenses add to logged monthly expenses.</p>
              <p className="mt-1.5 text-[var(--text-muted)]">&quot;All&quot; shows everything. &quot;Income&quot; and &quot;Expense&quot; show only that transaction type.</p>
            </HelpPopover>
          </h3>
          <TransactionList
            transactions={currentMonthTransactions}
            onEdit={editTransaction}
            onDelete={deleteTransaction}
            onAddNew={() => { resetTxForm(); setShowTxForm(true); }}
          />
        </div>

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              Budget Health
              <HelpPopover title="Budget Health" className="ml-1">
                <p>Budgets help you record a monthly amount for a category. Life Pulse compares logged expenses in that category against the budget.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Within budget = logged expenses are below the budget. Near limit = logged expenses are close to the budget. Over budget = logged expenses passed the budget.</p>
                <p className="mt-1.5">Budgets only use expense categories.</p>
              </HelpPopover>
            </h3>
            {!showBudgetForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowBudgetForm(true)}>
                + Budget
              </Button>
            )}
          </div>
          <BudgetForm
            show={showBudgetForm}
            saving={saving}
            budgetCategoryId={budgetCategoryId}
            budgetAmount={budgetAmount}
            budgetCatOptions={budgetCatOptions}
            onCategoryChange={setBudgetCategoryId}
            onAmountChange={setBudgetAmount}
            onSave={handleAddBudget}
            onCancel={() => setShowBudgetForm(false)}
          />
          <BudgetHealthList
            budgetUsage={analytics.budgetUsage}
            formatCurrency={formatCurrency}
            onDelete={deleteBudget}
            onRequestDelete={setConfirmingBudgetDeleteId}
            onCancelDelete={() => setConfirmingBudgetDeleteId(null)}
            confirmingDeleteId={confirmingBudgetDeleteId}
          />
        </div>

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              Accounts
              <HelpPopover title="Accounts" className="ml-1">
                <p>Accounts are where your money lives, like cash, bank, card, or savings.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Current balance = starting balance + linked income &minus; linked expenses. Not connected to your bank.</p>
              </HelpPopover>
            </h3>
            {!showAccountForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowAccountForm(true)}>
                + Account
              </Button>
            )}
          </div>
          <AccountForm
            show={showAccountForm}
            saving={saving}
            acctName={acctName}
            acctType={acctType}
            acctBalance={acctBalance}
            acctCurrency={acctCurrency}
            onNameChange={setAcctName}
            onTypeChange={setAcctType}
            onBalanceChange={setAcctBalance}
            onCurrencyChange={setAcctCurrency}
            onSave={handleAddAccount}
            onCancel={() => setShowAccountForm(false)}
          />
          <AccountSummary
            accountBalances={analytics.accountBalances}
            hasMixedCurrencies={analytics.hasMixedCurrencies}
            onDelete={deleteAccount}
            onRequestDelete={setConfirmingAccountDeleteId}
            onCancelDelete={() => setConfirmingAccountDeleteId(null)}
            confirmingDeleteId={confirmingAccountDeleteId}
            onAddNew={() => setShowAccountForm(true)}
          />
        </div>

        <p className="break-words text-center text-xs text-[var(--text-muted)]">
          Private manual tracker. No bank connection. Not financial advice. Not investment, tax, or debt advice.
        </p>
      </div>
    </DashboardNav>
  );
}
