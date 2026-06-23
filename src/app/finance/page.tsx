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

const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Subscriptions", "Clothes", "School", "Health", "Entertainment", "Other"];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Other"];


export default function FinancePage() {
  const supabase = createClient();
  const router = useRouter();
  const cancelledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
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
    if (!confirm("Delete this budget? This cannot be undone.")) return;
    try {
      await supabase.from("finance_budgets").delete().eq("id", id);
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
    if (!confirm("Delete this account? Transactions linked to this account will remain but the account will be removed.")) return;
    try {
      await supabase.from("finance_accounts").delete().eq("id", id);
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
          />
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
