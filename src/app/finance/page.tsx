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
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
} from "@/components/finance/types";
import {
  formatCurrency,
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

const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Subscriptions", "Clothes", "School", "Health", "Entertainment", "Other"];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Other"];
const ACCOUNT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];
const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

function SimpleSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
        >
          <span className="flex-1 text-left">
            {selected ? selected.label : <span className="text-[var(--text-muted)]">{placeholder}</span>}
          </span>
          <svg className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl" role="listbox">
            {options.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-[var(--text-muted)]">No options</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    value === opt.value
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinancePage() {
  const supabase = createClient();
  const router = useRouter();
  const cancelledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);

  const monthRange = getMonthRange(currentMonth);

  const analytics = useMemo(
    () => computeAnalytics({ transactions, budgets, accounts, currentMonth }),
    [transactions, budgets, accounts, currentMonth]
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
    setFeedback(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const [accountsRes, categoriesRes, txRes, budgetsRes] = await Promise.all([
        supabase.from("finance_accounts").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_categories").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_transactions")
          .select("*, finance_accounts(name, type, currency), finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false }),
        supabase.from("finance_budgets").select("*, finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .eq("month", `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`),
      ]);

      if (!cancelledRef.current) {
        if (accountsRes.error) throw accountsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        if (txRes.error) throw txRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        setAccounts(accountsRes.data ?? []);
        setCategories(categoriesRes.data ?? []);
        setTransactions(txRes.data ?? []);
        setBudgets(budgetsRes.data ?? []);

        if ((categoriesRes.data ?? []).length === 0) {
          seedDefaultCategories(user.id);
        }
      }
    } catch {
      if (!cancelledRef.current) {
        setFeedback({ type: "error", message: "Failed to load finance data." });
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
      const { data } = await supabase.from("finance_categories").select("*").eq("user_id", userId);
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
      setFeedback({ type: "error", message: "Title is required." });
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      setFeedback({ type: "error", message: "Amount must be greater than 0." });
      return;
    }
    if (!txCategoryId) {
      setFeedback({ type: "error", message: "Category is required." });
      return;
    }

    setSaving(true);
    setFeedback(null);
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
      setFeedback({ type: "success", message: editingTxId ? "Transaction updated." : "Transaction added." });
    } catch {
      setFeedback({ type: "error", message: "Failed to save transaction." });
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
      setFeedback({ type: "error", message: "Failed to delete transaction." });
    } finally {
      setSaving(false);
    }
  }

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

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
      setFeedback({ type: "error", message: "Failed to add budget." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    try {
      await supabase.from("finance_budgets").delete().eq("id", id);
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to delete budget." });
    }
  }

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [acctName, setAcctName] = useState("");
  const [acctType, setAcctType] = useState("cash");
  const [acctBalance, setAcctBalance] = useState("0");
  const [acctCurrency, setAcctCurrency] = useState("ILS");

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
      setFeedback({ type: "error", message: "Failed to add account." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    try {
      await supabase.from("finance_accounts").delete().eq("id", id);
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to delete account." });
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
      value: `${delta >= 0 ? "+" : ""}${delta}%`,
      isPositive: delta >= 0,
    };
  }

  const budgetTotal = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetPct = budgetTotal > 0 ? Math.round((analytics.currentMonthExpenses / budgetTotal) * 100) : 0;

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-5xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      <div className="mx-auto max-w-5xl px-5 py-8 animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Finance</h1>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                {hasData
                  ? `Know where your money is going ${monthRange.label.toLowerCase()}.`
                  : "Track your money moves."}
                <HelpPopover title="What is Finance?" className="ml-1.5">
                  <p>Finance is a manual tracker. Add income, expenses, budgets, and accounts to understand your money flow. No bank connection. Not financial advice.</p>
                </HelpPopover>
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">{monthRange.label}</h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                aria-label="Previous month"
              >
                &larr; Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date())}
                className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                aria-label="Next month"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>

        {feedback && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]"
          }`}>
            {feedback.message}
          </div>
        )}

        {!hasData && (
          <>
            <InfoTip id="finance" title="Start with one money move" className="mb-4">
              <ol className="list-decimal list-inside space-y-1">
                <li>Add an account, like Cash.</li>
                <li>Add one expense, like Food.</li>
                <li>Add one income, like Gift or Salary.</li>
                <li>Create one budget for a category you care about.</li>
              </ol>
            </InfoTip>
            <Card className="mb-6 p-6 text-center">
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Add your first transaction to start seeing charts, trends, and insights.
              </p>
              <Button onClick={() => { resetTxForm(); setShowTxForm(true); }} size="sm">
                Add your first transaction
              </Button>
            </Card>
          </>
        )}

        {hasData && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">
                  Cashflow Trend
                  <HelpPopover title="Cashflow Trend" className="ml-1">
                    <p>This shows income and expenses over the last 6 months so you can see whether your money flow is improving or getting worse.</p>
                    <p className="mt-1.5 text-[var(--text-muted)]">Income line (blue) shows money in. Expenses line (red) shows money out. Net = income minus expenses.</p>
                  </HelpPopover>
                </h3>
                <CashflowTrendChart data={analytics.monthlyTrendLast6Months} />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">
                  Expense Breakdown
                  <HelpPopover title="Expense Breakdown" className="ml-1">
                    <p>This shows where your spending went during the selected month, grouped by category.</p>
                    <p className="mt-1.5 text-[var(--text-muted)]">Percentages are based on monthly expenses only. Income transactions are not included. Larger slices mean more money spent in that category.</p>
                  </HelpPopover>
                </h3>
                <ExpenseBreakdownChart data={analytics.expensesByCategory} />
              </Card>
            </div>

            {insights.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
                  Smart Insights
                  <HelpPopover title="Smart Insights" className="ml-1">
                    <p>These insights are calculated from your real finance data. They highlight spending patterns, budget risks, and changes from last month.</p>
                  </HelpPopover>
                </h3>
                <FinanceInsights insights={insights} />
              </div>
            )}
          </>
        )}

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              {editingTxId ? "Edit Transaction" : "Add Transaction"}
            </h3>
            {!showTxForm ? (
              <Button size="sm" variant="secondary" onClick={() => { resetTxForm(); setShowTxForm(true); }}>
                + New
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={resetTxForm}>
                Cancel
              </Button>
            )}
          </div>
          {showTxForm && (
            <Card className="p-4">
              <form onSubmit={handleSaveTransaction} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
                    <input
                      value={txTitle}
                      onChange={(e) => setTxTitle(e.target.value)}
                      placeholder="Groceries, Salary, ..."
                      required
                      maxLength={200}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {TRANSACTION_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTxType(t.value as "income" | "expense"); setTxCategoryId(""); }}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        txType === t.value
                          ? t.value === "income"
                            ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[var(--success)]/30"
                            : "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-[var(--danger)]/30"
                          : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SimpleSelect
                    label="Category"
                    options={txType === "income" ? incomeOptions : expenseOptions}
                    value={txCategoryId}
                    onChange={setTxCategoryId}
                    placeholder="Select category"
                  />
                  <SimpleSelect
                    label="Account (optional)"
                    options={accountOptions}
                    value={txAccountId}
                    onChange={setTxAccountId}
                    placeholder="No account"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Date</label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Note (optional)</label>
                    <input
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      placeholder="Optional note"
                      maxLength={500}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Saving..." : editingTxId ? "Update" : "Add Transaction"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>

        <div className="mb-8">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            Recent Transactions
            <HelpPopover title="Recent Transactions" className="ml-1">
              <p>Transactions are the money moves you add manually. Income increases your monthly income, and expenses increase your monthly spending.</p>
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              Budget Health
              <HelpPopover title="Budget Health" className="ml-1">
                <p>Budgets help you set a monthly spending limit for a category. Life Pulse compares your spending in that category against the budget.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">On track = spending is still safe. Near limit = spending is getting close to the budget. Over budget = spending passed the limit.</p>
                <p className="mt-1.5">Budgets only use expense categories.</p>
              </HelpPopover>
            </h3>
            {!showBudgetForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowBudgetForm(true)}>
                + Budget
              </Button>
            )}
          </div>
          {showBudgetForm && (
            <Card className="mb-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px]">
                  <SimpleSelect
                    label="Category"
                    options={budgetCatOptions}
                    value={budgetCategoryId}
                    onChange={setBudgetCategoryId}
                    placeholder="Select category"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Monthly amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pb-px">
                  <Button size="sm" onClick={handleAddBudget} disabled={saving || !budgetCategoryId || !budgetAmount}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowBudgetForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {analytics.budgetUsage.length === 0 ? (
            <Card variant="subtle" className="p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Create a monthly budget for a spending category to see whether you are on track.
              </p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {analytics.budgetUsage.map((b) => {
                const barColor =
                  b.status === "over_budget"
                    ? "var(--danger)"
                    : b.status === "near_limit"
                    ? "var(--warning)"
                    : "var(--accent)";

                const statusLabel =
                  b.status === "over_budget"
                    ? "Over budget"
                    : b.status === "near_limit"
                    ? "Near limit"
                    : "On track";

                const statusColor =
                  b.status === "over_budget"
                    ? "text-[var(--danger)]"
                    : b.status === "near_limit"
                    ? "text-[var(--warning)]"
                    : "text-[var(--success)]";

                return (
                  <Card key={b.budgetId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-[var(--text)] truncate">{b.categoryName}</span>
                        <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] shrink-0">
                        {formatCurrency(b.spent)} / {formatCurrency(b.budgetAmount)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--surface)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(b.percentage, 100)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">{b.percentage}% used</span>
                      <button
                        type="button"
                        onClick={() => deleteBudget(b.budgetId)}
                        className="rounded-md px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
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
          {showAccountForm && (
            <Card className="mb-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px]">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
                  <input
                    value={acctName}
                    onChange={(e) => setAcctName(e.target.value)}
                    placeholder="Wallet, Checking, ..."
                    maxLength={100}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="w-36">
                  <SimpleSelect
                    label="Type"
                    options={ACCOUNT_TYPES}
                    value={acctType}
                    onChange={setAcctType}
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Starting balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={acctBalance}
                    onChange={(e) => setAcctBalance(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="w-20">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Currency</label>
                  <input
                    value={acctCurrency}
                    onChange={(e) => setAcctCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="ILS"
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pb-px">
                  <Button size="sm" onClick={handleAddAccount} disabled={saving || !acctName.trim()}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAccountForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
          <AccountSummary
            accountBalances={analytics.accountBalances}
            hasMixedCurrencies={analytics.hasMixedCurrencies}
            onDelete={deleteAccount}
            onAddNew={() => setShowAccountForm(true)}
          />
        </div>

        <p className="text-center text-xs text-[var(--text-muted)]">
          Manual tracker. Not financial advice. No bank connection.
        </p>
      </div>
    </DashboardNav>
  );
}
